import { vi } from 'vitest';
import { Prisma, TransactionType } from '../../generated/prisma/client.js';
import { ReportPeriodPreset } from '../../common/utils/date-range.util.js';
import { ReportsService } from './reports.service.js';

describe('ReportsService', () => {
  const prisma = {
    workspace: { findUnique: vi.fn() },
    wallet: { findMany: vi.fn() },
    transaction: { findMany: vi.fn() },
  };

  const service = new ReportsService(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.workspace.findUnique.mockResolvedValue({
      id: 'ws-1',
      name: 'Keluarga Kasku',
      currency: 'IDR',
      type: 'FAMILY',
    });
    prisma.wallet.findMany.mockResolvedValue([
      {
        id: 'w-1',
        name: 'Bank BCA',
        type: 'BANK',
        color: '#059669',
        balance: new Prisma.Decimal('8000000'),
      },
    ]);
    prisma.transaction.findMany
      .mockResolvedValueOnce([
        {
          id: 'tx-1',
          type: TransactionType.INCOME,
          amount: new Prisma.Decimal('10000000'),
          transactionDate: new Date('2026-11-01T08:00:00.000Z'),
          description: 'Gaji Bulanan',
          category: { id: 'c-1', name: 'Gaji', color: '#059669', icon: 'briefcase' },
          wallet: { id: 'w-1', name: 'Bank BCA' },
          destinationWallet: null,
          createdBy: { id: 'u-1', name: 'Dimm' },
        },
        {
          id: 'tx-2',
          type: TransactionType.EXPENSE,
          amount: new Prisma.Decimal('2000000'),
          transactionDate: new Date('2026-11-05T08:00:00.000Z'),
          description: 'Belanja Dapur',
          category: { id: 'c-2', name: 'Makanan', color: '#f59e0b', icon: 'utensils' },
          wallet: { id: 'w-1', name: 'Bank BCA' },
          destinationWallet: null,
          createdBy: { id: 'u-1', name: 'Dimm' },
        },
      ])
      .mockResolvedValueOnce([
        { type: TransactionType.INCOME, amount: new Prisma.Decimal('8000000') },
        { type: TransactionType.EXPENSE, amount: new Prisma.Decimal('4000000') },
      ])
      .mockResolvedValueOnce([
        {
          type: TransactionType.INCOME,
          amount: new Prisma.Decimal('10000000'),
          transactionDate: new Date('2026-11-01T08:00:00.000Z'),
        },
      ]);
  });

  it('computes period-over-period comparisons and excludes transfer from income/expense', async () => {
    const res = await service.getSummary('ws-1', {
      period: ReportPeriodPreset.CUSTOM,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      year: 2026,
    });

    expect(res.overview.totalIncome).toBe('10000000');
    expect(res.overview.totalExpense).toBe('2000000');
    expect(res.overview.netCashflow).toBe('8000000');
    expect(res.comparison.incomeChangePercent).toBe(25);
    expect(res.comparison.expenseChangePercent).toBe(-50);
    expect(res.monthlyTrend).toHaveLength(12);
    expect(res.monthlyTrend[10].income).toBe(10000000);
  });

  it('generates valid Excel and PDF binary buffers', async () => {
    const xlsxBuffer = await service.exportExcel('ws-1', {
      period: ReportPeriodPreset.CUSTOM,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    });
    expect(xlsxBuffer.byteLength).toBeGreaterThan(1000);

    // Reset mock sequence for second call
    prisma.transaction.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const pdfBuffer = await service.exportPdf('ws-1', {
      period: ReportPeriodPreset.CUSTOM,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    });
    expect(pdfBuffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});

