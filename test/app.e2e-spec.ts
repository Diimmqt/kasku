import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

interface AuthEnvelope {
  success: boolean;
  data: {
    user: { id: string; email: string; name: string };
    tokens: { accessToken: string; refreshToken: string };
    defaultWorkspaceId?: string;
  };
}

interface DataEnvelope<T> {
  success: boolean;
  data: T;
}

describe('Kasku End-to-End Flow (live MySQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const stamp = Date.now();
  const userAEmail = `e2e.a.${stamp}@kasku.test`;
  const userBEmail = `e2e.b.${stamp}@kasku.test`;
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: '', method: RequestMethod.GET }],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { in: [userAEmail, userBEmail] } },
        select: { id: true },
      });
      const userIds = users.map((u) => u.id);
      if (userIds.length > 0) {
        const ownedWorkspaces = await prisma.workspace.findMany({
          where: { ownerId: { in: userIds } },
          select: { id: true },
        });
        const wsIds = ownedWorkspaces.map((w) => w.id);
        if (wsIds.length > 0) {
          await prisma.recurringExecutionLog.deleteMany({
            where: { workspaceId: { in: wsIds } },
          });
          await prisma.recurringTransaction.deleteMany({
            where: { workspaceId: { in: wsIds } },
          });
          await prisma.debtPayment.deleteMany({
            where: { workspaceId: { in: wsIds } },
          });
          await prisma.debt.deleteMany({
            where: { workspaceId: { in: wsIds } },
          });
          await prisma.savingsContribution.deleteMany({
            where: { workspaceId: { in: wsIds } },
          });
          await prisma.savingsGoal.deleteMany({
            where: { workspaceId: { in: wsIds } },
          });
          await prisma.budget.deleteMany({
            where: { workspaceId: { in: wsIds } },
          });
          await prisma.transaction.deleteMany({
            where: { workspaceId: { in: wsIds } },
          });
          await prisma.wallet.deleteMany({
            where: { workspaceId: { in: wsIds } },
          });
          await prisma.category.deleteMany({
            where: { workspaceId: { in: wsIds } },
          });
          await prisma.workspace.deleteMany({
            where: { id: { in: wsIds } },
          });
        }
        await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        });
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('checks public health endpoints', async () => {
    const rootRes = await request(app.getHttpServer()).get('/').expect(200);
    const rootBody = rootRes.body as DataEnvelope<string>;
    expect(rootBody.success).toBe(true);
    expect(rootBody.data).toBe('Hello World!');

    const healthRes = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    const healthBody = healthRes.body as DataEnvelope<{ status: string }>;
    expect(healthBody.data.status).toBe('ok');
  });

  it('executes full Kasku personal & family lifecycle with isolation, idempotency, and exports', async () => {
    // 1. Register User A & User B
    const regA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'User A', email: userAEmail, password })
      .expect(201);
    const bodyA = regA.body as AuthEnvelope;
    const tokenA = bodyA.data.tokens.accessToken;
    const personalWsId = bodyA.data.defaultWorkspaceId;
    expect(personalWsId).toBeDefined();
    if (!personalWsId) return;

    const regB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'User B', email: userBEmail, password })
      .expect(201);
    const bodyB = regB.body as AuthEnvelope;
    const tokenB = bodyB.data.tokens.accessToken;

    // 2. Verify Personal Workspace isolation: User B cannot view User A personal wallets
    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${personalWsId}/wallets`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);

    // 3. Create Family Workspace + invite User B without report permission
    const famRes = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Keluarga Harmonis', currency: 'IDR' })
      .expect(201);
    const familyWsId = (famRes.body as DataEnvelope<{ id: string }>).data.id;

    const invRes = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${familyWsId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        email: userBEmail,
        role: 'MEMBER',
        permissions: { canViewReports: false },
      })
      .expect(201);
    const invitationId = (invRes.body as DataEnvelope<{ id: string }>).data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/invitations/${invitationId}/accept`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    // Backend RBAC enforces canViewReports: false
    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${familyWsId}/reports/summary`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);

    // 4. Personal Workspace financial workflow
    const catsRes = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${personalWsId}/categories?type=EXPENSE`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const expenseCategories = (
      catsRes.body as DataEnvelope<{ id: string; name: string }[]>
    ).data;
    const foodCat =
      expenseCategories.find((c) => c.name === 'Makanan') ??
      expenseCategories[0];
    expect(foodCat).toBeDefined();

    const wBcaRes = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${personalWsId}/wallets`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Bank BCA', type: 'BANK', initialBalance: '5000000' })
      .expect(201);
    const bcaId = (wBcaRes.body as DataEnvelope<{ id: string }>).data.id;

    const wCashRes = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${personalWsId}/wallets`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Cash', type: 'CASH', initialBalance: '500000' })
      .expect(201);
    const cashId = (wCashRes.body as DataEnvelope<{ id: string }>).data.id;

    const todayIso = new Date().toISOString().slice(0, 10);
    const currentYm = todayIso.slice(0, 7);

    // Budget on Makanan (1,200,000 limit, 80% warning)
    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${personalWsId}/budgets`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        categoryId: foodCat.id,
        periodType: 'MONTHLY',
        month: currentYm,
        amountLimit: '1200000',
        warningThresholdPercent: 80,
      })
      .expect(201);

    // Expense 1,000,000 -> triggers budget WARNING
    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${personalWsId}/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'EXPENSE',
        walletId: bcaId,
        categoryId: foodCat.id,
        amount: '1000000',
        transactionDate: todayIso,
        description: 'Belanja Mingguan',
      })
      .expect(201);

    // Transfer 200,000 BCA -> Cash (must NOT count toward budget expense!)
    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${personalWsId}/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'TRANSFER',
        walletId: bcaId,
        destinationWalletId: cashId,
        amount: '200000',
        transactionDate: todayIso,
        description: 'Tarik Tunai ATM',
      })
      .expect(201);

    const budgetsCheck = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${personalWsId}/budgets?month=${currentYm}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const budgetData = (
      budgetsCheck.body as DataEnvelope<{
        items: { spentAmount: string; status: string }[];
      }>
    ).data;
    expect(budgetData.items[0].spentAmount).toBe('1000000');
    expect(budgetData.items[0].status).toBe('WARNING');

    // Savings Goal deposit 1,000,000 from BCA -> reaches target -> COMPLETED
    const goalRes = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${personalWsId}/savings-goals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Dana Darurat', targetAmount: '1000000' })
      .expect(201);
    const goalId = (goalRes.body as DataEnvelope<{ id: string }>).data.id;

    const depositRes = await request(app.getHttpServer())
      .post(
        `/api/v1/workspaces/${personalWsId}/savings-goals/${goalId}/contributions`,
      )
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ walletId: bcaId, amount: '1000000', contributionDate: todayIso })
      .expect(201);
    expect(
      (depositRes.body as DataEnvelope<{ status: string }>).data.status,
    ).toBe('COMPLETED');

    // Debt + Payment from Cash (500,000) -> auto creates EXPENSE & sets PAID
    const debtRes = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${personalWsId}/debts`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'DEBT',
        counterpartyName: 'Pak Budi',
        totalAmount: '500000',
        debtDate: todayIso,
      })
      .expect(201);
    const debtId = (debtRes.body as DataEnvelope<{ id: string }>).data.id;

    const payRes = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${personalWsId}/debts/${debtId}/payments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ walletId: cashId, amount: '500000', paymentDate: todayIso })
      .expect(201);
    expect((payRes.body as DataEnvelope<{ status: string }>).data.status).toBe(
      'PAID',
    );

    // Recurring Transaction idempotency check
    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${personalWsId}/recurring-transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        walletId: bcaId,
        categoryId: foodCat.id,
        type: 'EXPENSE',
        amount: '50000',
        description: 'Langganan Katering',
        frequency: 'MONTHLY',
        startDate: todayIso,
      })
      .expect(201);

    const run1 = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${personalWsId}/recurring-transactions/run-due`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);
    expect(
      (run1.body as DataEnvelope<{ executedCount: number }>).data.executedCount,
    ).toBe(1);

    const run2 = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${personalWsId}/recurring-transactions/run-due`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);
    expect(
      (run2.body as DataEnvelope<{ executedCount: number }>).data.executedCount,
    ).toBe(0);

    // Final wallet balance verification:
    // BCA = 5,000,000 - 1,000,000 (expense) - 200,000 (transfer) - 1,000,000 (goal) - 50,000 (recurring) = 2,750,000
    // Cash = 500,000 + 200,000 (transfer) - 500,000 (debt payment) = 200,000
    // Total Balance = 2,950,000
    const dashRes = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${personalWsId}/dashboard`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const dashBody = (
      dashRes.body as DataEnvelope<{
        summary: { totalBalance: string; periodExpense: string };
      }>
    ).data;
    expect(dashBody.summary.totalBalance).toBe('2950000');
    expect(dashBody.summary.periodExpense).toBe('1550000');

    // Notifications should exist for User A (budget warning + goal achieved + recurring)
    const notifRes = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      (notifRes.body as DataEnvelope<{ items: unknown[] }>).data.items.length,
    ).toBeGreaterThanOrEqual(3);

    // PDF & Excel exports return binary files
    const pdfRes = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${personalWsId}/reports/export/pdf`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');

    const excelRes = await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${personalWsId}/reports/export/excel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(excelRes.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  }, 30_000);
});
