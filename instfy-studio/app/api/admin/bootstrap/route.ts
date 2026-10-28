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
 * One-off initialisation of a hosted database: applies the seed (organization,
 * sample catalog, demo clients). Idempotent — every write is an upsert.
 *
 * Guarded by BOOTSTRAP_SECRET. With the variable unset the route is disabled,
 * so a deployment that forgot to configure it cannot be seeded by a stranger.
 */
export async function POST(request: Request) {
  if (!process.env.BOOTSTRAP_SECRET?.trim()) {
    return NextResponse.json({ error: 'Bootstrap desabilitado: BOOTSTRAP_SECRET não está configurado.' }, { status: 403 });
  }
  if (!secretMatches(request.headers.get('x-bootstrap-secret'))) {
    return NextResponse.json({ error: 'Segredo de bootstrap inválido.' }, { status: 401 });
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
