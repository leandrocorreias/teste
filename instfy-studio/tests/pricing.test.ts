import { describe, expect, it } from 'vitest';
import {
  buildImplantationSchedule,
  computeItem,
  computeProposal,
  type PricingItemInput,
} from '../lib/pricing';
import { sumCents } from '../lib/money';

const R = (reais: number) => reais * 100;

describe('billing models', () => {
  it('one_time charges unit * quantity once', () => {
    const r = computeItem(
      { id: 'a', label: 'Branding', billingModel: 'one_time', unitAmountCents: R(10000) },
      { discountAuthorizationCapPct: 0, taxRateBasisPoints: null, termMonths: 12 },
    );
    expect(r.oneTimeCents).toBe(R(10000));
    expect(r.recurringTotalCents).toBe(0);
  });

  it('per_unit multiplies by quantity', () => {
    const r = computeItem(
      { id: 'a', label: 'Peça extra', billingModel: 'per_unit', unitAmountCents: R(350), quantity: 7 },
      { discountAuthorizationCapPct: 0, taxRateBasisPoints: null, termMonths: 12 },
    );
    expect(r.oneTimeCents).toBe(R(2450));
  });

  it('monthly repeats across the contracted term', () => {
    const r = computeItem(
      { id: 'a', label: 'Recorrente', billingModel: 'monthly', unitAmountCents: R(8000), monthsCovered: 12 },
      { discountAuthorizationCapPct: 0, taxRateBasisPoints: null, termMonths: 12 },
    );
    expect(r.monthlyBreakdown).toHaveLength(12);
    expect(r.recurringTotalCents).toBe(R(96000));
    expect(r.monthlyFirstCents).toBe(R(8000));
  });

  it('percent_of_base computes the management fee on the declared media budget', () => {
    const r = computeItem(
      {
        id: 'a',
        label: 'Gestão de mídia',
        billingModel: 'percent_of_base',
        percentBasisPoints: 2000,
        percentBaseCents: R(10000),
        monthsCovered: 12,
      },
      { discountAuthorizationCapPct: 0, taxRateBasisPoints: null, termMonths: 12 },
    );
    expect(r.monthlyFirstCents).toBe(R(2000));
    expect(r.recurringTotalCents).toBe(R(24000));
  });

  it('flags a percent item whose base is unknown instead of inventing one', () => {
    const r = computeItem(
      {
        id: 'a',
        label: 'Gestão de mídia',
        billingModel: 'percent_of_base',
        percentBasisPoints: 2000,
        monthsCovered: 12,
      },
      { discountAuthorizationCapPct: 0, taxRateBasisPoints: null, termMonths: 12 },
    );
    expect(r.recurringTotalCents).toBe(0);
    expect(r.flags.map((f) => f.code)).toContain('MISSING_BASE');
  });
});

describe('acceptance B — Muscle Up reference service mix', () => {
  const items: PricingItemInput[] = [
    {
      id: 'discovery',
      label: 'Pré-Discovery e diagnóstico estratégico',
      billingModel: 'one_time',
      unitAmountCents: R(5000),
      bonified: true,
    },
    { id: 'branding', label: 'Branding e posicionamento', billingModel: 'one_time', unitAmountCents: R(10000) },
    { id: 'website', label: 'Website, SEO, IA e web app', billingModel: 'one_time', unitAmountCents: R(12000) },
    {
      id: 'recorrente',
      label: 'Estratégia e ativações recorrentes',
      billingModel: 'monthly',
      unitAmountCents: R(8000),
      monthsCovered: 12,
    },
    {
      id: 'midia-fee',
      label: 'Gestão de campanhas de mídia paga',
      billingModel: 'percent_of_base',
      percentBasisPoints: 2000,
      percentBaseCents: R(10000),
      monthsCovered: 12,
    },
    {
      id: 'midia-verba',
      label: 'Verba de anúncios (paga às plataformas)',
      billingModel: 'third_party_spend',
      unitAmountCents: R(10000),
      monthsCovered: 12,
      isThirdPartySpend: true,
    },
  ];

  const result = computeProposal(items, {
    termMonths: 12,
    instalmentWeights: [4000, 3000, 3000],
  });

  it('bonifies discovery without hiding its list value', () => {
    const discovery = result.items.find((i) => i.id === 'discovery')!;
    expect(discovery.listOneTimeCents).toBe(R(5000));
    expect(discovery.oneTimeCents).toBe(0);
    expect(result.totals.bonifiedValueCents).toBe(R(5000));
  });

  it('totals the one-time implantation at R$ 22.000', () => {
    expect(result.totals.oneTimeCents).toBe(R(22000));
  });

  it('charges R$ 8.000/month recurring strategy', () => {
    const recorrente = result.items.find((i) => i.id === 'recorrente')!;
    expect(recorrente.monthlyFirstCents).toBe(R(8000));
    expect(recorrente.recurringTotalCents).toBe(R(96000));
  });

  it('computes 20% of a R$ 10.000 media budget as a R$ 2.000 fee', () => {
    const fee = result.items.find((i) => i.id === 'midia-fee')!;
    expect(fee.monthlyFirstCents).toBe(R(2000));
  });

  it('tracks the R$ 10.000 ad spend separately from Instfy fees', () => {
    expect(result.totals.thirdPartySpendCents).toBe(R(120000));
    // Instfy fees = 22.000 one-time + (8.000 + 2.000) * 12 recurring
    expect(result.totals.instfyFeesCents).toBe(R(22000) + R(120000));
    expect(result.totals.clientTotalCashOutlayCents).toBe(R(22000) + R(120000) + R(120000));
  });

  it('bills the first month as instalment 1 plus month 1 recurring', () => {
    // 8.800 (1st instalment of 22.000) + 8.000 strategy + 2.000 media fee
    expect(result.totals.firstMonthDueCents).toBe(R(8800) + R(8000) + R(2000));
  });

  it('adds no tax when none is configured', () => {
    expect(result.totals.taxCents).toBeNull();
  });

  it('builds the 40/30/30 implantation schedule', () => {
    const schedule = buildImplantationSchedule(result.totals.oneTimeCents);
    expect(schedule.map((s) => s.amountCents)).toEqual([R(8800), R(6600), R(6600)]);
    expect(sumCents(schedule.map((s) => s.amountCents))).toBe(R(22000));
  });
});

