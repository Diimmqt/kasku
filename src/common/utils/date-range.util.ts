import { BadRequestException } from '@nestjs/common';

export enum ReportPeriodPreset {
  THIS_WEEK = 'THIS_WEEK',
  THIS_MONTH = 'THIS_MONTH',
  THIS_YEAR = 'THIS_YEAR',
  CUSTOM = 'CUSTOM',
}

export interface ResolvedPeriodRange {
  type: ReportPeriodPreset;
  startDate: Date;
  endDate: Date;
  previousStartDate: Date;
  previousEndDate: Date;
  groupBy: 'day' | 'month';
}

export function resolvePeriodRange(
  preset: ReportPeriodPreset = ReportPeriodPreset.THIS_MONTH,
  rawStartDate?: string,
  rawEndDate?: string,
  now: Date = new Date(),
): ResolvedPeriodRange {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();

  let startDate: Date;
  let endDate: Date;
  let previousStartDate: Date;
  let previousEndDate: Date;
  let groupBy: 'day' | 'month' = 'day';

  if (preset === ReportPeriodPreset.THIS_WEEK) {
    // Monday-based week in UTC
    const utcDay = now.getUTCDay();
    const diffToMonday = utcDay === 0 ? 6 : utcDay - 1;
    startDate = new Date(Date.UTC(year, month, day - diffToMonday, 0, 0, 0, 0));
    endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 6);
    endDate.setUTCHours(23, 59, 59, 999);

    previousStartDate = new Date(startDate);
    previousStartDate.setUTCDate(startDate.getUTCDate() - 7);
    previousEndDate = new Date(endDate);
    previousEndDate.setUTCDate(endDate.getUTCDate() - 7);
    groupBy = 'day';
  } else if (preset === ReportPeriodPreset.THIS_YEAR) {
    startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    previousStartDate = new Date(Date.UTC(year - 1, 0, 1, 0, 0, 0, 0));
    previousEndDate = new Date(Date.UTC(year - 1, 11, 31, 23, 59, 59, 999));
    groupBy = 'month';
  } else if (preset === ReportPeriodPreset.CUSTOM) {
    if (!rawStartDate || !rawEndDate) {
      throw new BadRequestException(
        'Periode kustom wajib menyertakan startDate dan endDate.',
      );
    }
    startDate = new Date(rawStartDate);
    endDate = /^\d{4}-\d{2}-\d{2}$/.test(rawEndDate)
      ? new Date(`${rawEndDate}T23:59:59.999Z`)
      : new Date(rawEndDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Format tanggal periode tidak valid.');
    }
    if (endDate < startDate) {
      throw new BadRequestException(
        'Tanggal akhir tidak boleh sebelum tanggal mulai.',
      );
    }

    const durationMs = endDate.getTime() - startDate.getTime();
    previousEndDate = new Date(startDate.getTime() - 1);
    previousStartDate = new Date(previousEndDate.getTime() - durationMs);
    const totalDays = Math.ceil(durationMs / 86_400_000);
    groupBy = totalDays > 62 ? 'month' : 'day';
  } else {
    startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

    previousStartDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    previousEndDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    groupBy = 'day';
  }

  return {
    type: preset,
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    groupBy,
  };
}

export function buildTimeBuckets(
  startDate: Date,
  endDate: Date,
  groupBy: 'day' | 'month',
): { dateKey: string; label: string }[] {
  const buckets: { dateKey: string; label: string }[] = [];
  const monthNames = [
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

  if (groupBy === 'month') {
    const cursor = new Date(
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1),
    );
    const endMonth = new Date(
      Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1),
    );
    while (cursor <= endMonth) {
      const y = cursor.getUTCFullYear();
      const m = cursor.getUTCMonth();
      const dateKey = `${y}-${String(m + 1).padStart(2, '0')}`;
      buckets.push({ dateKey, label: `${monthNames[m]} ${y}` });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return buckets;
  }

  const cursor = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
    ),
  );
  while (cursor <= lastDay) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const d = cursor.getUTCDate();
    const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    buckets.push({ dateKey, label: `${d} ${monthNames[m]}` });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
}

