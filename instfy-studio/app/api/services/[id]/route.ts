import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, getOrg, audit } from '@/lib/db';
import { parseBRLToCents } from '@/lib/money';

const patch = z.object({
  name: z.string().min(3).max(160).optional(),
  category: z.string().min(2).max(60).optional(),
  summary: z.string().max(500).nullable().optional(),
  active: z.boolean().optional(),
  amount: z.string().max(40).optional(),
  percentPct: z.number().min(0).max(100).optional(),
  tiers: z
    .array(z.object({ fromMonth: z.number().int().min(1), toMonth: z.number().int().min(1).nullable(), amount: z.string() }))
    .max(8)
    .optional(),
  scope: z.array(z.string().max(300)).max(20).optional(),
  exclusions: z.array(z.string().max(300)).max(20).optional(),
  notes: z.string().max(600).nullable().optional(),
});

/**
 * Edits create a NEW ServiceVersion rather than mutating history, so proposals
 * already issued keep pointing at the version they were priced with.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 });
  }
  const service = await prisma.service.findFirst({
    where: { id, orgId: org.id, deletedAt: null },
    include: { versions: { where: { isCurrent: true }, include: { pricingRules: true }, take: 1 } },
  });
  if (!service) return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 });
  const current = service.versions[0];
  if (!current) return NextResponse.json({ error: 'Serviço sem versão vigente' }, { status: 500 });

  const d = parsed.data;
  await prisma.service.update({
    where: { id },
    data: {
      name: d.name ?? service.name,
      category: d.category ?? service.category,
      summary: d.summary !== undefined ? d.summary : service.summary,
      active: d.active ?? service.active,
    },
  });

  const pricingChanged = d.amount !== undefined || d.percentPct !== undefined || d.tiers !== undefined;
  const contentChanged = d.scope !== undefined || d.exclusions !== undefined || d.notes !== undefined;

  if (pricingChanged || contentChanged) {
    const rule = current.pricingRules[0];
    let amountCents = rule?.amountCents ?? null;
    try {
      if (d.amount !== undefined) amountCents = d.amount === '' ? null : parseBRLToCents(d.amount);
    } catch {
      return NextResponse.json({ error: 'Valor monetário inválido.' }, { status: 400 });
    }

    const last = await prisma.serviceVersion.findFirst({ where: { serviceId: id }, orderBy: { version: 'desc' } });
    await prisma.serviceVersion.updateMany({ where: { serviceId: id }, data: { isCurrent: false } });
    await prisma.serviceVersion.create({
      data: {
        serviceId: id,
        version: (last?.version ?? 0) + 1,
        billingModel: current.billingModel,
        scopeJson: JSON.stringify(d.scope ?? JSON.parse(current.scopeJson || '[]')),
        exclusionsJson: JSON.stringify(d.exclusions ?? JSON.parse(current.exclusionsJson || '[]')),
        notes: d.notes !== undefined ? d.notes : current.notes,
        isCurrent: true,
        pricingRules: {
          create: {
            kind: current.billingModel,
            amountCents,
            percentBasisPoints:
              d.percentPct !== undefined ? Math.round(d.percentPct * 100) : (rule?.percentBasisPoints ?? null),
            percentOf: rule?.percentOf ?? null,
            tiersJson: JSON.stringify(
              d.tiers
                ? d.tiers.map((t) => ({ fromMonth: t.fromMonth, toMonth: t.toMonth, amountCents: parseBRLToCents(t.amount) }))
                : JSON.parse(rule?.tiersJson || '[]'),
            ),
            label: rule?.label ?? current.billingModel,
          },
        },
      },
    });
  }

  await audit(org.id, 'update', 'Service', id, { pricingChanged, contentChanged });
  const updated = await prisma.service.findUnique({
    where: { id },
    include: { versions: { where: { isCurrent: true }, include: { pricingRules: true } } },
  });
  return NextResponse.json({ service: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const service = await prisma.service.findFirst({ where: { id, orgId: org.id, deletedAt: null } });
  if (!service) return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 });
  await prisma.service.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  await audit(org.id, 'soft_delete', 'Service', id, { code: service.code });
  return NextResponse.json({ ok: true });
}
