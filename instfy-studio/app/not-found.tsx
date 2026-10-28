import Link from 'next/link';
import { Shell, EmptyState } from '@/components/Shell';

export default function NotFound() {
  return (
    <Shell>
      <EmptyState
        title="Página não encontrada"
        description="O recurso solicitado não existe ou foi removido."
        action={<Link href="/" className="btn-primary">Voltar ao painel</Link>}
      />
    </Shell>
  );
}
