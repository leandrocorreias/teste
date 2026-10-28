/**
 * Proposal document renderer: A4 pages with running headers/footers, stable
 * page breaks, scope, financial breakdown, terms and acceptance.
 */
import type { ReactNode } from 'react';
import type { ProposalSpec } from '@/lib/proposal-spec';
import { InstfyLockup, InstfyMark } from './InstfyMark';

function Page({ children, index, total, spec }: { children: ReactNode; index: number; total: number; spec: ProposalSpec }) {
  return (
    <section
      className="instfy-page"
      style={{
        width: 794,
        minHeight: 1123,
        background: 'var(--c-bg)',
        color: 'var(--c-ink)',
        fontFamily: 'var(--f-sans)',
        padding: '46px 54px 58px',
        boxSizing: 'border-box',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        breakAfter: index === total - 1 ? 'auto' : 'page',
        pageBreakAfter: index === total - 1 ? 'auto' : 'always',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 }}>
        <div>
          <InstfyLockup size={20} />
          <div style={{ marginTop: 7, fontSize: 8.5, color: 'var(--c-ink-mute)', letterSpacing: '0.02em' }}>
            {spec.orgLegalName} · CNPJ {spec.orgTaxId}
            {spec.orgWebsite ? ` · ${spec.orgWebsite}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--c-ink-mute)', fontWeight: 700 }}>
            Proposta comercial
          </div>
          <div style={{ marginTop: 5, fontSize: 9, color: 'var(--c-ink-mute)' }}>Emissão {spec.issuedAtLabel}</div>
          {spec.validUntilLabel && (
            <div style={{ fontSize: 9, color: 'var(--c-ink-mute)' }}>Validade até {spec.validUntilLabel}</div>
          )}
        </div>
      </header>
      <div style={{ flex: 1 }}>{children}</div>
      <footer
        style={{
          marginTop: 26,
          paddingTop: 10,
          borderTop: '1px solid var(--c-rule)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 8.5,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--c-ink-mute)',
        }}
      >
        <span>
          Instfy × {spec.clientName} · versão {spec.version}
        </span>
        <span>
          {index + 1}/{total}
        </span>
      </footer>
    </section>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 18, height: 3, background: 'var(--c-accent)', borderRadius: 2 }} />
        <span style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--c-ink-mute)' }}>
          {kicker}
        </span>
      </div>
      <h2 style={{ margin: '12px 0 0', fontFamily: 'var(--f-display)', fontSize: 23, fontWeight: 500, letterSpacing: '-0.02em' }}>
        {title}
      </h2>
    </div>
  );
}

function HeadlineBox({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 8.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--c-accent)', fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ marginTop: 7, fontFamily: 'var(--f-display)', fontSize: 25, fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--c-chapter-ink)' }}>
        {value}
      </div>
      {note && <div style={{ marginTop: 5, fontSize: 9, color: 'var(--c-chapter-ink)', opacity: 0.68, lineHeight: 1.45 }}>{note}</div>}
    </div>
  );
}

export function ProposalDocument({ spec }: { spec: ProposalSpec }) {
  const blocking = spec.flags.filter((f) => f.severity === 'block');
  const pages: ReactNode[] = [];

  /*
   * Page-1 budget.
   *
   * A4 holds a finite amount. Rather than let the opening page spill onto a
   * stray sheet, we estimate its content and move the stage table (plus the
   * headline figures) to a page of its own once the opener gets heavy.
   */
  const openerChars =
    (spec.narrative.headline ?? spec.title).length +
    spec.narrative.openingParagraphs.join(' ').length +
    spec.narrative.valuePillars.reduce((n, v) => n + v.heading.length + v.text.length, 0);
  const stageWeight = spec.stages.reduce((n, st) => n + st.label.length + (st.description?.length ?? 0), 0);
  const splitOpener =
    openerChars + stageWeight > 1500 ||
    spec.stages.length > 5 ||
    spec.demoMode ||
    blocking.length > 0;

  const stageTable = (
    <>
      <SectionTitle kicker="Escopo dos serviços e investimento" title="As etapas do projeto" />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {spec.stages.map((s, i) => (
            <tr key={i} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <td style={{ padding: '11px 10px 11px 0', borderBottom: '1px solid var(--c-rule)', verticalAlign: 'top', width: 62 }}>
                <span style={{ fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--c-ink-mute)', fontWeight: 700 }}>
                  Etapa {String(i + 1).padStart(2, '0')}
                </span>
              </td>
              <td style={{ padding: '11px 14px 11px 0', borderBottom: '1px solid var(--c-rule)', verticalAlign: 'top' }}>
                <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>{s.label}</div>
                {s.description && (
                  <div style={{ marginTop: 4, fontSize: 9, lineHeight: 1.5, color: 'var(--c-ink-mute)' }}>{s.description}</div>
                )}
              </td>
              <td style={{ padding: '11px 0', borderBottom: '1px solid var(--c-rule)', textAlign: 'right', verticalAlign: 'top', width: 150 }}>
                <div style={{ fontFamily: 'var(--f-display)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                  {s.priceLabel}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 8,
                    letterSpacing: '0.08em',
                    lineHeight: 1.4,
                    color: s.bonified ? 'var(--c-ink)' : 'var(--c-ink-mute)',
                    fontWeight: s.bonified ? 700 : 400,
                    background: s.bonified ? 'var(--c-accent)' : undefined,
                    display: s.bonified ? 'inline-block' : 'block',
                    padding: s.bonified ? '2px 5px' : undefined,
                    borderRadius: s.bonified ? 2 : undefined,
                  }}
                >
                  {s.priceNote}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        style={{
          marginTop: 24,
          background: 'var(--c-chapter-bg)',
          color: 'var(--c-chapter-ink)',
          padding: '20px 24px',
          display: 'flex',
          gap: 26,
          borderRadius: 3,
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
        }}
      >
        <HeadlineBox label="Implantação única" value={spec.headline.oneTimeLabel} note="Etapas de implantação, conforme cronograma" />
        <HeadlineBox label="Operação mensal" value={spec.headline.recurringFirstLabel} note={spec.headline.recurringNote} />
        <HeadlineBox label="Valor do primeiro mês" value={spec.headline.firstMonthDueLabel} note="1ª parcela da implantação e 1ª mensalidade, sem verba de mídia" />
      </div>
    </>
  );

  /* ------------------------------- page 1 -------------------------------- */
  pages.push(
    <>
      {spec.demoMode && (
        <div style={{ marginBottom: 16, padding: '9px 13px', background: '#F7E9D9', color: '#7A3F10', fontSize: 9.5, fontWeight: 600, borderRadius: 3 }}>
          MODO DEMONSTRAÇÃO — o texto de enquadramento foi gerado sem provedor de IA. Os valores vêm do motor de precificação e não foram gerados por IA.
        </div>
      )}
      {blocking.length > 0 && (
        <div style={{ marginBottom: 16, padding: '9px 13px', background: '#FBE4E0', color: '#8E2B1E', fontSize: 9.5, fontWeight: 600, borderRadius: 3 }}>
          RASCUNHO NÃO APROVADO — {blocking.length} pendência(s) comercial(is) bloqueando a emissão: {blocking.map((f) => f.message).join(' ')}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <span style={{ fontSize: 8.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--c-ink-mute)', fontWeight: 700 }}>
          Preparada para
        </span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{spec.preparedFor.join(' · ') || spec.clientName}</span>
      </div>
      <h1 style={{ margin: 0, fontFamily: 'var(--f-display)', fontSize: 33, lineHeight: 1.12, fontWeight: 400, letterSpacing: '-0.03em', maxWidth: 560 }}>
        {spec.narrative.headline ?? spec.title}
      </h1>
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {spec.narrative.openingParagraphs.map((p, i) => (
          <p key={i} style={{ margin: 0, fontSize: 10.5, lineHeight: 1.62, color: 'var(--c-ink-soft)' }}>
            {p}
          </p>
        ))}
      </div>

      {spec.narrative.valuePillars.length > 0 && (
        <div
          style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(spec.narrative.valuePillars.length, 5)}, 1fr)`,
            gap: 14,
          }}
        >
          {spec.narrative.valuePillars.map((v, i) => (
            <div key={i} style={{ borderTop: '2px solid var(--c-accent)', paddingTop: 9 }}>
              <div style={{ fontSize: 10, fontWeight: 700 }}>{v.heading}</div>
              <div style={{ marginTop: 5, fontSize: 9, lineHeight: 1.5, color: 'var(--c-ink-mute)' }}>{v.text}</div>
            </div>
          ))}
        </div>
      )}

      {!splitOpener && <div style={{ marginTop: 26 }}>{stageTable}</div>}
    </>,
  );

  if (splitOpener) {
    pages.push(stageTable);
  }

  /* ------------------------- scope detail pages --------------------------- */
  const blocksPerPage = 3;
  for (let i = 0; i < spec.scopeBlocks.length; i += blocksPerPage) {
    const chunk = spec.scopeBlocks.slice(i, i + blocksPerPage);
    pages.push(
      <>
        {i === 0 && <SectionTitle kicker="Detalhamento das entregas" title="O que está incluído e seus limites" />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {chunk.map((b, j) => (
            <div key={j} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, borderBottom: '2px solid var(--c-accent)', paddingBottom: 6 }}>
                <h3 style={{ margin: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: '-0.01em' }}>{b.label}</h3>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-ink-mute)', whiteSpace: 'nowrap' }}>
                  {b.priceLabel} {b.priceNote ? `· ${b.priceNote}` : ''}
                </span>
              </div>
              {b.summary && <p style={{ margin: '9px 0 0', fontSize: 9.5, lineHeight: 1.6, color: 'var(--c-ink-soft)' }}>{b.summary}</p>}
              {b.scope.length > 0 && (
                <ul style={{ margin: '9px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {b.scope.map((s, k) => (
                    <li key={k} style={{ fontSize: 9.5, lineHeight: 1.55, color: 'var(--c-ink-soft)', paddingLeft: 12, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, top: 6, width: 4, height: 4, background: 'var(--c-accent)', borderRadius: 4 }} />
                      {s}
                    </li>
                  ))}
                </ul>
              )}
              {b.exclusions.length > 0 && (
                <div style={{ marginTop: 9, padding: '8px 11px', background: 'var(--c-bg-alt)', borderLeft: '2px solid var(--c-ink-mute)', borderRadius: 2 }}>
                  <div style={{ fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--c-ink-mute)' }}>
                    Não incluído
                  </div>
                  <div style={{ marginTop: 4, fontSize: 9, lineHeight: 1.55, color: 'var(--c-ink-soft)' }}>{b.exclusions.join(' · ')}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </>,
    );
  }

  /* --------------------------- financial page ----------------------------- */
  pages.push(
    <>
      <SectionTitle kicker="Resumo financeiro" title="Honorários, repasses e desembolso total" />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <tbody>
          {[
            ['Honorários Instfy no período contratado', spec.financial.instfyFeesLabel, true],
            ['Verba de terceiros (anúncios, pagos pelo cliente às plataformas)', spec.financial.thirdPartySpendLabel, false],
            ...(spec.financial.taxLabel ? ([['Tributos (configuração explícita)', spec.financial.taxLabel, false]] as Array<[string, string, boolean]>) : []),
            ['Desembolso total estimado do cliente', spec.financial.clientTotalLabel, true],
            ['Valor bonificado concedido', spec.financial.bonifiedLabel, false],
            ['Desconto aprovado concedido', spec.financial.discountLabel, false],
          ].map(([label, value, strong], i) => (
            <tr key={i}>
              <td style={{ padding: '10px 0', borderBottom: '1px solid var(--c-rule)', color: strong ? 'var(--c-ink)' : 'var(--c-ink-soft)', fontWeight: strong ? 600 : 400 }}>
                {label as string}
              </td>
              <td
                style={{
                  padding: '10px 0',
                  borderBottom: '1px solid var(--c-rule)',
                  textAlign: 'right',
                  fontFamily: 'var(--f-display)',
                  fontWeight: strong ? 700 : 500,
                  fontSize: strong ? 13 : 11,
                  whiteSpace: 'nowrap',
                }}
              >
                {value as string}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!spec.financial.taxLabel && (
        <p style={{ marginTop: 9, fontSize: 8.5, color: 'var(--c-ink-mute)', lineHeight: 1.5 }}>
          Nenhum tributo foi adicionado automaticamente. Impostos, quando aplicáveis, são tratados conforme o regime fiscal acordado e configurados explicitamente.
        </p>
      )}

      <div style={{ marginTop: 26 }}>
        <SectionTitle kicker="Cronograma financeiro" title="Parcelas e recorrência" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--c-ink-mute)', marginBottom: 9 }}>
              Implantação
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5 }}>
              <tbody>
                {spec.schedule.map((s, i) => (
                  <tr key={i}>
                    <td style={{ padding: '8px 8px 8px 0', borderBottom: '1px solid var(--c-rule)' }}>
                      <div style={{ fontWeight: 600 }}>{s.label}</div>
                      <div style={{ fontSize: 8.5, color: 'var(--c-ink-mute)' }}>{s.dueRule}</div>
                    </td>
                    <td style={{ padding: '8px 0', borderBottom: '1px solid var(--c-rule)', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {s.amountLabel}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: '9px 0', fontWeight: 700 }}>Total da implantação</td>
                  <td style={{ padding: '9px 0', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--f-display)', fontSize: 12 }}>
                    {spec.headline.oneTimeLabel}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--c-ink-mute)', marginBottom: 9 }}>
              Operação mensal ({spec.termMonths} meses)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingBottom: 6, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-ink-mute)', borderBottom: '1px solid var(--c-accent)' }}>Mês</th>
                  <th style={{ textAlign: 'right', paddingBottom: 6, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-ink-mute)', borderBottom: '1px solid var(--c-accent)' }}>Honorários</th>
                  <th style={{ textAlign: 'right', paddingBottom: 6, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-ink-mute)', borderBottom: '1px solid var(--c-accent)' }}>Verba de mídia</th>
                </tr>
              </thead>
              <tbody>
                {spec.financial.monthly.map((m) => (
                  <tr key={m.month}>
                    <td style={{ padding: '5px 0', borderBottom: '1px solid var(--c-rule)' }}>{m.month}</td>
                    <td style={{ padding: '5px 0', borderBottom: '1px solid var(--c-rule)', textAlign: 'right' }}>{m.instfyLabel}</td>
                    <td style={{ padding: '5px 0', borderBottom: '1px solid var(--c-rule)', textAlign: 'right', color: 'var(--c-ink-mute)' }}>{m.thirdPartyLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>,
  );

  /* ------------------------ terms + acceptance page ----------------------- */
  pages.push(
    <>
      <SectionTitle kicker="Condições e aceite" title="Formalização" />
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {spec.conditions.map((c, i) => (
          <li key={i} style={{ fontSize: 9.5, lineHeight: 1.6, color: 'var(--c-ink-soft)', paddingLeft: 13, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0, top: 6, width: 4, height: 4, background: 'var(--c-accent)', borderRadius: 4 }} />
            {c}
          </li>
        ))}
      </ul>

      {spec.narrative.closingNote && (
        <p style={{ marginTop: 18, fontSize: 9.5, lineHeight: 1.6, color: 'var(--c-ink-soft)' }}>{spec.narrative.closingNote}</p>
      )}

      <div style={{ marginTop: 28, padding: '18px 22px', background: 'var(--c-bg-alt)', border: '1px solid var(--c-rule)', borderRadius: 3 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--c-ink-mute)' }}>Aceite</div>
        <p style={{ margin: '10px 0 0', fontSize: 9.5, lineHeight: 1.6, color: 'var(--c-ink-soft)' }}>
          Proponente: {spec.orgLegalName}, CNPJ {spec.orgTaxId}
          {spec.orgWebsite ? `, ${spec.orgWebsite}` : ''}. Cliente: {spec.clientName}
          {spec.preparedFor.length ? `, representado por ${spec.preparedFor.join(' e ')}` : ''}. Emissão em {spec.issuedAtLabel}
          {spec.validUntilLabel ? `, válida até ${spec.validUntilLabel}` : ''}. A formalização se dá por assinatura eletrônica desta proposta e
          celebração do contrato de prestação de serviços.
        </p>
      </div>

      <div style={{ marginTop: 56, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
        <div style={{ borderTop: '1px solid var(--c-ink)', paddingTop: 9 }}>
          <div style={{ fontSize: 10, fontWeight: 600 }}>{spec.orgLegalName}</div>
          <div style={{ fontSize: 8.5, color: 'var(--c-ink-mute)' }}>CNPJ {spec.orgTaxId} · Proponente</div>
        </div>
        <div style={{ borderTop: '1px solid var(--c-ink)', paddingTop: 9 }}>
          <div style={{ fontSize: 10, fontWeight: 600 }}>{spec.preparedFor[0] ?? spec.clientName}</div>
          <div style={{ fontSize: 8.5, color: 'var(--c-ink-mute)' }}>{spec.clientName} · Contratante</div>
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 30, display: 'flex', justifyContent: 'center' }}>
        <InstfyMark size={22} />
      </div>
    </>,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {pages.map((content, i) => (
        <Page key={i} index={i} total={pages.length} spec={spec}>
          {content}
        </Page>
      ))}
    </div>
  );
}

/**
 * Mirrors the page assembly in ProposalDocument so a DocumentVersion can record
 * its page count before Chromium runs. The renderer re-measures afterwards and
 * the stored count is corrected from the real pagination.
 */
export function countProposalPages(spec: ProposalSpec): number {
  const openerChars =
    (spec.narrative.headline ?? spec.title).length +
    spec.narrative.openingParagraphs.join(' ').length +
    spec.narrative.valuePillars.reduce((n, v) => n + v.heading.length + v.text.length, 0);
  const stageWeight = spec.stages.reduce((n, st) => n + st.label.length + (st.description?.length ?? 0), 0);
  const splitOpener =
    openerChars + stageWeight > 1500 ||
    spec.stages.length > 5 ||
    spec.demoMode ||
    spec.flags.some((f) => f.severity === 'block');
  return 1 + (splitOpener ? 1 : 0) + Math.ceil(spec.scopeBlocks.length / 3) + 2;
}
