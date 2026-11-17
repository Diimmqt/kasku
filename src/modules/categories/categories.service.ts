import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { DEFAULT_CATEGORIES } from './default-categories.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { QueryCategoriesDto } from './dto/query-categories.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  /** Idempotently seeds default income and expense categories for a workspace. */
  async ensureDefaultCategories(
    workspaceId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const count = await client.category.count({ where: { workspaceId } });
    if (count > 0) return;

    await client.category.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({
        workspaceId,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
        isDefault: true,
      })),
      skipDuplicates: true,
    });
  }

  async listCategories(workspaceId: string, query: QueryCategoriesDto) {
    await this.ensureDefaultCategories(workspaceId);

    return this.prisma.category.findMany({
      where: {
        workspaceId,
        ...(query.type ? { type: query.type } : {}),
        ...(query.includeArchived ? {} : { isArchived: false }),
      },
      include: {
        _count: { select: { transactions: true } },
      },
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async createCategory(
    workspaceId: string,
    userId: string,
    dto: CreateCategoryDto,
  ) {
    const duplicate = await this.prisma.category.findUnique({
      where: {
        workspaceId_name_type: {
          workspaceId,
          name: dto.name,
          type: dto.type,
        },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        `Kategori "${dto.name}" (${dto.type}) sudah ada di workspace ini.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          workspaceId,
          name: dto.name,
          type: dto.type,
          icon: dto.icon ?? 'tag',
          color: dto.color ?? '#059669',
          isDefault: false,
        },
      });

      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'CATEGORY_CREATED',
          entityType: 'Category',
          entityId: category.id,
          metadata: { name: category.name, type: category.type },
        },
        tx,
      );

      return category;
    });
  }

  async updateCategory(
    workspaceId: string,
    categoryId: string,
    userId: string,
    dto: UpdateCategoryDto,
  ) {
    const existing = await this.prisma.category.findFirst({
      where: { id: categoryId, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Kategori tidak ditemukan.');
    }

    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.prisma.category.findUnique({
        where: {
          workspaceId_name_type: {
            workspaceId,
            name: dto.name,
            type: existing.type,
          },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(
          `Kategori "${dto.name}" (${existing.type}) sudah ada.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id: existing.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
          ...(dto.color !== undefined ? { color: dto.color } : {}),
          ...(dto.isArchived !== undefined
            ? { isArchived: dto.isArchived }
            : {}),
        },
      });

      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'CATEGORY_UPDATED',
          entityType: 'Category',
          entityId: existing.id,
          metadata: { name: updated.name, isArchived: updated.isArchived },
        },
        tx,
      );

      return updated;
    });
  }

  async deleteOrArchiveCategory(
    workspaceId: string,
    categoryId: string,
    userId: string,
  ): Promise<{ deleted: boolean; archived: boolean }> {
    const existing = await this.prisma.category.findFirst({
      where: { id: categoryId, workspaceId },
      include: { _count: { select: { transactions: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Kategori tidak ditemukan.');
    }

    if (existing._count.transactions > 0 || existing.isDefault) {
      await this.prisma.$transaction(async (tx) => {
        await tx.category.update({
          where: { id: existing.id },
          data: { isArchived: true },
        });
        await this.auditLogs.record(
          {
            workspaceId,
            userId,
            action: 'CATEGORY_ARCHIVED',
            entityType: 'Category',
            entityId: existing.id,
            metadata: { name: existing.name },
          },
          tx,
        );
      });
      return { deleted: false, archived: true };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.category.delete({ where: { id: existing.id } });
      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'CATEGORY_DELETED',
          entityType: 'Category',
          entityId: existing.id,
          metadata: { name: existing.name },
        },
        tx,
      );
    });

    return { deleted: true, archived: false };
  }
}

