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
atuacao/                       frentes de trabalho, a empresa e o ecossistema
agenda/                        todas as edições, etapas e shows em um calendário único
equipe/                        núcleo, sócios por projeto, especialistas e parceiros
imprensa/                      kit: apresentação, marca, fotos e ficha técnica
contato/                       formulário e canais diretos
en/                            resumo institucional em inglês
reservado/                     uso interno: valores, diligências e pendências (noindex)
assets/marcas/                 logotipos de marcas e instituições
assets/kit/                    arquivos para download da imprensa
assets/video/                  reel e vídeos de projeto
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

## V15: atletas, e os eventos pelos decks oficiais

**Atletas** (`/atletas/`): 29 fichas, uma página por atleta, em três frentes — o squad BB
citado no material do Tamo Junto, os confirmados no Campeonato Brasileiro de Skate Vertical
e os convidados e internacionais. Cada ficha traz a trajetória documentada com a fonte em
cada linha, a tabela de edições do acervo em que o atleta aparece e os outros nomes da
mesma frente. Os nomes no bloco “Quem esteve em cena” de cada edição agora linkam para a
ficha quando ela existe. A página entra no rodapé e no sitemap, sem mexer no menu
principal.

**Vert Battle 2025** ganhou o calendário real das quatro etapas, com dia e local: Goiânia
(3 e 4 de maio), Niterói (31 de maio e 1º de junho, dentro do Itacoatiara Pro), Curitiba
(11 e 12 de outubro) e a final em Fortaleza (13 e 14 de dezembro, dentro do Tamo Junto BB).
Entraram também os 16 atletas confirmados, o Palco Vert Battle etapa a etapa, a demo de
paraskate e o balanço da produção. O bloco `papel` registra que o material oficial da
temporada é assinado pela **Cadillac Production**.

**Tamo Junto BB** ganhou a edição de 2026 (Maceió, 28 de outubro a 1º de novembro), o
balanço das duas primeiras edições e o bloco de mercado com a valoração de mídia.

**Itacoatiara Pro 2022** ganhou as oito modalidades, as hot zones, o contest mundial de
bodyboard e a programação musical completa de junho.

Todos esses números são declarados pelas produções nos decks, sem auditoria independente,
e a página diz isso. Bob Burnquist aparece nos decks do Itacoatiara Pro e do Tamo Junto e
**foi deliberadamente excluído** de todo o acervo, conforme orientação da direção.

## V14: elenco completo e o caminho das fotos

Com a rede liberada nesta sessão, o bloco “Quem esteve em cena” deixou de ter nomes
soltos. Fortaleza 2025 foi de 8 para 16 artistas com palco e dia; Natal 2024, que não
tinha elenco nenhum, ganhou 11 nomes e teve a data corrigida de “só o ano” para 30 de
outubro a 3 de novembro. Onde as publicações divergem, a divergência fica escrita na
linha.

**As fotos continuam fora, por duas razões independentes**, e `FOTOS.md` explica as
duas com o teste que as comprova:

- Este ambiente não alcança nenhum portal. O proxy recusa o túnel para
  `itacoatiarapro.com.br`, `tamojuntobb.com.br`, `cbsk.com.br`, `instagram.com` e
  `i.ytimg.com`. Só o GitHub passa. Não dá para baixar um arquivo daqui.
- Mesmo com acesso, **foto de imprensa não é nossa para publicar**. A imagem que
  ilustra uma reportagem é do veículo ou do fotógrafo. Três referências assim já foram
  retiradas deste projeto e estão registradas em `photos.referencias_removidas`.

`FOTOS.md` traz o que a pesquisa achou sobre cada origem — entre elas o crédito
**Lucas Benevides / Prefeitura de Niterói** no Itacoatiara Pro 2026 e o material do
Banco do Brasil no Tamo Junto — mais o texto do pedido pronto para enviar e a ordem de
retorno.

## V13: correção — os ícones não carregavam