describe('acceptance C — MYO stepped monthly pricing', () => {
  const result = computeProposal(
    [
      {
        id: 'recorrente',
        label: 'Estratégia, marketing e ativações recorrentes',
        billingModel: 'tiered_monthly',
        monthsCovered: 12,
        tiers: [
          { fromMonth: 1, toMonth: 6, amountCents: R(5000), label: 'Condição de lançamento' },
          { fromMonth: 7, toMonth: null, amountCents: R(8000), label: 'Mensalidade contratual' },
        ],
      },
    ],
    { termMonths: 12 },
  );

  it('charges R$ 5.000 in months 1-6 and R$ 8.000 in months 7-12', () => {
    expect(result.totals.monthlyBreakdown).toEqual([
      R(5000), R(5000), R(5000), R(5000), R(5000), R(5000),
      R(8000), R(8000), R(8000), R(8000), R(8000), R(8000),
    ]);
  });

  it('totals R$ 78.000 of recurring fees across 12 months', () => {
    expect(result.totals.recurringTotalCents).toBe(R(78000));
  });

  it('reports no third-party spend when no media budget is attached', () => {
    expect(result.totals.thirdPartySpendCents).toBe(0);
  });

  it('flags gaps in a tier schedule instead of charging zero silently', () => {
    const gapped = computeProposal(
      [
        {
          id: 'g',
          label: 'Com lacuna',
          billingModel: 'tiered_monthly',
          monthsCovered: 12,
          tiers: [
            { fromMonth: 1, toMonth: 3, amountCents: R(3500) },
            { fromMonth: 7, toMonth: null, amountCents: R(4000) },
          ],
        },
      ],
      { termMonths: 12 },
    );
    expect(gapped.flags.map((f) => f.code)).toContain('TIER_GAP');
  });
});

describe('acceptance — communication proposal stepped pricing', () => {
  it('charges R$ 3.500 in months 1-3 and R$ 4.000 from month 4', () => {
    const result = computeProposal(
      [
        {
          id: 'comms',
          label: 'Comunicação digital',
          billingModel: 'tiered_monthly',
          monthsCovered: 12,
          tiers: [
            { fromMonth: 1, toMonth: 3, amountCents: R(3500) },
            { fromMonth: 4, toMonth: null, amountCents: R(4000) },
          ],
        },
      ],
      { termMonths: 12 },
    );
    expect(result.totals.monthlyBreakdown.slice(0, 3)).toEqual([R(3500), R(3500), R(3500)]);
    expect(result.totals.monthlyBreakdown[3]).toBe(R(4000));
    expect(result.totals.recurringTotalCents).toBe(R(3500) * 3 + R(4000) * 9);
  });
});

describe('discount authorization', () => {
  it('blocks an unapproved discount under the default 0% cap', () => {
    const result = computeProposal(
      [{ id: 'a', label: 'Branding', billingModel: 'one_time', unitAmountCents: R(10000), discountPct: 10 }],
      {},
    );
    const codes = result.flags.map((f) => f.code);
    expect(codes).toContain('DISCOUNT_OVER_CAP');
    expect(codes).toContain('DISCOUNT_NOT_APPROVED');
    expect(result.flags.some((f) => f.severity === 'block')).toBe(true);
  });

  it('records an approved override and applies it exactly', () => {
    const result = computeProposal(
      [
        {
          id: 'a',
          label: 'Branding',
          billingModel: 'one_time',
          unitAmountCents: R(10000),
          discountPct: 10,
          discountApproved: true,
        },
      ],
      {},
    );
    expect(result.totals.oneTimeCents).toBe(R(9000));
    expect(result.totals.discountValueCents).toBe(R(1000));
    expect(result.flags.find((f) => f.code === 'DISCOUNT_OVER_CAP')?.severity).toBe('warn');
  });

  it('allows a discount within an explicitly raised cap', () => {
    const result = computeProposal(
      [
        {
          id: 'a',
          label: 'Branding',
          billingModel: 'one_time',
          unitAmountCents: R(10000),
          discountPct: 5,
          discountApproved: true,
        },
      ],
      { discountAuthorizationCapPct: 10 },
    );
    expect(result.flags.map((f) => f.code)).not.toContain('DISCOUNT_OVER_CAP');
    expect(result.totals.oneTimeCents).toBe(R(9500));
  });
});

describe('tax handling', () => {
  it('produces no tax line by default', () => {
    const r = computeProposal([{ id: 'a', label: 'X', billingModel: 'one_time', unitAmountCents: R(1000) }], {});
    expect(r.totals.taxCents).toBeNull();
    expect(r.totals.clientTotalCashOutlayCents).toBe(R(1000));
  });

  it('applies tax only when explicitly configured', () => {
    const r = computeProposal(
      [{ id: 'a', label: 'X', billingModel: 'one_time', unitAmountCents: R(1000) }],
      { taxRateBasisPoints: 500 },
    );
    expect(r.totals.taxCents).toBe(R(50));
    expect(r.totals.clientTotalCashOutlayCents).toBe(R(1050));
    expect(r.flags.map((f) => f.code)).toContain('TAX_APPLIED');
  });
});
