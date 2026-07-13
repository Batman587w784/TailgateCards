/** Format integer cents as a whole-dollar USD string, e.g. 11250 -> "$113". */
export function formatUsdFromCents(cents: number | null | undefined): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format((cents ?? 0) / 100);
}
