/**
 * Builds the printable proposal spec from the database.
 *
 * Pricing is recomputed from stored item rows by the deterministic engine and
 * then SNAPSHOTTED onto the proposal, so a document version always shows the
 * numbers that were approved when it was generated.
 */
import { prisma } from './db';
import { computeProposal, buildImplantationSchedule, type PricingItemInput, type PricingResult } from './pricing';
import { centsToBRL, centsToBRLCompact } from './money';

export interface ProposalScopeBlock {
  label: string;
  priceLabel: string;
  priceNote?: string;
  summary?: string;
  scope: string[];
  exclusions: string[];
}

export interface ProposalSpec {
  proposalId: string;
  version: number;
  title: string;
  clientName: string;
  preparedFor: string[];
  issuedAtLabel: string;
  validUntilLabel: string | null;
  termMonths: number;
  orgLegalName: string;
  orgTaxId: string;
  orgWebsite: string;
  narrative: {
    headline?: string;
    openingParagraphs: string[];
    valuePillars: Array<{ heading: string; text: string }>;
    closingNote?: string;
    aiCopyStatus: string;
  };
  stages: Array<{
    label: string;
    description?: string;
    priceLabel: string;
    priceNote: string;
    bonified: boolean;
  }>;
  headline: {
    oneTimeLabel: string;
    recurringFirstLabel: string;
    firstMonthDueLabel: string;
    recurringNote: string;
  };
  financial: {
    instfyFeesLabel: string;
    thirdPartySpendLabel: string;
    clientTotalLabel: string;
    bonifiedLabel: string;
    discountLabel: string;
    taxLabel: string | null;
    monthly: Array<{ month: number; instfyLabel: string; thirdPartyLabel: string }>;
  };
  schedule: Array<{ label: string; dueRule: string; amountLabel: string }>;
  conditions: string[];
  scopeBlocks: ProposalScopeBlock[];
  flags: PricingResult['flags'];
  demoMode: boolean;
}

function dateLabel(d: Date | null | undefined): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(d);
}

export function itemsToPricingInput(
  items: Array<{
    id: string;
    label: string;
    billingModel: string;
    quantity: number;
    unitAmountCents: number;
    percentBasisPoints: number | null;
    percentBaseCents: number | null;
    tiersJson: string;
    monthsCovered: number | null;
    bonified: boolean;
    discountPct: number;
    discountApproved: boolean;
    isThirdPartySpend: boolean;
  }>,
): PricingItemInput[] {
  return items.map((i) => ({
    id: i.id,
    label: i.label,
    billingModel: i.billingModel as PricingItemInput['billingModel'],
    quantity: i.quantity,
    unitAmountCents: i.unitAmountCents,
    percentBasisPoints: i.percentBasisPoints ?? undefined,
    percentBaseCents: i.percentBaseCents ?? undefined,
    tiers: JSON.parse(i.tiersJson || '[]'),
    monthsCovered: i.monthsCovered ?? undefined,
    bonified: i.bonified,
    discountPct: i.discountPct,
    discountApproved: i.discountApproved,
    isThirdPartySpend: i.isThirdPartySpend,
  }));
}

