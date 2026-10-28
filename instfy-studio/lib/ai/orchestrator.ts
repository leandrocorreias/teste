/**
 * Stage orchestration: Intake -> Research -> Analysis -> Strategy -> Narrative
 * -> Layout Plan -> Validation.
 *
 * Research is SKIPPED unless RESEARCH_CONNECTOR names a real connector. The app
 * never claims research it did not perform.
 */
import { prisma } from '@/lib/db';
import {
  analysisOutput,
  layoutPlanOutput,
  narrativeOutput,
  proposalCopyOutput,
  slidePage,
  type AnalysisOutput,
  type NarrativeOutput,
  type ProposalCopyOutput,
  type SlidePage,
} from '@/lib/design/schema';
import { fitPages, type LayoutWarning } from '@/lib/design/validate';
import { allQuestions, computeCompletion, DISCOVERY_DIMENSIONS, SECTORS } from '@/lib/questionnaire';
import { demoAnalysis, demoNarrative, demoProposalCopy, planPagesFromNarrative } from './demo';
import {
  ANALYSIS_SYSTEM,
  containsMonetaryClaim,
  intakeBlock,
  layoutPlanSystem,
  noResearchClause,
  PROPOSAL_COPY_SYSTEM,
  STRATEGY_NARRATIVE_SYSTEM,
  type IntakeContext,
} from './prompts';
import { complete, extractJson, promptHash, resolveProvider } from './provider';

export interface StageMeta {
  stage: string;
  provider: string;
  model: string;
  demoMode: boolean;
  researchPerformed: boolean;
  validationOk: boolean;
  latencyMs: number;
  notes: string[];
}

async function recordRun(
  projectId: string | null,
  meta: StageMeta,
  prompt: string,
  tokens: { input?: number; output?: number } = {},
  error?: string,
) {
  await prisma.aiRun.create({
    data: {
      projectId,
      stage: meta.stage,
      provider: meta.provider,
      model: meta.model,
      demoMode: meta.demoMode,
      status: error ? 'error' : 'ok',
      // Only a hash is stored: prompt inputs carry confidential client detail.
      promptHash: promptHash(prompt),
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      latencyMs: meta.latencyMs,
      validationOk: meta.validationOk,
      error,
    },
  });
}

/** INTAKE — assembles the factual context from the stored submission. */
export async function buildIntake(projectId: string): Promise<IntakeContext & { completion: ReturnType<typeof computeCompletion> }> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      client: true,
      submissions: { orderBy: { createdAt: 'desc' }, take: 1, include: { answers: true } },
    },
  });

  const submission = project.submissions[0];
  const raw: Record<string, unknown> = {};
  for (const a of submission?.answers ?? []) {
    try {
      raw[a.questionId] = JSON.parse(a.valueJson);
    } catch {
      raw[a.questionId] = a.valueJson;
    }
  }

  const questions = allQuestions(project.sector);
  const dimensionOf = new Map<string, string>();
  for (const d of DISCOVERY_DIMENSIONS) for (const q of d.questions) dimensionOf.set(q.id, d.name);

  const answers = questions
    .map((q) => {
      const v = raw[q.id];
      const value = Array.isArray(v) ? v.join(', ') : v === null || v === undefined ? '' : String(v);
      return { questionId: q.id, dimension: dimensionOf.get(q.id) ?? 'Outros', label: q.label, value: value.trim() };
    })
    .filter((a) => a.value !== '');

  const completion = computeCompletion(project.sector, raw);

  return {
    clientName: project.client.name,
    sectorName: SECTORS.find((s) => s.id === project.sector)?.name ?? project.sector,
    projectName: project.name,
    answers,
    missingCritical: completion.missingCritical.map((m) => ({ questionId: m.questionId, label: m.label })),
    completion,
  };
}

