/**
 * DEMO MODE content generator.
 *
 * Deterministic, derived only from the answers the user actually typed.
 * It never fabricates market statistics and never claims research. Every
 * generated claim is labelled HYPOTHESIS or INFERENCE unless it quotes a
 * form answer verbatim, in which case it is a FACT with that answer as source.
 */
import type { AnalysisOutput, NarrativeOutput, ProposalCopyOutput, SlidePage } from '@/lib/design/schema';
import { DISCOVERY_DIMENSIONS } from '@/lib/questionnaire';
import type { IntakeContext } from './prompts';

export const DEMO_BANNER =
  'MODO DEMONSTRAÇÃO — conteúdo gerado sem provedor de IA e sem pesquisa externa. Os textos derivam exclusivamente das respostas do questionário e servem para validar o fluxo, não para envio ao cliente.';

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function demoAnalysis(ctx: IntakeContext): AnalysisOutput {
  const byDimension = new Map<string, IntakeContext['answers']>();
  for (const a of ctx.answers) {
    const list = byDimension.get(a.dimension) ?? [];
    list.push(a);
    byDimension.set(a.dimension, list);
  }

  const findings: AnalysisOutput['findings'] = [];
  for (const [dimension, answers] of byDimension) {
    const longest = [...answers].sort((a, b) => b.value.length - a.value.length)[0];
    if (!longest) continue;
    findings.push({
      dimension,
      title: truncate(`${dimension}: ${longest.label}`, 118),
      body: truncate(
        `Registrado pelo cliente: "${longest.value}". ` +
          `Outras respostas nesta dimensão: ${answers
            .filter((a) => a.questionId !== longest.questionId)
            .map((a) => a.label)
            .join('; ') || 'nenhuma'}. ` +
          'Este achado reproduz o que foi declarado e não acrescenta dado externo.',
        880,
      ),
      evidenceType: 'FACT',
      sourceRefs: answers.map((a) => ({ kind: 'form_answer' as const, ref: a.questionId, label: truncate(a.label, 150) })),
      confidence: 80,
    });
  }

  if (ctx.missingCritical.length > 0) {
    findings.push({
      dimension: 'Lacunas',
      title: 'Dados críticos ausentes impedem conclusões firmes',
      body: truncate(
        `As seguintes informações críticas não foram respondidas: ${ctx.missingCritical
          .map((m) => m.label)
          .join('; ')}. Enquanto não forem preenchidas, nenhuma afirmação sobre esses pontos pode ser tratada como fato.`,
        880,
      ),
      evidenceType: 'FACT',
      sourceRefs: ctx.missingCritical.map((m) => ({ kind: 'form_answer' as const, ref: m.questionId })),
      confidence: 100,
    });
  }

  findings.push({
    dimension: 'Prioridades estratégicas',
    title: 'Hipótese de sequenciamento a validar com o cliente',
    body: truncate(
      `Com base apenas nas respostas registradas, a Instfy propõe tratar posicionamento e presença digital antes de ampliar investimento em aquisição. ` +
        'Esta é uma hipótese de trabalho da Instfy, não uma característica atual do cliente nem uma conclusão de pesquisa de mercado.',
      880,
    ),
    evidenceType: 'HYPOTHESIS',
    sourceRefs: [],
    confidence: 40,
  });

  return {
    findings: findings.slice(0, 40),
    missingCriticalData: ctx.missingCritical.map((m) => m.label),
    researchPerformed: false,
  };
}