A lista `icon_names` enviada ao Google Fonts tinha **`mail` repetido**. O Google Fonts
responde **HTTP 400** a qualquer lista com nome duplicado, e sem a folha de estilo a
fonte de ícones nunca chegava: **todos** os ícones do site apareciam com o próprio nome
escrito — `arrow_outward`, `photo_camera`, `place`, `menu`. Em todas as páginas, em
qualquer navegador.

A falha era invisível para as checagens que havia: o link checker só valida caminhos
internos, e a auditoria mede layout, não requisição de terceiro.

Três mudanças, nessa ordem:

- A lista virou `set`, então duplicata não volta a existir.
- `icon()` registra todo ícone pedido, e **o build para com erro** se algum ficar fora
  do subset baixado — o caso em que o ícone sairia como texto.
- `close` e `download` ficam declarados como dinâmicos: o primeiro é trocado pelo JS no
  botão do menu, o segundo só aparece quando há arquivo de kit. Sem isso o build os
  acusaria de ociosos a cada rodada.

Verificado em requisição real ao Google Fonts (200, com `@font-face`) e em navegador,
com `document.fonts` confirmando a fonte carregada.

## V12: vídeo institucional

O institucional da Cadillac entrou no espaço reservado da home
(`video.reel.url` no modelo). Três decisões nessa entrega:

- **O player só carrega depois do clique.** Até lá a página mostra a miniatura e um
  botão: nenhuma requisição e nenhum cookie vão para o YouTube enquanto o visitante
  não decidir assistir. Isso tira da home o carregamento do player (centenas de KB de
  JavaScript de terceiro) e evita rastreio de quem só passou pela página. Sem
  JavaScript, um `<noscript>` oferece o link direto.
- **O ID do vídeo é extraído de verdade** (`youtube_id()`), de qualquer formato de link
  — `youtu.be/ID`, `watch?v=ID`, `/embed/`, `/shorts/` — e os parâmetros de rastreio do
  link compartilhado são descartados. O código anterior quebrava com links de
  compartilhamento.
- **O JSON-LD de `VideoObject` não foi emitido ainda.** Falta a data de publicação:
  sem ela o Google trata o dado estruturado como incompleto. Preencha
  `video.reel.publicado_em` (AAAA-MM-DD) e, se quiser, `duracao_iso` (`PT1M42S`),
  e o bloco passa a sair sozinho na home.

## V11: Mr. Moo Festival

Nono projeto do acervo, em `/projetos/mr-moo-festival/`. É o primeiro caso de um
projeto que **a Cadillac não produziu**: o festival existe desde 2015, tem 22 edições
realizadas por sua própria produção e um recorde do Guinness World Records certificado
em 17 de maio de 2025. A Cadillac entra na 23ª edição, de 22 de maio de 2027, **apenas
na captação de patrocínio**.

Esse caso exigiu dois blocos novos no gerador, disponíveis para qualquer projeto:

- `projeto.papel` → diz, em destaque, o que a Cadillac faz naquele projeto, com selo de
  situação e nota de limite. Sem isso, presença no acervo vira atribuição de autoria.
- `projeto.historico` → série completa de edições de um projeto de terceiro, da mais
  recente para a mais antiga, com público por edição e selo de data. O resumo soma
  **participações, não pessoas únicas**, e deixa a edição futura fora da soma.

Decisão de integridade: **todo o público do Mr. Moo entra em `/dados/` com `counts:
false`**. São 143 mil participações em 22 edições que não são alcance da Cadillac, e
somar isso ao total da empresa seria falso. Elas aparecem identificadas, fora de
qualquer total.

Fonte sem URL pública (um mídia kit da produção) agora aparece como item identificado
em toda a lista de fontes, nunca como link quebrado; `/na-midia/` ignora essas entradas,
porque lá só entra o que o leitor pode abrir.

Valores comerciais (naming rights de R$ 950 mil, projeções de faturamento, mesa VIP)
ficam só em `/reservado/`. O telefone pessoal do contato comercial que consta no mídia
kit **não foi incluído em lugar nenhum do repositório**: é dado pessoal de terceiro.

## V10: Connect Heroes

