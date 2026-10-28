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
const DATASOURCE = /datasource db \{[\s\S]*?\n\}/;
const match = canonical.match(DATASOURCE);
if (!match || !match[0].includes('provider = "postgresql"')) {
  console.error(`${SOURCE} não declara um datasource postgresql. Abortando para não gerar schema inconsistente.`);
  process.exit(1);
}

// SQLite has no connection pooler, so it takes a single DATABASE_URL and no directUrl.
const derived = canonical.replace(
  DATASOURCE,
  'datasource db {\n  provider = "sqlite"\n  url      = env("DATABASE_URL")\n}',
);
writeFileSync(
  TARGET,
  `// GERADO POR scripts/schema-sqlite.mjs — NÃO EDITE.\n// Fonte: ${SOURCE}. Única diferença permitida: o provider do datasource.\n${derived}`,
);
console.log(`${TARGET} gerado a partir de ${SOURCE}.`);
