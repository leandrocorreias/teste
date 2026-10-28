import Link from 'next/link';
import { InstfyLockup } from './InstfyMark';
import { resolveProvider } from '@/lib/ai/provider';

const NAV = [
  { href: '/', label: 'Painel' },
  { href: '/clients', label: 'Clientes' },
  { href: '/services', label: 'Catálogo' },
  { href: '/documents', label: 'Documentos' },
  { href: '/settings/brand', label: 'Marca' },
];

export function Shell({ children, breadcrumb }: { children: React.ReactNode; breadcrumb?: React.ReactNode }) {
  const provider = resolveProvider();
  return (
    <div className="min-h-screen bg-paper" style={{ ['--c-accent' as string]: '#A8D92A', ['--c-accent-ink' as string]: '#14201B', ['--c-ink' as string]: '#14201B', ['--f-display' as string]: 'var(--font-display)' }}>
      <header className="sticky top-0 z-20 border-b border-paper-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <InstfyLockup size={22} />
              <span className="hidden text-[10px] font-semibold uppercase tracking-kicker text-ink-mute sm:inline">
                Intelligence Studio
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-alt hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-kicker ${
                provider.demoMode ? 'bg-[#F7E9D9] text-[#7A3F10]' : 'bg-[#E6F0E3] text-[#14401F]'
              }`}
              title={provider.reason}
            >
              {provider.demoMode ? 'Modo demonstração' : `IA: ${provider.id}`}
            </span>
            <span
              className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-kicker bg-paper-alt text-ink-mute"
              title={
                provider.researchEnabled
                  ? 'Conector de pesquisa declarado.'
                  : 'Nenhum conector de pesquisa configurado: nenhuma pesquisa externa é realizada ou afirmada.'
              }
            >
              {provider.researchEnabled ? 'Pesquisa: conector declarado' : 'Sem pesquisa externa'}
            </span>
          </div>
        </div>
        {breadcrumb && (
          <div className="border-t border-paper-line bg-paper-alt/60">
            <div className="mx-auto max-w-[1400px] px-6 py-2 text-xs text-ink-mute">{breadcrumb}</div>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
      <footer className="border-t border-paper-line py-6">
        <div className="mx-auto max-w-[1400px] px-6 text-[10px] uppercase tracking-kicker text-ink-mute">
          Instfy Brasil Ltda · ambiente local de trabalho · os valores exibidos vêm do motor determinístico de precificação
        </div>
      </footer>
    </div>
  );
}

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-paper-line pb-6">
      <div>
        {kicker && <div className="kicker mb-2">{kicker}</div>}
        <h1 className="font-display text-3xl font-normal tracking-[-0.03em] text-ink">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="h-2 w-10 bg-lime-600" />
      <h3 className="mt-5 font-display text-lg font-medium text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-mute">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
