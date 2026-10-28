/**
 * Deterministic pricing engine.
 *
 * Pure functions only: no I/O, no clock, no randomness, no AI. The AI layer may
 * draft prose around these numbers but never produces or alters them.
 */
import {
  type Cents,
  applyBasisPoints,
  sumCents,
  splitInstalments,
  MoneyError,
} from './money';

export type BillingModel =
  | 'one_time'
  | 'monthly'
  | 'per_unit'
  | 'percent_of_base'
  | 'tiered_monthly'
  | 'third_party_spend';

export interface MonthTier {
  /** 1-based inclusive first month this tier applies to. */
  fromMonth: number;
  /** 1-based inclusive last month, or null for "from here onwards". */
  toMonth: number | null;
  amountCents: Cents;
  label?: string;
}

export interface PricingItemInput {
  id: string;
  label: string;
  billingModel: BillingModel;
  /** Unit price in cents for one_time / monthly / per_unit. */
  unitAmountCents?: Cents;
  quantity?: number;
  /** For percent_of_base: rate in basis points (20% => 2000). */
  percentBasisPoints?: number;
  /** For percent_of_base: the base the percentage is taken from, in cents. */
  percentBaseCents?: Cents;
  /** For tiered_monthly: month-dependent schedule. */
  tiers?: MonthTier[];
  /** For monthly / percent_of_base / tiered: how many months are contracted. */
  monthsCovered?: number;
  /** Bonified items keep their list price visible but charge zero. */
  bonified?: boolean;
  /** Discount percentage, 0-100, expressed as a plain number. */
  discountPct?: number;
  discountApproved?: boolean;
  /**
   * True for money the client pays a third party (ad platforms, hosting).
   * Never counted as Instfy revenue.
   */
  isThirdPartySpend?: boolean;
}

export interface PricingItemResult {
  id: string;
  label: string;
  billingModel: BillingModel;
  /** Price before bonification and discount. */
  listOneTimeCents: Cents;
  listMonthlyFirstCents: Cents;
  listRecurringTotalCents: Cents;
  /** Price actually charged. */
  oneTimeCents: Cents;
  /** Amount charged in month 1 of the recurring operation. */
  monthlyFirstCents: Cents;
  /** Sum charged across `monthsCovered`. */
  recurringTotalCents: Cents;
  /** Per-month breakdown, index 0 = month 1. */
  monthlyBreakdown: Cents[];
  isThirdPartySpend: boolean;
  bonified: boolean;
  discountPct: number;
  discountApproved: boolean;
  flags: PricingFlag[];
}

export interface PricingFlag {
  code:
    | 'DISCOUNT_OVER_CAP'
    | 'DISCOUNT_NOT_APPROVED'
    | 'BONIFIED'
    | 'TIER_GAP'
    | 'TIER_OVERLAP'
    | 'MISSING_BASE'
    | 'TAX_APPLIED'
    | 'THIRD_PARTY_SPEND';
  severity: 'info' | 'warn' | 'block';
  message: string;
  itemId?: string;
}

export interface PricingConfig {
  /** Maximum discount a user may grant without an explicit override. Default 0%. */
  discountAuthorizationCapPct: number;
  /** Tax is never assumed. When null, no tax line is produced at all. */
  taxRateBasisPoints: number | null;
  /** Contracted term used when an item does not state its own monthsCovered. */
  termMonths: number;
  /** Weights (basis points) for splitting the one-time implantation total. */
  instalmentWeights?: number[];
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  discountAuthorizationCapPct: 0,
  taxRateBasisPoints: null,
  termMonths: 12,
};

