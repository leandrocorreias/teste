/**
 * Derives the SQLite schema from the canonical Postgres one.
 *
 * Postgres is canonical because that is what the hosted deployment runs. This
 * script exists so local development can still use a file database without the
 * two schemas drifting: the only difference allowed is the datasource provider.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'prisma/schema.prisma';
const TARGET = 'prisma/schema.sqlite.prisma';

const canonical = readFileSync(SOURCE, 'utf8');
if (!canonical.includes('provider = "postgresql"')) {
  console.error(`${SOURCE} não declara o provider postgresql. Abortando para não gerar schema inconsistente.`);
  process.exit(1);
}

const derived = canonical.replace('provider = "postgresql"', 'provider = "sqlite"');
writeFileSync(
  TARGET,
  `// GERADO POR scripts/schema-sqlite.mjs — NÃO EDITE.\n// Fonte: ${SOURCE}. Única diferença permitida: o provider do datasource.\n${derived}`,
);
console.log(`${TARGET} gerado a partir de ${SOURCE}.`);
