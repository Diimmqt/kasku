import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  SavingsGoalStatus,
} from '../../generated/prisma/client.js';
import {
  decimalToString,
  parsePositiveDecimal,
} from '../../common/utils/decimal.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AddContributionDto } from './dto/add-contribution.dto.js';
import { CreateSavingsGoalDto } from './dto/create-savings-goal.dto.js';
import { UpdateSavingsGoalDto } from './dto/update-savings-goal.dto.js';

const GOAL_INCLUDE = {
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  contributions: {
    include: {
      wallet: {
        select: {
          id: true,
          name: true,
          type: true,
          color: true,
          icon: true,
        },
      },
      contributedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ contributionDate: 'desc' }, { createdAt: 'desc' }],
  },
} satisfies Prisma.SavingsGoalInclude;

type GoalWithRelations = Prisma.SavingsGoalGetPayload<{
  include: typeof GOAL_INCLUDE;
}>;

@Injectable()
export class SavingsGoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async listGoals(workspaceId: string) {
    const goals = await this.prisma.savingsGoal.findMany({
      where: { workspaceId },
      include: GOAL_INCLUDE,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    const items = goals.map((goal) => this.serializeGoal(goal));

    let totalTarget = new Prisma.Decimal(0);
    let totalSaved = new Prisma.Decimal(0);
    let activeCount = 0;
    let completedCount = 0;

    for (const goal of items) {
      if (goal.status !== SavingsGoalStatus.ARCHIVED) {
        totalTarget = totalTarget.plus(goal.targetAmount);
        totalSaved = totalSaved.plus(goal.currentAmount);
      }
      if (goal.status === SavingsGoalStatus.ACTIVE) activeCount += 1;
      if (goal.status === SavingsGoalStatus.COMPLETED) completedCount += 1;
    }

    return {
      items,
      summary: {
        totalGoals: items.length,
        activeCount,
        completedCount,
        totalTarget: decimalToString(totalTarget),
        totalSaved: decimalToString(totalSaved),
      },
    };
  }

  async getGoalDetail(workspaceId: string, goalId: string) {
    const goal = await this.prisma.savingsGoal.findFirst({
      where: { id: goalId, workspaceId },
      include: GOAL_INCLUDE,
    });
    if (!goal) {
      throw new NotFoundException('Target tabungan tidak ditemukan.');
    }
    return this.serializeGoal(goal);
  }

  async createGoal(
    workspaceId: string,
    userId: string,
    dto: CreateSavingsGoalDto,
  ) {
    const targetAmount = parsePositiveDecimal(dto.targetAmount, 'Nominal target');
    const created = await this.prisma.savingsGoal.create({
      data: {
        workspaceId,
        createdByUserId: userId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        targetAmount,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
      },
      include: GOAL_INCLUDE,
    });

    await this.auditLogs.record({
      workspaceId,
      userId,
      action: 'SAVINGS_GOAL_CREATED',
      entityType: 'SAVINGS_GOAL',
      entityId: created.id,
      metadata: {
        name: created.name,
        targetAmount: decimalToString(targetAmount),
      },
    });

    return this.serializeGoal(created);
  }

  async updateGoal(
    workspaceId: string,
    goalId: string,
    userId: string,
    dto: UpdateSavingsGoalDto,
  ) {
    const existing = await this.prisma.savingsGoal.findFirst({
      where: { id: goalId, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Target tabungan tidak ditemukan.');
    }

    const nextTarget = dto.targetAmount
      ? parsePositiveDecimal(dto.targetAmount, 'Nominal target')
      : new Prisma.Decimal(existing.targetAmount);

    const current = new Prisma.Decimal(existing.currentAmount);
    let nextStatus = dto.status ?? existing.status;
    if (!dto.status && existing.status !== SavingsGoalStatus.ARCHIVED) {
      nextStatus = current.gte(nextTarget)
        ? SavingsGoalStatus.COMPLETED
        : SavingsGoalStatus.ACTIVE;
    }

    const updated = await this.prisma.savingsGoal.update({
      where: { id: goalId },
      data: {
        name: dto.name?.trim() ?? existing.name,
        description:
          dto.description === undefined
            ? existing.description
            : dto.description === null
              ? null
              : dto.description.trim() || null,
        targetAmount: nextTarget,
        deadline:
          dto.deadline === undefined
            ? existing.deadline
            : dto.deadline === null
              ? null
              : new Date(dto.deadline),
        status: nextStatus,
      },
      include: GOAL_INCLUDE,
    });

    await this.auditLogs.record({
      workspaceId,
      userId,
      action: 'SAVINGS_GOAL_UPDATED',
      entityType: 'SAVINGS_GOAL',
      entityId: goalId,
      metadata: {
        name: updated.name,
        status: updated.status,
      },
    });

    return this.serializeGoal(updated);
  }

  async addContribution(
    workspaceId: string,
    goalId: string,
    userId: string,
    dto: AddContributionDto,
  ) {
    const amount = parsePositiveDecimal(dto.amount, 'Nominal setoran');

    const result = await this.prisma.$transaction(async (tx) => {
      const goal = await tx.savingsGoal.findFirst({
        where: { id: goalId, workspaceId },
      });
      if (!goal) {
        throw new NotFoundException('Target tabungan tidak ditemukan.');
      }
      if (goal.status === SavingsGoalStatus.ARCHIVED) {
        throw new BadRequestException(
          'Tidak dapat menyetor ke target tabungan yang diarsipkan.',
        );
      }

      const wallet = await tx.wallet.findFirst({
        where: { id: dto.walletId, workspaceId, isArchived: false },
      });
      if (!wallet) {
        throw new NotFoundException('Dompet sumber tidak ditemukan.');
      }

      const walletBalance = new Prisma.Decimal(wallet.balance);
      if (walletBalance.lt(amount)) {
        throw new BadRequestException(
          'Saldo dompet sumber tidak mencukupi untuk setoran tabungan ini.',
        );
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      });

      const nextCurrentAmount = new Prisma.Decimal(goal.currentAmount).plus(
        amount,
      );
      const reachedTarget = nextCurrentAmount.gte(goal.targetAmount);

      await tx.savingsContribution.create({
        data: {
          workspaceId,
          savingsGoalId: goal.id,
          walletId: wallet.id,
          contributedByUserId: userId,
          amount,
          contributionDate: dto.contributionDate
            ? new Date(dto.contributionDate)
            : new Date(),
          note: dto.note?.trim() || null,
        },
      });

      const updatedGoal = await tx.savingsGoal.update({
        where: { id: goal.id },
        data: {
          currentAmount: nextCurrentAmount,
          ...(reachedTarget ? { status: SavingsGoalStatus.COMPLETED } : {}),
        },
        include: GOAL_INCLUDE,
      });

      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'SAVINGS_CONTRIBUTION_ADDED',
          entityType: 'SAVINGS_GOAL',
          entityId: goal.id,
          metadata: {
            goalName: goal.name,
            walletId: wallet.id,
            walletName: wallet.name,
            amount: decimalToString(amount),
            reachedTarget,
          },
        },
        tx,
      );

      return updatedGoal;
    });

    if (
      result.status === SavingsGoalStatus.COMPLETED &&
      this.notifications
    ) {
      await this.notifications.notifyWorkspaceMembers({
        workspaceId,
        type: NotificationType.GOAL_ACHIEVED,
        title: `Target Tabungan Tercapai: ${result.name}`,
        message: `Selamat! Target tabungan "${result.name}" telah mencapai ${decimalToString(result.targetAmount)}.`,
        referenceType: 'SAVINGS_GOAL',
        referenceId: result.id,
        deduplicate: true,
      });
    }

    return this.serializeGoal(result);
  }

