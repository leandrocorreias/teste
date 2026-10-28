import { Shell, PageHeader } from '@/components/Shell';
import { prisma, getOrg } from '@/lib/db';
import { THEMES, contrastRatio, type ThemeId } from '@/lib/design/tokens';
import { LAYOUT_CATALOG } from '@/lib/design/schema';
import { checkTheme } from '@/lib/design/validate';
import { InstfyMark } from '@/components/InstfyMark';
import { resolveProvider } from '@/lib/ai/provider';

export const dynamic = 'force-dynamic';

export default async function BrandSettingsPage() {
  const org = await getOrg();
  const [brandKits, settings] = await Promise.all([
    prisma.brandKit.findMany({ where: { orgId: org.id }, include: { client: true }, orderBy: { createdAt: 'asc' } }),
    prisma.orgSetting.findMany({ where: { orgId: org.id }, orderBy: { key: 'asc' } }),
  ]);
  const provider = resolveProvider();

  return (
    <Shell>
      <PageHeader
        kicker="Design system"
        title="Marca, temas e políticas"
        description="Os tokens abaixo alimentam a pré-visualização e o PDF pelo mesmo caminho. O renderizador verifica contraste WCAG AA e o tamanho mínimo de corpo antes de cada geração."
      />

      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl font-medium text-ink">Temas</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {(Object.keys(THEMES) as ThemeId[]).map((id) => {
            const theme = THEMES[id];
            const warnings = checkTheme(theme);
            return (
              <div key={id} className="card overflow-hidden">
                <div className="flex h-24 items-center justify-center" style={{ background: theme.colors.chapterBg }}>
                  <InstfyMark size={34} discColor={theme.colors.accent} inkColor={theme.colors.accentInk} />
                </div>
                <div className="p-5">
                  <div className="kicker">{id}</div>
                  <h3 className="mt-1 font-display text-base font-medium text-ink">{theme.name}</h3>
                  <div className="mt-3 flex gap-1">
                    {[theme.colors.bg, theme.colors.bgAlt, theme.colors.chapterBg, theme.colors.accent, theme.colors.ink].map((c) => (
                      <span key={c} className="h-7 flex-1" style={{ background: c, outline: '1px solid rgba(0,0,0,0.08)' }} title={c} />
                    ))}
                  </div>
                  <dl className="mt-4 space-y-1.5 text-xs">
                    {[
                      ['Texto / fundo', contrastRatio(theme.colors.ink, theme.colors.bg)],
                      ['Auxiliar / fundo', contrastRatio(theme.colors.inkMute, theme.colors.bg)],
                      ['Capítulo', contrastRatio(theme.colors.chapterInk, theme.colors.chapterBg)],
                      ['Sobre acento', contrastRatio(theme.colors.accentInk, theme.colors.accent)],
                    ].map(([label, ratio]) => (
                      <div key={label as string} className="flex justify-between">
                        <dt className="text-ink-mute">{label as string}</dt>
                        <dd className={`font-semibold ${(ratio as number) >= 4.5 ? 'text-[#14401F]' : 'text-[#8E2B1E]'}`}>
                          {(ratio as number).toFixed(2)}:1 {(ratio as number) >= 4.5 ? '✓' : '✕'}
                        </dd>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-paper-line pt-1.5">
                      <dt className="text-ink-mute">Corpo mínimo</dt>
                      <dd className="font-semibold text-ink">{theme.type.minBodyPx}px</dd>
                    </div>
                  </dl>
                  {warnings.length > 0 ? (
                    <ul className="mt-3 space-y-1">
                      {warnings.map((w, i) => <li key={i} className="text-[11px] text-[#8E2B1E]">{w.message}</li>)}
                    </ul>
                  ) : (
                    <p className="mt-3 text-[11px] text-[#14401F]">Aprovado nas verificações de acessibilidade.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 font-display text-xl font-medium text-ink">Kits de marca</h2>
          <div className="card divide-y divide-paper-line">
            {brandKits.map((kit) => {
              const tokens = JSON.parse(kit.tokensJson || '{}') as { themeId?: string; logoPlacement?: string; footerLine?: string; clientAccent?: string };
              return (
                <div key={kit.id} className="p-5">
                  <div className="kicker">{kit.client ? `Cliente · ${kit.client.name}` : 'Instfy'}{kit.isDefault ? ' · padrão' : ''}</div>
                  <h3 className="mt-1 text-sm font-semibold text-ink">{kit.name}</h3>
                  <dl className="mt-2 space-y-1 text-xs text-ink-mute">
                    <div>Tema: {tokens.themeId ?? 'instfy-light'}</div>
                    <div>Posição do logo: {tokens.logoPlacement ?? 'top-left'}</div>
                    <div>Rodapé: {tokens.footerLine ?? '—'}</div>
                    {tokens.clientAccent && <div>Acento do cliente: {tokens.clientAccent}</div>}
                  </dl>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-mute">
            A edição de kits pela interface ainda não está implementada neste MVP. Os kits são criados no seed e lidos pelo
            renderizador; o acento do cliente é aplicado apenas ao tema <code className="font-mono">instfy-client</code>.
          </p>
        </section>

        <section>
          <h2 className="mb-4 font-display text-xl font-medium text-ink">Políticas e ambiente</h2>
          <div className="card divide-y divide-paper-line">
            {settings.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="font-mono text-xs text-ink-mute">{s.key}</span>
                <span className="font-semibold text-ink">{s.value === '' ? 'não definido' : s.value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <span className="font-mono text-xs text-ink-mute">provedor_ia</span>
              <span className="font-semibold text-ink">{provider.demoMode ? 'demonstração' : `${provider.id} · ${provider.model}`}</span>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <span className="font-mono text-xs text-ink-mute">conector_pesquisa</span>
              <span className="font-semibold text-ink">{provider.researchEnabled ? 'declarado' : 'nenhum'}</span>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-mute">
            As chaves de IA permanecem no servidor e nunca são enviadas ao navegador. Apenas o hash do prompt é registrado — o
            conteúdo confidencial das respostas do cliente não entra em log.
          </p>

          <h2 className="mb-3 mt-8 font-display text-xl font-medium text-ink">Biblioteca de layouts</h2>
          <div className="card divide-y divide-paper-line">
            {LAYOUT_CATALOG.map((l) => (
              <div key={l.layoutId} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-ink">{l.name}</span>
                  <code className="font-mono text-[10px] text-ink-mute">{l.layoutId}</code>
                </div>
                <div className="mt-0.5 text-xs text-ink-mute">{l.purpose} · {l.capacity}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
