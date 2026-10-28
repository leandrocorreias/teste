/**
 * Typed slide/page schemas.
 *
 * The LLM picks a layoutId and supplies CONTENT only. It never writes HTML or
 * CSS; deterministic renderers own all markup. Anything the model returns is
 * validated here before it can reach a renderer.
 */
import { z } from 'zod';

export const EvidenceType = z.enum(['FACT', 'SIGNAL', 'INFERENCE', 'HYPOTHESIS']);
export type EvidenceTypeT = z.infer<typeof EvidenceType>;

export const EVIDENCE_LABELS: Record<EvidenceTypeT, string> = {
  FACT: 'Fato',
  SIGNAL: 'Sinal',
  INFERENCE: 'Inferência',
  HYPOTHESIS: 'Hipótese',
};

export const EVIDENCE_HELP: Record<EvidenceTypeT, string> = {
  FACT: 'Declarado pelo cliente no questionário ou verificável em fonte citada.',
  SIGNAL: 'Indício observado nas respostas, ainda não confirmado.',
  INFERENCE: 'Conclusão derivada logicamente dos dados do formulário.',
  HYPOTHESIS: 'Proposta da Instfy a validar — não é característica já existente.',
};

const kicker = z.string().min(1).max(60);
const title = z.string().min(1).max(120);
const paragraph = z.string().min(1).max(640);
const shortText = z.string().min(1).max(220);

export const sourceRef = z.object({
  kind: z.enum(['form_answer', 'url', 'client_statement', 'none']),
  ref: z.string().max(240),
  label: z.string().max(160).optional(),
});
export type SourceRef = z.infer<typeof sourceRef>;

const evidenced = {
  evidenceType: EvidenceType.default('INFERENCE'),
  sourceRefs: z.array(sourceRef).default([]),
};

/* ----------------------------- page archetypes ---------------------------- */

export const coverPage = z.object({
  layoutId: z.literal('cover'),
  eyebrow: kicker.optional(),
  title: title,
  subtitle: shortText.optional(),
  clientName: z.string().max(80),
  preparedFor: z.array(z.string().max(80)).max(4).default([]),
  dateLabel: z.string().max(40).optional(),
  tagline: z.string().max(120).optional(),
});

export const chapterPage = z.object({
  layoutId: z.literal('chapter'),
  numeral: z.string().max(8),
  kicker: kicker.optional(),
  title: title,
  lead: paragraph.optional(),
});

export const editorialSplitPage = z.object({
  layoutId: z.literal('editorial-split'),
  kicker: kicker.optional(),
  title: title,
  paragraphs: z.array(paragraph).min(1).max(4),
  pullQuote: shortText.optional(),
  side: z.enum(['left', 'right']).default('right'),
  ...evidenced,
});

export const metricGridPage = z.object({
  layoutId: z.literal('metric-grid'),
  kicker: kicker.optional(),
  title: title,
  metrics: z
    .array(
      z.object({
        value: z.string().min(1).max(14),
        label: shortText,
        source: z.string().max(80).optional(),
        evidenceType: EvidenceType.default('FACT'),
      }),
    )
    .min(2)
    .max(4),
  note: paragraph.optional(),
  callout: shortText.optional(),
});

export const comparisonPage = z.object({
  layoutId: z.literal('comparison'),
  kicker: kicker.optional(),
  title: title,
  columns: z
    .array(
      z.object({
        heading: z.string().max(48),
        items: z.array(shortText).min(1).max(5),
      }),
    )
    .min(2)
    .max(3),
  note: paragraph.optional(),
  ...evidenced,
});

export const timelinePage = z.object({
  layoutId: z.literal('timeline'),
  kicker: kicker.optional(),
  title: title,
  steps: z
    .array(
      z.object({
        period: z.string().max(32),
        heading: z.string().max(48),
        detail: shortText.optional(),
      }),
    )
    .min(2)
    .max(6),
  note: paragraph.optional(),
});

export const matrixPage = z.object({
  layoutId: z.literal('matrix'),
  kicker: kicker.optional(),
  title: title,
  headers: z.array(z.string().max(40)).min(2).max(4),
  rows: z.array(z.array(z.string().max(120)).min(2).max(4)).min(1).max(8),
  note: paragraph.optional(),
  ...evidenced,
});

export const keyInsightPage = z.object({
  layoutId: z.literal('key-insight'),
  kicker: kicker.optional(),
  statement: z.string().min(1).max(220),
  support: z.array(shortText).max(3).default([]),
  attribution: z.string().max(80).optional(),
  ...evidenced,
});

export const roadmapPage = z.object({
  layoutId: z.literal('roadmap'),
  kicker: kicker.optional(),
  title: title,
  phases: z
    .array(
      z.object({
        label: z.string().max(32),
        focus: z.string().max(48),
        outcomes: z.array(shortText).min(1).max(4),
      }),
    )
    .min(2)
    .max(4),
  note: paragraph.optional(),
});