  async deleteContribution(
    workspaceId: string,
    goalId: string,
    contributionId: string,
    userId: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const contribution = await tx.savingsContribution.findFirst({
        where: { id: contributionId, savingsGoalId: goalId, workspaceId },
        include: { savingsGoal: true },
      });
      if (!contribution) {
        throw new NotFoundException('Riwayat setoran tidak ditemukan.');
      }

      const amount = new Prisma.Decimal(contribution.amount);

      await tx.wallet.update({
        where: { id: contribution.walletId },
        data: { balance: { increment: amount } },
      });

      await tx.savingsContribution.delete({
        where: { id: contribution.id },
      });

      const currentAfter = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        new Prisma.Decimal(contribution.savingsGoal.currentAmount).minus(amount),
      );
      const shouldReopen =
        contribution.savingsGoal.status === SavingsGoalStatus.COMPLETED &&
        currentAfter.lt(contribution.savingsGoal.targetAmount);

      const updatedGoal = await tx.savingsGoal.update({
        where: { id: goalId },
        data: {
          currentAmount: currentAfter,
          ...(shouldReopen ? { status: SavingsGoalStatus.ACTIVE } : {}),
        },
        include: GOAL_INCLUDE,
      });

      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'SAVINGS_CONTRIBUTION_REVERTED',
          entityType: 'SAVINGS_GOAL',
          entityId: goalId,
          metadata: {
            contributionId,
            amount: decimalToString(amount),
          },
        },
        tx,
      );

      return updatedGoal;
    });

    return this.serializeGoal(result);
  }

  async deleteGoal(workspaceId: string, goalId: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const goal = await tx.savingsGoal.findFirst({
        where: { id: goalId, workspaceId },
        include: { contributions: true },
      });
      if (!goal) {
        throw new NotFoundException('Target tabungan tidak ditemukan.');
      }

      // Refund all recorded contributions back to source wallets before deleting the goal.
      for (const contribution of goal.contributions) {
        await tx.wallet.update({
          where: { id: contribution.walletId },
          data: { balance: { increment: contribution.amount } },
        });
      }

      await tx.savingsGoal.delete({ where: { id: goalId } });

      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'SAVINGS_GOAL_DELETED',
          entityType: 'SAVINGS_GOAL',
          entityId: goalId,
          metadata: {
            name: goal.name,
            refundedContributions: goal.contributions.length,
          },
        },
        tx,
      );
    });

    return { deleted: true };
  }

  private serializeGoal(goal: GoalWithRelations) {
    const target = new Prisma.Decimal(goal.targetAmount);
    const current = new Prisma.Decimal(goal.currentAmount);
    const remaining = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      target.minus(current),
    );
    const progressPercent = target.gt(0)
      ? Math.min(
          100,
          Number(current.div(target).mul(100).toDecimalPlaces(2).toString()),
        )
      : 0;

    return {
      id: goal.id,
      workspaceId: goal.workspaceId,
      name: goal.name,
      description: goal.description,
      targetAmount: decimalToString(target),
      currentAmount: decimalToString(current),
      remainingAmount: decimalToString(remaining),
      progressPercent,
      deadline: goal.deadline,
      status: goal.status,
      createdBy: goal.createdBy,
      contributions: goal.contributions.map((item) => ({
        id: item.id,
        walletId: item.walletId,
        amount: decimalToString(item.amount),
        contributionDate: item.contributionDate,
        note: item.note,
        wallet: item.wallet,
        contributedBy: item.contributedBy,
        createdAt: item.createdAt,
      })),
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    };
  }
}
