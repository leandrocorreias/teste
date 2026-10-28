/**
 * Sector-aware Discovery questionnaire.
 *
 * Versioned: the schema below is stored as FormVersion.schemaJson at seed time,
 * and every Submission points at the exact version it was answered against.
 */
import { z } from 'zod';

export type QuestionType = 'text' | 'longtext' | 'single' | 'multi' | 'number' | 'currency' | 'url' | 'attachment';

export interface Question {
  id: string;
  label: string;
  help?: string;
  type: QuestionType;
  options?: string[];
  /** Critical questions drive the "missing critical data" banner and block export-grade claims. */
  critical?: boolean;
  placeholder?: string;
  unit?: string;
  /** Shown only when the project's sector is in this list. */
  sectors?: string[];
  /** Shown only when another answer matches. */
  dependsOn?: { questionId: string; equals: string | string[] };
}

export interface Dimension {
  id: string;
  name: string;
  intent: string;
  questions: Question[];
}

export const SECTORS = [
  { id: 'fitness_wellness', name: 'Fitness e bem-estar' },
  { id: 'saude', name: 'Saúde e clínicas' },
  { id: 'educacao', name: 'Educação' },
  { id: 'servicos_b2b', name: 'Serviços B2B' },
  { id: 'varejo', name: 'Varejo e e-commerce' },
  { id: 'alimentacao', name: 'Alimentação' },
  { id: 'tecnologia', name: 'Tecnologia e SaaS' },
  { id: 'outro', name: 'Outro' },
] as const;

export type SectorId = (typeof SECTORS)[number]['id'];

export const DISCOVERY_FORM_SLUG = 'discovery-estrategico';
export const DISCOVERY_FORM_VERSION = 1;

