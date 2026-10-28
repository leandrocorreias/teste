import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/** Single-tenant local MVP: one organization row, resolved once. */
export async function getOrg() {
  const org = await prisma.organization.findFirst({ where: { deletedAt: null } });
  if (!org) throw new Error('Organização não encontrada. Rode `npm run db:seed`.');
  return org;
}

export async function audit(
  orgId: string,
  action: string,
  entity: string,
  entityId?: string,
  meta: Record<string, unknown> = {},
) {
  await prisma.auditLog.create({
    data: { orgId, action, entity, entityId, metaJson: JSON.stringify(meta) },
  });
}