export interface PricingTotals {
  /** Instfy one-time fees actually charged. */
  oneTimeCents: Cents;
  /** Instfy recurring fees over the whole term. */
  recurringTotalCents: Cents;
  /** Instfy recurring fee charged in month 1. */
  recurringFirstMonthCents: Cents;
  /** Total Instfy fees = one-time + recurring over term. Excludes third parties. */
  instfyFeesCents: Cents;
  /** Money the client pays directly to third parties (ad spend etc.) over the term. */
  thirdPartySpendCents: Cents;
  /** Everything leaving the client's account over the term. */
  clientTotalCashOutlayCents: Cents;
  /** One-time (first instalment) + first recurring month. Media excluded unless contracted. */
  firstMonthDueCents: Cents;
  /** Total bonified list value granted to the client. */
  bonifiedValueCents: Cents;
  /** Total discount value granted. */
  discountValueCents: Cents;
  /** Only present when taxRateBasisPoints is explicitly configured. */
  taxCents: Cents | null;
  monthlyBreakdown: Cents[];
  thirdPartyMonthlyBreakdown: Cents[];
}

export interface PricingResult {
  items: PricingItemResult[];
  totals: PricingTotals;
  flags: PricingFlag[];
  config: PricingConfig;
  /** Stable snapshot persisted with the proposal. */
  computedAtVersion: string;
}

export const PRICING_ENGINE_VERSION = '1.0.0';

function monthsFor(item: PricingItemInput, config: PricingConfig): number {
  const months = item.monthsCovered ?? config.termMonths;
  if (!Number.isInteger(months) || months < 0) {
    throw new MoneyError(`monthsCovered inválido para "${item.label}": ${months}`);
  }
  return months;
}

/** Resolves the amount charged in a specific 1-based month for a tiered item. */
export function amountForMonth(tiers: MonthTier[], month: number): Cents {
  for (const tier of tiers) {
    const from = tier.fromMonth;
    const to = tier.toMonth ?? Number.POSITIVE_INFINITY;
    if (month >= from && month <= to) return tier.amountCents;
  }
  return 0;
}

export function validateTiers(tiers: MonthTier[], months: number, itemId: string): PricingFlag[] {
  const flags: PricingFlag[] = [];
  const sorted = [...tiers].sort((a, b) => a.fromMonth - b.fromMonth);
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const currentTo = current.toMonth ?? Number.POSITIVE_INFINITY;
    if (currentTo >= next.fromMonth) {
      flags.push({
        code: 'TIER_OVERLAP',
        severity: 'block',
        itemId,
        message: `Faixas de meses sobrepostas: meses ${current.fromMonth}-${current.toMonth} e ${next.fromMonth}-${next.toMonth ?? '∞'}.`,
      });
    } else if (currentTo + 1 < next.fromMonth) {
      flags.push({
        code: 'TIER_GAP',
        severity: 'warn',
        itemId,
        message: `Intervalo sem preço definido entre os meses ${currentTo + 1} e ${next.fromMonth - 1}.`,
      });
    }
  }
  for (let m = 1; m <= months; m += 1) {
    const covered = sorted.some(
      (t) => m >= t.fromMonth && m <= (t.toMonth ?? Number.POSITIVE_INFINITY),
    );
    if (!covered) {
      flags.push({
        code: 'TIER_GAP',
        severity: 'warn',
        itemId,
        message: `Mês ${m} está dentro da vigência mas não possui faixa de preço.`,
      });
      break;
    }
  }
  return flags;
}

