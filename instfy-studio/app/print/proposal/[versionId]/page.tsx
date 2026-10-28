import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { resolveTokens, tokensToCssVars, type ThemeId } from '@/lib/design/tokens';
import { ProposalDocument } from '@/components/proposal-doc';
import { PrintToolbar } from '@/components/PrintToolbar';
import { pdfEngine } from '@/lib/pdf-engine';
import type { ProposalSpec } from '@/lib/proposal-spec';

export const dynamic = 'force-dynamic';

export default async function PrintProposal({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const version = await prisma.documentVersion.findUnique({ where: { id: versionId } });
  if (!version) notFound();

  // The document renders from the SNAPSHOT taken at generation time, not from
  // live pricing, so a stored PDF and its on-screen version always agree.
  const spec = JSON.parse(version.specJson || '{}') as ProposalSpec;
  if (!spec.proposalId) notFound();

  const tokens = resolveTokens((version.theme as ThemeId) ?? 'instfy-light');
  const cssVars = tokensToCssVars(tokens);

  return (
    <>
      {pdfEngine() === 'browser' && (
        <PrintToolbar label="Proposta comercial" hint="Use retrato A4 e desmarque cabeçalhos e rodapés do navegador." />
      )}
      <div data-print-ready="true" style={{ ...(cssVars as Record<string, string>), background: '#ffffff' }}>
        <ProposalDocument spec={spec} />
      </div>
    </>
  );
}