export function demoNarrative(ctx: IntakeContext, analysis: AnalysisOutput): NarrativeOutput {
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  const grouped = new Map<string, AnalysisOutput['findings']>();
  for (const f of analysis.findings) {
    const list = grouped.get(f.dimension) ?? [];
    list.push(f);
    grouped.set(f.dimension, list);
  }
  const sections = [...grouped.entries()].slice(0, 11).map(([dimension, items], i) => ({
    numeral: romans[i] ?? String(i + 1),
    heading: truncate(dimension, 118),
    lead: truncate(
      DISCOVERY_DIMENSIONS.find((d) => d.name === dimension)?.intent ??
        'Leitura derivada das respostas registradas no questionário.',
      620,
    ),
    body: items.slice(0, 6).map((f) => truncate(f.body, 880)),
    evidenceType: items[0]?.evidenceType ?? ('INFERENCE' as const),
    sourceRefs: items.flatMap((f) => f.sourceRefs).slice(0, 6),
  }));

  // The narrative needs at least two sections to satisfy the schema.
  if (sections.length < 2) {
    sections.push({
      numeral: romans[sections.length] ?? 'II',
      heading: 'Lacunas de informação',
      lead: 'O questionário ainda não possui respostas suficientes para sustentar um estudo completo.',
      body: [
        truncate(
          `Dados críticos pendentes: ${ctx.missingCritical.map((m) => m.label).join('; ') || 'nenhum registrado'}. ` +
            'Nenhuma afirmação sobre esses pontos foi produzida.',
          880,
        ),
      ],
      evidenceType: 'FACT' as const,
      sourceRefs: [],
    });
  }

  return {
    title: truncate(`Estudo estratégico preliminar · ${ctx.clientName}`, 118),
    subtitle: truncate(`${ctx.sectorName} · documento gerado em modo demonstração`, 218),
    sections,
    closingMessage: truncate(
      'Este documento consolida um estudo preliminar. Conceitos, nomes de programas e cronogramas marcados como hipótese são propostas da Instfy a validar, não características já implantadas pelo cliente.',
      620,
    ),
    nextSteps: [
      'Completar os dados críticos pendentes do questionário',
      'Revisar e aprovar os achados classificados como hipótese',
      'Definir o escopo comercial na aba de proposta',
    ],
  };
}

export function demoProposalCopy(clientName: string, itemLabels: string[]): ProposalCopyOutput {
  return {
    headline: truncate(`Estratégia, marca e tecnologia para a ${clientName}`, 118),
    openingParagraphs: [
      truncate(
        `Esta proposta reúne as frentes selecionadas para a ${clientName}: ${itemLabels.join(', ') || 'nenhum serviço selecionado'}. ` +
          'O enquadramento abaixo foi gerado em modo demonstração e descreve apenas o raciocínio das frentes, sem qualquer afirmação de resultado.',
        880,
      ),
      truncate(
        'Os valores, condições de pagamento e descontos apresentados neste documento vêm do motor determinístico de precificação da Instfy e foram aprovados por um responsável humano. Nenhum número deste documento foi redigido por IA.',
        880,
      ),
    ],
    valuePillars: itemLabels.slice(0, 5).map((label) => ({
      heading: truncate(label, 46),
      text: truncate(`Frente contratada conforme escopo e limites detalhados na seção de entregas.`, 230),
    })),
    closingNote: truncate(
      'Texto de enquadramento gerado em modo demonstração. Substitua por redação aprovada antes de enviar ao cliente.',
      620,
    ),
  };
}