export const DISCOVERY_DIMENSIONS: Dimension[] = [
  {
    id: 'modelo_negocio',
    name: 'Modelo de negócio',
    intent: 'Como a empresa gera receita hoje e com que estrutura.',
    questions: [
      { id: 'mn_descricao', label: 'Descreva o negócio em até 3 frases', type: 'longtext', critical: true },
      { id: 'mn_tempo', label: 'Há quanto tempo a empresa opera?', type: 'text', placeholder: 'Ex.: 8 meses, 4 anos', critical: true },
      { id: 'mn_receita', label: 'Principais fontes de receita', type: 'multi', critical: true,
        options: ['Mensalidade / assinatura', 'Venda avulsa', 'Pacotes', 'Contratos B2B', 'Comissionamento', 'Outro'] },
      { id: 'mn_unidades', label: 'Quantas unidades / pontos de atendimento?', type: 'number', unit: 'unidades' },
      { id: 'mn_capacidade', label: 'Capacidade simultânea de atendimento', type: 'number', unit: 'pessoas',
        sectors: ['fitness_wellness', 'saude', 'alimentacao'] },
      { id: 'mn_modalidades', label: 'Modalidades e serviços oferecidos', type: 'longtext', sectors: ['fitness_wellness', 'saude'] },
    ],
  },
  {
    id: 'oferta',
    name: 'Oferta',
    intent: 'O que é vendido, com quais entregas e limites.',
    questions: [
      { id: 'of_principal', label: 'Oferta principal e o que ela inclui', type: 'longtext', critical: true },
      { id: 'of_ticket', label: 'Ticket médio atual', type: 'currency', critical: true, help: 'Se não houver dado consolidado, deixe em branco — será registrado como dado ausente.' },
      { id: 'of_planos', label: 'Planos ou pacotes existentes', type: 'longtext' },
      { id: 'of_diferencial_entrega', label: 'O que a concorrência não entrega do mesmo jeito', type: 'longtext' },
    ],
  },
  {
    id: 'cliente',
    name: 'Cliente',
    intent: 'Quem compra, por quê e em que contexto.',
    questions: [
      { id: 'cl_perfil', label: 'Perfil do cliente atual', type: 'longtext', critical: true },
      { id: 'cl_dor', label: 'Principal problema que o cliente busca resolver', type: 'longtext', critical: true },
      { id: 'cl_objecoes', label: 'Objeções mais frequentes na venda', type: 'longtext' },
      { id: 'cl_base', label: 'Tamanho da base ativa de clientes', type: 'number', unit: 'clientes' },
      { id: 'cl_retencao', label: 'Permanência média do cliente', type: 'text', placeholder: 'Ex.: 7 meses' },
    ],
  },
  {
    id: 'mercado',
    name: 'Mercado',
    intent: 'Onde o negócio está inserido geográfica e economicamente.',
    questions: [
      { id: 'mk_regiao', label: 'Região de atuação', type: 'text', critical: true, placeholder: 'Bairro, cidade, estado' },
      { id: 'mk_raio', label: 'Raio de deslocamento aceito pelo cliente', type: 'text', placeholder: 'Ex.: até 15 min a pé' },
      { id: 'mk_sazonalidade', label: 'Sazonalidades relevantes', type: 'longtext' },
      { id: 'mk_fontes', label: 'Fontes de dados de mercado que você já possui (URLs)', type: 'url',
        help: 'Somente links que podem ser citados como fonte. Sem isso, nenhum número externo será afirmado como fato.' },
    ],
  },
  {
    id: 'concorrencia',
    name: 'Concorrência',
    intent: 'Com quem o cliente compara antes de decidir.',
    questions: [
      { id: 'cc_diretos', label: 'Concorrentes diretos (nomes)', type: 'longtext', critical: true },
      { id: 'cc_indiretos', label: 'Alternativas indiretas que resolvem o mesmo problema', type: 'longtext' },
      { id: 'cc_forca', label: 'Onde os concorrentes são mais fortes', type: 'longtext' },
      { id: 'cc_referencias', label: 'Referências nacionais ou internacionais que admira', type: 'longtext' },
    ],
  },
  {
    id: 'posicionamento',
    name: 'Posicionamento',
    intent: 'Como a marca quer ser reconhecida.',
    questions: [
      { id: 'po_promessa', label: 'Promessa central da marca hoje', type: 'longtext', critical: true },
      { id: 'po_percepcao', label: 'Como os clientes descrevem a marca com as próprias palavras', type: 'longtext' },
      { id: 'po_maturidade', label: 'Maturidade da identidade visual', type: 'single',
        options: ['Não existe', 'Logo apenas', 'Identidade parcial', 'Identidade completa com manual'], critical: true },
      { id: 'po_tom', label: 'Tom de voz desejado', type: 'text' },
    ],
  },
  {
    id: 'funil',
    name: 'Funil comercial',
    intent: 'Como um interessado vira cliente.',
    questions: [
      { id: 'fn_etapas', label: 'Etapas atuais da jornada de venda', type: 'longtext', critical: true },
      { id: 'fn_canais_entrada', label: 'Por onde chegam os interessados', type: 'multi',
        options: ['Indicação', 'Instagram', 'Google', 'Passagem / fachada', 'Parcerias', 'Prospecção ativa', 'Outro'], critical: true },
      { id: 'fn_leads_mes', label: 'Volume de interessados por mês', type: 'number', unit: 'leads/mês' },
      { id: 'fn_conversao', label: 'Taxa de conversão de interessado em cliente', type: 'number', unit: '%' },
      { id: 'fn_responsavel', label: 'Quem faz o atendimento comercial', type: 'text' },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    intent: 'O que já é feito de comunicação e com que resultado.',
    questions: [
      { id: 'mg_canais', label: 'Canais ativos hoje', type: 'multi',
        options: ['Instagram', 'Site', 'Google Ads', 'Meta Ads', 'E-mail', 'WhatsApp', 'Eventos', 'Nenhum'], critical: true },
      { id: 'mg_site', label: 'URL do site atual', type: 'url' },
      { id: 'mg_instagram', label: 'URL do Instagram', type: 'url' },
      { id: 'mg_verba', label: 'Verba mensal de mídia paga disponível', type: 'currency',
        help: 'Verba de anúncios paga às plataformas. Não é honorário Instfy.' },
      { id: 'mg_producao', label: 'Quem produz conteúdo atualmente', type: 'text' },
    ],
  },
  {
    id: 'operacao',
    name: 'Operação',
    intent: 'Como a entrega acontece no dia a dia.',
    questions: [
      { id: 'op_equipe', label: 'Tamanho e composição da equipe', type: 'longtext', critical: true },
      { id: 'op_processos', label: 'Processos já documentados', type: 'longtext' },
      { id: 'op_gargalos', label: 'Principais gargalos operacionais', type: 'longtext', critical: true },
    ],
  },
  {
    id: 'tecnologia',
    name: 'Tecnologia',
    intent: 'Que sistemas sustentam o negócio.',
    questions: [
      { id: 'tc_sistemas', label: 'Sistemas em uso (gestão, CRM, pagamentos)', type: 'longtext' },
      { id: 'tc_integracoes', label: 'Integrações necessárias', type: 'longtext' },
      { id: 'tc_app', label: 'Existe aplicativo ou área logada para clientes?', type: 'single',
        options: ['Não', 'Em planejamento', 'Sim, de terceiros', 'Sim, próprio'] },
      { id: 'tc_wearables', label: 'Integração com wearables ou equipamentos', type: 'longtext', sectors: ['fitness_wellness', 'saude'] },
    ],
  },
  {
    id: 'financeiro',
    name: 'Financeiro',
    intent: 'Capacidade de investimento e horizonte de retorno.',
    questions: [
      { id: 'fi_faturamento', label: 'Faturamento mensal atual', type: 'currency',
        help: 'Campo opcional. Se não informado, nenhum número de receita será afirmado nos documentos.' },
      { id: 'fi_investimento', label: 'Investimento mensal disponível para marketing e tecnologia', type: 'currency', critical: true },
      { id: 'fi_horizonte', label: 'Horizonte esperado de retorno', type: 'single',
        options: ['3 meses', '6 meses', '12 meses', 'Mais de 12 meses'], critical: true },
    ],
  },
  {
    id: 'objetivos',
    name: 'Objetivos',
    intent: 'O resultado esperado em número e prazo.',
    questions: [
      { id: 'ob_12m', label: 'Objetivo principal para os próximos 12 meses', type: 'longtext', critical: true },
      { id: 'ob_metrica', label: 'Indicador que define sucesso', type: 'text', critical: true },
      { id: 'ob_meta', label: 'Meta numérica associada', type: 'text', placeholder: 'Ex.: 120 alunos ativos' },
    ],
  },
  {
    id: 'restricoes',
    name: 'Restrições',
    intent: 'O que não pode ou não deve ser feito.',
    questions: [
      { id: 'rs_inegociaveis', label: 'Decisões inegociáveis', type: 'longtext' },
      { id: 'rs_prazo', label: 'Restrições de prazo', type: 'longtext' },
      { id: 'rs_legais', label: 'Restrições legais, regulatórias ou de compliance', type: 'longtext' },
    ],
  },
  {
    id: 'prioridades',
    name: 'Prioridades estratégicas',
    intent: 'Onde começar.',
    questions: [
      { id: 'pr_ordem', label: 'Ordene as frentes por prioridade', type: 'multi', critical: true,
        options: ['Posicionamento e marca', 'Aquisição de clientes', 'Retenção', 'Presença digital', 'Tecnologia e produto', 'Operação comercial', 'Comunidade'] },
      { id: 'pr_90dias', label: 'O que precisa estar resolvido em 90 dias', type: 'longtext', critical: true },
      { id: 'pr_anexos', label: 'Materiais de apoio', type: 'attachment', help: 'Opcional no MVP: registre aqui a lista de materiais entregues fora do sistema.' },
    ],
  },
];

export function questionsForSector(sector: string): Dimension[] {
  return DISCOVERY_DIMENSIONS.map((d) => ({
    ...d,
    questions: d.questions.filter((q) => !q.sectors || q.sectors.includes(sector)),
  })).filter((d) => d.questions.length > 0);
}

export function allQuestions(sector: string): Question[] {
  return questionsForSector(sector).flatMap((d) => d.questions);
}

export interface Completion {
  answered: number;
  total: number;
  pct: number;
  missingCritical: Array<{ questionId: string; label: string; dimension: string }>;
  criticalTotal: number;
  criticalAnswered: number;
}

export function computeCompletion(sector: string, answers: Record<string, unknown>): Completion {
  const dims = questionsForSector(sector);
  const questions = dims.flatMap((d) => d.questions.map((q) => ({ q, dimension: d.name })));
  const isAnswered = (v: unknown): boolean => {
    if (v === undefined || v === null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'number') return Number.isFinite(v);
    return Boolean(v);
  };
  const answered = questions.filter(({ q }) => isAnswered(answers[q.id])).length;
  const criticals = questions.filter(({ q }) => q.critical);
  const missingCritical = criticals
    .filter(({ q }) => !isAnswered(answers[q.id]))
    .map(({ q, dimension }) => ({ questionId: q.id, label: q.label, dimension }));
  return {
    answered,
    total: questions.length,
    pct: questions.length === 0 ? 0 : Math.round((answered / questions.length) * 100),
    missingCritical,
    criticalTotal: criticals.length,
    criticalAnswered: criticals.length - missingCritical.length,
  };
}

export const answerValue = z.union([z.string(), z.number(), z.array(z.string()), z.null()]);
export const answersPayload = z.record(z.string(), answerValue);

export const FORM_SCHEMA_SNAPSHOT = {
  slug: DISCOVERY_FORM_SLUG,
  version: DISCOVERY_FORM_VERSION,
  dimensions: DISCOVERY_DIMENSIONS,
  sectors: SECTORS,
};
