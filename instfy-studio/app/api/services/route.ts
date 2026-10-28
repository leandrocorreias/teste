import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, getOrg, audit } from '@/lib/db';
import { parseBRLToCents } from '@/lib/money';

const BILLING_MODELS = ['one_time', 'monthly', 'per_unit', 'percent_of_base', 'tiered_monthly', 'third_party_spend'] as const;

const serviceInput = z.object({
  code: z.string().min(2).max(40),
  name: z.string().min(3).max(160),
  category: z.string().min(2).max(60),
  summary: z.string().max(500).optional().or(z.literal('')),
  billingModel: z.enum(BILLING_MODELS),
  amount: z.string().max(40).optional().or(z.literal('')),
  percentPct: z.number().min(0).max(100).optional(),
  tiers: z
    .array(z.object({ fromMonth: z.number().int().min(1), toMonth: z.number().int().min(1).nullable(), amount: z.string() }))
    .max(8)
    .default([]),
  scope: z.array(z.string().max(300)).max(20).default([]),
  exclusions: z.array(z.string().max(300)).max(20).default([]),
  notes: z.string().max(600).optional().or(z.literal('')),
});

export async function GET() {
  const org = await getOrg();
  const services = await prisma.service.findMany({
    where: { orgId: org.id, deletedAt: null },
    include: { versions: { where: { isCurrent: true }, include: { pricingRules: true } } },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json({ services });
}

export async function POST(request: Request) {
  const org = await getOrg();
  const parsed = serviceInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 });
  }
  const d = parsed.data;
  const existing = await prisma.service.findUnique({ where: { orgId_code: { orgId: org.id, code: d.code } } });
  if (existing) return NextResponse.json({ error: `Já existe um serviço com o código ${d.code}.` }, { status: 409 });

  let amountCents: number | null = null;
  try {
    amountCents = d.amount ? parseBRLToCents(d.amount) : null;
  } catch {
    return NextResponse.json({ error: 'Valor monetário inválido.' }, { status: 400 });
  }

  const service = await prisma.service.create({
    data: {
      orgId: org.id,
      code: d.code,
      name: d.name,
      category: d.category,
      summary: d.summary || null,
      versions: {
        create: {
          version: 1,
          billingModel: d.billingModel,
          scopeJson: JSON.stringify(d.scope.filter(Boolean)),
          exclusionsJson: JSON.stringify(d.exclusions.filter(Boolean)),
          notes: d.notes || null,
          isCurrent: true,
          pricingRules: {
            create: {
              kind: d.billingModel,
              amountCents,
              percentBasisPoints: d.percentPct !== undefined ? Math.round(d.percentPct * 100) : null,
              percentOf: d.billingModel === 'percent_of_base' ? 'media_budget' : null,
              tiersJson: JSON.stringify(
                d.tiers.map((t) => ({ fromMonth: t.fromMonth, toMonth: t.toMonth, amountCents: parseBRLToCents(t.amount) })),
              ),
              label: d.billingModel,
            },
          },
        },
      },
    },
    include: { versions: { include: { pricingRules: true } } },
  });
  await audit(org.id, 'create', 'Service', service.id, { code: service.code });
  return NextResponse.json({ service }, { status: 201 });
}
