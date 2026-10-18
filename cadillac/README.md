# CADILLAC / PORTAL — V8

Portal estático multipágina, responsivo, com URL dedicada por projeto e por edição.
Todas as páginas são geradas a partir de um único modelo de conteúdo.

## Executar localmente

```bash
python3 -m http.server 8080     # na pasta do projeto
# abrir http://localhost:8080
```

## Gerar o site

```bash
python3 build.py
```

`build.py` lê `content-model.json` e reescreve todas as páginas HTML, o `sitemap.xml`
e o `robots.txt`. Os arquivos `assets/site.css` e `assets/site.js` são mantidos à mão.
Para publicar uma alteração de conteúdo: edite o JSON, rode o gerador, publique a pasta.

## Estrutura

```
index.html                     home
projetos/                      acervo com filtros por área, ano e busca
projetos/<slug>/               histórico do projeto, FAQ, fontes, relacionados
projetos/<slug>/<ano>/         edição, fatos documentados, fontes, navegação entre anos
atuacao/                       as cinco frentes de trabalho, com casos do acervo
ecossistema/                   quem é patrocinador, titular, produtora, entidade, fornecedor
assets/fotos/                  acervo fotográfico; LEIA-ME.md lista cada arquivo esperado
na-midia/                      referências agrupadas por projeto
dados/                         métricas, gráficos, cobertura e metodologia
404.html                       página de erro
assets/site.css, site.js       estilo e comportamento, sem dependências de framework
assets/logo-cadillac*.png      logotipo oficial, versões escura e branca
assets/favicon-*.png           ícones de aba e de atalho
assets/og-cadillac.jpg         imagem de compartilhamento 1200x630
tools/logos.py                 regera os derivados do logotipo oficial
content-model.json             fonte única de conteúdo
build.py                       gerador
```

## O que mudou na V8

Incorporação do dossiê consolidado de outubro de 2026.

- **Manchete aprovada**: "A gente faz o extraordinário acontecer", com o texto institucional,
  a razão social, o CNPJ e a data de fundação no bloco sobre a empresa.
- **Novo projeto**: CCBB leva skate ao MAC Bahia (2026). O acervo vai a oito projetos.
- **Fatos por edição ampliados**: Itacoatiara Pro 2026 (IBC World Tour, Men's Prime Series com
  US$ 35 mil, skate Street, Vitor Ferreira campeão, ≈500 atletas informados, patrocínio municipal
  de R$ 2 mi cuja contraparte é a Associação de Bodyboard de Niterói); 2025 (13ª edição,
  30/05–15/06); 2022 (valor total de R$ 1.373.190 e R$ 1.352.190 aprovados para captação);
  Vert Battle 2026 (BH 12–13/09 com ≈6 mil espectadores e R$ 100 mil em premiação, campeões,
  São Paulo 17–18/10, Maceió 30–31/10); Tamo Junto BB 2025 (10–14/12, line-up, Circuito BB de
  Surfe) e 2024 (Arena das Dunas, >30 mil/dia relatado); Juruti 2018 (inexigibilidade
  20181907001, contrato 003/2018, Festa dos Visitantes do XXIV Festival de Tribos);
  Dominguinho (300 mi de streams, 43 shows, especial na TV Globo).
- **Nova página `/ecossistema/`**: nove papéis definidos e catorze entidades classificadas, cada
  uma marcada como fonte pública ou a confirmar.
- **`/dados/` com três camadas**: indicadores do acervo (calculados), números divulgados por
  terceiros (com natureza e atribuição por linha) e contexto setorial de 2024.
- **Tipografia V8**: Roboto Condensed nos títulos, Manrope no texto. Laranja da marca
  restaurado em #FF5900; textos pequenos sobre papel usam um laranja mais escuro para contraste.
- **Espaços reservados para a fotografia oficial**: todo lugar que vai receber imagem mostra
  um espaço nomeado, com o caminho exato do arquivo que ele espera, a proporção e o papel
  editorial. São 8 na home, 8 no acervo, 1 banner por projeto, 1 banner e 3 de galeria por
  edição, e 1 por case em Atuação. Nenhuma arte é inventada e nenhuma foto de terceiro é
  hotlinkada: as três prévias que vinham de portais de notícia foram retiradas e estão
  listadas em `assets/fotos/LEIA-ME.md` para substituição por material oficial.
