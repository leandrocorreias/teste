import { Shell, PageHeader } from '@/components/Shell';
import { prisma, getOrg } from '@/lib/db';
import { ClientsManager } from './ClientsManager';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const org = await getOrg();
  const clients = await prisma.client.findMany({
    where: { orgId: org.id, deletedAt: null },
    include: { contacts: true, projects: { where: { deletedAt: null } } },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <Shell>
      <PageHeader
        kicker="Cadastro"
        title="Clientes"
        description="Cada cliente reúne contatos, projetos e documentos. A exclusão é lógica: documentos já emitidos continuam resolvendo."
      />
      <ClientsManager
        initialClients={clients.map((c) => ({
          id: c.id,
          name: c.name,
          legalName: c.legalName,
          taxId: c.taxId,
          sector: c.sector,
          website: c.website,
          city: c.city,
          state: c.state,
          notes: c.notes,
          contacts: c.contacts.map((ct) => ({ id: ct.id, name: ct.name, role: ct.role, email: ct.email })),
          projectCount: c.projects.length,
        }))}
      />
    </Shell>
  );
}
