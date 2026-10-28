# Instfy Intelligence Studio — relatório de implementação

Data da execução: 28/10/2026
Ambiente: Node 22.22, Next.js 15.5.28, Prisma 6.3 + SQLite, Chromium via Playwright 1.63

Este relatório descreve **o que foi efetivamente construído e testado**. Nada
aqui é descrito como pronto para produção; ao final há a lista explícita do que
não foi feito.

---

## Onde está rodando

**Hospedado:** https://instfy-intelligence-studio.vercel.app
Vercel (team `lecorreia40-1962s-projects`), branch `instfy-intelligence-studio`
do repositório `leandrocorreias/teste`, root `instfy-studio`, Node 22.
Postgres do marketplace Vercel/Supabase, com `prisma migrate deploy` aplicando
as 28 tabelas no build. **Vercel Authentication ligada** — o link exige login na
conta Vercel, porque a aplicação não tem autenticação própria.

No primeiro acesso a um banco vazio, a aplicação mostra a tela "Inicializar o
Intelligence Studio" com um botão que semeia organização, layouts, questionário
e catálogo.

**Local:**

```bash
cd instfy-studio
cp .env.example .env
npm install
npm run db:push && npm run db:seed
npm run dev
```

URL: **http://localhost:3100**

Sem chave de IA a aplicação entra em **modo demonstração** rotulado. Para IA
real, preencha `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` no `.env` — essa parte
**não foi exercitada**, pois nenhuma chave estava disponível nesta execução (ver
"Riscos").

---

## Testes efetivamente executados

### Unitários — Vitest, 75 testes, 6 arquivos, todos passando

```
tests/money.test.ts          13 testes   aritmética em centavos, parsing pt-BR/en-US, arredondamento, parcelamento
tests/pricing.test.ts        23 testes   os 6 modelos de cobrança, aceites B e C, desconto, tributo
tests/design.test.ts         12 testes   catálogo de layouts, schema, transbordo, contraste WCAG
tests/questionnaire.test.ts   8 testes   14 dimensões, perguntas condicionais, progresso e lacunas
tests/ai-guards.test.ts      10 testes   guarda de cifras, honestidade de pesquisa, saída do modo demo
tests/artifacts.test.ts       9 testes   sanitização de nome, contenção de caminho, extensões
```

Comando: `npm test`

### Aceite ponta a ponta — 63 verificações, todas passando

`node scripts/acceptance.mjs` contra o servidor em execução. Exercita as mesmas
rotas da interface, com os mesmos payloads.

Comando e resultado reproduzidos nesta execução:

```
A. Discovery → análise → narrativa aprovada → apresentação PDF   ✔ 21 verificações
B. Proposta com o mix de referência Muscle Up                    ✔ 18 verificações
C. Precificação escalonada MYO (meses 1–6 e 7–12)                ✔  5 verificações
E/F. Catálogo, versões, erros e segurança                        ✔ 11 verificações
+ exportação PPTX                                                ✔  4 verificações
RESULTADO: 63 aprovados, 0 reprovados

apresentação: 533 KB, 26 páginas · 4 capturas de página
pptx:         282 KB, 26 slides
proposta:     407 KB,  6 páginas
```

### Build, tipos e lint

```
npx tsc --noEmit    sem erros
npx next lint       ✔ No ESLint warnings or errors
npx next build      29 rotas compiladas, sem erros
```

### Verificação visual (aceite D)

Os PDFs foram abertos, paginados com `pdfinfo` e inspecionados página a página
como imagem:

- Apresentação: **26 páginas**, 960×540 pt. Capa, divisores de capítulo,
  splits editoriais, insights, comparativos, roadmap e encerramento conferidos
  visualmente — sem corte de texto.
- Proposta: **6 páginas A4** (595,92 × 842,88 pt). Capa comercial, tabela de
  etapas com números de destaque, detalhamento de entregas, resumo financeiro,
  cronograma e aceite — sem corte de texto.
