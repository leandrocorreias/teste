import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';
import { seedDatabase } from '@/lib/seed-core';

export const maxDuration = 60;

function secretMatches(provided: string | null): boolean {
  const expected = process.env.BOOTSTRAP_SECRET?.trim();
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Compare in constant time, and only when lengths match (timingSafeEqual throws otherwise).
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Initialises a database: applies the seed (organization, sample catalog, demo
 * clients). Idempotent — every write is an upsert.
 *
 * Authorisation has two modes:
 *  - An EMPTY database (no Organization row) may be seeded without a secret.
 *    There is nothing to read or destroy yet, and on a hosted deployment the
 *    whole app already sits behind the platform's access protection. This is
 *    what lets the first-run screen initialise itself from the browser.
 *  - A database that already holds an organization requires BOOTSTRAP_SECRET,
 *    so re-seeding over live data is never a single unauthenticated request.
 */
export async function POST(request: Request) {
  const alreadyInitialised = (await prisma.organization.count()) > 0;

  if (alreadyInitialised) {
    if (!process.env.BOOTSTRAP_SECRET?.trim()) {
      return NextResponse.json(
        { error: 'Banco já inicializado. Re-semear exige BOOTSTRAP_SECRET configurado.' },
        { status: 403 },
      );
    }
    if (!secretMatches(request.headers.get('x-bootstrap-secret'))) {
      return NextResponse.json({ error: 'Segredo de bootstrap inválido.' }, { status: 401 });
    }
  }

  try {
    const result = await seedDatabase();
    const counts = {
      organizations: await prisma.organization.count(),
      services: await prisma.service.count(),
      clients: await prisma.client.count(),
      projects: await prisma.project.count(),
      layouts: await prisma.layoutTemplate.count(),
    };
    return NextResponse.json({ seeded: result, counts });
  } catch (error) {
    return NextResponse.json(
      { error: `Falha no bootstrap: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
