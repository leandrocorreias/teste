import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, getOrg, audit } from '@/lib/db';
import { parseBRLToCents } from '@/lib/money';
import { buildProposalSpec } from '@/lib/proposal-spec';
import { buildImplantationSchedule, blockingFlags } from '@/lib/pricing';

const BILLING_MODELS = ['one_time', 'monthly', 'per_unit', 'percent_of_base', 'tiered_monthly', 'third_party_spend'] as const;

const itemInput = z.object({
  id: z.string().optional(),
  serviceVersionId: z.string().nullable().optional(),
  label: z.string().min(2).max(160),
  description: z.string().max(600).nullable().optional(),
  billingModel: z.enum(BILLING_MODELS),
  quantity: z.number().int().min(0).max(999).default(1),
  unitAmount: z.string().max(40).default('0'),
  percentPct: z.number().min(0).max(100).nullable().optional(),
  percentBase: z.string().max(40).nullable().optional(),
  tiers: z
    .array(z.object({ fromMonth: z.number().int().min(1), toMonth: z.number().int().min(1).nullable(), amount: z.string(), label: z.string().max(80).optional() }))
    .max(8)
    .default([]),
  monthsCovered: z.number().int().min(1).max(60).nullable().optional(),
  bonified: z.boolean().default(false),
  discountPct: z.number().min(0).max(100).default(0),
  discountApproved: z.boolean().default(false),
  discountApprovedBy: z.string().max(120).nullable().optional(),
  isThirdPartySpend: z.boolean().default(false),
  scope: z.array(z.string().max(400)).max(24).default([]),
  exclusions: z.array(z.string().max(400)).max(24).default([]),
});

const patchProposal = z.object({
  title: z.string().min(3).max(200).optional(),
  termMonths: z.number().int().min(1).max(60).optional(),
  taxRatePct: z.number().min(0).max(100).nullable().optional(),
  preparedFor: z.array(z.string().max(120)).max(6).optional(),
  conditions: z.array(z.string().max(800)).max(20).optional(),
  items: z.array(itemInput).max(30).optional(),
  status: z.enum(['draft', 'review', 'approved', 'sent']).optional(),
  regenerateSchedule: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { spec, pricing } = await buildProposalSpec(id);
    return NextResponse.json({ spec, totals: pricing.totals, flags: pricing.flags });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 404 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const parsed = patchProposal.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `${parsed.error.issues[0]?.path.join('.')}: ${parsed.error.issues[0]?.message}` },
      { status: 400 },
    );
  }
  const proposal = await prisma.proposal.findFirst({ where: { id, deletedAt: null } });
  if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });

  const d = parsed.data;

  if (d.items) {
    // Replace the item set atomically so ordering and ids stay consistent.
    try {
      await prisma.$transaction([
        prisma.proposalItem.deleteMany({ where: { proposalId: id } }),
        ...d.items.map((item, index) =>
          prisma.proposalItem.create({
            data: {
              proposalId: id,
              serviceVersionId: item.serviceVersionId || null,
              orderIndex: index,
              label: item.label,
              description: item.description ?? null,
              billingModel: item.billingModel,
              quantity: item.quantity,
              unitAmountCents: parseBRLToCents(item.unitAmount || '0'),
              percentBasisPoints: item.percentPct != null ? Math.round(item.percentPct * 100) : null,
              percentBaseCents: item.percentBase ? parseBRLToCents(item.percentBase) : null,
              tiersJson: JSON.stringify(
                item.tiers.map((t) => ({
                  fromMonth: t.fromMonth,
                  toMonth: t.toMonth,
                  amountCents: parseBRLToCents(t.amount || '0'),
                  label: t.label,
                })),
              ),
              monthsCovered: item.monthsCovered ?? null,
              bonified: item.bonified,
              discountPct: Math.round(item.discountPct),
              discountApproved: item.discountApproved,
              discountApprovedBy: item.discountApprovedBy ?? null,
              isThirdPartySpend: item.isThirdPartySpend || item.billingModel === 'third_party_spend',
              scopeJson: JSON.stringify(item.scope.filter(Boolean)),
              exclusionsJson: JSON.stringify(item.exclusions.filter(Boolean)),
            },
          }),
        ),
      ]);
    } catch (error) {
      return NextResponse.json(
        { error: `Falha ao salvar itens: ${error instanceof Error ? error.message : String(error)}` },
        { status: 400 },
      );
    }
  }

  await prisma.proposal.update({
    where: { id },
    data: {
      title: d.title ?? proposal.title,
      termMonths: d.termMonths ?? proposal.termMonths,
      taxRateBasisPoints:
        d.taxRatePct === undefined
          ? proposal.taxRateBasisPoints
          : d.taxRatePct === null
            ? null
            : Math.round(d.taxRatePct * 100),
      preparedForJson: d.preparedFor ? JSON.stringify(d.preparedFor) : proposal.preparedForJson,
      conditionsJson: d.conditions ? JSON.stringify(d.conditions) : proposal.conditionsJson,
      status: d.status ?? proposal.status,
    },
  });

  // Recompute, snapshot the prices, and refresh the implantation schedule.
  const { pricing } = await buildProposalSpec(id);

  for (const item of pricing.items) {
    await prisma.proposalItem.update({
      where: { id: item.id },
      data: { priceSnapshot: JSON.stringify(item) },
    });
  }

  if (d.items || d.regenerateSchedule) {
    await prisma.paymentSchedule.deleteMany({ where: { proposalId: id } });
    const lines = buildImplantationSchedule(pricing.totals.oneTimeCents);
    if (pricing.totals.oneTimeCents > 0) {
      await prisma.paymentSchedule.createMany({
        data: lines.map((l, i) => ({ proposalId: id, orderIndex: i, label: l.label, dueRule: l.dueRule, amountCents: l.amountCents })),
      });
    }
  }

  await prisma.proposal.update({
    where: { id },
    data: {
      totalsSnapshot: JSON.stringify({ ...pricing.totals, engineVersion: pricing.computedAtVersion, computedAt: new Date().toISOString() }),
    },
  });

  if (d.status === 'approved') {
    const blocking = blockingFlags(pricing.flags);
    if (blocking.length > 0) {
      await prisma.proposal.update({ where: { id }, data: { status: 'draft' } });
      return NextResponse.json(
        { error: `Não é possível aprovar: ${blocking.map((f) => f.message).join(' ')}`, flags: pricing.flags },
        { status: 409 },
      );
    }
    await prisma.approval.create({
      data: { proposalId: id, subject: `Proposta v${proposal.version}`, decision: 'approved', note: 'Condições comerciais aprovadas no Studio.' },
    });
  }

  await audit(org.id, 'update', 'Proposal', id, { items: d.items?.length, status: d.status });
  const refreshed = await buildProposalSpec(id);
  return NextResponse.json({ spec: refreshed.spec, totals: refreshed.pricing.totals, flags: refreshed.pricing.flags });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const proposal = await prisma.proposal.findFirst({ where: { id, deletedAt: null } });
  if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });
  await prisma.proposal.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(org.id, 'soft_delete', 'Proposal', id, { version: proposal.version });
  return NextResponse.json({ ok: true });
}
