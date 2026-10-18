# CADILLAC / PORTAL — V7

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
na-midia/                      referências agrupadas por projeto
dados/                         métricas, gráficos, cobertura e metodologia
404.html                       página de erro
assets/site.css, site.js       estilo e comportamento, sem dependências de framework
content-model.json             fonte única de conteúdo
build.py                       gerador
```

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
