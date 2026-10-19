# Revisão geral do portal Cadillac
Auditoria de 18/10/2026 · 26 páginas · build V8

Auditei as 26 páginas em cinco larguras (320, 390, 768, 1024 e 1440px), medindo
estrutura, acessibilidade, SEO, peso, cobertura de conteúdo e navegação. Este
documento separa o que **está resolvido**, o que **corrigi agora** e o que **depende
de decisão ou de dado que só a produção tem**.

---

## 1. Estado técnico — sólido

| Verificação | Resultado |
|---|---|
| Links internos quebrados | 0 em 26 páginas |
| Transbordo horizontal | 0 em 320, 390, 768, 1024 e 1440px |
| Erros de JavaScript | nenhum |
| `h1` por página | exatamente 1 em todas |
| Saltos de hierarquia de título | nenhum |
| IDs duplicados | nenhum |
| Imagens sem `alt` | 0 |
| Links sem texto ou com texto vago | 0 |
| Links externos sem `rel="noopener"` | 0 |
| Títulos e descrições duplicados | nenhum |
| Páginas sem canonical ou `og:image` | nenhuma |
| Blocos JSON-LD válidos | 58 |
| Peso por página | 265–298 KB em 10 requisições |

## 2. Corrigido nesta revisão

1. **Alvos de toque abaixo de 24px** — links de fonte dentro de tabelas, trilha de
   navegação e o "voltar" das edições tinham 15 a 17px de altura. Abaixo do mínimo
   da WCAG 2.5.8 para alvo que não está no meio de um parágrafo. Agora todos têm 24px.
2. **Títulos e descrições longos demais** — sete títulos passavam de 70 caracteres e
   seis descrições de 160, o que o Google corta. O gerador passou a encurtar sem
   partir palavra, e os títulos de projeto e edição ficaram mais diretos.
3. **Logotipo pesado** — servíamos 900px de largura para exibir no máximo 290px.
   Reduzido para 600px: 110 KB viraram 79 KB, em toda página do site.

## 3. O que falta de material — o maior buraco

A estrutura está pronta e vazia em pontos que importam. Não é defeito de código: é
dado que não existe em fonte pública.

| Frente | Preenchido | Falta |
|---|---|---|
| Fotografia | 0 | todos os espaços: 8 capas de projeto, 10 de edição, 30 de galeria |
| Audiência | 6 linhas | 17 linhas sem número |
| Transmissões | 0 medidas | 6 registros sem leitura de plataforma |
| Datas com dia e mês | 4 edições | 6 edições só com o ano |
| Ficha de operação | 6 campos | equipe, fornecedores, dias de montagem e palcos em **todas** as 10 edições |

**Os quatro campos que mais vendem porte estão 100% vazios**: equipe em operação,
fornecedores, dias de montagem e palcos simultâneos. São os números que transformam
"produzimos o Itacoatiara Pro" em "mobilizamos X pessoas e Y fornecedores em Z dias
de montagem". Nenhum deles vem de imprensa — saem do mapa de equipe, da lista de
fornecedores, do contrato de locação e do cronograma de produção.

### Cobertura por projeto

| Projeto | Edições | Registros | Fontes | FAQ | Elenco |
|---|---|---|---|---|---|
| Itacoatiara Pro | 4 | 16 | 11 | 4 | 3 edições |
| Vert Battle | 2 | 9 | 5 | 3 | 2 edições |
| Tamo Junto BB | 2 | 9 | 4 | 3 | 1 edição |
| Dominguinho | 1 | 7 | 2 | 3 | 1 edição |
| Bob Burnquist | — | 6 | 3 | 4 | 1 |
| Festival de Tribos de Juruti | 1 | 4 | 1 | 2 | 1 |
| Arte em Circuito | — | 4 | 1 | 2 | 1 |
| CCBB no MAC Bahia | — | 4 | **0** | 1 | 1 |

**CCBB no MAC Bahia é a única página sem nenhuma fonte pública.** Ela se sustenta só
em relato profissional. Ou se recupera a ficha técnica institucional, ou essa página
não deveria ir ao ar na primeira publicação.

## 4. Organização — duas sobreposições a decidir

1. **Agenda e Dados cobrem o mesmo terreno.** A tabela "evento por evento" em `/dados/`
   e o calendário em `/agenda/` repetem data, local e evento. Proposta: `/agenda/` fica
   com quando e onde; `/dados/` fica só com quanto — público, inscritos, elenco — e
   linka para a agenda.