function priceLabelFor(
  item: { billingModel: string; bonified: boolean; percentBasisPoints: number | null; tiersJson: string },
  computed: PricingResult['items'][number],
): { priceLabel: string; priceNote: string } {
  if (item.bonified) {
    return { priceLabel: centsToBRLCompact(computed.listOneTimeCents || computed.listRecurringTotalCents), priceNote: 'BONIFICADO' };
  }
  switch (item.billingModel) {
    case 'one_time':
    case 'per_unit':
      return {
        priceLabel: computed.oneTimeCents === 0 ? 'Incluso' : centsToBRLCompact(computed.oneTimeCents),
        priceNote: computed.oneTimeCents === 0 ? 'no projeto' : 'etapa única',
      };
    case 'monthly':
      return { priceLabel: centsToBRLCompact(computed.monthlyFirstCents), priceNote: 'por mês' };
    case 'tiered_monthly': {
      const tiers: Array<{ fromMonth: number; toMonth: number | null; amountCents: number }> = JSON.parse(item.tiersJson || '[]');
      const sorted = [...tiers].sort((a, b) => a.fromMonth - b.fromMonth);
      const first = sorted[0];
      const rest = sorted
        .slice(1)
        .map((t) => `${centsToBRLCompact(t.amountCents)} ${t.toMonth ? `nos meses ${t.fromMonth} a ${t.toMonth}` : `do mês ${t.fromMonth} em diante`}`)
        .join(' · ');
      return {
        priceLabel: first ? centsToBRLCompact(first.amountCents) : '—',
        priceNote: first
          ? `por mês, ${first.toMonth ? `meses ${first.fromMonth} a ${first.toMonth}` : `a partir do mês ${first.fromMonth}`}${rest ? ` · ${rest}` : ''}`
          : 'faixas não definidas',
      };
    }
    case 'percent_of_base': {
      const pct = (item.percentBasisPoints ?? 0) / 100;
      const hasBase = computed.monthlyFirstCents > 0;
      return {
        priceLabel: `${pct.toLocaleString('pt-BR')}%`,
        priceNote: hasBase
          ? `da verba de mídia · ${centsToBRLCompact(computed.monthlyFirstCents)}/mês na verba informada`
          : 'da verba de mídia · verba não informada',
      };
    }
    case 'third_party_spend':
      return {
        priceLabel: computed.monthlyFirstCents > 0 ? centsToBRLCompact(computed.monthlyFirstCents) : 'A definir',
        priceNote: 'por mês, pago às plataformas pelo cliente',
      };
    default:
      return { priceLabel: '—', priceNote: '' };
  }
}