- PPTX: integridade do ZIP verificada, 26 slides, `presentation.xml` e
  `[Content_Types].xml` presentes, texto extraído corretamente do slide 1.

O renderizador agora **mede a paginação real** e reporta transbordos; o aceite
verifica que `páginas físicas == páginas lógicas` e que nenhuma página
transborda o papel.

---

## Defeitos encontrados e corrigidos durante a execução

Registrados porque foram encontrados pelos próprios testes, não por inspeção:

1. **Contraste insuficiente no tema claro.** `inkMute` `#6E7F77` sobre
   `#F7F6F1` dava 3,91:1, abaixo do mínimo WCAG AA de 4,5:1. O guarda de
   contraste do próprio renderizador reprovou o tema. Corrigido o token para
   `#5B6C64` (5,14:1) — o token, não o teste.
2. **Extensão de arquivo destruída pela sanitização.** `safeSlug` transformava
   `proposta.pdf` em `proposta-pdf`, e a gravação falhava com `ENOENT`.
   Introduzido `safeFileName`, que preserva extensões de uma lista permitida.
3. **Subdiretório de artefato não criado.** Só `ARTIFACT_DIR` era criado, não a
   pasta por cliente. Adicionado `ensureParentDir`, com a mesma verificação de
   contenção.
4. **Contagem de páginas enganosa.** O renderizador reportava a quantidade de
   elementos `.instfy-page`, não de páginas do PDF. A primeira página da
   proposta transbordava o A4 (1294 px contra 1123) e gerava uma 6ª folha
   silenciosa. Passou-se a **medir** a paginação real e a reportar transbordos;
   e a página de abertura agora move a tabela de etapas para uma página própria
   quando o conteúdo não cabe.

---

## Aceites do enunciado

| Aceite | Situação | Como foi verificado |
| --- | --- | --- |
| **A** Cliente → projeto → discovery → análise → narrativa aprovada → PDF multipágina | **Atendido** | Aceite ponta a ponta; PDF de 26 páginas baixado e inspecionado |
| **B** Mix Muscle Up: 22.000 único, 8.000/mês, 20% de 10.000 = 2.000, verba de 10.000 separada | **Atendido** | 23 testes unitários + 18 verificações de aceite contra a API |
| **C** Escalonamento MYO: meses 1–6 a 5.000, 7–12 a 8.000, total 78.000 | **Atendido** | Teste unitário e aceite via API confirmam o vetor mês a mês |
| **D** PDFs abrem e não têm corte severo | **Atendido** | `pdfinfo` + inspeção visual página a página + medição automática de transbordo |
| **E** Catálogo persiste, versões persistem, erros aparecem | **Atendido** | Aceite cria/edita/remove serviço, confirma nova versão, e verifica mensagens de erro de duplicidade e de valor inválido |
| **F** Sem segredo no navegador, sem pesquisa fictícia, sem preço inventado | **Atendido** | HTML das páginas inspecionado por padrão de chave; `researchPerformed: false` verificado; guarda de cifras no texto da IA testado |

### Números do aceite B, conferidos

| Grandeza | Valor |
| --- | --- |
| Implantação única (honorários) | R$ 22.000 (5.000 bonificado + 10.000 + 12.000) |
| Operação mensal, mês 1 | R$ 10.000 (8.000 estratégia + 2.000 gestão de mídia) |
| Gestão de mídia | 20% de R$ 10.000 = R$ 2.000/mês |
| Verba de anúncios (terceiros) | R$ 10.000/mês → R$ 120.000 em 12 meses, fora da receita Instfy |
| Honorários Instfy no período | R$ 142.000 |
| Desembolso total do cliente | R$ 262.000 |
| Valor do primeiro mês | R$ 18.800 (1ª parcela de 8.800 + mês 1 de 10.000) |
| Tributo | nenhum — não configurado, não presumido |
| Parcelamento da implantação | 8.800 / 6.600 / 6.600 (40/30/30), soma exata |

