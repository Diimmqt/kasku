import { Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Prisma, TransactionType } from '../../generated/prisma/client.js';
import {
  buildTimeBuckets,
  ReportPeriodPreset,
  resolvePeriodRange,
} from '../../common/utils/date-range.util.js';
import { decimalToString } from '../../common/utils/decimal.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QueryReportsDto } from './dto/query-reports.dto.js';

const MONTH_NAMES_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(workspaceId: string, query: QueryReportsDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, currency: true, type: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace tidak ditemukan.');
    }

    const now = new Date();
    const range = resolvePeriodRange(
      query.period ?? ReportPeriodPreset.THIS_MONTH,
      query.startDate,
      query.endDate,
      now,
    );
    const targetYear = query.year ?? range.startDate.getUTCFullYear();
    const yearStart = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0, 0));
    const yearEnd = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999));

    const [wallets, periodTx, previousTx, yearlyTx] = await Promise.all([
      this.prisma.wallet.findMany({
        where: { workspaceId, isArchived: false },
        orderBy: { balance: 'desc' },
      }),
      this.prisma.transaction.findMany({
        where: {
          workspaceId,
          transactionDate: { gte: range.startDate, lte: range.endDate },
        },
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          wallet: { select: { id: true, name: true } },
          destinationWallet: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.transaction.findMany({
        where: {
          workspaceId,
          type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
          transactionDate: {
            gte: range.previousStartDate,
            lte: range.previousEndDate,
          },
        },
        select: { type: true, amount: true },
      }),
      this.prisma.transaction.findMany({
        where: {
          workspaceId,
          type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
          transactionDate: { gte: yearStart, lte: yearEnd },
        },
        select: { type: true, amount: true, transactionDate: true },
      }),
    ]);

    const totalBalance = wallets.reduce(
      (acc, w) => acc.plus(w.balance),
      new Prisma.Decimal(0),
    );

    const walletBalances = wallets.map((w) => {
      const bal = new Prisma.Decimal(w.balance);
      return {
        id: w.id,
        name: w.name,
        type: w.type,
        color: w.color,
        balance: decimalToString(bal),
        numericBalance: Number(bal.toDecimalPlaces(2).toString()),
        percentage: totalBalance.gt(0)
          ? Number(bal.div(totalBalance).mul(100).toDecimalPlaces(1).toString())
          : 0,
      };
    });

    let totalIncome = new Prisma.Decimal(0);
    let totalExpense = new Prisma.Decimal(0);
    let totalTransfer = new Prisma.Decimal(0);

    const buckets = buildTimeBuckets(range.startDate, range.endDate, range.groupBy);
    const periodSeriesMap = new Map<
      string,
      { dateKey: string; label: string; income: Prisma.Decimal; expense: Prisma.Decimal }
    >();
    for (const bucket of buckets) {
      periodSeriesMap.set(bucket.dateKey, {
        ...bucket,
        income: new Prisma.Decimal(0),
        expense: new Prisma.Decimal(0),
      });
    }

    const incomeCats = new Map<
      string,
      { categoryId: string; categoryName: string; color: string; amount: Prisma.Decimal; count: number }
    >();
    const expenseCats = new Map<
      string,
      { categoryId: string; categoryName: string; color: string; amount: Prisma.Decimal; count: number }
    >();

    for (const tx of periodTx) {
      const amount = new Prisma.Decimal(tx.amount);
      const iso = tx.transactionDate.toISOString();
      const key = range.groupBy === 'month' ? iso.slice(0, 7) : iso.slice(0, 10);
      const bucket = periodSeriesMap.get(key);

      if (tx.type === TransactionType.INCOME) {
        totalIncome = totalIncome.plus(amount);
        if (bucket) bucket.income = bucket.income.plus(amount);
        this.accumulateCategory(incomeCats, tx.category, amount);
      } else if (tx.type === TransactionType.EXPENSE) {
        totalExpense = totalExpense.plus(amount);
        if (bucket) bucket.expense = bucket.expense.plus(amount);
        this.accumulateCategory(expenseCats, tx.category, amount);
      } else {
        totalTransfer = totalTransfer.plus(amount);
      }
    }

    let previousIncome = new Prisma.Decimal(0);
    let previousExpense = new Prisma.Decimal(0);
    for (const tx of previousTx) {
      if (tx.type === TransactionType.INCOME) {
        previousIncome = previousIncome.plus(tx.amount);
      } else if (tx.type === TransactionType.EXPENSE) {
        previousExpense = previousExpense.plus(tx.amount);
      }
    }

    const monthlyTrend = Array.from({ length: 12 }, (_, idx) => ({
      month: idx + 1,
      label: MONTH_NAMES_ID[idx],
      incomeDec: new Prisma.Decimal(0),
      expenseDec: new Prisma.Decimal(0),
    }));

    for (const tx of yearlyTx) {
      const m = tx.transactionDate.getUTCMonth();
      if (tx.type === TransactionType.INCOME) {
        monthlyTrend[m].incomeDec = monthlyTrend[m].incomeDec.plus(tx.amount);
      } else if (tx.type === TransactionType.EXPENSE) {
        monthlyTrend[m].expenseDec = monthlyTrend[m].expenseDec.plus(tx.amount);
      }
    }

    const netCashflow = totalIncome.minus(totalExpense);
    const previousNetCashflow = previousIncome.minus(previousExpense);

    return {
      workspace,
      year: targetYear,
      period: {
        type: range.type,
        startDate: range.startDate,
        endDate: range.endDate,
      },
      previousPeriod: {
        startDate: range.previousStartDate,
        endDate: range.previousEndDate,
      },
      overview: {
        totalBalance: decimalToString(totalBalance),
        totalIncome: decimalToString(totalIncome),
        totalExpense: decimalToString(totalExpense),
        totalTransfer: decimalToString(totalTransfer),
        netCashflow: decimalToString(netCashflow),
        transactionCount: periodTx.length,
      },
      comparison: {
        previousIncome: decimalToString(previousIncome),
        previousExpense: decimalToString(previousExpense),
        previousNetCashflow: decimalToString(previousNetCashflow),
        incomeChangePercent: this.percentChange(totalIncome, previousIncome),
        expenseChangePercent: this.percentChange(totalExpense, previousExpense),
      },
      walletBalances,
      incomeByCategory: this.serializeCategoryBreakdown(incomeCats, totalIncome),
      expenseByCategory: this.serializeCategoryBreakdown(expenseCats, totalExpense),
      periodTrend: Array.from(periodSeriesMap.values()).map((b) => ({
        dateKey: b.dateKey,
        label: b.label,
        income: Number(b.income.toDecimalPlaces(2).toString()),
        expense: Number(b.expense.toDecimalPlaces(2).toString()),
      })),
      monthlyTrend: monthlyTrend.map((m) => {
        const net = m.incomeDec.minus(m.expenseDec);
        return {
          month: m.month,
          label: m.label,
          income: Number(m.incomeDec.toDecimalPlaces(2).toString()),
          expense: Number(m.expenseDec.toDecimalPlaces(2).toString()),
          net: Number(net.toDecimalPlaces(2).toString()),
        };
      }),
      transactions: periodTx.slice(0, 500).map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: decimalToString(tx.amount),
        transactionDate: tx.transactionDate,
        description: tx.description,
        categoryName: tx.category?.name ?? '-',
        walletName: tx.wallet.name,
        destinationWalletName: tx.destinationWallet?.name ?? null,
        createdByName: tx.createdBy.name,
      })),
    };
  }

  async exportExcel(workspaceId: string, query: QueryReportsDto): Promise<Buffer> {
    const report = await this.getSummary(workspaceId, query);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Kasku';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Ringkasan');
    summarySheet.columns = [
      { header: 'Metrik', key: 'metric', width: 32 },
      { header: 'Nilai', key: 'value', width: 24 },
    ];
    summarySheet.addRows([
      { metric: 'Workspace', value: report.workspace.name },
      { metric: 'Mata Uang', value: report.workspace.currency },
      {
        metric: 'Periode',
        value: `${report.period.startDate.toISOString().slice(0, 10)} s/d ${report.period.endDate.toISOString().slice(0, 10)}`,
      },
      { metric: 'Total Saldo Dompet', value: Number(report.overview.totalBalance) },
      { metric: 'Total Pemasukan', value: Number(report.overview.totalIncome) },
      { metric: 'Total Pengeluaran', value: Number(report.overview.totalExpense) },
      { metric: 'Arus Kas Bersih', value: Number(report.overview.netCashflow) },
      { metric: 'Jumlah Transaksi', value: report.overview.transactionCount },
    ]);

    const categorySheet = workbook.addWorksheet('Kategori Pengeluaran');
    categorySheet.columns = [
      { header: 'Kategori', key: 'name', width: 28 },
      { header: 'Jumlah Transaksi', key: 'count', width: 18 },
      { header: 'Total', key: 'amount', width: 20 },
      { header: 'Persentase (%)', key: 'percentage', width: 16 },
    ];
    for (const cat of report.expenseByCategory) {
      categorySheet.addRow({
        name: cat.categoryName,
        count: cat.count,
        amount: cat.numericAmount,
        percentage: cat.percentage,
      });
    }

    const txSheet = workbook.addWorksheet('Daftar Transaksi');
    txSheet.columns = [
      { header: 'Tanggal', key: 'date', width: 14 },
      { header: 'Jenis', key: 'type', width: 12 },
      { header: 'Deskripsi', key: 'description', width: 34 },
      { header: 'Kategori', key: 'category', width: 20 },
      { header: 'Dompet', key: 'wallet', width: 22 },
      { header: 'Nominal', key: 'amount', width: 18 },
      { header: 'Dicatat Oleh', key: 'creator', width: 20 },
    ];
    for (const tx of report.transactions) {
      txSheet.addRow({
        date: new Date(tx.transactionDate).toISOString().slice(0, 10),
        type: tx.type,
        description: tx.description,
        category: tx.categoryName,
        wallet: tx.destinationWalletName
          ? `${tx.walletName} -> ${tx.destinationWalletName}`
          : tx.walletName,
        amount: Number(tx.amount),
        creator: tx.createdByName,
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async exportPdf(workspaceId: string, query: QueryReportsDto): Promise<Buffer> {
    const report = await this.getSummary(workspaceId, query);
    const currency = report.workspace.currency || 'IDR';

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc
        .fontSize(18)
        .fillColor('#065f46')
        .text(`Laporan Keuangan Kasku - ${report.workspace.name}`);
      doc
        .moveDown(0.3)
        .fontSize(10)
        .fillColor('#475569')
        .text(
          `Periode: ${report.period.startDate.toISOString().slice(0, 10)} s/d ${report.period.endDate.toISOString().slice(0, 10)} (${currency})`,
        );

      doc.moveDown(1);
      doc.fontSize(12).fillColor('#0f172a').text('Ringkasan Keuangan', {
        underline: true,
      });
      doc.moveDown(0.4).fontSize(10);
      doc.text(`Total Saldo Aktif : ${currency} ${report.overview.totalBalance}`);
      doc.text(`Total Pemasukan   : ${currency} ${report.overview.totalIncome}`);
      doc.text(`Total Pengeluaran : ${currency} ${report.overview.totalExpense}`);
      doc.text(`Arus Kas Bersih   : ${currency} ${report.overview.netCashflow}`);
      doc.text(`Total Transaksi   : ${report.overview.transactionCount}`);

      doc.moveDown(1);
      doc.fontSize(12).fillColor('#0f172a').text('Saldo Dompet', {
        underline: true,
      });
      doc.moveDown(0.4).fontSize(10);
      if (report.walletBalances.length === 0) {
        doc.text('Tidak ada dompet aktif.');
      } else {
        for (const w of report.walletBalances) {
          doc.text(`- ${w.name} (${w.type}): ${currency} ${w.balance} (${w.percentage}%)`);
        }
      }

      doc.moveDown(1);
      doc.fontSize(12).fillColor('#0f172a').text('Pengeluaran per Kategori', {
        underline: true,
      });
      doc.moveDown(0.4).fontSize(10);
      if (report.expenseByCategory.length === 0) {
        doc.text('Belum ada pengeluaran pada periode ini.');
      } else {
        for (const cat of report.expenseByCategory) {
          doc.text(
            `- ${cat.categoryName}: ${currency} ${cat.amount} (${cat.percentage}%, ${cat.count} transaksi)`,
          );
        }
      }

      doc.moveDown(1);
      doc.fontSize(12).fillColor('#0f172a').text('Transaksi Periode Ini (Maks. 50)', {
        underline: true,
      });
      doc.moveDown(0.4).fontSize(9);
      for (const tx of report.transactions.slice(0, 50)) {
        const dateStr = new Date(tx.transactionDate).toISOString().slice(0, 10);
        doc.text(
          `${dateStr} | ${tx.type} | ${tx.description} | ${tx.categoryName} | ${tx.walletName} | ${currency} ${tx.amount}`,
        );
      }

      doc.end();
    });
  }

  private accumulateCategory(
    map: Map<
      string,
      { categoryId: string; categoryName: string; color: string; amount: Prisma.Decimal; count: number }
    >,
    category: { id: string; name: string; color: string } | null,
    amount: Prisma.Decimal,
  ) {
    const id = category?.id ?? 'uncategorized';
    const existing = map.get(id);
    if (existing) {
      existing.amount = existing.amount.plus(amount);
      existing.count += 1;
    } else {
      map.set(id, {
        categoryId: id,
        categoryName: category?.name ?? 'Tanpa Kategori',
        color: category?.color ?? '#64748b',
        amount,
        count: 1,
      });
    }
  }

  private serializeCategoryBreakdown(
    map: Map<
      string,
      { categoryId: string; categoryName: string; color: string; amount: Prisma.Decimal; count: number }
    >,
    total: Prisma.Decimal,
  ) {
    return Array.from(map.values())
      .sort((a, b) => b.amount.comparedTo(a.amount))
      .map((item) => ({
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        color: item.color,
        count: item.count,
        amount: decimalToString(item.amount),
        numericAmount: Number(item.amount.toDecimalPlaces(2).toString()),
        percentage: total.gt(0)
          ? Number(item.amount.div(total).mul(100).toDecimalPlaces(1).toString())
          : 0,
      }));
  }

  private percentChange(current: Prisma.Decimal, previous: Prisma.Decimal) {
    if (previous.eq(0)) {
      return current.gt(0) ? 100 : 0;
    }
    return Number(
      current
        .minus(previous)
        .div(previous.abs())
        .mul(100)
        .toDecimalPlaces(1)
        .toString(),
    );
  }
}

