/** CLI entry point for the seed. See lib/seed-core.ts for the logic. */
import { prisma } from '../lib/db';
import { seedDatabase } from '../lib/seed-core';

seedDatabase()
  .then((r) => {
    console.log(`Seed concluído: ${r.services} serviços, ${r.clients} clientes de demonstração, ${r.layouts} layouts.`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
