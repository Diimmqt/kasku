/** Formats a numeric string or number as localized currency (defaults to IDR). */
export function formatCurrency(
  amount: string | number,
  currency = 'IDR',
): string {
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(num)) return `${currency} 0`;

  const locale = currency === 'IDR' ? 'id-ID' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(num);
}

/** Formats an ISO date string according to user preference (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD). */
export function formatDate(
  isoDate: string,
  preference: string = 'DD/MM/YYYY',
): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();

  if (preference === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
  if (preference === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
  return `${dd}/${mm}/${yyyy}`;
}

/** Strips trailing decimal zeros from canonical DB decimal strings (e.g. "150000.0000" -> "150000"). */
export function stripTrailingDecimalZeros(raw: string): string {
  if (!raw.includes('.')) return raw;
  return raw.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

/** Formats a canonical numeric string ("1500000.25") into Indonesian dot-grouped display ("1.500.000,25"). */
export function formatAmountDots(canonical: string): string {
  if (!canonical) return '';
  const hasCommaDot = canonical.includes('.');
  const [rawInt, rawDec] = canonical.split('.');
  const cleanInt = rawInt.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const groupedInt = (cleanInt || (hasCommaDot ? '0' : '')).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    '.',
  );
  if (!hasCommaDot) return groupedInt;
  const cleanDec = (rawDec ?? '').replace(/\D/g, '').slice(0, 4);
  return `${groupedInt},${cleanDec}`;
}

/** Parses user-typed dot-grouped display text ("1.500.000,25") back to canonical numeric string ("1500000.25"). */
export function parseAmountDots(displayText: string): string {
  const withoutDots = displayText.replace(/\./g, '');
  const commaIdx = withoutDots.indexOf(',');
  if (commaIdx === -1) {
    return withoutDots.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  }
  const intPart = withoutDots
    .slice(0, commaIdx)
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '');
  const decPart = withoutDots
    .slice(commaIdx + 1)
    .replace(/\D/g, '')
    .slice(0, 4);
  return `${intPart || '0'}.${decPart}`;
}