export function computeItem(item: PricingItemInput, config: PricingConfig): PricingItemResult {
  const flags: PricingFlag[] = [];
  const quantity = item.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new MoneyError(`Quantidade inválida para "${item.label}": ${quantity}`);
  }
  const months = monthsFor(item, config);
  const discountPct = item.discountPct ?? 0;
  if (discountPct < 0 || discountPct > 100) {
    throw new MoneyError(`Desconto fora do intervalo 0-100 para "${item.label}": ${discountPct}`);
  }
  const discountBp = Math.round(discountPct * 100);

  let listOneTime = 0;
  let listMonthlyBreakdown: Cents[] = new Array(months).fill(0);

  switch (item.billingModel) {
    case 'one_time': {
      listOneTime = (item.unitAmountCents ?? 0) * quantity;
      break;
    }
    case 'per_unit': {
      listOneTime = (item.unitAmountCents ?? 0) * quantity;
      break;
    }
    case 'monthly': {
      const perMonth = (item.unitAmountCents ?? 0) * quantity;
      listMonthlyBreakdown = new Array(months).fill(perMonth);
      break;
    }
    case 'tiered_monthly': {
      const tiers = item.tiers ?? [];
      flags.push(...validateTiers(tiers, months, item.id));
      listMonthlyBreakdown = Array.from({ length: months }, (_, i) =>
        amountForMonth(tiers, i + 1) * quantity,
      );
      break;
    }
    case 'percent_of_base': {
      const bp = item.percentBasisPoints ?? 0;
      const base = item.percentBaseCents;
      if (base === undefined || base === null) {
        flags.push({
          code: 'MISSING_BASE',
          severity: 'warn',
          itemId: item.id,
          message: `"${item.label}" é percentual mas a base (verba) não foi informada. Valor exibido como pendente.`,
        });
        listMonthlyBreakdown = new Array(months).fill(0);
      } else {
        const fee = applyBasisPoints(base, bp);
        listMonthlyBreakdown = new Array(months).fill(fee);
      }
      break;
    }
    case 'third_party_spend': {
      const perMonth = (item.unitAmountCents ?? 0) * quantity;
      listMonthlyBreakdown = new Array(months).fill(perMonth);
      break;
    }
    default: {
      const exhaustive: never = item.billingModel;
      throw new MoneyError(`Modelo de cobrança desconhecido: ${String(exhaustive)}`);
    }
  }

  const bonified = item.bonified ?? false;
  if (bonified) {
    flags.push({
      code: 'BONIFIED',
      severity: 'info',
      itemId: item.id,
      message: `"${item.label}" bonificado: valor de tabela preservado, cobrança zerada.`,
    });
  }

  if (discountPct > 0) {
    if (discountPct > config.discountAuthorizationCapPct) {
      flags.push({
        code: 'DISCOUNT_OVER_CAP',
        severity: item.discountApproved ? 'warn' : 'block',
        itemId: item.id,
        message: `Desconto de ${discountPct}% em "${item.label}" excede o limite autorizado de ${config.discountAuthorizationCapPct}%.${item.discountApproved ? ' Override registrado.' : ' Requer aprovação explícita.'}`,
      });
    }
    if (!item.discountApproved) {
      flags.push({
        code: 'DISCOUNT_NOT_APPROVED',
        severity: 'block',
        itemId: item.id,
        message: `Desconto de ${discountPct}% em "${item.label}" ainda não foi aprovado.`,
      });
    }
  }

  const isThirdParty = item.isThirdPartySpend ?? item.billingModel === 'third_party_spend';
  if (isThirdParty) {
    flags.push({
      code: 'THIRD_PARTY_SPEND',
      severity: 'info',
      itemId: item.id,
      message: `"${item.label}" é verba de terceiros: pago diretamente pelo cliente, fora da receita Instfy.`,
    });
  }

  const chargeFactorBp = bonified ? 0 : 10000 - discountBp;
  const oneTime = applyBasisPoints(listOneTime, chargeFactorBp);
  const monthlyBreakdown = listMonthlyBreakdown.map((m) => applyBasisPoints(m, chargeFactorBp));

  return {
    id: item.id,
    label: item.label,
    billingModel: item.billingModel,
    listOneTimeCents: listOneTime,
    listMonthlyFirstCents: listMonthlyBreakdown[0] ?? 0,
    listRecurringTotalCents: sumCents(listMonthlyBreakdown),
    oneTimeCents: oneTime,
    monthlyFirstCents: monthlyBreakdown[0] ?? 0,
    recurringTotalCents: sumCents(monthlyBreakdown),
    monthlyBreakdown,
    isThirdPartySpend: isThirdParty,
    bonified,
    discountPct,
    discountApproved: item.discountApproved ?? false,
    flags,
  };
}