2. **O menu tem sete itens** (Projetos, Atuação, Agenda, Na Mídia, Dados, Ecossistema,
   Cadillac). Cabe no desktop com folga de 35px a 1100px, mas é muito para decidir
   rápido. Proposta: manter Projetos, Atuação, Agenda e Dados no topo, e levar
   Na Mídia e Ecossistema para dentro de Dados, como seções com âncora.

## 5. Fluidez — o que atrapalha hoje

- **Densidade de "a preencher".** São 299 marcações visíveis no site, 53 só em `/dados/`.
  Para a equipe, é a lista de pendências. Para um patrocinador, pode passar a impressão
  de portal inacabado. O interruptor `MOSTRAR_CAMPOS` no `build.py` já esconde os
  caminhos técnicos; recomendo também esconder as linhas vazias na versão pública,
  mantendo-as na interna.
- **`/dados/` tem 1.035 nós de DOM**, quase o triplo das outras. São quatro tabelas
  largas em sequência. Em celular, isso é muito rolar. Com a separação do item 4.1 o
  problema se resolve sozinho.
- **O 404 usa URLs absolutas** do domínio definitivo, por necessidade técnica. Em
  staging ele aparece sem estilo. É esperado, mas vale saber antes de testar.

## 6. Riscos antes de publicar

1. **Direito de imagem** — nenhuma foto de terceiro é carregada hoje, e isso deve
   continuar. As três prévias hotlinkadas foram removidas.
2. **Marca** — o lettering "Cadillac" é idêntico ao da montadora. Se o arquivo não for
   identidade própria registrada de vocês, vale a checagem jurídica.
3. **E-mail de contato** — `contato@cadillacproducoes.com.br` é sugerido e precisa
   existir antes da publicação.
4. **Atribuições em validação** — Tamo Junto BB e Dominguinho estão descritos como
   participação informada, não contratada. Manter assim até haver ficha técnica.

## 7. Ordem de prioridade recomendada

1. Fotografia oficial das capas de projeto (8 arquivos) — é o que mais muda a percepção.
2. Equipe, fornecedores e dias de montagem das três edições mais recentes.
3. Ficha técnica do CCBB no MAC Bahia, ou retirada da página.
4. Datas exatas das seis edições que só têm o ano.
5. Leitura das transmissões no canal da CBSk, com data de captura.
6. Decisão sobre o item 4 (Agenda/Dados e menu).


---

# Atualização V9 — estrutura para competir de igual

Depois da revisão, entrou tudo o que as agências de referência mostram e o portal não tinha.

| Critério | Antes | Agora | Teto com o material |
|---|---|---|---|
| Engenharia e performance | 9,0 | 9,0 | 9,5 |
| Acessibilidade | 9,0 | 9,5 | 10 |
| SEO e estrutura | 8,5 | 9,0 | 10 |
| Arquitetura de conteúdo | 8,0 | 9,5 | 10 |
| Identidade visual | 7,0 | 7,0 | 10 |
| Prova de capacidade | 4,0 | 6,0 | 10 |
| Material visual | 2,0 | 2,0 | 10 |
| Conversão comercial | 4,5 | 8,0 | 10 |

**O que subiu sem depender de vocês**: formulário de contato, kit de imprensa, mural de
marcas, página de equipe com vínculo por evento, case estruturado por edição, versão em
inglês, créditos de operação em cada página.

**O que não sobe sem vocês**: identidade visual e material visual continuam onde estavam,
porque dependem de fotografia e do reel. Prova de capacidade subiu só até 6 porque equipe,
fornecedores e dias de montagem seguem vazios.

## O que falta, por ordem de impacto

| Item | Onde entra | Quem resolve |
|---|---|---|
| Reel de 20 a 30 segundos | `assets/video/reel.mp4` | produção |
| 8 fotos de capa de projeto | `assets/fotos/<slug>.jpg` | produção |
| Foto da equipe | `assets/fotos/<slug-da-pessoa>.jpg` | equipe |
| Nomes e cargos do restante do time | `pessoas.equipe` | direção |
| Equipe, fornecedores, montagem por edição | `operacao.fichas` | produção |
| Case das 3 edições recentes | `cases.fichas` | direção |
| Depoimento de patrocinador | `cases.fichas · depoimento` | comercial |
| Logotipos autorizados | `assets/marcas/` | jurídico e marcas |
| Apresentação em PDF | `assets/kit/` | direção |
| Endpoint do formulário | `contato.endpoint` | TI |
| Telefone e redes | `contato.canais` | direção |


