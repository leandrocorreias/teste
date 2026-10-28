import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_DIMENSIONS,
  allQuestions,
  computeCompletion,
  questionsForSector,
} from '../lib/questionnaire';

describe('questionnaire structure', () => {
  it('covers all 14 required strategic dimensions', () => {
    expect(DISCOVERY_DIMENSIONS).toHaveLength(14);
    const ids = DISCOVERY_DIMENSIONS.map((d) => d.id);
    for (const required of [
      'modelo_negocio', 'oferta', 'cliente', 'mercado', 'concorrencia',
      'posicionamento', 'funil', 'marketing', 'operacao', 'tecnologia',
      'financeiro', 'objetivos', 'restricoes', 'prioridades',
    ]) {
      expect(ids).toContain(required);
    }
  });

  it('has globally unique question ids', () => {
    const ids = DISCOVERY_DIMENSIONS.flatMap((d) => d.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('shows sector-conditional questions only for their sectors', () => {
    const fitness = allQuestions('fitness_wellness').map((q) => q.id);
    const b2b = allQuestions('servicos_b2b').map((q) => q.id);
    expect(fitness).toContain('mn_capacidade');
    expect(fitness).toContain('tc_wearables');
    expect(b2b).not.toContain('mn_capacidade');
    expect(b2b).not.toContain('tc_wearables');
  });

  it('keeps every dimension non-empty for every sector', () => {
    for (const sector of ['fitness_wellness', 'servicos_b2b', 'varejo', 'outro']) {
      for (const d of questionsForSector(sector)) {
        expect(d.questions.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('completion tracking', () => {
  it('reports zero progress and all critical gaps on an empty form', () => {
    const c = computeCompletion('fitness_wellness', {});
    expect(c.answered).toBe(0);
    expect(c.pct).toBe(0);
    expect(c.missingCritical.length).toBe(c.criticalTotal);
    expect(c.criticalTotal).toBeGreaterThan(10);
  });

  it('does not count blank strings or empty arrays as answers', () => {
    const c = computeCompletion('outro', { mn_descricao: '   ', mn_receita: [], of_ticket: null });
    expect(c.answered).toBe(0);
  });

  it('counts numeric zero as a real answer', () => {
    const c = computeCompletion('outro', { fn_leads_mes: 0 });
    expect(c.answered).toBe(1);
  });

  it('clears a critical gap once answered', () => {
    const before = computeCompletion('outro', {});
    const after = computeCompletion('outro', { mn_descricao: 'Consultoria de estratégia.' });
    expect(after.missingCritical.length).toBe(before.missingCritical.length - 1);
    expect(after.missingCritical.map((m) => m.questionId)).not.toContain('mn_descricao');
  });
});
