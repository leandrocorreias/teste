import Link from 'next/link';

const TABS = [
  { key: 'discovery', label: '1 · Discovery', href: 'discovery' },
  { key: 'analysis', label: '2 · Análise e narrativa', href: 'analysis' },
  { key: 'presentation', label: '3 · Apresentação', href: 'presentation' },
  { key: 'proposal', label: '4 · Proposta', href: 'proposal' },
] as const;

export function ProjectTabs({ projectId, active }: { projectId: string; active: (typeof TABS)[number]['key'] }) {
  return (
    <nav className="mb-8 flex flex-wrap gap-1 border-b border-paper-line" aria-label="Etapas do projeto">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/projects/${projectId}/${tab.href}`}
          aria-current={tab.key === active ? 'page' : undefined}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            tab.key === active
              ? 'border-lime-600 text-ink'
              : 'border-transparent text-ink-mute hover:border-paper-line hover:text-ink'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
