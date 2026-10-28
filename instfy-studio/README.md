# Instfy Intelligence Studio

Aplicação local que liga dois fluxos de trabalho da Instfy em um único ambiente:

1. **Discovery** — cliente e projeto → questionário setorial de 14 dimensões → análise com classificação de evidência → narrativa editável e aprovada por uma pessoa → apresentação estratégica em PDF (e PPTX editável).
2. **Proposta** — seleção de serviços do catálogo → quantidades, escopo, períodos, verbas de mídia e descontos aprovados → **cálculo determinístico** → texto contextual redigido por IA sob restrição → proposta comercial em PDF → revisão, versionamento e exportação.

## Rodando localmente

```bash
cd instfy-studio
cp .env.example .env          # ajuste se quiser habilitar IA real
npm install
npm run db:push:sqlite        # banco em arquivo, cria prisma/dev.db
npm run db:seed               # organização, catálogo de exemplo e 2 clientes de demonstração
npm run dev                   # http://localhost:3100
```

Para rodar contra Postgres (o mesmo banco da versão hospedada), aponte
`DATABASE_URL` para ele e use `npm run db:push` no lugar de `db:push:sqlite`.

Requisitos: Node 20+ e um Chromium acessível ao Playwright (o ambiente deste
projeto fornece um em `/opt/pw-browsers/chromium`; ajuste
`CHROMIUM_EXECUTABLE_PATH` se o seu estiver em outro lugar).

### Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento em `http://localhost:3100` |
| `npm run build` | Build de produção |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Testes unitários (Vitest) |
| `npm run db:reset:sqlite` | Recria o banco em arquivo e roda o seed |
| `npm run db:sql` | Imprime o DDL Postgres do schema atual |
| `node scripts/acceptance.mjs` | Aceite ponta a ponta, configuração local (`PDF_ENGINE=server`) |
| `node scripts/acceptance-hosted.mjs` | Aceite da configuração hospedada (`PDF_ENGINE=browser`) |

## Modo demonstração

Sem `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY`, a aplicação roda em **modo
demonstração**, sinalizado no cabeçalho, nas telas e no próprio documento
gerado. Nesse modo o conteúdo é derivado mecanicamente das respostas do
questionário — **nenhum modelo de linguagem é chamado** e **nenhuma pesquisa
externa é realizada ou afirmada**.

A etapa de *Research* só executa quando `RESEARCH_CONNECTOR` aponta para um
conector real. Enquanto não houver um adaptador implementado, a etapa informa
explicitamente que nada foi pesquisado, em vez de simular.

## Regras que a aplicação impõe

- **A IA nunca define preço.** Valores, descontos, parcelas e prazos vêm do
  motor determinístico em `lib/pricing.ts`. O texto gerado passa por um guarda
  que substitui qualquer cifra que escape (`containsMonetaryClaim`).
- **Aritmética em centavos inteiros.** Nenhum total monetário passa por ponto
  flutuante binário (`lib/money.ts`).
- **Tributo nunca é presumido.** Sem configuração explícita, não existe linha de
  imposto no documento.
- **Desconto exige autorização.** O limite padrão é 0%; qualquer desconto acima
  disso é sinalizado e bloqueia a aprovação até haver override registrado.
- **Verba de terceiros é separada de honorários.** `instfy_fees`,
  `third_party_spend`, `client_total_cash_outlay` e `first_month_due` são
  grandezas distintas no cálculo e no documento.
- **Dado ausente é exibido como ausente.** Lacunas críticas do questionário
  aparecem como lacunas declaradas; nada é estimado no lugar.
- **Toda afirmação carrega evidência.** `FACT`, `SIGNAL`, `INFERENCE` ou
  `HYPOTHESIS`, com referência à pergunta de origem. Um `FACT` sem fonte é
  inválido.
- **A IA não escreve markup.** Ela escolhe um `layoutId` do catálogo e fornece
  conteúdo validado por Zod; os renderizadores da Instfy produzem todo o HTML,
  verificam contraste WCAG AA, tamanho mínimo de fonte e orçamento de texto, e
  **dividem páginas em vez de cortar conteúdo**.

## Estrutura

```
app/                       Rotas (App Router) e API
  api/                     Handlers REST
  print/                   Páginas que o Playwright imprime em PDF
  projects/[id]/...        Discovery, análise, apresentação, proposta
components/
  slides.tsx               Renderizadores determinísticos dos 11 archetypes
  proposal-doc.tsx         Documento A4 da proposta
lib/
  money.ts                 Primitivas monetárias em centavos
  pricing.ts               Motor determinístico de precificação
  questionnaire.ts         Questionário setorial versionado
  design/                  Tokens, schemas Zod e validador de layout
  ai/                      Adaptador de provedor, prompts, modo demo, orquestrador
  pdf.ts / pptx.ts         Exportação
  jobs.ts                  Fila durável de geração com retry
prisma/                    Schema e seed
tests/                     Testes unitários
scripts/acceptance.mjs     Aceite ponta a ponta
```

## Catálogo de exemplo

O seed cria 10 serviços a partir das propostas de referência da Instfy. **Cada
valor é um exemplo de uma proposta específica, não uma tabela de preços
universal** — o campo de observações de cada serviço diz de onde veio. Edite
antes de usar em proposta nova. Editar preço ou escopo cria uma nova
`ServiceVersion`, preservando as propostas já emitidas.

## Como o PDF é produzido

Existem dois caminhos, escolhidos por `PDF_ENGINE`, e **os dois usam exatamente
os mesmos renderizadores e o mesmo CSS**:

- `server` (local, padrão fora da Vercel): o Chromium imprime a rota `/print/...`
  no servidor e o arquivo é guardado como versão de documento. É o caminho
  coberto pelo aceite completo, incluindo a medição automática de transbordo de
  página.
- `browser` (padrão na Vercel): a aplicação abre a mesma rota `/print/...` e o
  navegador de quem está vendo imprime. Serverless não tem disco persistente nem
  Chromium. O que se perde é o arquivo guardado no servidor e a medição
  automática de transbordo; o conteúdo e o layout são idênticos.

O PPTX é JavaScript puro e funciona nos dois casos — localmente é gravado em
disco, e na versão hospedada é transmitido direto pela rota
`/api/documents/[versionId]/pptx`, sem tocar em disco.

## Banco de dados hospedado

`prisma/schema.prisma` declara Postgres. Para inicializar um banco hospedado:

1. Aplique o DDL: `npm run db:sql` e rode o resultado no banco.
2. Defina `BOOTSTRAP_SECRET` no ambiente da aplicação.
3. Semeie uma vez:
   `curl -X POST https://SEU-APP/api/admin/bootstrap -H "x-bootstrap-secret: SEU-SEGREDO"`

A rota é idempotente (tudo é upsert) e fica **desabilitada** enquanto
`BOOTSTRAP_SECRET` não estiver configurado.

## Armazenamento de artefatos

PDFs e PPTX são gravados em `storage/artifacts/` (fora de `public/`) e servidos
apenas por `/api/documents/[versionId]/file`, que resolve o caminho a partir do
banco e revalida a contenção no diretório antes de ler. Nomes de arquivo são
sanitizados preservando a extensão.
