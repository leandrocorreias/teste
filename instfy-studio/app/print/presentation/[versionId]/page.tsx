import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { slidePage, type SlidePage } from '@/lib/design/schema';
import { resolveTokens, tokensToCssVars, type ThemeId } from '@/lib/design/tokens';
import { SlideRenderer } from '@/components/slides';

export const dynamic = 'force-dynamic';

export default async function PrintPresentation({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: { pages: { orderBy: { orderIndex: 'asc' } }, document: { include: { project: { include: { client: true } } } } },
  });
  if (!version) notFound();

  const spec = JSON.parse(version.specJson || '{}') as { clientName?: string; themeId?: ThemeId };
  const tokens = resolveTokens((version.theme as ThemeId) ?? 'instfy-light');
  const cssVars = tokensToCssVars(tokens);

  const pages: SlidePage[] = [];
  for (const row of version.pages) {
    const parsed = slidePage.safeParse(JSON.parse(row.contentJson));
    if (parsed.success) pages.push(parsed.data);
  }

  const clientName = spec.clientName ?? version.document.project?.client.name ?? 'Cliente';

  return (
    <div
      data-print-ready="true"
      style={{
        ...(cssVars as Record<string, string>),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#ffffff',
      }}
    >
      {pages.map((page, i) => (
        <div
          key={i}
          style={{
            breakAfter: i === pages.length - 1 ? 'auto' : 'page',
            pageBreakAfter: i === pages.length - 1 ? 'auto' : 'always',
          }}
        >
          <SlideRenderer
            page={page}
            ctx={{ pageNumber: i + 1, totalPages: pages.length, clientName, footerLine: 'Instfy Brasil Ltda · instfy.com' }}
          />
        </div>
      ))}
    </div>
  );
}