/** Deterministic layout plan built from an approved narrative. */
export function planPagesFromNarrative(
  narrative: NarrativeOutput,
  opts: { clientName: string; preparedFor: string[]; dateLabel?: string; demoMode: boolean },
): SlidePage[] {
  const pages: SlidePage[] = [];

  pages.push({
    layoutId: 'cover',
    eyebrow: 'Estudo estratégico',
    title: truncate(narrative.title, 118),
    subtitle: narrative.subtitle ? truncate(narrative.subtitle, 218) : undefined,
    clientName: truncate(opts.clientName, 78),
    preparedFor: opts.preparedFor.slice(0, 4).map((p) => truncate(p, 78)),
    dateLabel: opts.dateLabel,
    tagline: opts.demoMode ? 'Documento gerado em modo demonstração' : undefined,
  });

  pages.push({
    layoutId: 'bullets',
    kicker: 'Conteúdo',
    title: `${narrative.sections.length} partes, de leitura sequencial`,
    lead: opts.demoMode ? truncate(DEMO_BANNER, 620) : undefined,
    bullets: narrative.sections.slice(0, 6).map((s) => ({
      heading: truncate(`${s.numeral} · ${s.heading}`, 58),
      text: truncate(s.lead ?? s.body[0] ?? s.heading, 218),
    })),
    evidenceType: 'FACT',
    sourceRefs: [],
  });

  narrative.sections.forEach((section, index) => {
    pages.push({
      layoutId: 'chapter',
      numeral: section.numeral,
      kicker: truncate(section.heading, 58),
      title: truncate(section.heading, 118),
      lead: section.lead ? truncate(section.lead, 620) : undefined,
    });

    // Rotate interior archetypes so the deck reads as an edited document.
    const rotation = index % 4;
    if (rotation === 0) {
      pages.push({
        layoutId: 'editorial-split',
        kicker: `${section.numeral} · ${truncate(section.heading, 40)}`,
        title: truncate(section.body[0]?.split('. ')[0] ?? section.heading, 118),
        paragraphs: section.body.slice(0, 3).map((b) => truncate(b, 630)),
        side: index % 2 === 0 ? 'right' : 'left',
        evidenceType: section.evidenceType,
        sourceRefs: section.sourceRefs.slice(0, 4),
      });
    } else if (rotation === 1) {
      pages.push({
        layoutId: 'bullets',
        kicker: `${section.numeral} · ${truncate(section.heading, 40)}`,
        title: truncate(section.heading, 118),
        bullets: section.body.slice(0, 4).map((b) => ({ text: truncate(b, 218) })),
        evidenceType: section.evidenceType,
        sourceRefs: section.sourceRefs.slice(0, 4),
      });
    } else if (rotation === 2) {
      pages.push({
        layoutId: 'key-insight',
        kicker: `${section.numeral} · ${truncate(section.heading, 40)}`,
        statement: truncate(section.lead ?? section.body[0] ?? section.heading, 215),
        support: section.body.slice(1, 4).map((b) => truncate(b, 215)),
        evidenceType: section.evidenceType,
        sourceRefs: section.sourceRefs.slice(0, 4),
      });
    } else {
      pages.push({
        layoutId: 'comparison',
        kicker: `${section.numeral} · ${truncate(section.heading, 40)}`,
        title: truncate(section.heading, 118),
        columns: [
          {
            heading: 'O que está registrado',
            items: section.body.slice(0, 3).map((b) => truncate(b, 215)),
          },
          {
            heading: 'O que ainda precisa ser validado',
            items: [truncate(section.lead ?? 'A validar com o cliente.', 215)],
          },
        ],
        evidenceType: section.evidenceType,
        sourceRefs: section.sourceRefs.slice(0, 4),
      });
    }
  });

  pages.push({
    layoutId: 'roadmap',
    kicker: 'Próximo passo',
    title: 'Como avançamos a partir daqui',
    phases: [
      { label: 'Agora', focus: 'Validação dos achados', outcomes: ['Revisar hipóteses com o cliente', 'Completar dados críticos pendentes'] },
      { label: 'Em seguida', focus: 'Escopo comercial', outcomes: ['Selecionar frentes no catálogo', 'Aprovar condições comerciais'] },
      { label: 'Depois', focus: 'Execução', outcomes: ['Cronograma de implantação', 'Operação recorrente e indicadores'] },
    ],
    note: 'Sequência proposta pela Instfy, sujeita à validação do cliente.',
  });

  pages.push({
    layoutId: 'closing',
    title: 'Próximo passo',
    message: narrative.closingMessage ? truncate(narrative.closingMessage, 630) : undefined,
    nextSteps: narrative.nextSteps.slice(0, 4).map((s) => truncate(s, 215)),
    contactLine: 'Instfy Brasil Ltda · instfy.com',
  });

  return pages;
}
