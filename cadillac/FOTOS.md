# Fotos: por que não entraram e como entram

## Por que não entraram

Duas razões, e elas são independentes.

**1. Este ambiente não alcança nenhum portal.** A sessão que gera o site roda atrás de
um proxy com lista de permissão. Testado nesta rodada:

| Destino | Resposta |
|---|---|
| `itacoatiarapro.com.br` | túnel recusado |
| `tamojuntobb.com.br` | túnel recusado |
| `cbsk.com.br` | túnel recusado |
| `instagram.com/connectheroes` | túnel recusado |
| `i.ytimg.com` | túnel recusado |
| `github.com` | passa |

Só o GitHub e alguns repositórios de pacote passam. Não é possível baixar um arquivo de
imagem daqui — nem de portal oficial, nem de veículo de imprensa.

**2. Foto de imprensa não é nossa para publicar.** Mesmo com acesso, a imagem que
ilustra uma reportagem pertence ao veículo ou ao fotógrafo. Três referências assim já
foram retiradas deste projeto antes, e estão registradas em
`content-model.json · photos.referencias_removidas`. Citar a fonte não transfere direito
de uso. Num site institucional que busca patrocínio, usar foto de terceiro sem licença é
exposição jurídica desnecessária.

O que vale é imagem de três origens: **acervo próprio da Cadillac**, **material cedido
pelo produtor ou patrocinador com autorização escrita**, e **órgão público que publique
sob licença aberta**.

## O que já sabemos sobre cada origem

Levantado por pesquisa nesta rodada.

| Projeto | Quem tem a foto | Observação |
|---|---|---|
| Itacoatiara Pro 2026 | Prefeitura de Niterói | A cobertura credita **Lucas Benevides / Prefeitura de Niterói**. Órgão público costuma ceder para divulgação mediante pedido à assessoria. É o caminho mais curto do acervo. |
| Itacoatiara Pro 2022 | Funarte | Os concertos das orquestras sociais foram programa da Funarte. Pedir ao núcleo do Arte em Circuito. |
| Tamo Junto BB 2025 e 2024 | Banco do Brasil | As imagens da cobertura aparecem como *Divulgação*, o que indica material fornecido pelo banco. Pedir à área de marketing e comunicação, com os termos de uso por escrito. |
| Vert Battle | Confederação Brasileira de Skate | Entidade organizadora das etapas. |
| Connect Heroes | produção do evento | Perfil oficial `@connectheroes`. |
| Mr. Moo Festival | produção do festival | O mídia kit que recebemos já traz fotos em alta. **É a origem mais fácil de resolver:** basta a produção liberar os arquivos soltos e autorizar o uso. |
| Dominguinho | assessoria do projeto | — |
| Festival de Tribos de Juruti | acervo do festival | — |
| CCBB no MAC Bahia | CCBB | Ficha técnica institucional. |

## Como entram

Cada espaço no site já mostra o nome exato do arquivo que espera. Não há nada a
programar: é copiar para `assets/fotos/` com esse nome e rodar `python3 build.py`.

A lista completa de nomes está em `assets/fotos/LEIA-ME.md`.

Formatos: capa de projeto e de edição em 16:10 ou 3:2; galeria em 16:9 para a principal
e 4:5 para as duas laterais. JPG, lado maior de 2000px é suficiente.

## O pedido, pronto para enviar

> Estamos publicando o portal institucional da Cadillac e queremos usar imagens da
> [edição / evento]. Vocês podem nos enviar de 3 a 5 fotos em alta, com autorização de
> uso para divulgação institucional no site e nas redes da Cadillac, e o crédito como
> deve ser escrito? Se houver restrição de prazo ou de meio, por favor nos informem.

Peça sempre o **crédito por escrito** junto com o arquivo. O site já tem onde exibi-lo.

## Ordem de retorno

1. **Mr. Moo** — a produção já nos mandou o mídia kit com as fotos. Só falta liberar os
   arquivos e autorizar.
2. **Itacoatiara Pro 2026** — Prefeitura de Niterói, origem pública e identificada.
3. **Tamo Junto BB** — Banco do Brasil, que é também o maior nome do acervo.

Com esses três, a página inicial e os três projetos mais fortes saem do hachurado. É o
que move a nota de 7,3 mais que qualquer outra coisa.
