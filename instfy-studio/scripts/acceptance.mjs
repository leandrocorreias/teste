/**
 * End-to-end acceptance run against a live dev server.
 *
 * Exercises both workflows exactly as the UI does — same API routes, same
 * payloads — and asserts the numbers the reference proposals require.
 * Usage: node scripts/acceptance.mjs
 */
const BASE = process.env.APP_BASE_URL || 'http://localhost:3100';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  return { status: res.status, ok: res.ok, json, text };
}

async function waitForJob(jobId, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { json } = await call(`/api/jobs/${jobId}`);
    if (json?.status === 'done' || json?.status === 'failed') return json;
    if (Date.now() > deadline) return { status: 'timeout', error: `excedeu ${timeoutMs}ms` };
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const R = (reais) => reais * 100;
const section = (t) => console.log(`\n${t}`);

async function main() {
  const stamp = Date.now();

  /* ---------------- A. Discovery -> analysis -> presentation ------------- */
  section('A. Discovery → análise → narrativa aprovada → apresentação PDF');

  const clientRes = await call('/api/clients', {
    method: 'POST',
    body: JSON.stringify({
      name: `Aceite Fitness ${stamp}`,
      sector: 'fitness_wellness',
      city: 'São Paulo',
      state: 'SP',
      contacts: [{ name: 'Joana', role: 'CEO', email: '', phone: '' }],
    }),
  });
  check('cria cliente', clientRes.status === 201, clientRes.json?.error);
  const clientId = clientRes.json?.client?.id;
  if (!clientId) throw new Error('sem cliente, abortando');

  const projectRes = await call('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ clientId, name: 'Aceite — posicionamento e crescimento', sector: 'fitness_wellness' }),
  });
  check('cria projeto', projectRes.status === 201, projectRes.json?.error);
  const projectId = projectRes.json?.project?.id;

  const answers = {
    mn_descricao: 'Estúdio de treinamento individualizado com até três alunos simultâneos.',
    mn_tempo: '8 meses',
    mn_receita: ['Mensalidade / assinatura', 'Pacotes'],
    mn_capacidade: 3,
    mn_modalidades: 'Treinamento funcional, pilates e mobilidade.',
    of_principal: 'Acompanhamento individualizado com avaliação e progressão.',
    of_ticket: '890,00',
    cl_perfil: 'Profissionais de 30 a 55 anos com rotina intensa.',
    cl_dor: 'Manter constância em uma rotina de treino com acompanhamento real.',
    mk_regiao: 'Vila Clementino, São Paulo',
    cc_diretos: 'Academias convencionais, academias premium e personal particular.',
    po_promessa: 'Atenção individual e continuidade no acompanhamento.',
    po_maturidade: 'Logo apenas',
    fn_etapas: 'Contato pelo Instagram, visita ao estúdio, aula experimental e matrícula.',
    fn_canais_entrada: ['Indicação', 'Instagram'],
    mg_canais: ['Instagram'],
    mg_verba: '10.000,00',
    op_equipe: 'Dois sócios e três profissionais de educação física.',
    op_gargalos: 'Agenda concentrada no início da manhã e no fim da tarde.',
    fi_investimento: '20.000,00',
    fi_horizonte: '12 meses',
    ob_12m: 'Ocupar a agenda e consolidar a marca na região.',
    ob_metrica: 'Alunos ativos',
    pr_ordem: ['Posicionamento e marca', 'Aquisição de clientes', 'Presença digital'],
    pr_90dias: 'Identidade visual e site publicados, com campanhas rodando.',
  };

  const discoveryRes = await call(`/api/projects/${projectId}/discovery`, {
    method: 'POST',
    body: JSON.stringify({ answers, submit: true }),
  });
  check('salva e envia o questionário', discoveryRes.ok, discoveryRes.json?.error);
  check(
    'relata progresso e lacunas críticas',
    typeof discoveryRes.json?.completion?.pct === 'number' && Array.isArray(discoveryRes.json?.completion?.missingCritical),
  );

  const analysisRes = await call(`/api/projects/${projectId}/analysis`, { method: 'POST' });
  check('roda a análise', analysisRes.ok, analysisRes.json?.error);
  check('produz achados', (analysisRes.json?.findings ?? 0) > 0, `findings=${analysisRes.json?.findings}`);
  check(
    'NÃO afirma ter feito pesquisa externa',
    analysisRes.json?.researchPerformed === false,
    `researchPerformed=${analysisRes.json?.researchPerformed}`,
  );

  const listRes = await call(`/api/projects/${projectId}/analysis`);
  check('lista os achados persistidos', listRes.ok, listRes.json?.error);
  const storedFindings = listRes.json?.findings ?? [];
  check('achados carregam classificação de evidência', storedFindings.every((f) => ['FACT', 'SIGNAL', 'INFERENCE', 'HYPOTHESIS'].includes(f.evidenceType)));
  check(
    'todo achado FACT cita ao menos uma fonte',
    storedFindings.filter((f) => f.evidenceType === 'FACT').every((f) => (f.sourceRefs ?? []).length > 0),
  );
  check(
    'propostas da Instfy são marcadas como hipótese',
    storedFindings.some((f) => f.evidenceType === 'HYPOTHESIS'),
  );

  // Approve findings through the same endpoint the workbench calls.
  let approvedCount = 0;
  for (const { id } of storedFindings.slice(0, 20)) {
    const r = await call(`/api/findings/${id}`, { method: 'PATCH', body: JSON.stringify({ approved: true }) });
    if (r.ok) approvedCount += 1;
  }
  check('aprova achados pela API', approvedCount > 0, `aprovados=${approvedCount} de ${storedFindings.length}`);

  const narrativeRes = await call(`/api/projects/${projectId}/narrative`, { method: 'POST' });
  check('gera narrativa a partir dos achados aprovados', narrativeRes.ok, narrativeRes.json?.error);
  const narrativeId = narrativeRes.json?.narrative?.id;

  const blockedPresentation = await call(`/api/projects/${projectId}/presentation`, {
    method: 'POST',
    body: JSON.stringify({ themeId: 'instfy-light' }),
  });
  check(
    'bloqueia a apresentação enquanto a narrativa não é aprovada',
    blockedPresentation.status === 400,
    `status=${blockedPresentation.status}`,
  );

  const approveRes = await call(`/api/projects/${projectId}/narrative`, {
    method: 'PATCH',
    body: JSON.stringify({ narrativeId, approve: true }),
  });
  check('aprova a narrativa', approveRes.ok, approveRes.json?.error);

  const presentationRes = await call(`/api/projects/${projectId}/presentation`, {
    method: 'POST',
    body: JSON.stringify({ themeId: 'instfy-light', screenshots: true }),
  });
  check('enfileira a geração da apresentação', presentationRes.ok, presentationRes.json?.error);
  check('planeja múltiplas páginas', (presentationRes.json?.pages ?? 0) >= 8, `páginas=${presentationRes.json?.pages}`);

  const presentationJob = await waitForJob(presentationRes.json?.jobId);
  check('gera o PDF da apresentação', presentationJob.status === 'done', presentationJob.error ?? presentationJob.status);
  check(
    'PDF da apresentação tem múltiplas páginas',
    (presentationJob.result?.pageCount ?? 0) >= 8,
    `pageCount=${presentationJob.result?.pageCount}`,
  );

  if (presentationJob.downloadUrl) {
    const pdf = await fetch(`${BASE}${presentationJob.downloadUrl}`);
    const buf = Buffer.from(await pdf.arrayBuffer());
    check('download do PDF responde 200', pdf.status === 200);
    check('arquivo é um PDF válido', buf.subarray(0, 5).toString() === '%PDF-', buf.subarray(0, 8).toString());
    check('PDF não é trivialmente pequeno', buf.length > 20_000, `${buf.length} bytes`);
    check(
      'nenhuma página da apresentação transborda o quadro',
      (presentationJob.result?.overflowPages ?? []).length === 0,
      JSON.stringify(presentationJob.result?.overflowPages),
    );
    console.log(`        apresentação: ${Math.round(buf.length / 1024)} KB, ${presentationJob.result?.pageCount} páginas`);
    console.log(`        capturas: ${(presentationJob.result?.screenshots ?? []).length}`);
  }

  // PPTX is exported from the already-validated pages, after the PDF exists.
  const pptxRes = await call(`/api/projects/${projectId}/presentation/pptx`, { method: 'POST' });
  check('enfileira a exportação PPTX', pptxRes.ok, pptxRes.json?.error);
  const pptxJob = await waitForJob(pptxRes.json?.jobId);
  check('gera o PPTX', pptxJob.status === 'done', pptxJob.error ?? pptxJob.status);
  if (pptxJob.downloadUrl) {
    const file = await fetch(`${BASE}${pptxJob.downloadUrl}`);
    const buf = Buffer.from(await file.arrayBuffer());
    check('PPTX é um arquivo OOXML válido (assinatura ZIP)', buf.subarray(0, 2).toString() === 'PK', buf.subarray(0, 4).toString('hex'));
    check('PPTX tem o mesmo número de páginas do deck', pptxJob.result?.pageCount === presentationJob.result?.logicalPageCount, `pptx=${pptxJob.result?.pageCount} deck=${presentationJob.result?.logicalPageCount}`);
    console.log(`        pptx: ${Math.round(buf.length / 1024)} KB, ${pptxJob.result?.pageCount} slides`);
  }

  /* ------------------- B. Muscle Up reference service mix ---------------- */
  section('B. Proposta com o mix de referência Muscle Up');

  const proposalRes = await call(`/api/projects/${projectId}/proposal`, { method: 'POST' });
  check('cria a proposta v1', proposalRes.status === 201, proposalRes.json?.error);
  const proposalId = proposalRes.json?.proposal?.id;

  const muscleUpItems = [
    { label: 'Pré-Discovery e diagnóstico estratégico', billingModel: 'one_time', unitAmount: '5.000,00', bonified: true, quantity: 1, tiers: [], scope: [], exclusions: [], discountPct: 0, discountApproved: false, isThirdPartySpend: false },
    { label: 'Branding e posicionamento de marca', billingModel: 'one_time', unitAmount: '10.000,00', quantity: 1, bonified: false, tiers: [], scope: ['Plataforma de marca', 'Manual de identidade'], exclusions: ['Produção gráfica'], discountPct: 0, discountApproved: false, isThirdPartySpend: false },
    { label: 'Website, SEO, IA e web app', billingModel: 'one_time', unitAmount: '12.000,00', quantity: 1, bonified: false, tiers: [], scope: ['Website de até 10 páginas', 'SEO técnico e semântico'], exclusions: ['Domínio e hospedagem'], discountPct: 0, discountApproved: false, isThirdPartySpend: false },
    { label: 'Estratégia e ativações recorrentes', billingModel: 'monthly', unitAmount: '8.000,00', quantity: 1, monthsCovered: 12, bonified: false, tiers: [], scope: ['Até 12 peças digitais por mês'], exclusions: ['Mídia paga'], discountPct: 0, discountApproved: false, isThirdPartySpend: false },
    { label: 'Gestão de campanhas de mídia paga', billingModel: 'percent_of_base', unitAmount: '0,00', percentPct: 20, percentBase: '10.000,00', monthsCovered: 12, quantity: 1, bonified: false, tiers: [], scope: [], exclusions: [], discountPct: 0, discountApproved: false, isThirdPartySpend: false },
    { label: 'Verba de anúncios (paga às plataformas)', billingModel: 'third_party_spend', unitAmount: '10.000,00', monthsCovered: 12, quantity: 1, bonified: false, tiers: [], scope: [], exclusions: [], discountPct: 0, discountApproved: false, isThirdPartySpend: true },
  ];

  const saveRes = await call(`/api/proposals/${proposalId}`, {
    method: 'PATCH',
    body: JSON.stringify({ items: muscleUpItems, termMonths: 12, taxRatePct: null }),
  });
  check('salva e recalcula os itens', saveRes.ok, saveRes.json?.error);

  const t = saveRes.json?.totals ?? {};
  check('implantação única = R$ 22.000', t.oneTimeCents === R(22000), `recebido ${t.oneTimeCents}`);
  check('discovery bonificado não é cobrado', saveRes.json?.spec?.financial?.bonifiedLabel === 'R$ 5.000,00', saveRes.json?.spec?.financial?.bonifiedLabel);
  check('operação mensal mês 1 = R$ 10.000 (8.000 + 2.000)', t.recurringFirstMonthCents === R(10000), `recebido ${t.recurringFirstMonthCents}`);
  check('gestão de mídia = 20% de R$ 10.000 = R$ 2.000', t.monthlyBreakdown?.[0] === R(10000) && t.recurringTotalCents === R(120000), `total recorrente ${t.recurringTotalCents}`);
  check('verba de terceiros rastreada à parte (R$ 120.000 em 12 meses)', t.thirdPartySpendCents === R(120000), `recebido ${t.thirdPartySpendCents}`);
  check('honorários Instfy = R$ 142.000', t.instfyFeesCents === R(142000), `recebido ${t.instfyFeesCents}`);
  check('desembolso total do cliente = R$ 262.000', t.clientTotalCashOutlayCents === R(262000), `recebido ${t.clientTotalCashOutlayCents}`);
  check('primeiro mês = R$ 18.800 (parcela 1 + mês 1)', t.firstMonthDueCents === R(18800), `recebido ${t.firstMonthDueCents}`);
  check('nenhum tributo adicionado sem configuração', t.taxCents === null, `recebido ${t.taxCents}`);
  check('cronograma 40/30/30 emitido', saveRes.json?.spec?.schedule?.[0]?.amountLabel === 'R$ 8.800,00', JSON.stringify(saveRes.json?.spec?.schedule?.map((s) => s.amountLabel)));

  const copyRes = await call(`/api/proposals/${proposalId}/copy`, { method: 'POST' });
  check('redige o enquadramento da proposta', copyRes.ok, copyRes.json?.error);
  const copyText = JSON.stringify(copyRes.json?.narrative ?? {});
  check('texto gerado não contém valor monetário', !/R\$\s*[\d.]/.test(copyText), copyText.slice(0, 160));

  const generateRes = await call(`/api/proposals/${proposalId}/generate`, {
    method: 'POST',
    body: JSON.stringify({ screenshots: true }),
  });
  check('enfileira o PDF da proposta', generateRes.ok, generateRes.json?.error);
  const proposalJob = await waitForJob(generateRes.json?.jobId);
  check('gera o PDF da proposta', proposalJob.status === 'done', proposalJob.error ?? proposalJob.status);

  if (proposalJob.downloadUrl) {
    const pdf = await fetch(`${BASE}${proposalJob.downloadUrl}`);
    const buf = Buffer.from(await pdf.arrayBuffer());
    check('PDF da proposta é válido', buf.subarray(0, 5).toString() === '%PDF-');
    check('PDF da proposta tem páginas suficientes', (proposalJob.result?.pageCount ?? 0) >= 4, `pageCount=${proposalJob.result?.pageCount}`);
    check(
      'nenhuma página da proposta transborda o A4',
      (proposalJob.result?.overflowPages ?? []).length === 0,
      JSON.stringify(proposalJob.result?.overflowPages),
    );
    check(
      'páginas físicas batem com as páginas lógicas',
      proposalJob.result?.pageCount === proposalJob.result?.logicalPageCount,
      `físicas=${proposalJob.result?.pageCount} lógicas=${proposalJob.result?.logicalPageCount}`,
    );
    console.log(`        proposta: ${Math.round(buf.length / 1024)} KB, ${proposalJob.result?.pageCount} páginas`);
  }

  /* ------------------------- C. MYO stepped pricing ---------------------- */
  section('C. Precificação escalonada MYO (meses 1–6 e 7–12)');

  const myoProposal = await call(`/api/projects/${projectId}/proposal`, { method: 'POST' });
  const myoId = myoProposal.json?.proposal?.id;
  const myoSave = await call(`/api/proposals/${myoId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      termMonths: 12,
      taxRatePct: null,
      items: [
        {
          label: 'Estratégia, marketing e ativações recorrentes',
          billingModel: 'tiered_monthly',
          unitAmount: '0,00',
          quantity: 1,
          monthsCovered: 12,
          bonified: false,
          discountPct: 0,
          discountApproved: false,
          isThirdPartySpend: false,
          scope: [],
          exclusions: [],
          tiers: [
            { fromMonth: 1, toMonth: 6, amount: '5.000,00', label: 'Condição de lançamento' },
            { fromMonth: 7, toMonth: null, amount: '8.000,00', label: 'Mensalidade contratual' },
          ],
        },
      ],
    }),
  });
  check('salva a proposta escalonada', myoSave.ok, myoSave.json?.error);
  const m = myoSave.json?.totals ?? {};
  check('meses 1–6 a R$ 5.000', (m.monthlyBreakdown ?? []).slice(0, 6).every((v) => v === R(5000)), JSON.stringify((m.monthlyBreakdown ?? []).slice(0, 6)));
  check('meses 7–12 a R$ 8.000', (m.monthlyBreakdown ?? []).slice(6, 12).every((v) => v === R(8000)), JSON.stringify((m.monthlyBreakdown ?? []).slice(6, 12)));
  check('recorrência total = R$ 78.000 em 12 meses', m.recurringTotalCents === R(78000), `recebido ${m.recurringTotalCents}`);
  check('sem verba de terceiros quando nenhuma mídia é contratada', m.thirdPartySpendCents === 0, `recebido ${m.thirdPartySpendCents}`);

  /* ------------------------ Policy and safety checks --------------------- */
  section('E/F. Catálogo, versões, erros e segurança');

  const catalogCreate = await call('/api/services', {
    method: 'POST',
    body: JSON.stringify({
      code: `TESTE-${stamp}`,
      name: 'Serviço de aceite',
      category: 'Teste',
      billingModel: 'one_time',
      amount: '1.234,56',
      scope: ['Item de escopo'],
      exclusions: ['Item excluído'],
    }),
  });
  check('cria serviço no catálogo', catalogCreate.status === 201, catalogCreate.json?.error);
  const serviceId = catalogCreate.json?.service?.id;

  const catalogEdit = await call(`/api/services/${serviceId}`, {
    method: 'PATCH',
    body: JSON.stringify({ amount: '2.000,00', name: 'Serviço de aceite (editado)' }),
  });
  check('edita serviço e persiste', catalogEdit.ok, catalogEdit.json?.error);
  const catalogList = await call('/api/services');
  const edited = catalogList.json?.services?.find((s) => s.id === serviceId);
  check('edição do catálogo persistiu', edited?.name === 'Serviço de aceite (editado)', edited?.name);
  check('edição criou nova versão do serviço', (edited?.versions?.[0]?.version ?? 0) >= 2, `v${edited?.versions?.[0]?.version}`);

  const duplicate = await call('/api/services', {
    method: 'POST',
    body: JSON.stringify({ code: `TESTE-${stamp}`, name: 'Duplicado', category: 'Teste', billingModel: 'one_time', amount: '1,00' }),
  });
  check('erro de código duplicado é exposto', duplicate.status === 409 && typeof duplicate.json?.error === 'string', duplicate.json?.error);

  const badMoney = await call(`/api/proposals/${myoId}`, {
    method: 'PATCH',
    body: JSON.stringify({ items: [{ label: 'Inválido', billingModel: 'one_time', unitAmount: 'abc', quantity: 1, tiers: [], scope: [], exclusions: [], bonified: false, discountPct: 0, discountApproved: false, isThirdPartySpend: false }] }),
  });
  check('valor monetário inválido é rejeitado com mensagem', badMoney.status >= 400 && typeof badMoney.json?.error === 'string', badMoney.json?.error);

  const discountProposal = await call(`/api/projects/${projectId}/proposal`, { method: 'POST' });
  const discountId = discountProposal.json?.proposal?.id;
  const unapproved = await call(`/api/proposals/${discountId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      items: [{ label: 'Branding', billingModel: 'one_time', unitAmount: '10.000,00', quantity: 1, discountPct: 15, discountApproved: false, bonified: false, tiers: [], scope: [], exclusions: [], isThirdPartySpend: false }],
      termMonths: 12,
    }),
  });
  const codes = (unapproved.json?.flags ?? []).map((f) => f.code);
  check('desconto acima do limite é sinalizado', codes.includes('DISCOUNT_OVER_CAP'), JSON.stringify(codes));
  check('desconto não aprovado é sinalizado', codes.includes('DISCOUNT_NOT_APPROVED'), JSON.stringify(codes));

  const tryApprove = await call(`/api/proposals/${discountId}`, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) });
  check('aprovação é bloqueada com pendências', tryApprove.status === 409, `status=${tryApprove.status}`);

  const traversal = await call('/api/documents/..%2F..%2F..%2Fetc%2Fpasswd/file');
  check('travessia de caminho no download é negada', traversal.status >= 400, `status=${traversal.status}`);

  const htmlPages = await Promise.all(
    ['/', '/services', '/settings/brand', `/projects/${projectId}/proposal`].map((p) => fetch(`${BASE}${p}`).then((r) => r.text())),
  );
  const leaked = htmlPages.some((html) => /sk-[A-Za-z0-9]{10,}|ANTHROPIC_API_KEY\s*[:=]\s*["'][^"']+/.test(html));
  check('nenhuma chave de IA vaza no HTML servido', !leaked);

  /* -------------------------------- report ------------------------------- */
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULTADO: ${passed} aprovados, ${failed} reprovados`);
  if (failures.length) {
    console.log('\nFalhas:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log('='.repeat(60));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nERRO FATAL:', e);
  process.exit(1);
});
