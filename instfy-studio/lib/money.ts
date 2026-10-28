/**
 * Integer-cents money primitives.
 *
 * Every monetary value in the system is an integer number of cents (BRL centavos).
 * No binary floating point is ever used to hold or accumulate a total.
 */

export type Cents = number;

export class MoneyError extends Error {}

function assertInt(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new MoneyError(`${label} deve ser um inteiro em centavos, recebido: ${value}`);
  }
}

/** Parses "1.234,56", "1234.56", "1234,56" or 1234.56 into integer cents. */
export function parseBRLToCents(input: string | number): Cents {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new MoneyError(`Valor inválido: ${input}`);
    return Math.round(input * 100);
  }
  const cleaned = input.trim().replace(/[R$\s ]/g, '');
  if (cleaned === '') return 0;
  let normalized = cleaned;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  if (hasComma && hasDot) {
    // Last separator wins as the decimal mark.
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new MoneyError(`Valor monetário inválido: ${input}`);
  return Math.round(parsed * 100);
}

export function centsToBRL(cents: Cents, opts: { symbol?: boolean } = {}): string {
  assertInt(cents, 'Valor');
  const symbol = opts.symbol ?? true;
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;
  const groupedWhole = whole.toLocaleString('pt-BR');
  const body = `${groupedWhole},${String(frac).padStart(2, '0')}`;
  return `${negative ? '-' : ''}${symbol ? 'R$ ' : ''}${body}`;
}

/** Compact form used in headline figures: R$ 22.000 (hides ",00"). */
export function centsToBRLCompact(cents: Cents): string {
  assertInt(cents, 'Valor');
  if (cents % 100 === 0) {
    const negative = cents < 0;
    const whole = Math.abs(cents) / 100;
    return `${negative ? '-' : ''}R$ ${whole.toLocaleString('pt-BR')}`;
  }
  return centsToBRL(cents);
}

export function sumCents(values: Cents[]): Cents {
  let total = 0;
  for (const v of values) {
    assertInt(v, 'Parcela');
    total += v;
  }
  return total;
}

/**
 * Applies a basis-point rate to a cents amount with half-up rounding on the
 * absolute value, so -0.5 and +0.5 round symmetrically away from zero.
 */
export function applyBasisPoints(baseCents: Cents, basisPoints: number): Cents {
  assertInt(baseCents, 'Base');
  if (!Number.isInteger(basisPoints)) {
    throw new MoneyError(`Basis points devem ser inteiros, recebido: ${basisPoints}`);
  }
  const sign = baseCents < 0 ? -1 : 1;
  const product = Math.abs(baseCents) * basisPoints;
  return sign * Math.floor((product + 5000) / 10000);
}

export function pctToBasisPoints(pct: number): number {
  if (!Number.isFinite(pct)) throw new MoneyError(`Percentual inválido: ${pct}`);
  return Math.round(pct * 100);
}

export function basisPointsToPct(bp: number): number {
  return bp / 100;
}

/**
 * Splits a total into `parts` instalments whose sum is exactly the total.
 * Optional `weights` (basis points of the total) drive uneven splits such as
 * the 40/30/30 implantation schedule used in the reference proposals.
 */
export function splitInstalments(totalCents: Cents, parts: number, weights?: number[]): Cents[] {
  assertInt(totalCents, 'Total');
  if (!Number.isInteger(parts) || parts < 1) {
    throw new MoneyError(`Número de parcelas inválido: ${parts}`);
  }
  if (weights && weights.length !== parts) {
    throw new MoneyError(`Pesos (${weights.length}) não correspondem às parcelas (${parts})`);
  }
  if (weights) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight !== 10000) {
      throw new MoneyError(`Pesos devem somar 10000 basis points, somaram ${totalWeight}`);
    }
    const raw = weights.map((w) => applyBasisPoints(totalCents, w));
    const drift = totalCents - sumCents(raw);
    raw[raw.length - 1] += drift;
    return raw;
  }
  const base = Math.trunc(totalCents / parts);
  const result = new Array<number>(parts).fill(base);
  let remainder = totalCents - base * parts;
  // Distribute the remaining cents one by one onto the earliest instalments.
  const step = remainder < 0 ? -1 : 1;
  let i = 0;
  while (remainder !== 0) {
    result[i % parts] += step;
    remainder -= step;
    i += 1;
  }
  return result;
}
