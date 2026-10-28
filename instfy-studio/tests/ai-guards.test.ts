import { describe, expect, it } from 'vitest';
import { containsMonetaryClaim, noResearchClause } from '../lib/ai/prompts';
import { demoAnalysis, demoNarrative, planPagesFromNarrative, DEMO_BANNER } from '../lib/ai/demo';
import { narrativeOutput, presentationSpec, slidePage } from '../lib/design/schema';

const intake = {
  clientName: 'Cliente Exemplo',
  sectorName: 'Fitness e bem-estar',
  projectName: 'Discovery 2027',
  answers: [
    { questionId: 'mn_descricao', dimension: 'Modelo de negócio', label: 'Descreva o negócio', value: 'Estúdio de treinamento individualizado.' },
    { questionId: 'cl_perfil', dimension: 'Cliente', label: 'Perfil do cliente atual', value: 'Profissionais de 30 a 50 anos.' },
    { questionId: 'ob_12m', dimension: 'Objetivos', label: 'Objetivo principal', value: 'Ocupar a agenda em 12 meses.' },
  ],
  missingCritical: [{ questionId: 'fi_investimento', label: 'Investimento mensal disponível' }],
};

describe('monetary claim guard', () => {
  it('catches BRL amounts the AI must never write', () => {
    expect(containsMonetaryClaim('O investimento é de R$ 22.000 na implantação.')).toBe('R$ 22.000');
    expect(containsMonetaryClaim('Oferecemos 15% de desconto.')).toBe('15% de desconto');
    expect(containsMonetaryClaim('Serão 8.000 mensais.')).toBe('8.000 mensais');
  });

  it('allows prose with no monetary content', () => {
    expect(containsMonetaryClaim('Posicionamento, aquisição e retenção em um único ecossistema.')).toBeNull();
  });
});

describe('research honesty', () => {
  it('states plainly that no research was performed when no connector exists', () => {
    const clause = noResearchClause(false);
    expect(clause).toContain('NENHUM conector de pesquisa externa');
    expect(clause).toContain('"researchPerformed": false');
  });

  it('demo analysis never claims research', () => {
    expect(demoAnalysis(intake).researchPerformed).toBe(false);
  });
});

describe('demo mode output', () => {
  it('labels proposals from Instfy as hypotheses, not client facts', () => {
    const analysis = demoAnalysis(intake);
    const proposed = analysis.findings.filter((f) => f.evidenceType === 'HYPOTHESIS');
    expect(proposed.length).toBeGreaterThan(0);
    for (const f of proposed) expect(f.body).toMatch(/hipótese|propõe|validar/i);
  });

  it('every FACT finding carries at least one source reference', () => {
    for (const f of demoAnalysis(intake).findings) {
      if (f.evidenceType === 'FACT') expect(f.sourceRefs.length).toBeGreaterThan(0);
    }
  });

  it('surfaces missing critical data instead of filling it in', () => {
    const analysis = demoAnalysis(intake);
    expect(analysis.missingCriticalData).toContain('Investimento mensal disponível');
    const gap = analysis.findings.find((f) => f.dimension === 'Lacunas');
    expect(gap?.body).toContain('Investimento mensal disponível');
  });

  it('produces a schema-valid narrative', () => {
    const narrative = demoNarrative(intake, demoAnalysis(intake));
    expect(narrativeOutput.safeParse(narrative).success).toBe(true);
  });

  it('produces a schema-valid multi-page deck with cover, chapters and closing', () => {
    const narrative = demoNarrative(intake, demoAnalysis(intake));
    const pages = planPagesFromNarrative(narrative, {
      clientName: 'Cliente Exemplo',
      preparedFor: ['Fulana · CEO'],
      dateLabel: '28/10/2026',
      demoMode: true,
    });
    for (const p of pages) {
      const r = slidePage.safeParse(p);
      if (!r.success) throw new Error(`${p.layoutId}: ${JSON.stringify(r.error.issues)}`);
    }
    expect(pages.length).toBeGreaterThanOrEqual(8);
    expect(pages[0].layoutId).toBe('cover');
    expect(pages[pages.length - 1].layoutId).toBe('closing');
    expect(pages.filter((p) => p.layoutId === 'chapter').length).toBeGreaterThanOrEqual(2);
    // At least 5 distinct archetypes so the deck is not visually monotonous.
    expect(new Set(pages.map((p) => p.layoutId)).size).toBeGreaterThanOrEqual(5);

    const spec = presentationSpec.safeParse({
      title: narrative.title,
      clientName: 'Cliente Exemplo',
      themeId: 'instfy-light',
      pages,
    });
    expect(spec.success).toBe(true);
  });

  it('marks demo decks as demo on the page itself', () => {
    const narrative = demoNarrative(intake, demoAnalysis(intake));
    const pages = planPagesFromNarrative(narrative, { clientName: 'X', preparedFor: [], demoMode: true });
    const text = JSON.stringify(pages);
    expect(text).toContain('demonstração');
    expect(DEMO_BANNER).toContain('sem pesquisa externa');
  });
});