---

## O que foi construído

### Modelo de dados (Prisma + SQLite)

Implementados: `Organization`, `OrgSetting`, `User`, `Client`, `Contact`,
`Project`, `Form`, `FormVersion`, `Submission`, `Answer`, `ResearchSource`,
`Finding`, `Narrative`, `Service`, `ServiceVersion`, `PricingRule`, `Proposal`,
`ProposalItem`, `PaymentSchedule`, `BrandKit`, `LayoutTemplate`, `Document`,
`DocumentVersion`, `DocumentPage`, `GenerationJob`, `AiRun`, `Approval`,
`AuditLog` — os 24 modelos pedidos, mais `OrgSetting` e `Narrative`.

Todos têm `createdAt`/`updatedAt`; exclusão lógica (`deletedAt`) nas entidades
cuja remoção quebraria documentos já emitidos. `organizationId` presente nas
entidades de topo e filtrado em todas as consultas.

### Precificação determinística

`lib/pricing.ts` — funções puras, sem I/O, relógio, aleatoriedade ou IA.
Seis modelos: `one_time`, `monthly`, `per_unit`, `percent_of_base`,
`tiered_monthly`, `third_party_spend`. Suporta bonificação, desconto com flag de
autorização, quantidade, tributo opcional, verba externa, taxa de gestão,
parcelamento e validação de faixas (lacuna e sobreposição são sinalizadas, não
cobradas como zero).

`lib/money.ts` — tudo em centavos inteiros. `applyBasisPoints` arredonda meio
afastando-se do zero; `splitInstalments` conserva o total exato em qualquer
divisão.

Snapshots de preço são gravados em `ProposalItem.priceSnapshot` e
`Proposal.totalsSnapshot` a cada recálculo, e o documento impresso lê o snapshot
da geração, não o preço vivo.

### Motor de design

11 archetypes de página (`cover`, `chapter`, `editorial-split`, `metric-grid`,
`comparison`, `timeline`, `matrix`, `key-insight`, `roadmap`, `bullets`,
`closing`) com renderizadores determinísticos. Três temas: Instfy claro, Instfy
escuro e Instfy + acento do cliente. Grafismos originais em SVG/CSS — nenhuma
página de referência foi reutilizada como imagem.

O validador verifica orçamento de texto por archetype e, no excesso, **divide a
página ou troca por um layout de maior capacidade**, registrando o ajuste na
versão do documento e exibindo-o na interface. Contraste e tamanho mínimo de
corpo são verificados antes de cada geração.

### Orquestração de IA

Estágios separados: Intake → Research → Analysis → Strategy → Narrative →
Layout Plan → Validation. Saídas em JSON validadas por Zod; saída reprovada não
chega ao renderizador. Se o modelo declarar ter pesquisado sem conector
configurado, a declaração é **rejeitada** e registrada. Apenas o hash do prompt
é persistido em `AiRun` — o conteúdo confidencial das respostas não entra em
log. As chaves ficam no servidor.

### Geração de documentos

Fila durável (`GenerationJob`) com tentativas e backoff exponencial; a interface
faz polling em `/api/jobs/[id]` e nunca trava. PDFs saem do Chromium imprimindo
as próprias rotas `/print/...` da aplicação, de modo que pré-visualização e PDF
usam exatamente os mesmos componentes. Artefatos ficam fora de `public/` e são
servidos por rota guardada.

---

## O que NÃO foi feito

Declarado explicitamente, em vez de omitido:

1. **IA real não foi exercitada.** Nenhuma chave estava disponível. Os
   adaptadores Anthropic e OpenAI estão escritos, com retry e validação de
   schema, mas **nunca chamaram uma API de verdade nesta execução**. Todo o
   conteúdo gerado nos testes veio do modo demonstração. Este é o maior risco em
   aberto.