export const bulletsPage = z.object({
  layoutId: z.literal('bullets'),
  kicker: kicker.optional(),
  title: title,
  lead: paragraph.optional(),
  bullets: z
    .array(z.object({ heading: z.string().max(60).optional(), text: shortText }))
    .min(1)
    .max(6),
  ...evidenced,
});

export const closingPage = z.object({
  layoutId: z.literal('closing'),
  title: title,
  message: paragraph.optional(),
  nextSteps: z.array(shortText).max(4).default([]),
  contactLine: z.string().max(120).optional(),
});

export const slidePage = z.discriminatedUnion('layoutId', [
  coverPage,
  chapterPage,
  editorialSplitPage,
  metricGridPage,
  comparisonPage,
  timelinePage,
  matrixPage,
  keyInsightPage,
  roadmapPage,
  bulletsPage,
  closingPage,
]);
export type SlidePage = z.infer<typeof slidePage>;
export type LayoutId = SlidePage['layoutId'];

export const LAYOUT_CATALOG: Array<{
  layoutId: LayoutId;
  name: string;
  purpose: string;
  capacity: string;
}> = [
  { layoutId: 'cover', name: 'Capa', purpose: 'Abertura do documento', capacity: 'título + subtítulo' },
  { layoutId: 'chapter', name: 'Divisor de capítulo', purpose: 'Separa as partes do estudo', capacity: 'numeral + título + lead' },
  { layoutId: 'editorial-split', name: 'Split editorial', purpose: 'Argumento longo com apoio visual', capacity: 'até 4 parágrafos' },
  { layoutId: 'metric-grid', name: 'Grade de indicadores', purpose: 'Números com fonte citada', capacity: '2 a 4 métricas' },
  { layoutId: 'comparison', name: 'Comparativo', purpose: 'Confronta alternativas', capacity: '2 a 3 colunas de 5 itens' },
  { layoutId: 'timeline', name: 'Linha do tempo', purpose: 'Sequência de etapas', capacity: '2 a 6 marcos' },
  { layoutId: 'matrix', name: 'Matriz/tabela', purpose: 'Categorias e atributos', capacity: 'até 8 linhas' },
  { layoutId: 'key-insight', name: 'Insight central', purpose: 'Uma afirmação que sustenta a tese', capacity: 'até 220 caracteres' },
  { layoutId: 'roadmap', name: 'Roadmap', purpose: 'Fases e resultados esperados', capacity: '2 a 4 fases' },
  { layoutId: 'bullets', name: 'Tópicos', purpose: 'Lista estruturada', capacity: 'até 6 tópicos' },
  { layoutId: 'closing', name: 'Encerramento', purpose: 'Próximos passos e contato', capacity: 'até 4 passos' },
];

export const presentationSpec = z.object({
  title: title,
  subtitle: shortText.optional(),
  themeId: z.enum(['instfy-light', 'instfy-dark', 'instfy-client']).default('instfy-light'),
  clientName: z.string().max(80),
  pages: z.array(slidePage).min(3).max(60),
  disclaimer: z.string().max(400).optional(),
});
export type PresentationSpec = z.infer<typeof presentationSpec>;

/* ----------------------------- AI stage outputs --------------------------- */

export const findingSchema = z.object({
  dimension: z.string().max(60),
  title: z.string().max(120),
  body: z.string().max(900),
  evidenceType: EvidenceType,
  sourceRefs: z.array(sourceRef).default([]),
  confidence: z.number().int().min(0).max(100).default(50),
});
export type FindingT = z.infer<typeof findingSchema>;

export const analysisOutput = z.object({
  findings: z.array(findingSchema).min(1).max(40),
  missingCriticalData: z.array(z.string().max(200)).default([]),
  researchPerformed: z.boolean().default(false),
});
export type AnalysisOutput = z.infer<typeof analysisOutput>;

export const narrativeOutput = z.object({
  title: title,
  subtitle: shortText.optional(),
  sections: z
    .array(
      z.object({
        numeral: z.string().max(8),
        heading: z.string().max(120),
        lead: z.string().max(640).optional(),
        body: z.array(z.string().max(900)).min(1).max(6),
        evidenceType: EvidenceType.default('INFERENCE'),
        sourceRefs: z.array(sourceRef).default([]),
      }),
    )
    .min(2)
    .max(14),
  closingMessage: z.string().max(640).optional(),
  nextSteps: z.array(z.string().max(220)).max(4).default([]),
});
export type NarrativeOutput = z.infer<typeof narrativeOutput>;

export const layoutPlanOutput = z.object({
  pages: z.array(slidePage).min(3).max(60),
});

export const proposalCopyOutput = z.object({
  headline: z.string().max(120),
  openingParagraphs: z.array(z.string().max(900)).min(1).max(3),
  valuePillars: z
    .array(z.object({ heading: z.string().max(48), text: z.string().max(240) }))
    .max(5)
    .default([]),
  closingNote: z.string().max(640).optional(),
});
export type ProposalCopyOutput = z.infer<typeof proposalCopyOutput>;
