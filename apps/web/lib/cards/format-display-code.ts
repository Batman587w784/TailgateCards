export interface CardDisplayCodeInput {
  card_type: 'physical' | 'digital';
  card_number: number | null;
  digital_card_number: number | null;
  organization_prefix: string | null;
  batch_prefix: string | null;
}

export function formatCardDisplayCode(input: CardDisplayCodeInput): string {
  if (input.card_type === 'digital') {
    if (input.digital_card_number === null) {
      return 'D';
    }

    return `D-${String(input.digital_card_number).padStart(6, '0')}`;
  }

  if (input.organization_prefix && input.batch_prefix) {
    return `${input.organization_prefix}-${input.batch_prefix}-${input.card_number}`;
  }

  return String(input.card_number ?? '');
}