/** RESEARCH — intentionally a no-op unless a real connector is configured. */
export async function runResearch(projectId: string): Promise<{ performed: boolean; note: string; sources: number }> {
  const provider = resolveProvider();
  if (!provider.researchEnabled) {
    return {
      performed: false,
      note: 'Etapa de pesquisa ignorada: nenhum conector de fontes externas está configurado. Nenhuma pesquisa externa foi realizada e nenhum dado externo será afirmado como fato.',
      sources: 0,
    };
  }
  // A real connector would populate ResearchSource rows here. Until one exists,
  // we refuse to pretend: the stage reports that it is configured but unimplemented.
  const existing = await prisma.researchSource.count({ where: { projectId } });
  return {
    performed: false,
    note: `Conector "${process.env.RESEARCH_CONNECTOR}" declarado, mas nenhum adaptador de coleta está implementado nesta build. Nenhuma pesquisa foi executada.`,
    sources: existing,
  };
}

/** ANALYSIS — structured findings with evidence labels. */
export async function runAnalysis(projectId: string): Promise<{ output: AnalysisOutput; meta: StageMeta }> {
  const provider = resolveProvider();
  const intake = await buildIntake(projectId);
  const research = await runResearch(projectId);
  const notes: string[] = [research.note];
  const started = Date.now();

  const user = [
    intakeBlock(intake),
    '',
    noResearchClause(provider.researchEnabled),
  ].join('\n');

  if (provider.demoMode) {
    const output = demoAnalysis(intake);
    const meta: StageMeta = {
      stage: 'analysis',
      provider: 'demo',
      model: provider.model,
      demoMode: true,
      researchPerformed: false,
      validationOk: true,
      latencyMs: Date.now() - started,
      notes: [...notes, 'Achados derivados mecanicamente das respostas. Nenhum modelo de linguagem foi chamado.'],
    };
    await recordRun(projectId, meta, user);
    return { output, meta };
  }

  try {
    const result = await complete({ system: ANALYSIS_SYSTEM, user, schemaName: 'analysisOutput' });
    const parsed = analysisOutput.safeParse(extractJson(result.raw));
    if (!parsed.success) {
      const meta: StageMeta = {
        stage: 'analysis', provider: provider.id, model: provider.model, demoMode: false,
        researchPerformed: false, validationOk: false, latencyMs: result.latencyMs,
        notes: [...notes, 'Saída do modelo reprovada na validação de schema.'],
      };
      await recordRun(projectId, meta, user, {}, parsed.error.message.slice(0, 500));
      throw new Error(`A saída da IA não passou na validação: ${parsed.error.issues[0]?.message ?? 'formato inválido'}`);
    }
    // The model cannot grant itself research it did not perform.
    const output: AnalysisOutput = { ...parsed.data, researchPerformed: provider.researchEnabled && parsed.data.researchPerformed };
    if (parsed.data.researchPerformed && !provider.researchEnabled) {
      notes.push('O modelo declarou ter pesquisado sem conector configurado. A declaração foi rejeitada.');
    }
    const meta: StageMeta = {
      stage: 'analysis', provider: provider.id, model: provider.model, demoMode: false,
      researchPerformed: output.researchPerformed, validationOk: true, latencyMs: result.latencyMs, notes,
    };
    await recordRun(projectId, meta, user, { input: result.inputTokens, output: result.outputTokens });
    return { output, meta };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const meta: StageMeta = {
      stage: 'analysis', provider: provider.id, model: provider.model, demoMode: false,
      researchPerformed: false, validationOk: false, latencyMs: Date.now() - started,
      notes: [...notes, message],
    };
    await recordRun(projectId, meta, user, {}, message.slice(0, 500));
    throw error;
  }
}

