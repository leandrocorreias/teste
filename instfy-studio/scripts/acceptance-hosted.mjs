/**
 * Acceptance for the HOSTED configuration (PDF_ENGINE=browser).
 *
 * The hosted app has no Chromium and no persistent disk, so documents are
 * printed by the viewer's browser from the app's own /print routes and PPTX is
 * streamed from memory. This script proves that path end to end.
 *
 * Usage: APP_BASE_URL=https://... node scripts/acceptance-hosted.mjs
 */
const BASE = process.env.APP_BASE_URL || 'http://localhost:3100';
let pass = 0, fail = 0;
const c = (n, ok, d='') => { ok ? pass++ : fail++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${d && !ok ? ' — ' + d : ''}`); };
const call = async (p, i) => { const r = await fetch(BASE+p, { ...i, headers: { 'content-type':'application/json', ...(i?.headers??{}) }});
  const t = await r.text(); let j=null; try { j = t?JSON.parse(t):null } catch {}; return { status:r.status, ok:r.ok, json:j, text:t }; };

const stamp = Date.now();
const cl = await call('/api/clients', { method:'POST', body: JSON.stringify({ name:`Browser ${stamp}`, sector:'servicos_b2b', contacts:[{name:'Ana',role:'CEO',email:'',phone:''}] })});
const pr = await call('/api/projects', { method:'POST', body: JSON.stringify({ clientId: cl.json.client.id, name:'Teste engine browser' })});
const pid = pr.json.project.id;
await call(`/api/projects/${pid}/discovery`, { method:'POST', body: JSON.stringify({ answers:{ mn_descricao:'Consultoria B2B.', cl_perfil:'Diretores de operações.', ob_12m:'Dobrar a carteira.' }, submit:true })});
await call(`/api/projects/${pid}/analysis`, { method:'POST' });
const list = await call(`/api/projects/${pid}/analysis`);
for (const f of list.json.findings) await call(`/api/findings/${f.id}`, { method:'PATCH', body: JSON.stringify({ approved:true })});
const nar = await call(`/api/projects/${pid}/narrative`, { method:'POST' });
await call(`/api/projects/${pid}/narrative`, { method:'PATCH', body: JSON.stringify({ narrativeId: nar.json.narrative.id, approve:true })});

const gen = await call(`/api/projects/${pid}/presentation`, { method:'POST', body: JSON.stringify({ themeId:'instfy-light' })});
c('apresentação responde com engine browser', gen.json?.engine === 'browser', JSON.stringify(gen.json).slice(0,150));
c('não enfileira job de Chromium', gen.json?.jobId === null);
c('devolve a rota de impressão', typeof gen.json?.printUrl === 'string' && gen.json.printUrl.startsWith('/print/presentation/'));

const printHtml = await fetch(BASE + gen.json.printUrl).then(r => r.text());
c('rota de impressão renderiza as páginas', (printHtml.match(/instfy-slide/g) || []).length >= 8, `slides=${(printHtml.match(/instfy-slide/g)||[]).length}`);
c('inclui a barra de impressão só na tela', printHtml.includes('Imprimir / salvar PDF') && printHtml.includes('no-print'));
c('marca prontidão para impressão', printHtml.includes('data-print-ready="true"'));

const pptx = await fetch(`${BASE}/api/documents/${gen.json.documentVersionId}/pptx`);
const pbuf = Buffer.from(await pptx.arrayBuffer());
c('PPTX transmitido sem disco', pptx.status === 200 && pbuf.subarray(0,2).toString() === 'PK', `status=${pptx.status}`);
c('PPTX tem tamanho plausível', pbuf.length > 50_000, `${pbuf.length} bytes`);

const prop = await call(`/api/projects/${pid}/proposal`, { method:'POST' });
await call(`/api/proposals/${prop.json.proposal.id}`, { method:'PATCH', body: JSON.stringify({ termMonths:12, items:[
  { label:'Branding', billingModel:'one_time', unitAmount:'10.000,00', quantity:1, bonified:false, tiers:[], scope:[], exclusions:[], discountPct:0, discountApproved:false, isThirdPartySpend:false }]})});
const pgen = await call(`/api/proposals/${prop.json.proposal.id}/generate`, { method:'POST', body: JSON.stringify({}) });
c('proposta responde com engine browser', pgen.json?.engine === 'browser', JSON.stringify(pgen.json).slice(0,150));
const phtml = await fetch(BASE + pgen.json.printUrl).then(r => r.text());
c('proposta renderiza páginas A4', (phtml.match(/instfy-page/g) || []).length >= 4, `pages=${(phtml.match(/instfy-page/g)||[]).length}`);
c('proposta mostra o valor calculado', phtml.includes('R$ 10.000'), 'valor não encontrado');

const boot = await call('/api/admin/bootstrap', { method:'POST' });
c('bootstrap bloqueia sem segredo', boot.status === 403 || boot.status === 401, `status=${boot.status}`);

console.log(`\nRESULTADO: ${pass} aprovados, ${fail} reprovados`);
process.exit(fail === 0 ? 0 : 1);
