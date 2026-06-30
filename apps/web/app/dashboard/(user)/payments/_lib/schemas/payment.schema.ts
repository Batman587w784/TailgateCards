export type PaymentTransaction = {
  transaction_id: string;
  card_id: string;
  cardholder_email: string | null;
  organization_name: string | null;
  amount_cents: number;
  date: string;
  status: 'successful' | 'failed';
};

export type PaymentStats = {
  total_volume_cents: number;
  revenue_generated_cents: number;
  successful_transactions: number;
  failed_transactions: number;
};

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatTransactionId(id: string): string {
  if (id.startsWith('pi_')) {
    return id.substring(0, 10);
  }
  return id.substring(0, 8);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