/** STRATEGY + NARRATIVE — editable prose built on approved findings. */
export async function runNarrative(
  projectId: string,
  findings: Array<{ dimension: string; title: string; body: string; evidenceType: string; sourceRefs: string }>,
): Promise<{ output: NarrativeOutput; meta: StageMeta }> {
  const provider = resolveProvider();
  const intake = await buildIntake(projectId);
  const started = Date.now();

  const findingsBlock = findings
    .map((f) => `- [${f.evidenceType}] (${f.dimension}) ${f.title}\n  ${f.body}\n  FONTES: ${f.sourceRefs}`)
    .join('\n');

  const user = [
    intakeBlock(intake),
    '',
    'ACHADOS APROVADOS PELO ESTRATEGISTA HUMANO:',
    findingsBlock || '- (nenhum achado aprovado)',
    '',
    noResearchClause(provider.researchEnabled),
  ].join('\n');

  if (provider.demoMode) {
    const analysis: AnalysisOutput = {
      findings: findings.map((f) => ({
        dimension: f.dimension,
        title: f.title,
        body: f.body,
        evidenceType: (['FACT', 'SIGNAL', 'INFERENCE', 'HYPOTHESIS'] as const).includes(f.evidenceType as never)
          ? (f.evidenceType as 'FACT')
          : 'INFERENCE',
        sourceRefs: [],
        confidence: 50,
      })),
      missingCriticalData: intake.missingCritical.map((m) => m.label),
      researchPerformed: false,
    };
    const output = demoNarrative(intake, analysis);
    const meta: StageMeta = {
      stage: 'narrative', provider: 'demo', model: provider.model, demoMode: true,
      researchPerformed: false, validationOk: true, latencyMs: Date.now() - started,
      notes: ['Narrativa montada a partir dos achados aprovados, sem chamada a modelo de linguagem.'],
    };
    await recordRun(projectId, meta, user);
    return { output, meta };
  }

  const result = await complete({ system: STRATEGY_NARRATIVE_SYSTEM, user, schemaName: 'narrativeOutput' });
  const parsed = narrativeOutput.safeParse(extractJson(result.raw));
  if (!parsed.success) {
    const meta: StageMeta = {
      stage: 'narrative', provider: provider.id, model: provider.model, demoMode: false,
      researchPerformed: false, validationOk: false, latencyMs: result.latencyMs,
      notes: ['Saída reprovada na validação de schema.'],
    };
    await recordRun(projectId, meta, user, {}, parsed.error.message.slice(0, 500));
    throw new Error(`A narrativa gerada não passou na validação: ${parsed.error.issues[0]?.message ?? 'formato inválido'}`);
  }
  const meta: StageMeta = {
    stage: 'narrative', provider: provider.id, model: provider.model, demoMode: false,
    researchPerformed: provider.researchEnabled, validationOk: true, latencyMs: result.latencyMs, notes: [],
  };
  await recordRun(projectId, meta, user, { input: result.inputTokens, output: result.outputTokens });
  return { output: parsed.data, meta };
}

/** LAYOUT PLAN + VALIDATION — layout ids and content only, then fitted. */
export async function runLayoutPlan(
  projectId: string,
  narrative: NarrativeOutput,
  opts: { clientName: string; preparedFor: string[]; dateLabel?: string },
): Promise<{ pages: SlidePage[]; warnings: LayoutWarning[]; meta: StageMeta }> {
  const provider = resolveProvider();
  const started = Date.now();
  const user = [
    `CLIENTE: ${opts.clientName}`,
    `PREPARADO PARA: ${opts.preparedFor.join(', ') || 'não informado'}`,
    '',
    'NARRATIVA APROVADA (JSON):',
    JSON.stringify(narrative),
  ].join('\n');

  let rawPages: SlidePage[];
  let demo = provider.demoMode;
  const notes: string[] = [];

  if (provider.demoMode) {
    rawPages = planPagesFromNarrative(narrative, { ...opts, demoMode: true });
    notes.push('Plano de layout determinístico (modo demonstração).');
  } else {
    try {
      const result = await complete({ system: layoutPlanSystem(), user, schemaName: 'layoutPlanOutput', maxTokens: 12000 });
      const parsed = layoutPlanOutput.safeParse(extractJson(result.raw));
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'formato inválido');
      rawPages = parsed.data.pages;
    } catch (error) {
      // Falling back is safe: the deterministic planner always produces a valid deck.
      notes.push(
        `Plano da IA rejeitado (${error instanceof Error ? error.message : String(error)}). Usado o planejador determinístico da Instfy.`,
      );
      rawPages = planPagesFromNarrative(narrative, { ...opts, demoMode: false });
      demo = false;
    }
  }

  // Every page passes schema validation again before it can reach a renderer.
  const validated: SlidePage[] = [];
  rawPages.forEach((p, i) => {
    const r = slidePage.safeParse(p);
    if (r.success) validated.push(r.data);
    else notes.push(`Página ${i + 1} descartada na validação: ${r.error.issues[0]?.message ?? 'inválida'}.`);
  });

  const { pages, warnings } = fitPages(validated);

  const meta: StageMeta = {
    stage: 'layout_plan', provider: demo ? 'demo' : provider.id, model: provider.model, demoMode: demo,
    researchPerformed: false, validationOk: validated.length === rawPages.length,
    latencyMs: Date.now() - started, notes,
  };
  await recordRun(projectId, meta, user);
  return { pages, warnings, meta };
}