- **Página de alcance**: `/dados/` abre com quanta gente a Cadillac alcança, em três totais
  que nunca se misturam — público presente, atletas e artistas, alcance digital. Cada linha
  tem o responsável pelo número e a base; as que faltam aparecem como "a preencher" em vez de
  sumir. Projeção divulgada antes do evento fica fora dos totais, e público relatado por dia é
  contado uma vez enquanto o número de dias não for confirmado. Para atualizar, edite
  `audiencia.entries` em `content-model.json` e rode o gerador.
- **Pipeline de fotos**: coloque o arquivo em `assets/fotos/` com o nome `<slug>.jpg` ou
  `<slug>-<ano>.jpg` e rode o gerador; a capa gráfica é trocada pela foto automaticamente.
  `assets/fotos/LEIA-ME.md` lista imagem por imagem o que falta e onde procurar.

### O que foi deliberadamente não publicado

Três itens do dossiê ficaram fora das páginas por decisão editorial, e não por esquecimento:

1. **Instrumentos do Banco do Brasil de maio de 2025** (202574212655, R$ 7.000.000 e
   202574213287, R$ 6.982.500). Publicá-los no site da Cadillac sugere receita da empresa, o que
   o próprio dossiê diz não estar demonstrado. Entram quando houver a íntegra e o objeto.
2. **Inquérito civil do MPRN sobre Natal 2024** (04.23.2085.0000024/2025-55). Portaria de
   instauração não comprova irregularidade, e o desfecho não foi localizado. É diligência
   interna, não conteúdo de portal institucional.
3. **COP30 e demais circuitos citados em relatos profissionais**, sem crédito ou contrato.

### Pendências que não devem virar afirmação pública

Titularidade de marcas e direitos (Itacoatiara Pro, Vert Battle, Tamo Junto BB); escopo
contratual no Dominguinho e nos projetos com Bob Burnquist; natureza e pagamentos dos
instrumentos do BB; desfecho do inquérito do MPRN; histórico integral de 2013–2021; URLs,
datas e metodologia das métricas de alta audiência; relação jurídica entre Criativos e
Cadillac; licenças de fotografia e direitos de transmissão.

Solicitações úteis: Fala.BR (íntegra dos instrumentos do BB), MPRN (andamento do inquérito),
Secretaria de Cultura do RJ (projeto 23397 e prestação de contas), Prefeitura de Niterói
(processo 9900023702/2026 e contrato 030/2026), TCM-PA (íntegra do contrato 003/2018).

### Benchmarks de referência

Brasil: 213 Sports, Dream Factory, Effect Sport, IMM, V3A, Golden Goal, Sertões, N Sports.
Exterior: IMG, SPORTFIVE, Octagon, Infront, CSM, Two Circles, On Location, Wasserman.

## O que mudou na V7

**Conteúdo.** Os sete projetos passaram a usar o mesmo modelo editorial: antes,
Dominguinho, Bob Burnquist e Arte em Circuito ficavam fora do acervo de `/projetos/`
e tinham layout próprio. Cada projeto agora tem visão geral, registros documentados,
FAQ (com `FAQPage`), fontes e projetos relacionados. Edições ganharam período, local
e nota quando o dado é documentado.

**Navegação.** Trilha de navegação (breadcrumbs) com `BreadcrumbList` em todas as
páginas internas; item de menu ativo marcado com `aria-current`; filtros de área,
ano e busca no acervo; navegação anterior/próxima entre edições; projetos
relacionados; link para pular ao conteúdo; botão de voltar ao topo; página 404.

**Responsividade.** Grades com `auto-fit` em vez de contagem fixa de colunas,
espaçamentos e tipografia fluidos, menu compacto a partir de 1000px (antes 760px,
onde o menu já estava apertado), alvos de toque de no mínimo 44px, tabelas largas
com rolagem horizontal própria e nenhum transbordo horizontal de 320px a 1440px.

