/**
 * Document assembly: turns approved content + computed pricing into a persisted,
 * versioned DocumentVersion with one DocumentPage row per rendered page.
 */
import { prisma } from './db';
import { type SlidePage } from './design/schema';
import { type LayoutWarning } from './design/validate';
import type { ThemeId } from './design/tokens';

export async function nextDocumentVersion(documentId: string, format: string): Promise<number> {
  const last = await prisma.documentVersion.findFirst({
    where: { documentId, format },
    orderBy: { version: 'desc' },
  });
  return (last?.version ?? 0) + 1;
}

export async function createPresentationVersion(opts: {
  orgId: string;
  projectId: string;
  title: string;
  themeId: ThemeId;
  pages: SlidePage[];
  warnings: LayoutWarning[];
  spec: Record<string, unknown>;
  format?: string;
}) {
  const document =
    (await prisma.document.findFirst({
      where: { projectId: opts.projectId, kind: 'presentation', deletedAt: null },
    })) ??
    (await prisma.document.create({
      data: {
        orgId: opts.orgId,
        projectId: opts.projectId,
        kind: 'presentation',
        title: opts.title,
        status: 'draft',
      },
    }));

  const format = opts.format ?? 'pdf';
  const version = await nextDocumentVersion(document.id, format);

  const documentVersion = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      version,
      format,
      theme: opts.themeId,
      specJson: JSON.stringify(opts.spec),
      pageCount: opts.pages.length,
      pages: {
        create: opts.pages.map((page, index) => ({
          orderIndex: index,
          layoutId: page.layoutId,
          contentJson: JSON.stringify(page),
          warningsJson: JSON.stringify(opts.warnings.filter((w) => w.pageIndex === index)),
        })),
      },
    },
    include: { pages: true },
  });

  await prisma.document.update({
    where: { id: document.id },
    data: { title: opts.title, status: 'generating', updatedAt: new Date() },
  });

  return { document, documentVersion };
}

export async function createProposalVersion(opts: {
  orgId: string;
  projectId: string;
  proposalId: string;
  title: string;
  themeId: ThemeId;
  spec: Record<string, unknown>;
  pageCount: number;
  format?: string;
}) {
  const document =
    (await prisma.document.findFirst({
      where: { proposalId: opts.proposalId, kind: 'proposal', deletedAt: null },
    })) ??
    (await prisma.document.create({
      data: {
        orgId: opts.orgId,
        projectId: opts.projectId,
        proposalId: opts.proposalId,
        kind: 'proposal',
        title: opts.title,
        status: 'draft',
      },
    }));

  const format = opts.format ?? 'pdf';
  const version = await nextDocumentVersion(document.id, format);
  const documentVersion = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      version,
      format,
      theme: opts.themeId,
      specJson: JSON.stringify(opts.spec),
      pageCount: opts.pageCount,
    },
  });

  await prisma.document.update({
    where: { id: document.id },
    data: { title: opts.title, status: 'generating', updatedAt: new Date() },
  });

  return { document, documentVersion };
}