Oitavo projeto do acervo, em `/projetos/connect-heroes/`, com a 1ª edição realizada em
julho de 2026 no Grand Hyatt Rio de Janeiro e a 2ª anunciada para dezembro. Como as duas
caem no mesmo ano, elas entram como **etapas** dentro da edição 2026, cada uma com seu
selo de situação de data — o dia exato de nenhuma das duas está documentado ainda.

Dois blocos novos no gerador, disponíveis para qualquer projeto:

- `projeto.mercado` → leitura do setor em que o evento atua, em cartões. Usado aqui para
  os números do jiu-jítsu brasileiro (praticantes, movimentação, academias, países).
  A nota do bloco diz, em todas as letras, que são estimativas de metodologia própria da
  produção, não censo oficial e não resultado do evento.
- `projeto.plano` → plano de longo prazo declarado: propósito, conceito, núcleos,
  verticais e fases por ano. Usado para o **World Connect Heroes**, de 2026 a 2032.
  A nota deixa explícito que é projeção estratégica, sem vínculo oficial com o
  Comitê Olímpico Internacional, com federações ou com os Jogos.

A audiência da 1ª edição entra em `/dados/` na família **transmissão**, nunca somada a
público presente: 240 mil televisores na Xsports, 149 mil visualizações no YouTube e
25 milhões em reels (família digital). A linha de 2 milhões “ao vivo + reprises” engloba
as anteriores e por isso fica **fora dos totais**. Todos são números declarados pela
produção no mídia kit oficial (V6), sem relatório de emissora nem captura de painel
anexados — o selo muda quando esses documentos chegarem.

Os valores comerciais da 2ª edição (custo total de referência do naming right e as quatro
cotas de patrocínio) ficam **só em `/reservado/`**, como todo dado de captação. Fonte sem
URL pública, como um documento da produção, agora aparece como texto identificado em vez
de link quebrado (`fonte_link()` em `build.py`).

## V9: o que faltava para competir

- **Equipe** (`/equipe/`): pessoas com cargo, bio, foto e, principalmente, **vínculo por
  projeto e por ano**. O modelo separa núcleo da casa, sócio em um projeto específico,
  especialista por frente e parceiro externo — porque alguém pode ser sócio no Itacoatiara
  e não atuar no Tamo Junto. Cada edição mostra "Quem assina esta operação" a partir dos
  mesmos vínculos. Para adicionar pessoas, copie `pessoas.vagas_modelo.modelo`.
- **Cases** por edição: desafio, solução, o que entregamos, resultado e depoimento. Campo
  vazio mostra o caminho exato no modelo, em vez de sumir.
- **Vídeo**: reel na home e vídeo por projeto. Aceita arquivo local ou URL de YouTube e
  Vimeo; sem URL, fica o espaço reservado.
- **Marcas**: mural de logotipos na home, ligado ao projeto onde cada marca aparece.
- **Imprensa** (`/imprensa/`): apresentação, marca, fotos e ficha técnica para download.
- **Contato** (`/contato/`): formulário com assunto, canais diretos e nota sobre o endpoint.
- **Inglês** (`/en/`): resumo institucional, frentes e lista de projetos, com `hreflang`.

## Página reservada

`/reservado/` reúne o que não vai ao ar: valores de captação, contratação e patrocínio,
os instrumentos do Banco do Brasil, as diligências em aberto, os pedidos a protocolar e
o espelho completo de audiência e operação, com o que falta em cada edição.

Ela sai dos buscadores por `noindex,nofollow,noarchive`, está fora do `sitemap.xml` e
nenhum link do site aponta para ela. **Isso não é controle de acesso**: quem tiver a URL
abre a página. Se o material for sensível, proteja o diretório no servidor com senha
(`.htaccess` ou equivalente) antes de publicar.

## Menu

Projetos · Atuação · Agenda · Mídia · Dados · Cadillac · Contatos