export async function buildProposalSpec(proposalId: string): Promise<{ spec: ProposalSpec; pricing: PricingResult }> {
  const proposal = await prisma.proposal.findUniqueOrThrow({
    where: { id: proposalId },
    include: {
      items: { orderBy: { orderIndex: 'asc' } },
      schedules: { orderBy: { orderIndex: 'asc' } },
      project: { include: { client: { include: { contacts: true } }, org: true } },
    },
  });

  const org = proposal.project.org;
  const capSetting = await prisma.orgSetting.findUnique({
    where: { orgId_key: { orgId: org.id, key: 'discount_authorization_cap_pct' } },
  });

  const pricing = computeProposal(itemsToPricingInput(proposal.items), {
    termMonths: proposal.termMonths,
    taxRateBasisPoints: proposal.taxRateBasisPoints,
    discountAuthorizationCapPct: Number(capSetting?.value ?? '0') || 0,
    instalmentWeights: [4000, 3000, 3000],
  });

  const computedById = new Map(pricing.items.map((i) => [i.id, i]));

  const stages = proposal.items.map((item) => {
    const computed = computedById.get(item.id)!;
    const { priceLabel, priceNote } = priceLabelFor(item, computed);
    return { label: item.label, description: item.description ?? undefined, priceLabel, priceNote, bonified: item.bonified };
  });

  const scopeBlocks: ProposalScopeBlock[] = proposal.items.map((item) => {
    const computed = computedById.get(item.id)!;
    const { priceLabel, priceNote } = priceLabelFor(item, computed);
    return {
      label: item.label,
      priceLabel,
      priceNote,
      summary: item.description ?? undefined,
      scope: JSON.parse(item.scopeJson || '[]'),
      exclusions: JSON.parse(item.exclusionsJson || '[]'),
    };
  });

  const schedule =
    proposal.schedules.length > 0
      ? proposal.schedules.map((s) => ({ label: s.label, dueRule: s.dueRule, amountLabel: centsToBRL(s.amountCents) }))
      : buildImplantationSchedule(pricing.totals.oneTimeCents).map((s) => ({
          label: s.label,
          dueRule: s.dueRule,
          amountLabel: centsToBRL(s.amountCents),
        }));

  const narrative = JSON.parse(proposal.narrativeJson || '{}') as ProposalSpec['narrative'];
  const preparedFor =
    (JSON.parse(proposal.preparedForJson || '[]') as string[]).length > 0
      ? (JSON.parse(proposal.preparedForJson) as string[])
      : proposal.project.client.contacts.map((c) => `${c.name}${c.role ? ` · ${c.role}` : ''}`);

  const recurringTiers = proposal.items
    .filter((i) => i.billingModel === 'tiered_monthly' && !i.isThirdPartySpend)
    .flatMap((i) => JSON.parse(i.tiersJson || '[]') as Array<{ fromMonth: number; toMonth: number | null; amountCents: number }>);

  const recurringNote =
    recurringTiers.length > 0
      ? recurringTiers
          .map((t) => `${centsToBRLCompact(t.amountCents)} ${t.toMonth ? `do mês ${t.fromMonth} ao ${t.toMonth}` : `do mês ${t.fromMonth} em diante`}`)
          .join(' · ')
      : `${centsToBRLCompact(pricing.totals.recurringFirstMonthCents)} por mês durante ${proposal.termMonths} meses`;

  const spec: ProposalSpec = {
    proposalId: proposal.id,
    version: proposal.version,
    title: proposal.title,
    clientName: proposal.project.client.name,
    preparedFor,
    issuedAtLabel: dateLabel(proposal.issuedAt ?? proposal.createdAt) ?? '—',
    validUntilLabel: dateLabel(proposal.validUntil),
    termMonths: proposal.termMonths,
    orgLegalName: org.legalName ?? org.name,
    orgTaxId: org.taxId ?? '—',
    orgWebsite: org.website ?? '',
    narrative: {
      headline: narrative.headline,
      openingParagraphs: narrative.openingParagraphs ?? [],
      valuePillars: narrative.valuePillars ?? [],
      closingNote: narrative.closingNote,
      aiCopyStatus: proposal.aiCopyStatus,
    },
    stages,
    headline: {
      oneTimeLabel: centsToBRLCompact(pricing.totals.oneTimeCents),
      recurringFirstLabel: centsToBRLCompact(pricing.totals.recurringFirstMonthCents),
      firstMonthDueLabel: centsToBRLCompact(pricing.totals.firstMonthDueCents),
      recurringNote,
    },
    financial: {
      instfyFeesLabel: centsToBRL(pricing.totals.instfyFeesCents),
      thirdPartySpendLabel: centsToBRL(pricing.totals.thirdPartySpendCents),
      clientTotalLabel: centsToBRL(pricing.totals.clientTotalCashOutlayCents),
      bonifiedLabel: centsToBRL(pricing.totals.bonifiedValueCents),
      discountLabel: centsToBRL(pricing.totals.discountValueCents),
      taxLabel: pricing.totals.taxCents === null ? null : centsToBRL(pricing.totals.taxCents),
      monthly: pricing.totals.monthlyBreakdown.map((cents, i) => ({
        month: i + 1,
        instfyLabel: centsToBRL(cents),
        thirdPartyLabel: centsToBRL(pricing.totals.thirdPartyMonthlyBreakdown[i] ?? 0),
      })),
    },
    schedule,
    conditions: JSON.parse(proposal.conditionsJson || '[]'),
    scopeBlocks,
    flags: pricing.flags,
    demoMode: proposal.aiCopyStatus === 'demo',
  };

  return { spec, pricing };
}

export const DEFAULT_CONDITIONS = [
  'A Instfy executa os serviços descritos, acompanha as entregas e apresenta os resultados. O cliente indica um responsável pelas aprovações e fornece informações, materiais e acessos.',
  'Até duas rodadas consolidadas de revisão por etapa. Alterações estruturais de escopo, integrações não previstas e novas funcionalidades dependem de orçamento e aprovação específicos.',
  'Domínio, hospedagem, ferramentas licenciadas, APIs pagas, infraestrutura em nuvem e demais despesas de terceiros não estão incluídos, salvo contratação expressa.',
  'Os ativos finais produzidos para o cliente são cedidos após a quitação integral, preservados os direitos de tecnologias de terceiros. Dados tratados com confidencialidade e observância da LGPD.',
  'Não há garantia de posicionamento em buscadores, menções em respostas de IA, volume de leads ou faturamento, pois dependem de fatores externos e da operação comercial do cliente.',
  'A verba de mídia é definida e aprovada previamente pelo cliente e paga diretamente às plataformas, preferencialmente em contas de titularidade do cliente.',
];