2. **Conector de pesquisa.** Não existe adaptador de coleta. A etapa informa
   isso explicitamente; não simula.
3. **Anexos no questionário.** O campo existe e registra uma lista textual de
   materiais; upload de arquivo não foi implementado (era opcional no MVP).
4. **Autenticação.** Não há login. A aplicação assume operador único em máquina
   local. As rotas de API **não têm controle de acesso** — não exponha esta
   build na rede.
5. **Edição de kits de marca pela interface.** Os kits são lidos do seed e
   aplicados; a tela de marca é somente leitura para eles. Tokens de tema são
   editáveis apenas em código.
6. **E2E com Playwright Test.** O aceite foi escrito como script de API
   (`scripts/acceptance.mjs`) em vez de specs de `@playwright/test`. Cobre os
   mesmos caminhos, mas não simula cliques no navegador. As interações de
   formulário foram verificadas manualmente, não automatizadas.
7. **Produção não foi exercitada além do build.** A política de rede desta
   sessão nega o host `vercel.app` (403 no CONNECT), então **nenhuma página da
   URL real foi aberta ou testada daqui**. O que se sabe de produção é que o
   build concluiu READY e que a migração rodou. O fluxo de primeiro acesso foi
   validado localmente contra um banco vazio, não contra o Postgres hospedado.
   Esta é a maior lacuna de verificação deste relatório.
8. **PPTX é fiel ao texto, não ao visual.** PowerPoint não reproduz os
   grafismos CSS; os archetypes foram mapeados para formas nativas com os mesmos
   tokens. O PDF continua sendo o artefato de apresentação.
9. **Regra de limiar da proposta de comunicação.** O texto original condiciona a
   gestão a 20% acima de R$ 10.000/mês investidos, com verba mínima nos meses 2
   e 3. **Isso não foi transformado em regra automática** — está registrado como
   observação no serviço do catálogo, para revisão e aprovação caso a caso,
   exatamente como o enunciado pediu.

---

## Riscos

- **Produção não observada.** Ver item 7 acima. Pode haver falha de runtime que
  só apareça no primeiro acesso real.
- **Caminho de IA real não verificado.** Parsing de resposta, validação de
  schema e fallback estão testados por tipo e por unidade, mas não contra um
  provedor real. Espere ajustes na primeira execução com chave.
- **Sem autenticação própria.** Qualquer processo na máquina alcança as rotas de
  API localmente. Na versão hospedada, a única barreira é a proteção de acesso
  da plataforma; se ela for desligada, o link fica aberto a qualquer pessoa.
- **Fontes externas.** As páginas carregam Inter do Google Fonts. Sem rede, o PDF
  cai para a fonte do sistema e a métrica tipográfica muda — o layout continua
  válido, mas o visual difere.
- **Fila em processo.** Os jobs rodam no processo do Next. Reiniciar o servidor
  durante uma geração deixa o job em `running`; ele não é retomado
  automaticamente.
- **SQLite.** Adequado ao MVP local; escrita concorrente de várias instâncias
  não é suportada.

---

## Próximos passos sugeridos

1. Abrir a URL hospedada, tocar em "Inicializar agora" e percorrer os dois
   fluxos, confirmando o que não pôde ser verificado daqui.
2. Rodar o aceite com uma chave de IA real e corrigir o que aparecer no parsing
   e na validação dos estágios de análise, narrativa e plano de layout.
3. Autenticação própria e verificação de `organizationId` por sessão, antes de
   qualquer uso que não dependa da proteção da plataforma.
4. Retomada de jobs órfãos na inicialização (varrer `status: running`).
5. Converter o aceite de API em specs de `@playwright/test`, cobrindo as
   interações de formulário que hoje só foram verificadas à mão.
6. Edição de kits de marca e de tokens de tema pela tela `/settings/brand`.
7. Auto-hospedar a família tipográfica para tornar o PDF independente de rede.
