import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { createObserveModule } from '@nestjs/observe';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BudgetsModule } from './modules/budgets/budgets.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { DebtsModule } from './modules/debts/debts.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { RecurringTransactionsModule } from './modules/recurring-transactions/recurring-transactions.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { SavingsGoalsModule } from './modules/savings-goals/savings-goals.module.js';
import { TransactionsModule } from './modules/transactions/transactions.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WalletsModule } from './modules/wallets/wallets.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com,
    // then run `npx @nestjs/observe link` to write your key pair into .env.
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'kukas',
    }),
    PrismaModule,
    AuditLogsModule,
    NotificationsModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
    CategoriesModule,
    WalletsModule,
    TransactionsModule,
    BudgetsModule,
    SavingsGoalsModule,
    DashboardModule,
    ReportsModule,
    DebtsModule,
    RecurringTransactionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