"Cadillac" e "Ecossistema" deixaram de ser páginas e viraram seções de `/atuacao/`
(`#sobre` e `#ecossistema`): a apresentação da empresa com razão social, CNPJ e
fundação, e a tabela de papéis e entidades. "Na Mídia" virou "Mídia" no rótulo,
mantendo a URL `/na-midia/`. "Contatos" entrou no menu.

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
- **Página `/agenda/`**: reúne edições, etapas de circuito, shows de turnê e apresentações
  relacionadas em um calendário único, separado entre o que tem dia e mês e o que só tem o
  ano. Entrou no menu principal.
- **Agenda da turnê Dominguinho**: a edição 2026 ganhou a lista de cidades citadas pela
  imprensa, as apresentações relacionadas e um painel que mostra a distância entre os 43 shows
  informados e as seis cidades nomeadas.
- **Datas reais**: cada edição passou a ter data estruturada (`datas` em `editions`), com
  início, fim, precisão e situação. O site escreve o período por extenso, calcula a duração em
  dias e mostra um selo dizendo se a data é confirmada, divulgada, anunciada, inferida, parcial,
  reportada ou a confirmar. Temporadas com mais de uma sede ganharam calendário de etapas com
  data e fonte por etapa.
- **Ordem cronológica invertida**: projetos e edições aparecem do mais recente para o mais
  antigo em todo o site — acervo, home, tabelas, matriz de cobertura e gráfico de edições por
  ano. A navegação entre edições continua cronológica, porque "anterior" e "próxima" só fazem
  sentido assim.
- **Elenco por edição**: bloco "Quem esteve em cena" com artistas, atletas e personalidades,
  cada um com o papel e a fonte. Entram os nomes documentados: o line-up de Fortaleza, os
  campeões de Belo Horizonte, o campeão do surfe e os sócios na realização do Itacoatiara,
  Bob Burnquist, André Frateschi, os skatistas do MAC Bahia.
- **Dominguinho com edição própria**: `/projetos/dominguinho/2026/` reúne os 43 shows, as
  cidades da turnê, os 300 milhões de streams, o especial na TV Globo e o cruzamento com o
  Tamo Junto BB de Fortaleza.
- **`/dados/` virou página de evento**: abre com alcance, segue com a tabela evento por
  evento — data, local, público, inscritos e elenco — e depois transmissões. Os indicadores
  de acervo (registros documentados, fontes por projeto) saíram: descreviam o catálogo, não
  os eventos.
- **Estimativa por capacidade**: a linha de público aceita `tipo: "estimado"` com a conta
  escrita (`capacidade × ocupação × dias`). Estimativa aparece marcada como tal, não entra no
  total de público declarado, e número declarado tem prioridade sobre estimativa, que tem
  prioridade sobre projeção.
- **Transmissões**: `/dados/#transmissoes` lista o que foi ao ar por evento e parceiro — CBSk
  no YouTube para o Vert Battle, IBC World Tour no Itacoatiara, Banco do Brasil e emissoras no
  Tamo Junto BB, TV Globo no especial do Dominguinho — com a coluna da audiência, a URL do
  registro e a referência. Nenhuma contagem foi lida: o ambiente bloqueia o acesso às
  plataformas. Cada linha espera a URL exata e a data da leitura, em `transmissoes.registros`.
  A audiência de transmissão é uma grandeza própria no bloco de alcance: nunca soma com
  público presente nem com streams de música.
- **Ficha de operação**: cada projeto ganhou um bloco de porte (cidades, modalidades, maior
  público, equipe, fornecedores, dias de montagem) e cada edição uma ficha completa
  (inscritos, público, capacidade do local, equipe em operação, fornecedores, dias de evento
  e de montagem, modalidades, palcos e transmissão). O campo sem dado aparece como
  "a preencher" com o caminho exato no `content-model.json`, em vez de sumir.
- **Interruptor `MOSTRAR_CAMPOS`** no topo do `build.py`: com `True`, os campos vazios e os
  espaços de imagem exibem o caminho do arquivo ou da chave, para a equipe preencher. Troque
  para `False` antes de publicar e os caminhos somem da página, ficando apenas no atributo
  `title`.
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
