import Link from 'next/link';
import { Shell, PageHeader } from '@/components/Shell';
import { prisma, getOrg } from '@/lib/db';
import { NewProjectForm } from './NewProjectForm';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const org = await getOrg();
  const { clientId } = await searchParams;
  const clients = await prisma.client.findMany({
    where: { orgId: org.id, deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, sector: true },
  });

  return (
    <Shell breadcrumb={<Link href="/" className="hover:underline">Painel</Link>}>
      <PageHeader
        kicker="Novo projeto"
        title="Criar projeto"
        description="O projeto conecta o questionário de discovery, a análise, a apresentação estratégica e as propostas comerciais do cliente."
      />
      {clients.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <h3 className="font-display text-lg text-ink">Cadastre um cliente primeiro</h3>
          <p className="mt-2 text-sm text-ink-mute">Todo projeto pertence a um cliente.</p>
          <Link href="/clients" className="btn-primary mt-6">Ir para clientes</Link>
        </div>
      ) : (
        <NewProjectForm clients={clients} preselected={clientId} />
      )}
    </Shell>
  );
}