export function computeProposal(
  items: PricingItemInput[],
  configOverride: Partial<PricingConfig> = {},
): PricingResult {
  const config: PricingConfig = { ...DEFAULT_PRICING_CONFIG, ...configOverride };
  if (!Number.isInteger(config.termMonths) || config.termMonths < 1) {
    throw new MoneyError(`termMonths inválido: ${config.termMonths}`);
  }
  const results = items.map((item) => computeItem(item, config));
  const flags: PricingFlag[] = results.flatMap((r) => r.flags);

  const instfyItems = results.filter((r) => !r.isThirdPartySpend);
  const thirdPartyItems = results.filter((r) => r.isThirdPartySpend);

  const horizon = Math.max(
    config.termMonths,
    ...results.map((r) => r.monthlyBreakdown.length),
    1,
  );
  const monthlyBreakdown = Array.from({ length: horizon }, (_, i) =>
    sumCents(instfyItems.map((r) => r.monthlyBreakdown[i] ?? 0)),
  );
  const thirdPartyMonthlyBreakdown = Array.from({ length: horizon }, (_, i) =>
    sumCents(thirdPartyItems.map((r) => r.monthlyBreakdown[i] ?? 0)),
  );

  const oneTimeCents = sumCents(instfyItems.map((r) => r.oneTimeCents));
  const recurringTotalCents = sumCents(monthlyBreakdown);
  const recurringFirstMonthCents = monthlyBreakdown[0] ?? 0;
  const instfyFeesCents = oneTimeCents + recurringTotalCents;
  const thirdPartySpendCents =
    sumCents(thirdPartyMonthlyBreakdown) + sumCents(thirdPartyItems.map((r) => r.oneTimeCents));

  const bonifiedValueCents = sumCents(
    results
      .filter((r) => r.bonified)
      .map((r) => r.listOneTimeCents + r.listRecurringTotalCents),
  );
  const discountValueCents = sumCents(
    results
      .filter((r) => !r.bonified && r.discountPct > 0)
      .map(
        (r) =>
          r.listOneTimeCents +
          r.listRecurringTotalCents -
          (r.oneTimeCents + r.recurringTotalCents),
      ),
  );

  let taxCents: Cents | null = null;
  if (config.taxRateBasisPoints !== null) {
    taxCents = applyBasisPoints(instfyFeesCents, config.taxRateBasisPoints);
    flags.push({
      code: 'TAX_APPLIED',
      severity: 'info',
      message: `Tributo de ${config.taxRateBasisPoints / 100}% aplicado por configuração explícita sobre honorários Instfy.`,
    });
  }

  // First instalment of the implantation, not the whole one-time total.
  const firstInstalment = config.instalmentWeights
    ? splitInstalments(oneTimeCents, config.instalmentWeights.length, config.instalmentWeights)[0]
    : oneTimeCents;

  const firstMonthDueCents = firstInstalment + recurringFirstMonthCents;

  const clientTotalCashOutlayCents =
    instfyFeesCents + thirdPartySpendCents + (taxCents ?? 0);

  return {
    items: results,
    totals: {
      oneTimeCents,
      recurringTotalCents,
      recurringFirstMonthCents,
      instfyFeesCents,
      thirdPartySpendCents,
      clientTotalCashOutlayCents,
      firstMonthDueCents,
      bonifiedValueCents,
      discountValueCents,
      taxCents,
      monthlyBreakdown,
      thirdPartyMonthlyBreakdown,
    },
    flags,
    config,
    computedAtVersion: PRICING_ENGINE_VERSION,
  };
}

export interface ScheduleLine {
  label: string;
  dueRule: string;
  amountCents: Cents;
}

/** Builds the implantation payment schedule (40/30/30 by default). */
export function buildImplantationSchedule(
  oneTimeCents: Cents,
  weights: number[] = [4000, 3000, 3000],
  dueRules: string[] = ['Assinatura e início', '30 dias após assinatura', '60 dias após assinatura'],
): ScheduleLine[] {
  const parts = splitInstalments(oneTimeCents, weights.length, weights);
  return parts.map((amountCents, i) => ({
    label: `${i + 1}ª parcela`,
    dueRule: dueRules[i] ?? `${i * 30} dias após assinatura`,
    amountCents,
  }));
}

export function blockingFlags(flags: PricingFlag[]): PricingFlag[] {
  return flags.filter((f) => f.severity === 'block');
}
