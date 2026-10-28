import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shell, PageHeader } from '@/components/Shell';
import { ProjectTabs } from '@/components/ProjectTabs';
import { prisma, getOrg } from '@/lib/db';
import { ProposalStudio } from './ProposalStudio';
import { centsToBRL } from '@/lib/money';
import { pdfEngine } from '@/lib/pdf-engine';

export const dynamic = 'force-dynamic';

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, orgId: org.id, deletedAt: null },
    include: { client: { include: { contacts: true } } },
  });
  if (!project) notFound();

  const [proposals, services, capSetting] = await Promise.all([
    prisma.proposal.findMany({
      where: { projectId: id, deletedAt: null },
      orderBy: { version: 'desc' },
      include: {
        items: { orderBy: { orderIndex: 'asc' } },
        documents: { include: { versions: { orderBy: { version: 'desc' } } } },
      },
    }),
    prisma.service.findMany({
      where: { orgId: org.id, deletedAt: null, active: true },
      include: { versions: { where: { isCurrent: true }, include: { pricingRules: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.orgSetting.findUnique({ where: { orgId_key: { orgId: org.id, key: 'discount_authorization_cap_pct' } } }),
  ]);

  const catalog = services
    .map((s) => {
      const version = s.versions[0];
      const rule = version?.pricingRules[0];
      if (!version) return null;
      return {
        serviceId: s.id,
        serviceVersionId: version.id,
        code: s.code,
        name: s.name,
        category: s.category,
        summary: s.summary,
        billingModel: version.billingModel,
        amount: rule?.amountCents != null ? centsToBRL(rule.amountCents, { symbol: false }) : '0,00',
        percentPct: rule?.percentBasisPoints != null ? rule.percentBasisPoints / 100 : null,
        tiers: (JSON.parse(rule?.tiersJson || '[]') as Array<{ fromMonth: number; toMonth: number | null; amountCents: number; label?: string }>).map((t) => ({
          fromMonth: t.fromMonth,
          toMonth: t.toMonth,
          amount: centsToBRL(t.amountCents, { symbol: false }),
          label: t.label,
        })),
        scope: JSON.parse(version.scopeJson || '[]') as string[],
        exclusions: JSON.parse(version.exclusionsJson || '[]') as string[],
        notes: version.notes,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <Shell breadcrumb={<><Link href="/" className="hover:underline">Painel</Link> / {project.client.name} / {project.name}</>}>
      <PageHeader
        kicker="Proposta comercial"
        title="Escopo, condições e emissão"
        description="Todos os valores são calculados pelo motor determinístico em centavos inteiros. A IA redige o enquadramento estratégico e nunca define preço, desconto ou prazo de pagamento."
      />
      <ProjectTabs projectId={id} active="proposal" />
      <ProposalStudio
        projectId={id}
        pdfEngine={pdfEngine()}
        discountCapPct={Number(capSetting?.value ?? '0') || 0}
        catalog={catalog}
        proposals={proposals.map((p) => ({
          id: p.id,
          version: p.version,
          title: p.title,
          status: p.status,
          termMonths: p.termMonths,
          taxRatePct: p.taxRateBasisPoints == null ? null : p.taxRateBasisPoints / 100,
          aiCopyStatus: p.aiCopyStatus,
          conditions: JSON.parse(p.conditionsJson || '[]') as string[],
          narrative: JSON.parse(p.narrativeJson || '{}'),
          items: p.items.map((i) => ({
            serviceVersionId: i.serviceVersionId,
            label: i.label,
            description: i.description,
            billingModel: i.billingModel,
            quantity: i.quantity,
            unitAmount: centsToBRL(i.unitAmountCents, { symbol: false }),
            percentPct: i.percentBasisPoints == null ? null : i.percentBasisPoints / 100,
            percentBase: i.percentBaseCents == null ? null : centsToBRL(i.percentBaseCents, { symbol: false }),
            tiers: (JSON.parse(i.tiersJson || '[]') as Array<{ fromMonth: number; toMonth: number | null; amountCents: number; label?: string }>).map((t) => ({
              fromMonth: t.fromMonth,
              toMonth: t.toMonth,
              amount: centsToBRL(t.amountCents, { symbol: false }),
              label: t.label,
            })),
            monthsCovered: i.monthsCovered,
            bonified: i.bonified,
            discountPct: i.discountPct,
            discountApproved: i.discountApproved,
            isThirdPartySpend: i.isThirdPartySpend,
            scope: JSON.parse(i.scopeJson || '[]') as string[],
            exclusions: JSON.parse(i.exclusionsJson || '[]') as string[],
          })),
          documents: p.documents.flatMap((d) =>
            d.versions.map((v) => ({
              id: v.id,
              version: v.version,
              pageCount: v.pageCount,
              fileBytes: v.fileBytes,
              hasFile: Boolean(v.filePath),
              createdAt: v.createdAt.toISOString(),
            })),
          ),
        }))}
      />
    </Shell>
  );
}
