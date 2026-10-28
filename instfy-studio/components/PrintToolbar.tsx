'use client';

/**
 * On-screen only. Lets the viewer print the document to PDF from their own
 * browser, which is how documents are produced on hosts without Chromium.
 * Hidden in the printed output by the `no-print` rule.
 */
export function PrintToolbar({ label, hint }: { label: string; hint?: string }) {
  return (
    <div
      className="no-print"
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, padding: '10px 18px',
        background: '#0E2A20', color: '#F7F6F1',
        fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)', fontSize: 13,
      }}
    >
      <span>
        <strong style={{ fontWeight: 600 }}>{label}</strong>
        {hint && <span style={{ opacity: 0.74, marginLeft: 10 }}>{hint}</span>}
      </span>
      <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ opacity: 0.6, fontSize: 11 }}>Destino: “Salvar como PDF” · margens: nenhuma</span>
        <button
          onClick={() => window.print()}
          style={{
            background: '#C3F53C', color: '#14201B', border: 'none',
            padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Imprimir / salvar PDF
        </button>
      </span>
    </div>
  );
}