**Iconização.** Google Material Symbols em todos os pontos de navegação, incluindo
os lugares que ainda usavam setas de texto (`↗`). Ícone de link externo
(`open_in_new`) distinto do de navegação interna (`arrow_outward`), ícone por área
de atuação, e ícones de contexto (local, período, verificação) nos metadados.

**Gráficos e métricas.** `/dados/` deixou de trazer números fixos escritos à mão —
que estavam defasados (dizia 4 projetos e 8 edições) — e passou a calcular tudo a
partir do modelo de conteúdo: edições por ano, projetos por área, registros e fontes
por projeto, matriz de cobertura projeto × ano com link para cada edição e tabela de
valores em registros públicos. Os gráficos são SVG inline de série única, com rótulo
direto, foco por teclado e `title` acessível; sem biblioteca externa.

**Atuação.** A seção de competências da home era só título e uma linha, com uma
seta que não levava a lugar nenhum. Cada frente ganhou conteúdo próprio em
`/atuacao/`: o que é, o que entregamos e os casos do acervo que a ilustram, cada
caso com link para a página do projeto e para a fonte pública. Os cinco itens da
home agora levam à seção correspondente.

**Identidade.** O logotipo oficial da Cadillac substituiu o lettering improvisado
em `Barlow Condensed` do cabeçalho e do rodapé. A partir do arquivo oficial em preto
foram gerados, em `assets/`, a versão escura (cabeçalho, fundo papel), a versão branca
(rodapé, fundo escuro), os favicons de 32px e 180px e a imagem Open Graph 1200×630 —
o portal não tinha `og:image`, então o compartilhamento em redes e WhatsApp saía sem
imagem. Para regerar os derivados a partir de um arquivo novo, veja `tools/logos.py`.

**Desempenho e SEO.** Fonte carregada por `<link>` com `preconnect` em vez de
`@import` encadeado no CSS; imagens como `<img loading="lazy">` com texto alternativo
em vez de `background-image`; `sitemap.xml` com todas as páginas e `lastmod`;
Open Graph e Twitter Card completos; JSON-LD de `Organization`, `WebSite`,
`CollectionPage`, `WebPage`, `Dataset`, `FAQPage` e `BreadcrumbList`.

## Hospedagem em subdiretório

CSS, JS e links internos usam caminhos relativos à página, então o site funciona tanto
em `https://instfy.com/cadillac/` quanto na raiz de `https://cadillacproducoes.com.br/`.
Envie **toda** a pasta (inclusive `assets/`) para o destino, não apenas `index.html`.
Havendo cache, force a atualização e limpe cache/CDN.

Exceção: `404.html` usa URLs absolutas do domínio definitivo, porque o servidor entrega
esse arquivo a partir de qualquer URL e caminhos relativos quebrariam. Ao hospedar em
staging, ajuste o `BASE` em `content-model.json` (`site.url`) e rode o gerador de novo.

## Conteúdo e direitos — pendências antes de publicar

- As fotografias externas referenciadas nos cartões (Mango Surf, Jornale, Portal Tela)
  são **prévia editorial e não estão licenciadas** para publicação comercial. Obter
  autorização ou substituir por acervo próprio. Citar a fonte não equivale a ter direito de uso.
- Os espaços de galeria nas páginas de edição estão reservados para imagens autorizadas.
- A participação da Cadillac na turnê Dominguinho é informação do solicitante e aguarda
  ficha técnica independente.
- O e-mail de contato é sugerido e precisa ser configurado.
- Nenhuma métrica de público, audiência ou impacto econômico é publicada. Os únicos
  valores financeiros exibidos constam de documentos públicos, com a natureza explicitada:
  valor aprovado para captação não é valor captado; valor de objeto contratado não é receita.
- Não registrar todos os anos históricos não significa ausência de edições.
- Antes de produção: imagens OG licenciadas, Search Console, analytics e revisão editorial.
  Evite indexar o staging quando publicar oficialmente.
