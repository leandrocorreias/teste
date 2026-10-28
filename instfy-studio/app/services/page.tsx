import { Shell, PageHeader } from '@/components/Shell';
import { prisma, getOrg } from '@/lib/db';
import { centsToBRL } from '@/lib/money';
import { ServicesManager } from './ServicesManager';

export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
  const org = await getOrg();
  const services = await prisma.service.findMany({
    where: { orgId: org.id, deletedAt: null },
    include: { versions: { orderBy: { version: 'desc' }, include: { pricingRules: true } } },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  return (
    <Shell>
      <PageHeader
        kicker="Catálogo"
        title="Serviços, escopo e precificação"
        description="Os valores aqui são exemplos extraídos de propostas anteriores da Instfy, não uma tabela de preços universal. Cada edição de preço ou escopo cria uma nova versão do serviço, preservando as propostas já emitidas."
      />
      <ServicesManager
        services={services.map((s) => {
          const current = s.versions.find((v) => v.isCurrent) ?? s.versions[0];
          const rule = current?.pricingRules[0];
          return {
            id: s.id,
            code: s.code,
            name: s.name,
            category: s.category,
            summary: s.summary,
            active: s.active,
            versionCount: s.versions.length,
            currentVersion: current?.version ?? 1,
            billingModel: current?.billingModel ?? 'one_time',
            amount: rule?.amountCents != null ? centsToBRL(rule.amountCents, { symbol: false }) : '',
            percentPct: rule?.percentBasisPoints != null ? rule.percentBasisPoints / 100 : null,
            tiers: (JSON.parse(rule?.tiersJson || '[]') as Array<{ fromMonth: number; toMonth: number | null; amountCents: number }>).map((t) => ({
              fromMonth: t.fromMonth,
              toMonth: t.toMonth,
              amount: centsToBRL(t.amountCents, { symbol: false }),
            })),
            scope: JSON.parse(current?.scopeJson || '[]') as string[],
            exclusions: JSON.parse(current?.exclusionsJson || '[]') as string[],
            notes: current?.notes ?? null,
          };
        })}
      />
    </Shell>
  );
}