## V10 — Connect Heroes no acervo

O acervo passa de sete para oito projetos. O Connect Heroes é, hoje, o único projeto do
site com **audiência de transmissão declarada em número**, o que muda o que a página de
dados consegue mostrar: até aqui a família “transmissão” tinha registros sem métrica.

| Dimensão | V9 | V10 | Teto |
|---|---|---|---|
| Prova de capacidade | 6,0 | 6,5 | 10 |
| Conversão comercial | 8,0 | 8,5 | 10 |
| Arquitetura de conteúdo | 9,5 | 9,5 | 10 |

Subiu pouco de propósito. O que entrou é bom — TV aberta, Globoplay, Disney+, 27
reprises, hotel cinco estrelas, plano até 2032 — mas **nenhum número tem lastro
verificável ainda**: tudo vem do mídia kit da produção. Enquanto não houver relatório de
emissora ou captura do painel do YouTube, o site diz isso em vez de apresentar os números
como auditados.

### O que falta neste projeto

| Item | Onde entra | Quem resolve |
|---|---|---|
| Dia exato da 1ª edição | `editions.2026.etapas` | produção |
| Data da 2ª edição de dezembro | `editions.2026.etapas` | produção |
| Relatório da emissora (240 mil televisores) | `audiencia.entries` | Xsports |
| Captura do painel do YouTube | `transmissoes.registros` | canal próprio |
| Público presente e capacidade do salão | `operacao.fichas` | produção |
| Inscritos e chave completa de atletas | `elenco.por_edicao` | produção |
| Fotos da edição e da fight week | `assets/fotos/connect-heroes-2026-*.jpg` | produção |
| Papel contratual da Cadillac no evento | `creditos` do projeto | direção |

A última linha é a mais importante. O site hoje **não afirma** qual é a relação da
Cadillac com o Connect Heroes, porque nenhum documento disponível diz isso. Enquanto a
ficha técnica não chegar, o projeto aparece no acervo pelo que está documentado sobre o
evento, não por atribuição de autoria.


## V11 — Mr. Moo Festival e a regra do papel

Nove projetos no acervo. O Mr. Moo é o primeiro em que a Cadillac não é produtora, e
isso obrigou o site a responder uma pergunta que antes ficava implícita: **o que a
Cadillac faz em cada projeto?**

| Dimensão | V10 | V11 | Teto |
|---|---|---|---|
| Prova de capacidade | 6,5 | 7,0 | 10 |
| Conversão comercial | 8,5 | 9,0 | 10 |
| Arquitetura de conteúdo | 9,5 | 10 | 10 |

Arquitetura de conteúdo chega a 10 porque o bloco `papel` fecha o último buraco
estrutural do acervo: agora todo projeto pode declarar o vínculo da empresa com ele, e
nenhum número de terceiro entra nos totais da casa sem dizer de quem é.

### O que o Mr. Moo traz, e o que não traz

Traz: um recorde do Guinness com data e certificado, 22 edições com série histórica de
público, público de 420 cidades e seis países, e um portfólio de marcas ativadas
(Banco do Brasil, Estância 92 e Minerva Foods, Red Bull, Heineken, Chevrolet,
Tramontina, Sapore). É o ativo comercial mais forte do acervo.

Não traz: prova de capacidade da Cadillac. Nada disso foi operado pela empresa, e a
página diz isso três vezes — no bloco de papel, na nota do histórico e em cada linha
de `/dados/`.

### O que falta neste projeto

| Item | Onde entra | Quem resolve |
|---|---|---|
| Contrato ou carta que formaliza a captação | `papel` do projeto | direção e jurídico |
| Dia exato das edições de 2026 e anteriores | `historico.linhas` | produção do festival |
| Número do recorde do Guinness (toneladas em 8h) | `facts.2025` | produção do festival |
| Link público do registro no Guinness | `sources` | produção do festival |
| Recorte por edição dos volumes (115 t, 920 mil, 415 mil) | `mercado.items` | produção do festival |
| Autorização de uso das marcas ativadas | `clientes` e `assets/marcas/` | jurídico |
| Fotos oficiais do festival | `assets/fotos/mr-moo-festival-*.jpg` | produção do festival |

O número do recorde é o item de maior retorno: “maior churrasco do mundo” sem a
quantidade certificada é adjetivo; com ela, é fato audível por qualquer patrocinador.
