import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';

/** Parses a positive monetary amount into Prisma.Decimal, rejecting NaN, <= 0, or >4 decimal places. */
export function parsePositiveDecimal(
  raw: string | number,
  fieldLabel = 'Nominal',
): Prisma.Decimal {
  const str = typeof raw === 'number' ? raw.toString() : raw.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(str)) {
    throw new BadRequestException(
      `${fieldLabel} harus berupa angka desimal valid (maksimal 4 angka di belakang koma).`,
    );
  }
  const decimal = new Prisma.Decimal(str);
  if (decimal.lte(0)) {
    throw new BadRequestException(`${fieldLabel} harus lebih besar dari 0.`);
  }
  return decimal;
}

/** Parses a non-negative monetary amount (>= 0) into Prisma.Decimal. */
export function parseNonNegativeDecimal(
  raw: string | number,
  fieldLabel = 'Nominal',
): Prisma.Decimal {
  const str = typeof raw === 'number' ? raw.toString() : raw.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(str)) {
    throw new BadRequestException(
      `${fieldLabel} harus berupa angka desimal valid (maksimal 4 angka di belakang koma).`,
    );
  }
  return new Prisma.Decimal(str);
}

/** Formats a Prisma.Decimal (or numeric string) to a fixed 2/4-scale canonical string for API responses. */
export function decimalToString(
  value: Prisma.Decimal | string | number | null | undefined,
): string {
  if (value === null || value === undefined) return '0';
  return new Prisma.Decimal(value).toString();
}