/** Proposal copy — constrained to contain no monetary figure at all. */
export async function runProposalCopy(
  projectId: string,
  clientName: string,
  itemLabels: string[],
  context: string,
): Promise<{ output: ProposalCopyOutput; meta: StageMeta }> {
  const provider = resolveProvider();
  const started = Date.now();
  const user = [
    `CLIENTE: ${clientName}`,
    `FRENTES CONTRATADAS (apenas nomes, sem valores): ${itemLabels.join('; ') || 'nenhuma'}`,
    '',
    'CONTEXTO ESTRATÉGICO APROVADO:',
    context || '(nenhum contexto de discovery aprovado)',
  ].join('\n');

  const strip = (output: ProposalCopyOutput): { output: ProposalCopyOutput; notes: string[] } => {
    const notes: string[] = [];
    const guard = (text: string, where: string): string => {
      const hit = containsMonetaryClaim(text);
      if (hit) {
        notes.push(`Valor monetário "${hit}" removido de ${where}: a IA não define preços.`);
        return text.replace(hit, '[valor conforme tabela comercial]');
      }
      return text;
    };
    return {
      output: {
        headline: guard(output.headline, 'título'),
        openingParagraphs: output.openingParagraphs.map((p, i) => guard(p, `parágrafo ${i + 1}`)),
        valuePillars: output.valuePillars.map((v) => ({ heading: v.heading, text: guard(v.text, `pilar "${v.heading}"`) })),
        closingNote: output.closingNote ? guard(output.closingNote, 'nota final') : undefined,
      },
      notes,
    };
  };

  if (provider.demoMode) {
    const { output, notes } = strip(demoProposalCopy(clientName, itemLabels));
    const meta: StageMeta = {
      stage: 'proposal_copy', provider: 'demo', model: provider.model, demoMode: true,
      researchPerformed: false, validationOk: true, latencyMs: Date.now() - started,
      notes: ['Texto de enquadramento gerado em modo demonstração.', ...notes],
    };
    await recordRun(projectId, meta, user);
    return { output, meta };
  }

  const result = await complete({ system: PROPOSAL_COPY_SYSTEM, user, schemaName: 'proposalCopyOutput' });
  const parsed = proposalCopyOutput.safeParse(extractJson(result.raw));
  if (!parsed.success) {
    const meta: StageMeta = {
      stage: 'proposal_copy', provider: provider.id, model: provider.model, demoMode: false,
      researchPerformed: false, validationOk: false, latencyMs: result.latencyMs, notes: [],
    };
    await recordRun(projectId, meta, user, {}, parsed.error.message.slice(0, 500));
    throw new Error(`O texto da proposta não passou na validação: ${parsed.error.issues[0]?.message ?? 'formato inválido'}`);
  }
  const { output, notes } = strip(parsed.data);
  const meta: StageMeta = {
    stage: 'proposal_copy', provider: provider.id, model: provider.model, demoMode: false,
    researchPerformed: false, validationOk: true, latencyMs: result.latencyMs, notes,
  };
  await recordRun(projectId, meta, user, { input: result.inputTokens, output: result.outputTokens });
  return { output, meta };
}
