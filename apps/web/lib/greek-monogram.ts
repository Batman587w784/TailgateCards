/**
 * M2.5-d / decision #13 — Greek-letter monogram for chapters without a logo.
 *
 * Chapter names ARE Greek-letter names ("Pi Kappa Alpha" -> ΠΚΑ), so a fixed
 * 24-letter lookup covers Greek life; non-Greek names (schools, little leagues)
 * fall back to initials-on-color. Pure + client-safe.
 */

const GREEK_LETTERS: Record<string, string> = {
  alpha: 'Α',
  beta: 'Β',
  gamma: 'Γ',
  delta: 'Δ',
  epsilon: 'Ε',
  zeta: 'Ζ',
  eta: 'Η',
  theta: 'Θ',
  iota: 'Ι',
  kappa: 'Κ',
  lambda: 'Λ',
  mu: 'Μ',
  nu: 'Ν',
  xi: 'Ξ',
  omicron: 'Ο',
  pi: 'Π',
  rho: 'Ρ',
  sigma: 'Σ',
  tau: 'Τ',
  upsilon: 'Υ',
  phi: 'Φ',
  chi: 'Χ',
  psi: 'Ψ',
  omega: 'Ω',
};

/**
 * A short monogram for a chapter name: the Greek letters if the name is made of
 * Greek-letter words (ΠΚΑ), else initials of the first words.
 */
export function chapterMonogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  const greek = words
    .map((w) => GREEK_LETTERS[w.toLowerCase()])
    .filter((g): g is string => Boolean(g));

  if (greek.length > 0) {
    return greek.join('');
  }

  const initials = words
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return initials || '?';
}

/** Deterministic, readable background color for a monogram, derived from name. */
export function monogramColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return `hsl(${hash} 52% 42%)`;
}
