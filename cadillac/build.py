#!/usr/bin/env python3
"""Gerador estático do portal Cadillac (V7).

Uso: python3 build.py
Lê content-model.json e escreve todas as páginas HTML, o sitemap e o robots.
Os assets (assets/site.css, assets/site.js) são mantidos à mão.
"""

import collections
import html
import json
from urllib.parse import quote
import pathlib
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parent
MODEL = json.loads((ROOT / "content-model.json").read_text(encoding="utf-8"))
SITE = MODEL["site"]
BASE = SITE["url"].rstrip("/")
CATS = MODEL["categories"]


def _carimbo(nome):
    """Oito caracteres do hash do arquivo, para o endereço mudar quando ele muda.

    Antes o carimbo vinha da versão do modelo. Mas CSS e JS são mantidos à mão e
    mudam sem que o modelo mude: três alterações seguidas de estilo mantiveram o
    mesmo endereço, e o navegador serviu por um ano o arquivo guardado — a página
    nova com a aparência velha. Com o hash do conteúdo, qualquer edição no arquivo
    muda o endereço, e só ela.
    """
    import hashlib
    caminho = ROOT / "assets" / nome
    if not caminho.exists():
        return "0"
    return hashlib.sha256(caminho.read_bytes()).hexdigest()[:8]


CARIMBO = {"site.css": _carimbo("site.css"), "site.js": _carimbo("site.js"),
           "fontes.css": _carimbo("fontes/fontes.css")}
ANO_BASE = SITE["base_year"]
ANO_ATUAL = int(MODEL["updated"][:4])
ANOS_CASA = ANO_ATUAL - ANO_BASE
def ano_de(eid):
    """O ano de uma edicao. O id pode ser 2026 ou "2026-2": um ano com duas."""
    return int(str(eid)[:4])


def rotulo_ed(pr, eid):
    """Como a edicao se chama na tela. Sem rotulo proprio, chama-se pelo ano."""
    ed = (pr.get("editions") or {}).get(str(eid)) or {}
    return ed.get("rotulo") or str(eid)


def href_edicao(pr, ano, p):
    """Link da edicao a partir do ano. Com duas no mesmo ano, leva ao projeto."""
    base = f'{p}projetos/{pr["slug"]}/'
    if not ano:
        return base
    ids = [x for x in pr["years"] if ano_de(x) == int(ano)]
    return f'{base}{ids[0]}/' if len(ids) == 1 else base


def _recencia(pr):
    """Ano mais recente do projeto; sem edição, lê o fim do período."""
    if pr["years"]:
        return max(ano_de(y) for y in pr["years"])
    digitos = [int(t) for t in __import__("re").findall(r"(20\d\d)", pr.get("period", ""))]
    return max(digitos) if digitos else 0


PROJECTS = sorted(MODEL["projects"],
                  key=lambda pr: (pr.get("ordem") or 99, -_recencia(pr), pr["name"]))

# Modo de preenchimento: mostra, em cada campo vazio, o caminho exato no
# content-model.json. Deixe False antes de publicar para o público.
MOSTRAR_CAMPOS = True

# O Google Fonts responde 400 quando icon_names traz um nome repetido, e aí
# NENHUM ícone do site carrega: cada um aparece com o próprio nome escrito.
# Por isso a lista passa por set() e o build confere, no fim, se algum ícone
# pedido ficou de fora.
ICONES = {
    "arrow_back", "arrow_forward", "arrow_outward", "calendar_month", "call", "campaign",
    "chat", "chevron_right", "close", "description", "download", "engineering", "expand_more",
    "festival", "filter_list", "groups", "home", "insights", "language", "mail", "menu",
    "movie", "music_note", "north", "palette", "photo_camera", "place",
    "play_arrow", "public", "search", "skateboarding", "stacked_bar_chart", "verified",
    "confirmation_number",
}
# Entram no subset sem passar por icon(): "close" é trocado pelo JS no botão do
# menu e "download" só aparece quando há arquivo de kit publicado.
ICONES_DINAMICOS = {"close", "download"}
ICON_SUBSET = ",".join(sorted(ICONES))
ICONES_PEDIDOS = set()

ATLETAS = MODEL.get("atletas", {}).get("lista", [])
ATLETA_POR_NOME = {x["nome"].lower(): x for x in ATLETAS}


def atleta_href(nome, depth):
    """Link para a ficha do atleta, quando ele existe no acervo."""
    x = ATLETA_POR_NOME.get(nome.strip().lower())
    return f'{rel(depth)}atletas/{x["slug"]}/' if x else None


# Cada entrada: rótulo, destino do próprio item, chave de página ativa e os
# grupos do submenu. Grupo sem título vira lista direta.
NAV = [
    ("Eventos", "projetos/", "eventos", [
        (None, [("Todos os eventos", "projetos/"),
                ("Agenda", "agenda/")]),
    ]),
    ("Produtora", "produtora/", "produtora", [
        (None, [("Nossa história", "produtora/#historia"),
                ("Manifesto", "produtora/#manifesto"),
                ("Atuação", "atuacao/")]),
        # Time e Nossa essência sao submenus, nao rotulos. Antes o painel da
        # Produtora despejava os onze links de uma vez, com os titulos de grupo
        # servindo so de separador visual: a lista inteira abria junto e quem
        # procurava "Atuação" varria onze linhas. Agora o painel mostra cinco
        # itens e estes dois abrem o proprio nivel.
        ("Time", "equipe/", [("Equipe", "equipe/"),
                             ("Atletas", "atletas/"),
                             ("Artistas", "artistas/"),
                             ("Parceiros", "parceiros/")]),
        ("Nossa essência", "produtora/#missao",
                           [("Missão", "produtora/#missao"),
                            ("Visão", "produtora/#visao"),
                            ("Valores", "produtora/#valores"),
                            ("Objetivos", "produtora/#objetivos")]),
    ]),
    ("Dados", "dados/", "dados", [
        (None, [("Cadillac em números", "dados/#numeros"),
                ("Audiência e alcance", "dados/#alcance"),
                ("Perfil do público", "dados/#perfil"),
                ("Impacto e resultados", "dados/#impacto"),
                ("Quadro de indicadores", "dados/#kpis"),
                ("Números do setor", "dados/#setor"),
                ("Certificações", "dados/#certificacoes")]),
    ]),
    ("Imprensa", "imprensa/", "imprensa", [
        (None, [
                ("Na mídia", "na-midia/"),
                ("Releases", "imprensa/#releases"),
                ("Press kit", "imprensa/"),
                ("Fotos e vídeos", "imprensa/#fotos-videos"),
                ("Assessoria de imprensa", "imprensa/#assessoria")]),
    ]),
    ("Relacionamento", "relacionamento/", "relacionamento", [
        (None, [("Patrocínios", "relacionamento/#patrocinios"),
                ("Marcas e ativações", "relacionamento/#marcas"),
                ("Novos negócios", "relacionamento/#negocios"),
                ("Fornecedores", "relacionamento/#fornecedores"),
                ("Talentos", "relacionamento/#talentos"),
                ("Trabalhe conosco", "relacionamento/#trabalhe"),
                ("Contato", "contato/")]),
    ]),
]

# Cada documento tem pagina propria. Antes eram seis ancoras numa pagina so:
# um link de politica de privacidade precisa abrir a politica de privacidade,
# nao jogar o visitante no meio de um documento de seis assuntos.
GOVERNANCA = [(d["titulo"], f'governanca/{d["slug"]}/') for d in MODEL["governanca"]["itens"]]


# --------------------------------------------------------------------------
# utilidades
# --------------------------------------------------------------------------
def e(text):
    return html.escape(str(text), quote=True)


def rel(depth):
    return "../" * depth


def icon(name, cls="cd-icon"):
    ICONES_PEDIDOS.add(name)
    return f'<span aria-hidden="true" class="material-symbols-outlined {cls}">{name}</span>'


def so_digitos(valor):
    """O numero como o aparelho disca: so sinal e digitos."""
    return "".join(ch for ch in valor or "" if ch.isdigit() or ch == "+")


def host_of(url):
    return urlsplit(url).netloc.replace("www.", "")


def brl(value):
    return "R$ " + f"{value:,.0f}".replace(",", ".")


def plural(n, one, many):
    return f"{n} {one if n == 1 else many}"


# --------------------------------------------------------------------------
# blocos estruturais
# --------------------------------------------------------------------------
def encurta(texto, limite):
    """Corta no limite sem partir palavra, para título e meta-descrição."""
    if len(texto) <= limite:
        return texto
    corte = texto[:limite].rsplit(" ", 1)[0].rstrip(" ,.;:—-")
    return corte + "…"


def head(depth, title, desc, path, jsonld=(), extra="", og_image=None):
    title, desc = encurta(title, 65), encurta(desc, 155)
    p = rel(depth)
    og = og_image or f"{BASE}/assets/og-cadillac.jpg"
    url = f"{BASE}/{path}" if path else f"{BASE}/"
    blocks = "".join(
        f'<script type="application/ld+json">{json.dumps(b, ensure_ascii=False)}</script>'
        for b in jsonld
    )
    # As fontes sao servidas pelo proprio site, nao pelo Google.
    #
    # Duas razoes. A de privacidade: a folha do Google carregava em todas as
    # paginas e entregava o IP de cada visitante a um terceiro, coisa que a
    # Politica de cookies e obrigada a declarar. Servindo daqui, nao ha o que
    # declarar. A de velocidade: eram duas conexoes novas e duas idas e voltas
    # antes do primeiro caractere aparecer; agora os arquivos vem do mesmo
    # servidor, na conexao ja aberta.
    #
    # Ficaram so os subconjuntos latin e latin-ext: cirilico, grego e
    # vietnamita nunca seriam pedidos num site em portugues.
    fonts = f'<link rel="stylesheet" href="{p}assets/fontes/fontes.css?v={CARIMBO["fontes.css"]}">'
    return f"""<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f7f6f3">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="{e(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{e(SITE['name'])}">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(url)}">
<meta property="og:image" content="{og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Logotipo da Cadillac Produções e Filmes">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(title)}">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{og}">
<link rel="icon" href="{p}assets/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="{p}assets/favicon-180.png">
{fonts}
<link rel="stylesheet" href="{p}assets/site.css?v={CARIMBO['site.css']}">
<script defer src="{p}assets/site.js?v={CARIMBO['site.js']}"></script>
{blocks}{extra}</head>"""


def header(depth, active="", body_class=""):
    """Cabeçalho com submenus. Sem JavaScript: abre no hover e no foco do teclado,
    e no celular usa <details>, que é acordeão nativo.

    body_class permite que a home peça o cabeçalho sobreposto ao vídeo do herói.
    """
    p = rel(depth)
    home = p if depth else "./"
    desk, mob = [], []
    for i, (label, target, key, grupos) in enumerate(NAV):
        cur = ' aria-current="page"' if key == active else ""
        colunas, linhas_mob = [], []
        for grupo in grupos:
            # (None, itens) e uma lista solta; (titulo, alvo, itens) e um
            # submenu que abre o proprio nivel.
            if len(grupo) == 2:
                titulo, itens = grupo
                alvo = None
            else:
                titulo, alvo, itens = grupo
            links = "".join(f'<a href="{home}{u}">{e(l)}</a>' for l, u in itens)
            if alvo:
                colunas.append(
                    f'<div class="nav-sub"><a class="nav-sub-top" href="{home}{alvo}">'
                    f'{e(titulo)}{icon("chevron_right")}</a>'
                    f'<div class="nav-sub-panel"><div class="nav-links">{links}</div></div></div>')
                # no celular o mesmo submenu e um acordeao dentro do acordeao
                linhas_mob.append(
                    f'<details class="mob-sub"><summary>{e(titulo)}{icon("expand_more")}</summary>'
                    f'<div class="mob-links">{links}</div></details>')
            else:
                colunas.append(f'<div class="nav-links">{links}</div>')
                linhas_mob.append(links)
        desk.append(
            f'<div class="nav-item"><a class="nav-top" href="{home}{target}"{cur}>{e(label)}'
            f'{icon("expand_more")}</a>'
            f'<div class="nav-panel"><div class="nav-panel-inner">{"".join(colunas)}</div></div></div>')
        mob.append(
            f'<details class="mob-group"{" open" if key == active else ""}>'
            f'<summary>{e(label)}{icon("expand_more")}</summary>'
            f'<div class="mob-links">{"".join(linhas_mob)}</div></details>')
    gov = "".join(f'<a href="{home}{u}">{e(l)}</a>' for l, u in GOVERNANCA)
    cls = f' class="{body_class}"' if body_class else ""
    return f"""<body{cls}><a class="skip-link" href="#conteudo">Ir para o conteúdo</a>
<header class="site-header"><div class="header-inner">
<a class="logo" href="{home}" aria-label="Cadillac Produções e Filmes, página inicial">{marca(p, "logo-cadillac", "logo-mark", True)}<span class="logo-sub">Produções<br>&amp; Filmes</span></a>
<nav class="nav" aria-label="Menu principal">{''.join(desk)}</nav>
<a class="contact-nav btn-laranja" href="{home}contato/">Vamos conversar {icon('arrow_outward')}</a>
<button class="hamburger" id="menuToggle" aria-expanded="false" aria-label="Abrir menu" aria-controls="mobileNav">{icon('menu')}</button>
</div></header>
<nav class="mobile-nav" id="mobileNav" aria-label="Menu principal, versão compacta">
{''.join(mob)}
<a class="mob-contato btn-laranja" href="{home}contato/">Vamos conversar {icon('arrow_outward')}</a>
<p class="mob-grupo">Governança e políticas</p><div class="mob-links">{gov}</div></nav>"""


def crumbs(depth, trail):
    """trail: lista de (label, href relativo ou None para a página atual)."""
    p = rel(depth)
    items = [(f'<li><a href="{p if depth else "./"}">{icon("home")} Início</a>'
              f'{icon("chevron_right")}</li>')]
    ld = [{"@type": "ListItem", "position": 1, "name": "Início", "item": BASE + "/"}]
    for i, (label, href) in enumerate(trail, start=2):
        if href:
            items.append(f'<li><a href="{href}">{e(label)}</a>{icon("chevron_right")}</li>')
            ld.append({"@type": "ListItem", "position": i, "name": label,
                       "item": f"{BASE}/{href.replace(p, '')}"})
        else:
            items.append(f'<li><span aria-current="page">{e(label)}</span></li>')
            ld.append({"@type": "ListItem", "position": i, "name": label})
    nav = (f'<nav aria-label="Trilha de navegação" class="crumbs container">'
           f'<ol>{"".join(items)}</ol></nav>')
    return nav, {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": ld}


def footer(depth):
    p = rel(depth)
    home = p if depth else "./"
    # As mesmas cinco famílias do cabeçalho. O rodapé repetia treze links soltos,
    # numa ordem que não era a do menu.
    nav = "".join(f'<a href="{home}{alvo}">{e(rotulo)}</a>'
                  for rotulo, alvo, _, _ in NAV)
    gov = "".join(f'<a href="{home}{u}">{e(l)}</a>' for l, u in GOVERNANCA)
    return f"""<footer class="footer"><div class="container foot-top">
<a class="footer-logo" href="{home}" aria-label="Cadillac Produções e Filmes, página inicial">{marca(p, "logo-cadillac-branco", "")}</a>
<nav class="foot-nav" aria-label="Rodapé">{nav}</nav></div>
<div class="container foot-bottom"><span>© {ANO_BASE}–{ANO_ATUAL} {e(SITE['name'])} Ltda.</span>
<nav class="foot-gov-nav" aria-label="Governança e políticas">{gov}</nav>
<a class="foot-by" href="https://instfy.com" target="_blank" rel="noopener noreferrer">Powered by <strong>instfy</strong></a>
</div></footer>
<a class="to-top" href="#top" aria-label="Voltar ao topo">{icon('north')}</a>
</body></html>"""


def fonte_link(fonte, vazio="—"):
    """Link da fonte. Documento interno sem URL aparece como texto, nunca como link quebrado."""
    if not fonte:
        return vazio
    label, url = fonte
    if not url:
        return f'<span class="s-doc">{icon("description")} {e(label)}</span>'
    return (f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">'
            f'{e(label)}</a>')


def bloco_fontes(sources, depth, titulo):
    """Lista as fontes do registro e sempre aponta o acervo de imprensa.

    Sem fonte própria a seção não anuncia o vazio: leva direto para a Mídia,
    onde está a cobertura reunida por projeto.
    """
    p = rel(depth)
    ir_para_midia = (f'<div class="section-end"><a class="pill-link" href="{p}na-midia/">'
                     f'Coberturas {icon("description")}</a></div>')
    if not sources:
        return f"""<section class="container sources"><hr class="rule">
<h2>NA MÍDIA.</h2>
<p class="body-copy">A cobertura de imprensa dos eventos está reunida em um acervo
único, organizado por evento.</p>{ir_para_midia}</section>"""
    return f"""<section class="container sources"><hr class="rule">
<h2>{titulo}</h2>{source_list(sources)}{ir_para_midia}</section>"""


def source_list(sources):
    if not sources:
        return ('<p class="note">Nenhuma fonte pública recuperada até agora para este registro. '
                'A ficha técnica institucional está sendo solicitada e entra aqui assim que chegar.</p>')
    rows = []
    for label, url in sources:
        if not url:
            rows.append(
                f'<span class="s-item s-offline">'
                f'<span class="s-main"><span class="s-label">{e(label)}</span>'
                f'<span class="s-host">documento da produção, sem URL pública</span></span>'
                f'{icon("description")}</span>'
            )
            continue
        rows.append(
            f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">'
            f'<span class="s-main"><span class="s-label">{e(label)}</span>'
            f'<span class="s-host">{e(host_of(url))}</span></span>'
            f'</a>'
        )
    return f'<div class="source-list">{"".join(rows)}</div>'


# --------------------------------------------------------------------------
# Imagens responsivas
# --------------------------------------------------------------------------
# O acervo guarda o JPEG em tamanho cheio e, ao lado, variantes WebP em 400,
# 800 e 1600px. A pagina pedia sempre o JPEG de 1600px: o cartao da home
# aparece com 615px e recebia 1600, e o retrato do atleta aparece com 191px e
# recebia 800. Eram 2,1 MB de imagem numa pagina que precisa de uma fracao
# disso. Aqui a pagina passa a oferecer as variantes e deixar o navegador
# escolher pela largura real do slot.

_DIM = {}

# Retratos sao quadrados e pequenos: 300px cobre a maior ocorrencia na tela.
MEDIDAS_RETRATO = "(min-width:1100px) 300px, (min-width:640px) 25vw, 45vw"


def dimensoes(rel_caminho):
    """Largura e altura lidas do arquivo, sem depender de biblioteca externa.

    Sem width e height no HTML o navegador so descobre a proporcao quando a
    imagem chega, e ate la reserva zero: o texto abaixo salta quando cada foto
    carrega. 213 das 555 imagens do site estavam assim.
    """
    if rel_caminho in _DIM:
        return _DIM[rel_caminho]
    caminho = ROOT / rel_caminho
    larg = alt = 0
    try:
        b = caminho.read_bytes()
        if b[:8] == b"\x89PNG\r\n\x1a\n":
            larg = int.from_bytes(b[16:20], "big")
            alt = int.from_bytes(b[20:24], "big")
        elif b[:2] == b"\xff\xd8":
            i = 2
            while i < len(b) - 9:
                if b[i] != 0xFF:
                    i += 1
                    continue
                marca = b[i + 1]
                if marca in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                             0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    alt = int.from_bytes(b[i + 5:i + 7], "big")
                    larg = int.from_bytes(b[i + 7:i + 9], "big")
                    break
                i += 2 + int.from_bytes(b[i + 2:i + 4], "big")
    except OSError:
        pass
    _DIM[rel_caminho] = (larg, alt)
    return larg, alt


def figura(rel_caminho, alt_txt, depth=0, classe="", sizes="100vw", eager=False, extra=""):
    """<picture> com as variantes WebP e o JPEG como reserva.

    O <img> de dentro guarda o JPEG: navegador sem WebP continua vendo a foto,
    e nada depende de JavaScript.
    """
    p = rel(depth)
    base = rel_caminho.rsplit(".", 1)[0]
    larg, altura = dimensoes(rel_caminho)
    fontes = []
    for w in (400, 800, 1600):
        if (ROOT / f"{base}-{w}.webp").exists():
            fontes.append(f"{p}{base}-{w}.webp {w}w")
    cls = f' class="{e(classe)}"' if classe else ""
    dim = f' width="{larg}" height="{altura}"' if larg and altura else ""
    carga = ' fetchpriority="high"' if eager else ' loading="lazy"'
    img = (f'<img src="{p}{e(rel_caminho)}" alt="{e(alt_txt)}"{cls}{dim}'
           f'{carga} decoding="async"{extra}>')
    if not fontes:
        return img
    return (f'<picture><source type="image/webp" srcset="{", ".join(fontes)}" '
            f'sizes="{e(sizes)}">{img}</picture>')


def marca(p, nome, classe, eager=False):
    """A marca do cabecalho e do rodape, em WebP com o PNG como reserva.

    Estavam declaradas como 1619x511 e o arquivo tem 600x189. A proporcao bate,
    entao nao havia salto de layout, mas o numero estava errado. Aqui a medida
    sai do arquivo.
    """
    lw, lh = dimensoes(f"assets/{nome}.png")
    cls = f' class="{classe}"' if classe else ""
    carga = ' fetchpriority="high"' if eager else ' loading="lazy"'
    img = (f'<img{cls} src="{p}assets/{nome}.png" alt="Cadillac" '
           f'width="{lw}" height="{lh}"{carga} decoding="async">')
    if not (ROOT / f"assets/{nome}.webp").exists():
        return img
    return f'<picture><source type="image/webp" srcset="{p}assets/{nome}.webp">{img}</picture>'


def paragrafo_nota(texto):
    """Um paragrafo de nota, ou nada.

    Varias notas sao opcionais no modelo, e o gerador emitia o <p> de qualquer
    jeito: esvaziar uma nota deixava um paragrafo oco ocupando espaco na
    pagina. Eram 19 deles.
    """
    texto = (texto or "").strip()
    if not texto:
        return ""
    return '<p class="note">' + e(texto) + '</p>'


def stems_edicao(project, year):
    """Nomes de arquivo possiveis para uma edicao, do mais especifico ao menos.

    A edicao passou a ter id proprio ("2026-1"), e as fotos do acervo foram
    nomeadas pelo ano. O ano segue valendo como segunda tentativa, senao uma
    galeria inteira sumiria so por causa do novo id.
    """
    stems = []
    if year:
        stems.append(f'{project["slug"]}-{year}')
        ano = ano_de(year)
        if str(ano) != str(year):
            stems.append(f'{project["slug"]}-{ano}')
    stems.append(project["slug"])
    return stems


def photo_for(project, year=None):
    """Foto do acervo, se o arquivo já estiver em assets/fotos."""
    stems = stems_edicao(project, year) if year else [project["slug"]]
    for stem in stems:
        for ext in ("jpg", "jpeg", "png", "webp"):
            if (ROOT / "assets" / "fotos" / f"{stem}.{ext}").exists():
                return f"assets/fotos/{stem}.{ext}"
    return None


def og_for(project, year=None):
    for stem in (stems_edicao(project, year) if year else [project["slug"]]):
        if (ROOT / "assets" / "og" / f"{stem}.jpg").exists():
            return f"{BASE}/assets/og/{stem}.jpg"
    return None


def slot(name, ratio, what, extra="", depth=0, credito=""):
    """A imagem, quando o arquivo já está no acervo. O espaço reservado, quando não está."""
    caminho = f"assets/fotos/{name}"
    if (ROOT / "assets" / "fotos" / name).exists():
        credito_html = (f'<span class="source-credit">{e(credito)}</span>' if credito else "")
        return (f'<figure class="photo-shot {extra}">'
                + figura(caminho, what, depth, "",
                         "(min-width:900px) 50vw, 100vw")
                + f'{credito_html}</figure>')
    chip = f"<code>{e(caminho)}</code>" if MOSTRAR_CAMPOS else ""
    return (f'<div class="photo-slot {extra}" role="img" title="{e(caminho)}" '
            f'aria-label="Espaço reservado para imagem: {e(what)}">'
            f'<span class="slot-mark">{icon("photo_camera")}</span>'
            f'<strong>{e(what)}</strong>{chip}'
            f'<small>{e(ratio)} · imagem oficial com direito de uso</small></div>')


def media(project, classes="", eager=False, year=None, depth=0):
    local = photo_for(project, year)
    img = None
    edicao = f", edição {year}" if year else ""
    if local:
        # O crédito do arquivo vem antes do crédito do projeto. A capa saía como
        # "Divulgação" mesmo quando a foto era de fotógrafo nomeado — atribuição
        # errada, e a galeria já consultava essa tabela. Agora as duas consultam.
        arquivo = local.rsplit("/", 1)[-1]
        img = {"url": rel(depth) + local, "local": local,
               "alt": f"{project['name']}{edicao}",
               "credit": MODEL["photos"].get("creditos_arquivo", {}).get(arquivo)
                         or MODEL["photos"].get("creditos", {}).get(
                             project["slug"], "Acervo Cadillac")}
    elif not project.get("image"):
        stem = project["slug"] + (f"-{year}" if year else "")
        return slot(f"{stem}.jpg", "16:10 ou 3:2",
                    f"{project['name']}{edicao}",
                    "slot-banner" if "banner" in classes else "slot-card")
    else:
        img = project.get("image")
    theme = project.get("theme", "")
    inner = []
    if img:
        # banner ocupa a largura do container; cartao, metade dela em duas colunas
        medidas = ("(min-width:1100px) 1100px, 100vw" if "banner" in classes
                   else "(min-width:1100px) 540px, (min-width:640px) 50vw, 100vw")
        if img.get("local"):
            inner.append(figura(img["local"], img["alt"], depth, "media-img",
                                medidas, eager))
        else:
            loading = ' fetchpriority="high"' if eager else ' loading="lazy"'
            inner.append(
                f'<img class="media-img" src="{e(img["url"])}" alt="{e(img["alt"])}"'
                f'{loading} decoding="async">')
    # Sobre a foto vai a frase, nao o nome. O nome ja aparece logo abaixo, no
    # titulo do cartao e no h1 da pagina do evento: repeti-lo na capa gastava o
    # espaco nobre dizendo duas vezes a mesma coisa. Sem frase cadastrada, o
    # nome volta a ser o recurso.
    chamada = project.get("chamada") or project["name"].upper()
    inner.append(f'<span class="media-symbol">{e(chamada)}</span>')
    role = "" if img else ' role="img" aria-label="Capa editorial de ' + e(project["name"]) + '"'
    # O selo de crédito saiu da capa a pedido. O dado continua no modelo e aqui no
    # title, para quem precisar da origem sem que ela dispute com a chamada.
    titulo = f' title="{e(img["credit"])}"' if img and img.get("credit") else ""
    return (f'<div class="media-surface {theme} {classes}"{role}{titulo}>'
            + "".join(inner) + "</div>")


def faq_block(project, number):
    if not project.get("faq"):
        return "", None
    rows = "".join(
        f'<details><summary>{e(q)} {icon("expand_more")}</summary><p>{e(a)}</p></details>'
        for q, a in project["faq"]
    )
    section = f"""<section class="container faq-section"><hr class="rule">
<h2 class="section-title">CURIOSIDADES<span class="orange">.</span></h2>
<div class="faq-list">{rows}</div></section>"""
    ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q,
         "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in project["faq"]]}
    return section, ld


def card(project, depth, eager=False):
    p = rel(depth)
    cat = CATS[project["category"]]
    years = " ".join(str(y) for y in project["years"])
    search_blob = " ".join([project["name"], project["kind"], project["location"],
                            project["desc"], cat["label"], years]).lower()
    meta = (f'<span class="meta-area" title="{e(cat["label"])}">{icon(cat["icon"])}'
            f'<span class="sr-only">{e(cat["label"])}</span></span>'
            f'<span>{icon("place")} {e(project["location"])}</span>'
            f'<span>{icon("calendar_month")} {e(project["period"])}</span>')
    img = media(project, eager=eager, depth=depth)
    return f"""<a class="work-card" data-project data-categoria="{project['category']}" data-anos="{years}" data-busca="{e(search_blob)}" href="{p}projetos/{project['slug']}/">
{img}
<div class="card-info"><div><h3>{e(project['name'])}</h3><div class="card-meta">{meta}</div></div>
<span class="card-arrow">{icon('arrow_outward')}</span></div></a>"""


# --------------------------------------------------------------------------
# métricas
# --------------------------------------------------------------------------
def project_facts(project):
    n = sum(len(v) for v in project.get("facts", {}).values())
    return n + len(project.get("records", []))


def project_sources(project):
    urls = {u for _, u in project.get("sources", [])}
    for items in project.get("yearsources", {}).values():
        urls.update(u for _, u in items)
    return urls


def metrics():
    years = sorted({ano_de(y) for pr in PROJECTS for y in pr["years"]}, reverse=True)
    all_sources = set()
    for pr in PROJECTS:
        all_sources |= project_sources(pr)
    per_year = {}
    for pr in PROJECTS:
        for y in pr["years"]:
            a = ano_de(y)
            per_year[a] = per_year.get(a, 0) + 1
    per_year = dict(sorted(per_year.items(), reverse=True))
    return {
        "projects": len(PROJECTS),
        "editions": sum(len(pr["years"]) for pr in PROJECTS),
        "years": years,
        "span": f"{years[-1]}–{str(years[0])[2:]}" if years else "—",
        "sources": len(all_sources),
        "facts": sum(project_facts(pr) for pr in PROJECTS),
        "per_year": per_year,
        "categories": sorted({pr["category"] for pr in PROJECTS}),
    }


M = metrics()


# --------------------------------------------------------------------------
# gráficos (SVG inline, série única, sem dependências)
# --------------------------------------------------------------------------
def bars_vertical(data, unit, w=620, h=250):
    """data: lista de (rótulo, valor). Série única, rótulos diretos."""
    pad_l, pad_b, pad_t = 8, 30, 26
    plot_h = h - pad_b - pad_t
    n = len(data)
    slot = (w - pad_l * 2) / n
    bw = min(slot * 0.52, 74)
    top = max(v for _, v in data) or 1
    out = [f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="Gráfico de barras: {e(unit)}">']
    out.append(f'<line class="axis" x1="0" y1="{pad_t + plot_h}" x2="{w}" y2="{pad_t + plot_h}"></line>')
    for i, (label, value) in enumerate(data):
        bh = max(plot_h * value / top, 4)
        x = pad_l + slot * i + (slot - bw) / 2
        y = pad_t + plot_h - bh
        base = pad_t + plot_h
        r = min(4, bw / 2, bh)
        path = (f"M{x:.1f},{base} V{y + r:.1f} Q{x:.1f},{y:.1f} {x + r:.1f},{y:.1f} "
                f"H{x + bw - r:.1f} Q{x + bw:.1f},{y:.1f} {x + bw:.1f},{y + r:.1f} "
                f"V{base} Z")
        out.append(
            f'<g class="bar-row" tabindex="0" role="listitem" aria-label="{e(label)}: {plural(value, unit[0], unit[1])}">'
            f'<title>{e(label)}: {plural(value, unit[0], unit[1])}</title>'
            f'<path class="bar" d="{path}"></path>'
            f'<text class="bar-label" x="{x + bw / 2:.1f}" y="{y - 9:.1f}" text-anchor="middle">{value}</text>'
            f'<text class="tick" x="{x + bw / 2:.1f}" y="{base + 19:.1f}" text-anchor="middle">{e(label)}</text></g>'
        )
    out.append("</svg>")
    return f'<div class="chart">{"".join(out)}</div>'


def bars_horizontal(data, unit, w=620, row=40):
    label_w, pad_r = 200, 44
    h = row * len(data)
    top = max(v for _, v in data) or 1
    bar_max = w - label_w - pad_r
    out = [f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="Gráfico de barras: {e(unit)}">']
    for i, (label, value) in enumerate(data):
        bw = max(bar_max * value / top, 3)
        y = row * i + 10
        bh = row - 22
        r = min(4, bh / 2, bw)
        x = label_w
        path = (f"M{x},{y} H{x + bw - r:.1f} Q{x + bw:.1f},{y} {x + bw:.1f},{y + r:.1f} "
                f"V{y + bh - r:.1f} Q{x + bw:.1f},{y + bh} {x + bw - r:.1f},{y + bh} H{x} Z")
        out.append(
            f'<g class="bar-row" tabindex="0" role="listitem" aria-label="{e(label)}: {plural(value, unit[0], unit[1])}">'
            f'<title>{e(label)}: {plural(value, unit[0], unit[1])}</title>'
            f'<text class="bar-name" x="0" y="{y + bh / 2 + 4:.1f}">{e(label[:28])}</text>'
            f'<path class="bar" d="{path}"></path>'
            f'<text class="bar-label" x="{x + bw + 10:.1f}" y="{y + bh / 2 + 4:.1f}">{value}</text></g>'
        )
    out.append("</svg>")
    return f'<div class="chart">{"".join(out)}</div>'


def coverage_matrix(depth):
    p = rel(depth)
    years = M["years"]
    head_cells = "".join(f'<th scope="col">{y}</th>' for y in years)
    rows = []
    for pr in PROJECTS:
        cells = []
        for y in years:
            # Um ano pode ter mais de uma edição: a célula leva à primeira delas.
            ids = [x for x in pr["years"] if ano_de(x) == y]
            if ids:
                cells.append(f'<td><a class="cell" href="{p}projetos/{pr["slug"]}/{ids[0]}/" '
                             f'aria-label="{e(pr["name"])} {y}, edição documentada">{y}</a></td>')
            else:
                cells.append('<td><span class="cell" aria-label="sem registro catalogado">—</span></td>')
        rows.append(f'<tr><th scope="row">{e(pr["name"])}</th>{"".join(cells)}</tr>')
    return f"""<div class="table-wrap"><table class="matrix">
<caption>Cada célula preenchida é uma edição com página própria e fontes. O traço indica ausência de registro catalogado nesta versão, não ausência de evento.</caption>
<thead><tr><th scope="col">Evento</th>{head_cells}</tr></thead>
<tbody>{"".join(rows)}</tbody></table></div>"""


def declared_table(depth):
    p = rel(depth)
    rows = []
    for d in MODEL["declared_metrics"]:
        label, url = d["source"]
        rows.append(f"""<tr><th scope="row"><a href="{p}{d['href']}">{e(d['event'])}</a></th>
<td><span class="val">{e(d['value'])}</span><small>{e(d['what'])}</small></td>
<td>{e(d['nature'])}</td>
<td><a href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(label)}</a></td></tr>""")
    return f"""<div class="table-wrap"><table class="amounts declared">
<caption>Números divulgados por organizadores, entidades, poder público ou imprensa. A Cadillac não os audita nem os apresenta como resultado próprio. Nunca some streams, público presencial e audiência de transmissão: são grandezas diferentes.</caption>
<thead><tr><th scope="col">Evento</th><th scope="col">Número</th><th scope="col">Natureza e atribuição</th><th scope="col">Quem divulgou</th></tr></thead>
<tbody>{"".join(rows)}</tbody></table></div>"""


def amounts_table():
    rows = []
    for pr in PROJECTS:
        for a in pr.get("amounts", []):
            label, url = a["source"]
            rows.append(f"""<tr><th scope="row">{e(pr['name'])}</th>
<td>{e(a['label'])}<small>{e(a['note'])}</small></td>
<td><span class="val">{brl(a['value'])}</span></td>
<td><a href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(label)}</a></td></tr>""")
    if not rows:
        return ""
    return f"""<div class="table-wrap"><table class="amounts">
<caption>Valores que aparecem em documentos públicos. São valores de projeto aprovado ou de objeto contratado — não representam receita, captação efetiva nem resultado da Cadillac.</caption>
<thead><tr><th scope="col">Evento</th><th scope="col">Registro</th><th scope="col">Valor</th><th scope="col">Fonte</th></tr></thead>
<tbody>{"".join(rows)}</tbody></table></div>"""


# --------------------------------------------------------------------------
# páginas
# --------------------------------------------------------------------------
def write(path, content):
    f = ROOT / path
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(content, encoding="utf-8")
    return path


def video_ld():
    """VideoObject só entra completo. Sem data de publicação, o Google trata como erro."""
    r = MODEL["video"]["reel"]
    if not (r.get("url") and r.get("publicado_em")):
        return None
    vid = youtube_id(r["url"]) if ("youtu" in r["url"]) else None
    ld = {"@context": "https://schema.org", "@type": "VideoObject",
          "name": r.get("titulo") or "Reel institucional Cadillac",
          "description": r.get("descricao") or SITE["tagline"],
          "uploadDate": r["publicado_em"],
          "contentUrl": r["url"]}
    if vid:
        ld["thumbnailUrl"] = [f"https://i.ytimg.com/vi/{vid}/maxresdefault.jpg"]
        ld["embedUrl"] = f"https://www.youtube-nocookie.com/embed/{vid}"
    if r.get("duracao_iso"):
        ld["duration"] = r["duracao_iso"]
    return ld


def page_home():
    org = {"@context": "https://schema.org", "@type": "Organization",
           "name": SITE["name"], "url": BASE, "email": SITE["email"],
           "description": SITE["tagline"],
           "address": {"@type": "PostalAddress", "addressCountry": "BR"}}
    if MODEL["contato"].get("telefone"):
        org["telephone"] = MODEL["contato"]["telefone"]
    website = {"@context": "https://schema.org", "@type": "WebSite", "name": SITE["name"],
               "url": BASE + "/", "inLanguage": "pt-BR"}
    cards = "".join(card(pr, 0, eager=(i == 0)) for i, pr in enumerate(PROJECTS))
    services = "".join(
        f'<a class="service-row" href="./atuacao/#{a["slug"]}">'
        f'<h3>{e(a["title"])}</h3>'
        f'<p>{e(a["lede"])}</p><span class="card-arrow">{icon("arrow_outward")}</span></a>'
        for a in MODEL["atuacao"]["areas"])
    logos = []
    for c in MODEL["clientes"]["itens"]:
        arq = ROOT / "assets" / "marcas" / c["logo"]
        alvo = f'./projetos/{c["projeto"]}/'
        if arq.exists():
            lw, lh = dimensoes(f'assets/marcas/{c["logo"]}')
            marca = (f'<img src="./assets/marcas/{e(c["logo"])}" alt="{e(c["nome"])}" '
                     f'width="{lw}" height="{lh}" loading="lazy" decoding="async">')
        else:
            marca = (f'<span class="logo-slot"><strong>{e(c["nome"])}</strong>'
                     f'<code>assets/marcas/{e(c["logo"])}</code></span>')
        # Um mural de logotipos se equilibra por peso visual, nao por altura.
        # Limitados so pela altura, uma marca deitada como a da Prefeitura ocupa
        # cinco vezes a area de uma quadrada como a do BB e domina a faixa. Quem
        # precisa descer traz "altura" no modelo, em pixels.
        alt = c.get("altura")
        estilo = f' style="--logo-h:{int(alt)}px"' if alt else ""
        logos.append(f'<a class="logo-item" href="{alvo}" title="{e(c["papel"])}"{estilo}>{marca}'
                     f'<span class="logo-papel">{e(c["papel"])}</span></a>')
    logos = "".join(logos)
    press_html = "".join(
        f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">'
        f'<h3>{e(title)}</h3><small>{e(outlet)} · cobertura externa</small></a>'
        for i, (outlet, title, url) in enumerate(MODEL["featured_press"], start=1))
    # Endereco e telefone no pe da home: quem quer falar nao deveria ter de
    # abrir outra pagina para achar como.
    ct = MODEL["contato"]
    linhas = []
    for en in ct.get("enderecos") or []:
        trecho = ", ".join(x for x in [en.get("logradouro"), en.get("bairro"),
                                       en["cidade"], en.get("cep")] if x)
        linhas.append(f'<span>{icon("place")} {e(en["papel"])}: {e(trecho)}</span>')
    if ct.get("telefone"):
        fone = ct["telefone"]
        linhas.append(f'<a href="tel:{so_digitos(fone)}">{icon("call")} {e(fone)}</a>')
    if ct.get("whatsapp"):
        zap = ct["whatsapp"]
        linhas.append(f'<a href="https://wa.me/{so_digitos(zap).lstrip("+")}" '
                      f'target="_blank" rel="noopener noreferrer">'
                      f'{icon("chat")} WhatsApp {e(zap)}</a>')
    contato_linhas = "".join(linhas)
    body = f"""<main id="conteudo"><span id="top"></span>
<section class="hero-cine" data-video="{youtube_id(MODEL['video']['reel']['url'])}">
<div class="hero-fundo" aria-hidden="true"></div>
<div class="hero-veu" aria-hidden="true"></div>
<div class="hero-cine-inner container">
<div class="hero-big"><h1>{SITE['headline'][0]}<br><em>{SITE['headline'][1]}</em><br><span class="h-fantasma">{SITE['headline'][2]}</span></h1>
<a class="circle-link" href="./projetos/" aria-label="Ver o acervo de eventos">{icon('arrow_outward')}</a></div>
<div class="hero-bottom"><p>{e(SITE['support'])}</p>
<a class="hero-explore" href="#projetos">EXPLORE OS EVENTOS {icon('expand_more')}</a></div></div></section>
<section class="container showcase" id="projetos">
<hr class="rule">
<div class="showcase-cabeca">
<h2 class="section-title">EVENTOS<span class="orange">.</span></h2>
</div>
<div class="works-grid">{cards}</div>
<div class="section-end"><a class="pill-link" href="./projetos/">Todos os eventos {icon('arrow_outward')}</a></div></section>
<section class="clientes"><div class="container">
<h2 class="section-title">NOSSOS<br><em>PARCEIROS.</em></h2>
<div class="logo-wall">{logos}</div>
{f'{paragrafo_nota(MODEL["clientes"]["nota"])}' if MODEL['clientes'].get('nota') else ''}</div></section>
<section class="statement" id="sobre"><div class="container statement-grid">
<div><h2>O IMPOSSÍVEL NÃO<br>ENTRA <em>NA PLANILHA.</em></h2>
{''.join(f'<p>{e(t)}</p>' for t in SITE['institutional'])}
</div></div></section>
<section class="container services" id="atuacao">
<h2 class="section-title">DA EXECUÇÃO<br><em>AOS DADOS.</em></h2>
<div class="service-list">{services}</div>
<div class="section-end"><a class="pill-link" href="./atuacao/">Conheça nosso trabalho {icon('arrow_outward')}</a></div></section>
<section class="dark-strip"><div class="container"><h2>NÃO É SÓ O QUE<br>ACONTECE. <em>É O QUE FICA.</em></h2></div></section>
<section class="container editorial">
<div class="editorial-header"><h2 class="section-title">NA<br><em>MÍDIA.</em></h2>
<a class="pill-link" href="./na-midia/">Ver todas as fontes {icon('arrow_outward')}</a></div>
<div class="article-grid">{press_html}</div></section>
<section class="contact" id="contato"><div class="container"><h2>TEM UMA IDEIA GRANDE?<br><em>ENTÃO CHAMA A GENTE.</em></h2>
<p>Eventos, parcerias, imprensa ou produção.</p>
<a class="contact-link" href="mailto:{SITE['email']}">{icon('mail')} FALE COM A CADILLAC</a>
<div class="contact-ways"><a class="pill-link" href="./projetos/">Ver eventos {icon('arrow_outward')}</a>
<a class="pill-link" href="./dados/">Ver dados {icon('insights')}</a></div>
<div class="contact-dados">{contato_linhas}</div></div></section>
</main>"""
    return write("index.html",
                 head(0, "Experiências, esportes, cultura e produções | Cadillac Produções",
                      "Conheça o universo Cadillac: projetos esportivos, festivais, edições históricas, "
                      "notícias e dados documentados com fontes públicas.",
                      "", [x for x in (org, website, video_ld()) if x])
                 + header(0, "home", body_class="home-cine") + body + footer(0))


def page_projects():
    trail_html, trail_ld = crumbs(1, [("Eventos", None)])
    cards = "".join(card(pr, 1, eager=(i == 0)) for i, pr in enumerate(PROJECTS))
    ld = {"@context": "https://schema.org", "@type": "CollectionPage",
          "name": "Eventos e cases", "url": f"{BASE}/projetos/",
          "mainEntity": {"@type": "ItemList", "numberOfItems": len(PROJECTS),
                         "itemListElement": [
                             {"@type": "ListItem", "position": i,
                              "name": pr["name"],
                              "url": f"{BASE}/projetos/{pr['slug']}/"}
                             for i, pr in enumerate(PROJECTS, start=1)]}}
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>EVENTOS<span class="orange">.</span></h1>
<p class="lede">Eventos, produções e histórias reunidos em um acervo vivo, do mais recente para o mais antigo.</p></section>
<section class="container video-abertura">{video_block("reel", MODEL["video"]["reel"]["titulo"], 1)}</section>
<section class="container index-grid">
<h2 class="sr-only">Acervo de eventos</h2>
<div class="works-grid">{cards}</div>
</section></main>"""
    return write("projetos/index.html",
                 head(1, "Eventos e cases | Cadillac Produções",
                      "Acervo de eventos da Cadillac: Itacoatiara Pro, Vert Battle, Tamo Junto BB, "
                      "Dominguinho, Arte em Circuito, MAC Bahia e Festival de Tribos de Juruti.",
                      "projetos/", [ld, trail_ld]) + header(1, "projetos") + body + footer(1))


def page_project(pr):
    depth, p = 2, rel(2)
    slug = pr["slug"]
    cat = CATS[pr["category"]]
    trail_html, trail_ld = crumbs(depth, [("Eventos", p + "projetos/"), (pr["name"], None)])
    n_facts, n_sources = project_facts(pr), len(project_sources(pr))
    metric = ""

    sections, n = [], 1

    sections.append(f"""<section class="container detail-intro">
<div><h2>UM EVENTO.<br>MUITAS HISTÓRIAS.</h2></div>
<div><p>{e(pr['intro'])}</p>
<div class="taglist"><span>{icon(cat['icon'])} {e(cat['label'])}</span>
<span>{icon('festival')} {e(pr['kind'])}</span>
<span>{icon('place')} {e(pr['location'])}</span>
<span>{icon('calendar_month')} {e(pr['period'])}</span></div></div></section>""")
    sections.append(galeria_projeto(pr, depth))
    sections.append(resumo_block(pr))
    n += 1

    cronograma = []
    if pr["years"]:
        rows = []
        for y in pr["years"]:
            ed = pr.get("editions", {}).get(str(y), {})
            txt, dias = periodo(ed.get("datas"))
            note = " · ".join(x for x in [txt or ed.get("period"), ed.get("place"),
                                          plural(dias, "dia", "dias") if dias else None] if x)
            rot = rotulo_ed(pr, y)
            rows.append(f"""<a class="year-row" href="{p}projetos/{slug}/{y}/">
<span class="yr">{ano_de(y)}</span><span><strong>{e(pr['name'])} {e(rot)}</strong>
<span class="yr-note">{e(note) if note else 'Edição catalogada'}</span></span>
<span class="yr-go">Explorar edição {icon('arrow_outward')}</span></a>""")
        cronograma.append(f"""<section class="container timeline">
<hr class="rule">
<h2 class="section-title">EDIÇÕES<span class="orange">.</span></h2>{''.join(rows)}</section>""")
        n += 1
    else:
        facts = "".join(
            f'<div class="fact"><span class="n">{i:02d}</span><p>{e(t)}</p></div>'
            for i, t in enumerate(pr.get("records", []), start=1))
        cronograma.append(f"""<section class="container facts-section">
<hr class="rule">
<h2 class="section-title">DOSSIÊ<br><em>DO EVENTO.</em></h2>
<div class="facts">{facts}</div>
<p class="note">{e(pr.get("nota_registro") or "")} Quando houver documentação por ano, cada edição ganha página própria com fontes.</p></section>""")
        n += 1

    faq_html, faq_ld = faq_block(pr, f"{n:02d}")
    if faq_html:
        n += 1

    if MODEL["video"]["por_projeto"].get(pr["slug"]):
        sections.append(f"""<section class="container reel-section"><hr class="rule">
<h2 class="section-title">TEASER<br><em>DO EVENTO.</em></h2>
{video_block(pr["slug"], MODEL["video"]["por_projeto"][pr["slug"]].get("titulo") or pr["name"], depth)}</section>""")
    sections.append(contexto_block(pr))
    sections.append(frentes_block(pr))
    sections.append(antecedente_block(pr))
    sections.append(papel_block(pr))
    sections.append(jornada_block(pr))
    sections.append(card_block(pr))
    sections.append(telas_block(pr))
    sections.extend(cronograma)
    sections.append(historico_block(pr))
    sections.append(op_project(pr))
    sections.append(mercado_block(pr))
    sections.append(parceiros_block(pr, depth))
    sections.append(cast_block(pr))
    sections.append(plano_block(pr))
    sections.append(faq_html)
    sections.append(creditos_projeto(pr, depth))
    sections.append(participacoes_block(pr, depth))
    sections.append(bloco_fontes(pr["sources"], depth, "NA MÍDIA."))
    n += 1

    # Fecho: a pagina termina em uma porta, nao no fim do texto. So aparece
    # para as propriedades que estao abertas a patrocinio no Relacionamento.
    patrocinaveis = {x[0] for b_ in MODEL["relacionamento"]["blocos"]
                     for x in (b_.get("propriedades") or [])}
    if slug in patrocinaveis:
        sections.append(f"""<section class="container fecho"><hr class="rule">
<div class="fecho-caixa"><h2>QUER SUA MARCA<br><em>NESSE EVENTO?</em></h2>
<p>Cotas, naming rights e ativação em arena são tratados caso a caso, por edição.
Conte o que a marca precisa alcançar e respondemos com o que está disponível.</p>
<div class="fecho-pe"><a class="pill-link pill-forte" href="{p}relacionamento/#patrocinios">
Quero patrocinar {icon('campaign')}</a>
<a class="pill-link" href="{p}contato/">Falar com a produção {icon('mail')}</a></div></div></section>""")

    related = [x for x in PROJECTS if x["slug"] != slug and x["category"] == pr["category"]]
    related += [x for x in PROJECTS if x["slug"] != slug and x not in related]
    rel_cards = "".join(card(x, depth) for x in related[:3])
    sections.append(f"""<section class="container related">
<hr class="rule">
<h2 class="section-title">VEJA MAIS<span class="orange">.</span></h2>
<div class="works-grid grid-4">{rel_cards}</div>
<div class="section-end"><a class="pill-link" href="{p}projetos/">Todos os eventos {icon('arrow_outward')}</a></div></section>""")

    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": pr["name"],
          "url": f"{BASE}/projetos/{slug}/", "description": pr["desc"], "inLanguage": "pt-BR",
          "publisher": {"@type": "Organization", "name": SITE["name"]}}
    blocks = [ld, trail_ld] + ([faq_ld] if faq_ld else [])
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="project-hero container">
<a class="back" href="{p}projetos/">{icon('arrow_back')} Todos os eventos</a>
<div class="project-title"><h1>{e(pr['name'])}<span class="orange">.</span></h1><p>{e(pr['desc'])}</p></div>
{media(pr, 'banner', eager=True, depth=depth)}{metric}</section>
{''.join(sections)}</main>"""
    return write(f"projetos/{slug}/index.html",
                 head(depth, f"{pr['name']} | Cadillac Produções",
                      f"{pr['name']}: {pr['desc']}",
                      f"projetos/{slug}/", blocks, og_image=og_for(pr)) + header(depth, "projetos") + body + footer(depth))


def shows_block(pr, year):
    ed = pr.get("editions", {}).get(str(year), {})
    shows = ed.get("shows")
    if not shows:
        return ""
    total, nota_total, fonte_total = ed.get("total_informado", [None, "", None])
    linhas = []
    for sh in shows + []:
        quando = (e(periodo({"inicio": sh["data"], "fim": sh["data"], "precisao": "dia"})[0])
                  if sh.get("data") else '<span class="val pend">data a levantar</span>')
        rotulo, _, ic = MODEL["datas"]["status"][sh["status"]]
        linhas.append(f"""<tr><th scope="row">{e(sh['cidade'])}</th><td>{quando}</td>
<td>{e(sh.get('local') or '—')}</td>
<td><span class="selo selo-{sh['status'].replace(' ', '-')}">{icon(ic)} {e(rotulo)}</span></td>
<td>{fonte_link(sh.get('fonte'))}</td></tr>""")
    rel = []
    for r in ed.get("relacionados", []):
        if r.get("data"):
            txt, _ = periodo({"inicio": r["data"], "fim": r["data_fim"] or r["data"], "precisao": "dia"})
            quando = e(txt)
        else:
            quando = '<span class="val pend">data a levantar</span>'
        rotulo, _, ic = MODEL["datas"]["status"][r["status"]]
        rel.append(f"""<tr><th scope="row">{e(r['o_que'])}<small>{e(r['nota'])}</small></th>
<td>{quando}</td><td>{e(r['local'])}</td>
<td><span class="selo selo-{r['status'].replace(' ', '-')}">{icon(ic)} {e(rotulo)}</span></td>
<td>{fonte_link(r.get('fonte'))}</td></tr>""")
    cabecalho = ('<thead><tr><th scope="col">Cidade</th><th scope="col">Quando</th>'
                 '<th scope="col">Local</th><th scope="col">Situação</th>'
                 '<th scope="col">Fonte</th></tr></thead>')
    com_data = sum(1 for x in shows if x.get("data"))
    confirmados = sum(1 for x in shows if x["status"] == "confirmada")
    painel = ""
    if total:
        falta = max(total - len(shows), 0)
        painel = f"""<div class="op-grid" style="margin-bottom:clamp(22px,3vw,32px)">
<div class="op-tile">{icon('music_note')}<strong>{total}</strong><span>Shows informados</span><small>{e(nota_total)}</small></div>
<div class="op-tile">{icon('calendar_month')}<strong>{com_data:02d}</strong><span>Datas nesta página</span><small>{confirmados} com data confirmada, as demais anunciadas</small></div>
<div class="op-tile">{icon('place')}<strong>{len(shows):02d}</strong><span>Apresentações catalogadas</span><small>Com cidade, local e fonte</small></div>
<div class="op-tile pend">{icon('search')}<strong>{falta}</strong><span>Apresentações sem registro</span><small>Dependem do mapa de turnê da produção</small></div></div>"""
    return f"""<section class="container reach-section" id="agenda"><hr class="rule">
<h2 class="section-title">AGENDA<br><em>DA TURNÊ.</em></h2>
{painel}
<div class="table-wrap"><table class="amounts reach-table">{cabecalho}
<tbody>{''.join(linhas)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver local, situação e fonte.</p>
{f'<h3 class="cases-title">Apresentações relacionadas</h3><div class="table-wrap"><table class="amounts reach-table">{cabecalho}<tbody>{"".join(rel)}</tbody></table></div>' if rel else ''}
{paragrafo_nota(ed.get('note_shows', ''))}</section>"""


def page_edition(pr, year):
    depth, p = 3, rel(3)
    slug, ystr = pr["slug"], str(year)
    rot = rotulo_ed(pr, year)
    ano = ano_de(year)
    # prefixo da galeria: o id da edicao se houver arquivo, senao o ano
    prefixo = next((st for st in stems_edicao(pr, year)
                    if (ROOT / "assets" / "fotos" / f"{st}-01.jpg").exists()),
                   f"{slug}-{year}")
    credito = MODEL["photos"].get("creditos", {}).get(slug, "Acervo Cadillac")
    ed = pr.get("editions", {}).get(ystr, {})
    trail_html, trail_ld = crumbs(depth, [("Eventos", p + "projetos/"),
                                          (pr["name"], p + f"projetos/{slug}/"),
                                          (f"Edição {rot}", None)])
    facts = pr["facts"].get(ystr, [])
    facts_html = "".join(f'<div class="fact"><span class="n">{i:02d}</span><p>{e(t)}</p></div>'
                         for i, t in enumerate(facts, start=1))
    sources = pr["yearsources"].get(ystr, [])
    datas = ed.get("datas")
    txt_periodo, dias_evento = periodo(datas)
    meta_tags = [f'<span>{icon("calendar_month")} {e(txt_periodo or ed.get("period", ystr))}</span>']
    if dias_evento:
        meta_tags.append(f'<span>{icon("description")} {plural(dias_evento, "dia de evento", "dias de evento")}</span>')
    if ed.get("place"):
        meta_tags.append(f'<span>{icon("place")} {e(ed["place"])}</span>')
    if ed.get("note"):
        meta_tags.append(f'<span>{icon("verified")} {e(ed["note"])}</span>')
    if datas:
        meta_tags.append(selo_data(datas))

    years_sorted = sorted(pr["years"])  # cronológico, para anterior e próxima
    idx = years_sorted.index(year)
    nav_links = []
    if idx > 0:
        prev = years_sorted[idx - 1]
        nav_links.append(f'<a href="{p}projetos/{slug}/{prev}/">{icon("arrow_back")} Edição {e(rotulo_ed(pr, prev))}</a>')
    if idx < len(years_sorted) - 1:
        nxt = years_sorted[idx + 1]
        nav_links.append(f'<a href="{p}projetos/{slug}/{nxt}/">Edição {e(rotulo_ed(pr, nxt))} {icon("arrow_forward")}</a>')
    others = [y for y in pr["years"] if y != year]
    other_html = "".join(
        f'<a href="{p}projetos/{slug}/{y}/">{e(rotulo_ed(pr, y))} {icon("arrow_outward")}</a>'
        for y in others) or "<span>Primeira edição catalogada</span>"

    ld = {"@context": "https://schema.org", "@type": "WebPage",
          "name": f"{pr['name']} {rot}", "url": f"{BASE}/projetos/{slug}/{year}/",
          "inLanguage": "pt-BR",
          "about": {"@type": "Event", "name": f"{pr['name']} {rot}",
                    "location": {"@type": "Place", "name": ed.get("place", pr["location"])}}}
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="edition-hero container">
<a class="back" href="{p}projetos/{slug}/">{icon('arrow_back')} Histórico de {e(pr['name'])}</a>
<h1>{e(pr['name'])}<br><em>{e(rot)}.</em></h1>
<p class="lede">{e(pr['desc'])}</p>
<div class="taglist">{''.join(meta_tags)}</div>
{media(pr, 'banner', eager=True, year=year, depth=depth)}
</section>
<section class="container detail-intro">
<div><h2>O QUE MARCOU<br>ESTA EDIÇÃO.</h2></div>
<div><p>Esta página é um registro editorial em atualização contínua. Apresentamos somente informações sustentadas por referências identificáveis, com prioridade para documentos oficiais e fontes da organização.</p>
<p>{e(pr['intro'])}</p></div></section>
{etapas_block(pr, year)}
{shows_block(pr, year)}
<section class="container facts-section">
<hr class="rule">
<h2 class="section-title">FATOS<br><em>DOCUMENTADOS.</em></h2>
<div class="facts">{facts_html}</div></section>
{case_block(pr, year)}
{cast_block(pr, year, depth=depth)}
{creditos_projeto(pr, depth, year)}
{op_edition(pr, year)}
<section class="container gallery-section">
<hr class="rule">
<h2 class="section-title">POR DENTRO<br><em>DO ACONTECIMENTO.</em></h2>
<div class="gallery">
{slot(f'{prefixo}-01.jpg', '16:9', 'Foto principal da edição', 'slot-wide', depth, credito)}
{slot(f'{prefixo}-02.jpg', '4:5', 'Bastidores', '', depth, credito)}
{slot(f'{prefixo}-03.jpg', '4:5', 'Atletas e público', '', depth, credito)}</div>
</section>
<section class="container insights">
<hr class="rule">
<div class="insight-content"><h2>ALÉM DA ARENA.</h2>
<p>Eventos como este articulam pessoas, território, produção e marcas. A leitura da Cadillac apresenta contexto e oportunidades do setor sem inventar métricas de público, resultados ou atribuições contratuais.</p>
<a class="pill-link" href="{p}dados/">Explorar dados e métricas {icon('insights')}</a></div></section>
{bloco_fontes(sources, depth, "FONTES E DOCUMENTAÇÃO.")}
<section class="container sources">
<div class="year-links"><span>Navegar nas edições</span>{''.join(nav_links)}</div>
<div class="year-links"><span>Outros anos</span>{other_html}</div></section></main>"""
    return write(f"projetos/{slug}/{year}/index.html",
                 head(depth, f"{pr['name']} {rot} | Cadillac Produções",
                      f"{pr['name']} {rot}: datas, fatos documentados, elenco e fontes públicas da edição.",
                      f"projetos/{slug}/{year}/", [ld, trail_ld], og_image=og_for(pr, year))
                 + header(depth, "projetos") + body + footer(depth))


def page_press():
    depth, p = 1, rel(1)
    trail_html, trail_ld = crumbs(depth, [("Na Mídia", None)])
    groups, total, hosts = [], 0, set()
    for pr in PROJECTS:
        items = [(lb, u) for lb, u in pr["sources"] if u]
        for y in sorted(pr["yearsources"], reverse=True):
            for label, url in pr["yearsources"][y]:
                if url:
                    items.append((f"{label} · {y}", url))
        seen, uniq = set(), []
        for label, url in items:
            if url in seen:
                continue
            seen.add(url)
            uniq.append((label, url))
        total += len(uniq)
        hosts.update(host_of(u) for _, u in uniq)
        cat = CATS[pr["category"]]
        groups.append(f"""<article class="press-group"><hr class="rule">
<h2 class="group-title">{e(pr['name'])}</h2>
<p class="group-count">{icon(cat['icon'])} {plural(len(uniq), 'fonte catalogada', 'fontes catalogadas')}</p>
{source_list(uniq)}
<div class="year-links"><span>Contexto</span>
<a href="{p}projetos/{pr['slug']}/">Página do evento {icon('arrow_outward')}</a></div></article>""")
    recentes = []
    for pr in PROJECTS:
        for y in pr["yearsources"]:
            for label, url in pr["yearsources"][y]:
                if url:
                    recentes.append((y, pr["name"], label, url))
    recentes.sort(key=lambda r: (str(r[0]), r[2]), reverse=True)
    vistos, feed = set(), []
    for y, nome, label, url in recentes:
        if url in vistos:
            continue
        vistos.add(url)
        feed.append(f'''<li class="noticia"><a href="{e(url)}" target="_blank" rel="noopener noreferrer">
<span class="noticia-ano">{e(str(y))}</span>
<span class="noticia-titulo">{e(label)}</span>
<span class="noticia-meta">{e(nome)} · {e(host_of(url))}</span></a></li>''')
        if len(feed) == 12:
            break
    bloco_noticias = (f'''<section class="container noticias-wrap" id="noticias">
<h2 class="sec-title">Na mídia</h2>
<ol class="noticias">{''.join(feed)}</ol></section>''') if feed else ""

    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>NA MÍDIA<span class="orange">.</span></h1>
<p class="lede">Histórias que ganharam as ruas, as arenas e a imprensa. Cada item aponta para a publicação original, agrupado pelo projeto a que se refere.</p>
</section>
{bloco_noticias}
<section class="container sources" id="cobertura">
<h2 class="sec-title">Cobertura por projeto</h2>
{''.join(groups)}
</section></main>"""
    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "Na Mídia",
          "url": f"{BASE}/na-midia/", "inLanguage": "pt-BR"}
    return write("na-midia/index.html",
                 head(depth, "Na Mídia | Reportagens, cobertura e fontes | Cadillac Produções",
                      "Repercussão dos projetos Cadillac na imprensa: reportagens, documentos oficiais "
                      "e referências públicas organizadas por projeto.",
                      "na-midia/", [ld, trail_ld]) + header(depth, "na-midia") + body + footer(depth))


MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
         "agosto", "setembro", "outubro", "novembro", "dezembro"]


def dia_mes(iso, com_ano=False):
    a, m, d = (int(x) for x in iso.split("-"))
    return f"{d} de {MESES[m - 1]}" + (f" de {a}" if com_ano else "")


def periodo(datas):
    """Texto do período conforme a precisão do que está documentado."""
    if not datas:
        return None, None
    i, f, prec = datas["inicio"], datas["fim"], datas["precisao"]
    ano = i[:4]
    if prec == "ano":
        return f"Ano de {ano}", None
    if prec == "mes":
        im, fm = int(i[5:7]), int(f[5:7])
        txt = f"{MESES[im - 1]} a {MESES[fm - 1]} de {ano}" if im != fm else f"{MESES[im - 1]} de {ano}"
        return txt[0].upper() + txt[1:], None
    from datetime import date
    d1, d2 = date.fromisoformat(i), date.fromisoformat(f)
    dias = (d2 - d1).days + 1
    if d1 == d2:
        txt = dia_mes(i, com_ano=True)
    elif (d1.year, d1.month) == (d2.year, d2.month):
        liga = "e" if dias == 2 else "a"
        txt = f"{d1.day} {liga} {dia_mes(f, com_ano=True)}"
    else:
        txt = f"{dia_mes(i)} a {dia_mes(f, com_ano=True)}"
    return txt, dias


def selo_data(datas, ingressos=""):
    """Selo da data. O rótulo sai da data, não só do status registrado.

    O status diz de onde a data veio; quem decide o que o visitante lê é o
    calendário. Uma data que já passou é "Realizada", qualquer que fosse o
    status. Uma data futura com bilheteria aberta vira "Ingressos" e leva ao
    link oficial. Fora esses dois casos, vale o rótulo do status.

    Sem esse cruzamento, renomear "confirmada" para "Realizada" diria que um
    evento aconteceu antes de acontecer, e "Ingressos" apareceria em data já
    vencida ou sem bilheteria nenhuma para onde apontar.
    """
    if not datas:
        return ""
    rotulo, _, ic = MODEL["datas"]["status"][datas["status"]]
    exata = datas.get("precisao") != "ano"
    fim = datas.get("fim") or datas.get("inicio") or ""
    if exata and fim and fim < MODEL["updated"]:
        return f'<span class="selo selo-realizada">{icon("verified")} Realizada</span>'
    if exata and ingressos:
        return (f'<a class="selo selo-ingressos" href="{e(ingressos)}" '
                f'target="_blank" rel="noopener noreferrer">'
                f'{icon("confirmation_number")} Ingressos</a>')
    return f'<span class="selo selo-{datas["status"].replace(" ", "-")}">{icon(ic)} {e(rotulo)}</span>'


def etapas_block(pr, year):
    ed = pr.get("editions", {}).get(str(year), {})
    etapas = ed.get("etapas")
    if not etapas:
        return ""
    linhas = []
    for et in etapas:
        if et["inicio"]:
            txt, dias = periodo({"inicio": et["inicio"], "fim": et["fim"], "precisao": "dia"})
            quando = e(txt) + (f' · {plural(dias, "dia", "dias")}' if dias else "")
        else:
            quando = '<span class="val pend">data a confirmar</span>'
        rotulo, _, ic = MODEL["datas"]["status"][et["status"]]
        fonte = fonte_link(et.get("fonte"), "")
        linhas.append(f"""<tr><th scope="row">{e(et['nome'])}</th><td>{quando}</td>
<td><span class="selo selo-{et['status'].replace(' ', '-')}">{icon(ic)} {e(rotulo)}</span></td>
<td>{fonte or '—'}</td></tr>""")
    return f"""<section class="container reach-section"><hr class="rule">
<h2 class="section-title">CALENDÁRIO<br><em>DA TEMPORADA.</em></h2>
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Etapa</th><th scope="col">Quando</th><th scope="col">Situação da data</th><th scope="col">Fonte</th></tr></thead>
<tbody>{''.join(linhas)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver a situação e a fonte.</p></section>"""


def big(n):
    return f"{n:,}".replace(",", ".")


def audience_totals():
    totals = {k: {"sum": 0, "n": 0, "pend": 0} for k in MODEL["audiencia"]["families"]}
    for x in MODEL["audiencia"]["entries"]:
        t = totals[x["family"]]
        if x["value"] is None:
            t["pend"] += 1
        elif x["counts"]:
            t["sum"] += x["value"]
            t["n"] += 1
    return totals


def audience_blocks(depth):
    p = rel(depth)
    data = MODEL["audiencia"]
    by_slug = {pr["slug"]: pr for pr in PROJECTS}
    fams = data["families"]
    totals = audience_totals()

    panels = []
    for key, (label, desc, ic) in fams.items():
        t = totals[key]
        panels.append(f"""<div class="data-panel reach">{icon(ic)}
<div><strong style="--d:{len(big(t['sum']))}">{big(t['sum'])}</strong><span>{e(label)}</span></div>
<p class="reach-note">{plural(t['n'], 'registro somado', 'registros somados')} · {plural(t['pend'], 'linha a preencher', 'linhas a preencher')}</p></div>""")

    rows = []
    for x in sorted(data["entries"], key=lambda x: (x["project"], -(x["year"] or 0))):
        pr = by_slug[x["project"]]
        href = href_edicao(pr, x["year"], p)
        fam = fams[x["family"]][0]
        if x["value"] is None:
            value = '<span class="val pend">a preencher</span>'
            basis = '<span class="tag-wait">Número ainda não levantado</span>'
            src = "—"
        else:
            value = f'<span class="val">{big(x["value"])}</span>'
            if not x["counts"]:
                value += '<small class="out">fora dos totais</small>'
            basis = e(x["basis"])
            src = fonte_link(x.get("source"))
        rows.append(f"""<tr><th scope="row"><a href="{href}">{e(pr['name'])}{' ' + str(x['year']) if x['year'] else ''}</a>
<small>{e(x['label'])}</small></th><td>{e(fam)}</td><td>{value}</td><td>{basis}</td><td>{src}</td></tr>""")

    filled = [x for x in data["entries"] if x["value"] is not None and x["counts"]
              and x["family"] == "presencial"]
    chart = (bars_horizontal(
        [(f'{by_slug[x["project"]]["name"][:22]} {x["year"] or ""}'.strip(), x["value"]) for x in filled],
        ("pessoa", "pessoas"), w=620) if filled else "")
    method = "".join(f'<li>{icon("arrow_forward")} {e(t)}</li>' for t in data["method"])
    pend = sum(t["pend"] for t in totals.values())
    return f"""<section class="container reach-section" id="alcance"><hr class="rule">
<h2 class="section-title">ALCANCE<span class="orange">.</span></h2>
<p class="body-copy">{e(data['lede'])}</p>
<div class="data-stats reach-grid">{''.join(panels)}</div>
<div class="charts"><div class="chart-card span-2"><h3>Linha a linha, com o responsável pelo número</h3>
<p class="chart-sub">Cada registro mostra quem divulgou e o que o número mede.</p>
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Evento</th><th scope="col">Grandeza</th><th scope="col">Número</th><th scope="col">Base</th><th scope="col">Quem divulgou</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver a base e a fonte.</p></div>
</div>
</section>"""


def op_tiles(values, scope_key, order):
    """Grade da ficha operacional. Campo sem dado aparece como 'a preencher'."""
    campos = MODEL["operacao"]["campos"]
    tiles = []
    for key in order:
        label, help_text, ic = campos[key]
        raw = values.get(key)
        value, basis = (raw if isinstance(raw, list) else (raw, "")) if raw else (None, "")
        if value in (None, ""):
            campo = f"{scope_key} · {key}"
            chip = f"<code>{e(campo)}</code>" if MOSTRAR_CAMPOS else ""
            tiles.append(f"""<div class="op-tile pend" title="{e(campo)}">{icon(ic)}
<strong>a preencher</strong><span>{e(label)}</span>
<small>{e(help_text)}</small>{chip}</div>""")
        else:
            shown = big(value) if isinstance(value, int) else e(value)
            tiles.append(f"""<div class="op-tile">{icon(ic)}
<strong>{shown}</strong><span>{e(label)}</span>
<small>{e(basis or help_text)}</small></div>""")
    return f'<div class="op-grid">{"".join(tiles)}</div>'


GALERIA_ALVO = 8


def galeria_projeto(pr, depth):
    """Galeria do projeto: oito posições, em grade. Clicar amplia a foto.

    O alvo é oito imagens por projeto. As que ainda não chegaram aparecem como
    reserva com o nome exato do arquivo esperado, em vez de a grade encolher e
    esconder o que falta.
    """
    pasta = ROOT / "assets" / "fotos"
    capa = f'{pr["slug"]}.jpg'
    nomes = sorted(x.name for x in pasta.glob(f'{pr["slug"]}*.jpg') if x.name != capa)[:GALERIA_ALVO]
    padrao = MODEL["photos"].get("creditos", {}).get(pr["slug"], "Acervo Cadillac")
    por_arquivo = MODEL["photos"].get("creditos_arquivo", {})

    itens = []
    for i, n in enumerate(nomes, start=1):
        credito = por_arquivo.get(n, padrao)
        # A lupa abria o JPEG cheio, 250 a 450 KB por foto. O WebP de 1600px
        # mostra o mesmo na tela por uma fracao disso; o JPEG fica de reserva
        # para quem nao le WebP, trocado pelo proprio onerror da imagem.
        grande = f'assets/fotos/{n.rsplit(".", 1)[0]}-1600.webp'
        if not (ROOT / grande).exists():
            grande = f'assets/fotos/{n}'
        itens.append(
            f'<button type="button" class="gal-item" '
            f'data-full="{rel(depth)}{e(grande)}" '
            f'data-full-reserva="{rel(depth)}assets/fotos/{e(n)}" '
            f'data-credito="{e(credito)}" data-legenda="{e(pr["name"])}" '
            f'aria-label="Ampliar foto {i} de {e(pr["name"])}">'
            + figura(f'assets/fotos/{n}', pr["name"], depth, "",
                     "(min-width:900px) 25vw, (min-width:560px) 33vw, 50vw")
            + f'<span class="gal-credito">{icon("photo_camera")} '
              f'{e(credito)}</span></button>')

    faltam = GALERIA_ALVO - len(nomes)
    for i in range(len(nomes) + 1, GALERIA_ALVO + 1):
        arquivo = f'{pr["slug"]}-{i:02d}.jpg'
        itens.append(
            f'<div class="gal-item gal-reserva">{icon("photo_camera")}'
            f'<code>assets/fotos/{e(arquivo)}</code></div>')

    # Sem rodape. Ele contava quantas fotos ha e quantas faltam - a contagem o
    # visitante faz com os olhos, e a pendencia e assunto da producao. O
    # credito continua onde importa: sobre cada foto e na legenda da lupa.
    rodape = ""

    return f"""<section class="container galeria-section" aria-label="Fotos de {e(pr['name'])}">
<div class="gal-grid">{''.join(itens)}</div>
{rodape}</section>"""


def resumo_block(pr):
    """Resumo executivo: o que um patrocinador lê antes de decidir se continua lendo."""
    d = pr.get("dossie") or {}
    if not d.get("resumo"):
        return ""
    chips = "".join(f'<div class="resumo-chip"><strong>{e(v)}</strong><span>{e(r)}</span></div>'
                    for v, r in (d.get("destaques") or []))
    return f"""<section class="container resumo-section"><hr class="rule">
<div class="resumo-grid"><div><h2 class="section-title">RESUMO<br><em>EXECUTIVO.</em></h2></div>
<div><p class="resumo-texto">{e(d['resumo'])}</p>
{f'<div class="resumo-chips">{chips}</div>' if chips else ''}</div></div></section>"""


def contexto_block(pr):
    """Contexto e proposta de valor: por que o projeto existe e o que ele entrega."""
    d = pr.get("dossie") or {}
    if not (d.get("contexto") or d.get("valor")):
        return ""
    blocos = []
    for chave, titulo, ic in (("necessidade", "A necessidade", "search"),
                              ("oportunidade", "A oportunidade", "insights")):
        if d.get("contexto", {}).get(chave):
            blocos.append(f"""<div class="nucleo"><h3>{titulo}</h3>
<p>{e(d['contexto'][chave])}</p></div>""")
    valor = "".join(
        f"""<div class="nucleo vertical"><h3>{e(t)}</h3><p>{e(x)}</p></div>"""
        for t, x in (d.get("valor") or []))
    return f"""<section class="container plano-section"><hr class="rule">
<h2 class="section-title">O QUE ESTE EVENTO<br><em>RESOLVE.</em></h2>
{f'<div class="nucleo-grid">{"".join(blocos)}</div>' if blocos else ''}
{f'<h3 class="area-list-title">Proposta de valor</h3><div class="nucleo-grid">{valor}</div>' if valor else ''}
</section>"""


def frentes_block(pr):
    """O que acontece dentro do evento: cada frente com entidade, calendário e público próprios."""
    d = pr.get("frentes")
    if not d:
        return ""
    cards = "".join(
        f"""<div class="frente"><h3>{e(nome)}</h3><p>{e(txt)}</p></div>"""
        for nome, txt, ic in d["itens"])
    return f"""<section class="container reach-section"><hr class="rule">
<h2 class="section-title">{e(d['titulo']).upper()}<br><em>{e(d['subtitulo'])}</em></h2>
<p class="body-copy">{e(d['lede'])}</p>
<div class="frentes-grid">{cards}</div>
{paragrafo_nota(d['nota'])}</section>"""


def antecedente_block(pr):
    """Evento anterior, de outra marca ou outro nome, que explica o formato atual."""
    d = (pr.get("dossie") or {}).get("antecedente")
    if not d:
        return ""
    fontes = " · ".join(fonte_link(f) for f in (d.get("fontes") or []))
    return f"""<section class="container papel-section"><hr class="rule">
<h2 class="section-title">ANTES<br><em>DISSO.</em></h2>
<div class="papel-card"><h3>{e(d['titulo'])}</h3>
<p>{e(d['texto'])}</p>
{f'<div class="taglist">{fontes}</div>' if fontes else ''}</div>
{paragrafo_nota(d['nota'])}</section>"""


def kpis_block(pr):
    """Indicadores que o projeto se compromete a medir, com o estado de cada um."""
    d = pr.get("dossie") or {}
    if not d.get("kpis"):
        return ""
    linhas = []
    for nome, alvo, atual, fonte in d["kpis"]:
        val = (f'<span class="val">{e(atual)}</span>' if atual
               else '<span class="val pend">a medir</span>')
        linhas.append(f"""<tr><th scope="row">{e(nome)}</th><td>{e(alvo or '—')}</td>
<td>{val}</td><td>{fonte_link(fonte)}</td></tr>""")
    return f"""<div class="kpis-bloco">
<h3 class="sub-titulo">Indicadores acompanhados</h3>
<p class="body-copy">{e(d.get('kpis_lede') or 'Os indicadores que o projeto acompanha, com a leitura mais recente e a origem de cada número.')}</p>
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Indicador</th><th scope="col">Referência</th>
<th scope="col">Última leitura</th><th scope="col">Fonte</th></tr></thead>
<tbody>{''.join(linhas)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver a leitura e a fonte.</p></div>"""


def parceiros_block(pr, depth):
    """Patrocinadores e parceiros identificados neste projeto."""
    d = pr.get("dossie") or {}
    itens = d.get("parceiros") or []
    if not itens:
        return ""
    cards = "".join(
        f"""<div class="parceiro"><span class="parceiro-nome">{e(nome)}</span>
<span class="parceiro-papel">{icon('verified')} {e(papel)}</span></div>"""
        for nome, papel in itens)
    return f"""<section class="container reach-section"><hr class="rule">
<h2 class="section-title">PARCEIROS<span class="orange">.</span></h2>
<div class="parceiros-grid">{cards}</div>
{paragrafo_nota(d.get('parceiros_nota'))}</section>"""


def papel_block(pr):
    """O que a Cadillac faz neste projeto. Sem isso, presença no acervo vira atribuição de autoria."""
    data = pr.get("papel")
    if not data:
        return ""
    rotulo, _, ic = MODEL["datas"]["status"][data["status"]]
    return f"""<section class="container papel-section"><hr class="rule">
<h2 class="section-title">CADILLAC<span class="orange">.</span></h2>
<div class="papel-card">
<h3>{e(data['rotulo'])}</h3>
<p>{e(data['texto'])}</p>
<div class="taglist"><span class="selo selo-{data['status'].replace(' ', '-')}">{icon(ic)} {e(rotulo)}</span>
<span>{icon('description')} {e(data['fonte_texto'])}</span></div></div>
{paragrafo_nota(data['nota'])}</section>"""


def historico_block(pr):
    """Serie completa de edicoes de um projeto que a Cadillac nao produziu, da mais recente para a mais antiga."""
    data = pr.get("historico")
    if not data:
        return ""
    linhas = []
    for n, quando, onde, publico, status in data["linhas"]:
        rotulo, _, ic = MODEL["datas"]["status"][status]
        pub = (f'<span class="val">{big(publico)}</span>' if isinstance(publico, int)
               else '<span class="val pend">a levantar</span>')
        linhas.append(f"""<tr><th scope="row">{n:02d}<small>{e(quando)}</small></th>
<td>{e(onde)}</td><td>{pub}</td>
<td><span class="selo selo-{status.replace(' ', '-')}">{icon(ic)} {e(rotulo)}</span></td></tr>""")
    vals = [x[3] for x in data["linhas"] if isinstance(x[3], int) and x[4] != "anunciada"]
    resumo = (f'<div class="op-grid"><div class="op-tile">{icon("calendar_month")}'
              f'<strong>{len(data["linhas"]) - 1:02d}</strong><span>Edições realizadas</span>'
              f'<small>{e(data["periodo"])}</small></div>'
              f'<div class="op-tile">{icon("groups")}<strong>{big(sum(vals))}</strong>'
              f'<span>Participações somadas</span><small>Presenças, não pessoas únicas. '
              f'A mesma pessoa pode ter ido a várias edições</small></div>'
              f'<div class="op-tile">{icon("public")}<strong>{big(max(vals))}</strong>'
              f'<span>Maior público de uma edição</span><small>{e(data["recorde"])}</small></div></div>')
    return f"""<section class="container reach-section"><hr class="rule">
<h2 class="section-title">{e(data['titulo']).upper()}<br><em>{e(data['subtitulo'])}</em></h2>
<p class="body-copy">{e(data['lede'])}</p>
{resumo}
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Edição</th><th scope="col">Onde</th><th scope="col">Público</th><th scope="col">Situação da data</th></tr></thead>
<tbody>{''.join(linhas)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver público e situação da data.</p>
{paragrafo_nota(data['nota'])}</section>"""


def mercado_block(pr):
    """Leitura de mercado do setor em que o projeto atua. Nunca é resultado do evento."""
    data = pr.get("mercado")
    if not data:
        return ""
    tiles = "".join(
        f"""<div class="op-tile">{icon('insights')}
<strong>{e(valor)}</strong><span>{e(rotulo)}</span><small>{e(nota)}</small></div>"""
        for valor, rotulo, nota in data["items"])
    return f"""<section class="container op-section"><hr class="rule">
<h2 class="section-title">{e(data['titulo']).upper()}<span class="orange">.</span></h2>
<p class="body-copy">{e(data['lede'])}</p>
<div class="op-grid">{tiles}</div>
{paragrafo_nota(data['nota'])}</section>"""


def jornada_block(pr):
    """Como uma edicao acontece, do primeiro dia ao mes seguinte.

    A pagina contava o que o evento e e o que ele gerou, e pulava o meio: como
    a coisa funciona. Cada etapa abre no clique, para quem quer o detalhe sem
    atravessar quatro paragrafos de texto corrido.
    """
    data = pr.get("jornada")
    if not data:
        return ""
    passos = []
    for i, (nome, quando, texto, chave) in enumerate(data["etapas"], start=1):
        aberto = " aria-expanded=\"true\"" if i == 1 else " aria-expanded=\"false\""
        escondido = "" if i == 1 else " hidden"
        passos.append(
            f'<div class="jornada-passo" data-passo="{e(chave)}">'
            f'<button type="button" class="jornada-cabeca"{aberto} '
            f'aria-controls="passo-{i}">'
            f'<span class="jornada-n">{i:02d}</span>'
            f'<span class="jornada-nome"><strong>{e(nome)}</strong>'
            f'<small>{e(quando)}</small></span>'
            f'{icon("expand_more", "cd-icon jornada-seta")}</button>'
            f'<div class="jornada-corpo" id="passo-{i}"{escondido}><p>{e(texto)}</p></div></div>')
    return f"""<section class="container jornada-section"><hr class="rule">
<h2 class="section-title">{e(data['titulo']).upper()}<span class="orange">.</span></h2>
<p class="body-copy">{e(data['lede'])}</p>
<div class="jornada">{''.join(passos)}</div></section>"""


def telas_block(pr):
    """A mesma noite em cada tela, com a barra na proporcao do que entregou.

    Numero solto em lista nao se compara. Aqui a barra mostra o tamanho de
    cada tela ao lado das outras, e cada tela guarda a propria fonte.
    """
    data = pr.get("telas")
    if not data:
        return ""
    itens = data["itens"]
    maior = max([x.get("peso") or 0 for x in itens] + [1])
    botoes, paineis = [], []
    for i, x in enumerate(itens):
        on = i == 0
        largura = round(100 * (x.get("peso") or 0) / maior, 1)
        botoes.append(
            f'<button type="button" class="tela-aba" role="tab" id="tela-ab-{i}" '
            f'aria-controls="tela-pn-{i}" aria-selected="{"true" if on else "false"}" '
            f'tabindex="{"0" if on else "-1"}">'
            f'<strong>{e(x["nome"])}</strong><small>{e(x["canal"])}</small>'
            f'<span class="tela-barra"><i style="width:{largura}%"></i></span></button>')
        linhas = "".join(
            f'<tr><th scope="row">{e(k)}</th><td>{e(v)}</td></tr>' for k, v in x["linhas"])
        rotulo, url = x.get("fonte") or (None, None)
        fonte = ""
        if rotulo:
            fonte = (f'<p class="tela-fonte">{icon("description")} '
                     + (f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(rotulo)}</a>'
                        if url else e(rotulo)) + '</p>')
        paineis.append(
            f'<div class="tela-painel" role="tabpanel" id="tela-pn-{i}" '
            f'aria-labelledby="tela-ab-{i}"{"" if on else " hidden"}>'
            f'<p class="tela-numero"><strong>{e(x["destaque"])}</strong>'
            f'<span>{e(x["unidade"])}</span></p>'
            f'<div class="table-wrap"><table class="amounts"><tbody>{linhas}</tbody></table></div>'
            f'{fonte}</div>')
    return f"""<section class="container telas-section"><hr class="rule">
<h2 class="section-title">{e(data['titulo']).upper()}<span class="orange">.</span></h2>
<p class="body-copy">{e(data['lede'])}</p>
<div class="telas">
<div class="tela-abas" role="tablist" aria-label="Telas da transmissão">{''.join(botoes)}</div>
<div class="tela-paineis">{''.join(paineis)}</div></div></section>"""


def card_block(pr):
    """O card e o regulamento: o que se combinou e o que aconteceu.

    Uma competicao sem chave precisa explicar a propria regra, senao o leitor
    procura o chaveamento e nao acha. A tabela traz o combate, o resultado e a
    fonte de cada linha; os cartoes ao lado, as regras que desenham o formato.
    """
    data = pr.get("card")
    if not data:
        return ""
    linhas = []
    for dupla, peso, resultado, fonte in data["linhas"]:
        rotulo, url = fonte
        marca = (f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(rotulo)}</a>'
                 if url else e(rotulo))
        linhas.append(f'<tr><th scope="row">{e(dupla)}</th><td>{e(peso)}</td>'
                      f'<td>{e(resultado)}</td><td>{marca}</td></tr>')
    regras = "".join(
        f'<article class="regra"><h3>{e(t)}</h3><p>{e(d)}</p></article>'
        for t, d in data.get("regras") or [])
    fontes = ""
    if data.get("regras_fonte"):
        itens = " · ".join(
            f'<a href="{e(u)}" target="_blank" rel="noopener noreferrer">{e(r)}</a>' if u else e(r)
            for r, u in data["regras_fonte"])
        fontes = f'<p class="tela-fonte">{icon("description")} <span>{itens}</span></p>'
    return f"""<section class="container card-section"><hr class="rule">
<h2 class="section-title">{e(data['titulo']).upper()}<span class="orange">.</span></h2>
<p class="body-copy">{e(data['lede'])}</p>
<div class="table-wrap"><table class="amounts"><thead><tr>
<th scope="col">Combate</th><th scope="col">Peso</th>
<th scope="col">Resultado</th><th scope="col">Fonte</th></tr></thead>
<tbody>{''.join(linhas)}</tbody></table></div>
{f'<div class="regra-grade">{regras}</div>' if regras else ''}{fontes}</section>"""


def plano_block(pr):
    """Plano de longo prazo declarado pela produção: núcleos, verticais e fases."""
    data = pr.get("plano")
    if not data:
        return ""
    nucleos = "".join(
        f"""<div class="nucleo"><h3>{e(nome)}</h3><p>{e(desc)}</p></div>"""
        for nome, desc, ic in data["nucleos"])
    verticais = "".join(
        f"""<div class="nucleo vertical"><h3>{e(nome)}</h3><p>{e(desc)}</p></div>"""
        for nome, desc, ic in data["verticais"])
    # A rota ate 2032 era uma lista de sete paragrafos longos, e ninguem lia o
    # setimo. Agora e uma linha de anos: escolhe-se o ano e le-se so ele.
    anos, etapas = [], []
    for i, (ano, titulo, texto) in enumerate(data["fases"]):
        on = i == 0
        anos.append(
            f'<button type="button" class="rota-ano" role="tab" id="rota-ab-{i}" '
            f'aria-controls="rota-pn-{i}" aria-selected="{"true" if on else "false"}" '
            f'tabindex="{"0" if on else "-1"}">{ano}</button>')
        etapas.append(
            f'<div class="rota-painel" role="tabpanel" id="rota-pn-{i}" '
            f'aria-labelledby="rota-ab-{i}"{"" if on else " hidden"}>'
            f'<span class="fase-ano">{ano}</span>'
            f'<div><strong>{e(titulo)}</strong><p>{e(texto)}</p></div></div>')
    fases = (f'<div class="rota-anos" role="tablist" aria-label="Etapas do plano">'
             f'{"".join(anos)}</div><div class="rota-paineis">{"".join(etapas)}</div>')
    return f"""<section class="container plano-section"><hr class="rule">
<h2 class="section-title">{e(data['titulo']).upper()}<br><em>O plano de longo prazo.</em></h2>
<p class="body-copy plano-proposito">{e(data['proposito'])}</p>
<p class="body-copy">{e(data['conceito'])}</p>
<h3 class="area-list-title">Núcleos</h3>
<div class="nucleo-grid">{nucleos}</div>
<h3 class="area-list-title">Verticais</h3>
<div class="nucleo-grid">{verticais}</div>
<h3 class="area-list-title">{e(data['fases_titulo'])}</h3>
<div class="rota">{fases}</div>
{paragrafo_nota(data['nota'])}</section>"""


def participacoes_block(pr, depth):
    """Para páginas de pessoa ou coletivo: onde ela aparece no acervo."""
    data = pr.get("participacoes")
    if not data:
        return ""
    p = rel(depth)
    by_slug = {x["slug"]: x for x in PROJECTS}
    linhas = []
    for item in data["itens"]:
        alvo = by_slug[item["projeto"]]
        href = f'{p}projetos/{alvo["slug"]}/' + (f'{item["ano"]}/' if item["ano"] else "")
        quando = str(item["ano"]) if item["ano"] else "Histórico"
        label, url = item["fonte"]
        linhas.append(f"""<tr><th scope="row"><a href="{href}">{e(alvo['name'])}{' ' + str(item['ano']) if item['ano'] else ''}</a></th>
<td>{quando}</td><td>{e(item['papel'])}</td>
<td><a href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(label)}</a></td></tr>""")
    return f"""<section class="container reach-section"><hr class="rule">
<h2 class="section-title">{e(data['titulo']).upper()}<span class="orange">.</span></h2>
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Evento</th><th scope="col">Quando</th><th scope="col">Papel</th><th scope="col">Fonte</th></tr></thead>
<tbody>{''.join(linhas)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver papel e fonte.</p></section>"""


def op_project(pr):
    data = MODEL["operacao"]
    perfil = dict(data["perfil"].get(pr["slug"], {}))
    fichas = [v for k, v in data["fichas"].items() if k.startswith(pr["slug"] + "-")]
    publicos = [f["publico"][0] for f in fichas if f.get("publico") and f["publico"][0]]
    if publicos:
        perfil.setdefault("publico", [max(publicos),
                                      "Maior público registrado entre as edições catalogadas"])
    order = ["cidades", "modalidades", "publico", "staff", "fornecedores", "dias_montagem"]
    return f"""<section class="container op-section"><hr class="rule">
<h2 class="section-title">DADOS<span class="orange">.</span></h2>
<p class="body-copy">O que este projeto mobiliza para acontecer. Os campos preenchidos têm origem identificada; os demais dependem de dado da produção.</p>
{op_tiles(perfil, f'operacao.perfil.{pr["slug"]}', order)}
{kpis_block(pr)}</section>"""


def op_edition(pr, year):
    key = f'{pr["slug"]}-{year}'
    ficha = MODEL["operacao"]["fichas"].get(key, {})
    order = ["inscritos", "publico", "capacidade", "staff", "fornecedores",
             "dias_evento", "dias_montagem", "modalidades", "palcos", "transmissao"]
    return f"""<section class="container op-section"><hr class="rule">
<h2 class="section-title">A OPERAÇÃO<br><em>DESTA EDIÇÃO.</em></h2>
{op_tiles(ficha, f'operacao.fichas.{key}', order)}
{paragrafo_nota(MODEL["operacao"]["note"])}</section>"""


def broadcast_block(depth):
    p = rel(depth)
    data = MODEL["transmissoes"]
    by_slug = {pr["slug"]: pr for pr in PROJECTS}
    how = "".join(
        f'<article><span class="step-i">{icon(ic)}</span><h3>{e(title)}</h3><p>{e(txt)}</p></article>'
        for title, txt, ic in data["como_medir"])
    rows = []
    for r in data["registros"]:
        pr = by_slug[r["project"]]
        href = href_edicao(pr, r["year"], p)
        if r["metrica"]:
            metric = (f'<span class="val">{e(r["metrica"])}</span>'
                      f'<small>lido em {e(r["capturado_em"])}</small>')
        else:
            metric = '<span class="val pend">a medir</span>'
        link = (f'<a href="{e(r["url"])}" target="_blank" rel="noopener noreferrer">'
                f'abrir</a>' if r["url"] else
                '<span class="tag-wait">URL a registrar</span>')
        fonte = ""
        if r["fonte"]:
            label, url = r["fonte"]
            fonte = (f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">'
                     f'{e(label)}</a>')
        rows.append(f"""<tr><th scope="row"><a href="{href}">{e(pr['name'])}{' ' + str(r['year']) if r['year'] else ''}</a>
<small>{e(r['o_que'])}</small></th>
<td>{e(r['parceiro'])}<small>{e(r['canal'])}</small></td>
<td>{metric}</td><td>{link}</td><td>{fonte or '—'}</td></tr>""")
    pend = sum(1 for r in data["registros"] if not r["metrica"])
    return f"""<section class="container reach-section" id="transmissoes"><hr class="rule">
<h2 class="section-title">TRANSMISSÕES<span class="orange">.</span></h2>
<p class="body-copy">{e(data['lede'])}</p>
<div class="charts"><div class="chart-card span-2"><h3>Transmissões por evento e parceiro</h3>
<p class="chart-sub">{plural(pend, 'linha aguarda', 'linhas aguardam')} a leitura na plataforma.</p>
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Evento</th><th scope="col">Parceiro e canal</th><th scope="col">Audiência</th><th scope="col">Registro</th><th scope="col">Referência</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver o registro e a referência.</p></div></div>
<h3 class="cases-title">Como cada número é lido</h3>
<div class="method">{how}</div>
{paragrafo_nota(data['note'])}</section>"""


def cast_block(pr, year=None, numero="05", depth=2):
    """Quem esteve no palco, na pista e na linha de frente."""
    data = MODEL["elenco"]
    key = f'{pr["slug"]}-{year}' if year else pr["slug"]
    bloco = data["por_edicao"].get(key) or (data["por_projeto"].get(pr["slug"]) if not year else None)
    if not bloco:
        return ""
    grupos = [("artistas", "Artistas", "music_note"), ("atletas", "Atletas", "skateboarding"),
              ("personalidades", "Personalidades", "groups")]
    colunas = []
    for chave, titulo, ic in grupos:
        gente = bloco.get(chave)
        if not gente:
            continue
        linhas = []
        for nome, papel in gente:
            href = atleta_href(nome, depth)
            marca = (f'<a href="{href}">{e(nome)} {icon("arrow_outward")}</a>' if href
                     else f'<strong>{e(nome)}</strong>')
            linhas.append(f'<li>{marca}<span>{e(papel)}</span></li>')
        itens = "".join(linhas)
        colunas.append(f"""<div class="cast-col"><h3>{titulo}</h3><ul>{itens}</ul></div>""")
    fonte = ""
    if bloco.get("fonte"):
        fonte = f'<p class="cast-source">Fonte: {fonte_link(bloco["fonte"])}</p>'
    return f"""<section class="container cast-section"><hr class="rule">
<h2 class="section-title">QUEM ESTEVE<br><em>EM CENA.</em></h2>
<div class="cast-grid">{''.join(colunas)}</div>{fonte}
{paragrafo_nota(data["note"])}</section>"""


def events_table(depth):
    """Uma linha por edição, da mais recente para a mais antiga."""
    p = rel(depth)
    op = MODEL["operacao"]["fichas"]
    elenco = MODEL["elenco"]["por_edicao"]
    aud = MODEL["audiencia"]["entries"]
    linhas = []
    edicoes = [(pr, y) for pr in PROJECTS for y in pr["years"]]
    edicoes.sort(key=lambda t: (-ano_de(t[1]), str(t[1]), t[0]["name"]))
    for pr, year in edicoes:
        key = f'{pr["slug"]}-{year}'
        ed = pr.get("editions", {}).get(str(year), {})
        ficha = op.get(key, {})
        bruto = ficha.get("inscritos")
        inscritos = bruto[0] if isinstance(bruto, list) else bruto
        # número declarado vence estimativa, que vence projeção
        prioridade = {"declarado": 0, "estimado": 1, "projecao": 2}
        candidatos = sorted(
            (x for x in aud if x["project"] == pr["slug"]
             and x["year"] == ano_de(year)
             and x["family"] == "presencial" and x["value"]),
            key=lambda x: prioridade.get(x.get("tipo", ""), 3))
        publico = candidatos[0] if candidatos else None
        if publico:
            tipo = publico.get("tipo", "")
            marca = {"declarado": "declarado", "estimado": "estimativa",
                     "projecao": "projeção divulgada antes do evento"}.get(tipo, "")
            classe = "val proj" if tipo == "projecao" else "val"
            detalhe = (marca if tipo == "projecao"
                       else f'{marca} · {e(publico["label"].lower())}')
            pub = (f'<span class="{classe}">{big(publico["value"])}</span>'
                   f'<small>{detalhe}</small>')
        else:
            pub = '<span class="val pend">a levantar</span>'
        nomes = []
        if key in elenco:
            for chave in ("artistas", "atletas", "personalidades"):
                nomes += [n for n, _ in elenco[key].get(chave, [])]
        destaque = (", ".join(nomes[:4]) + (" e outros" if len(nomes) > 4 else "")) if nomes else "—"
        txt, dias = periodo(ed.get("datas"))
        quando = (f'{e(txt)}<small>{selo_data(ed.get("datas"))}'
                  f'{" · " + plural(dias, "dia", "dias") if dias else ""}</small>'
                  if txt else '<span class="val pend">a confirmar</span>')
        linhas.append(f"""<tr><th scope="row"><a href="{p}projetos/{pr['slug']}/{year}/">{e(pr['name'])} {year}</a>
<small>{plural(inscritos, 'inscrito', 'inscritos') if inscritos else 'inscritos a levantar'}</small></th>
<td>{quando}</td>
<td>{e(ed.get('place', pr['location']))}</td>
<td>{pub}</td>
<td>{e(destaque)}</td></tr>""")
    return f"""<section class="container reach-section" id="eventos"><hr class="rule">
<h2 class="section-title">POR EVENTO<span class="orange">.</span></h2>
<p class="body-copy">Cada edição com data, local, público, inscritos e quem esteve em cena. Da mais recente para a mais antiga.</p>
<div class="charts"><div class="chart-card span-2">
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Edição</th><th scope="col">Quando</th><th scope="col">Onde</th><th scope="col">Público</th><th scope="col">Em cena</th></tr></thead>
<tbody>{''.join(linhas)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver público, inscritos e elenco.</p></div></div>
<div class="section-end"><a class="pill-link" href="{p}agenda/">Ver a agenda completa {icon('calendar_month')}</a></div></section>"""


def ficha_pessoa(pessoa, depth, com_vinculos=True):
    p = rel(depth)
    foto = ROOT / "assets" / "fotos" / (pessoa.get("foto") or "")
    if pessoa.get("foto") and foto.exists():
        img = figura(f'assets/fotos/{pessoa["foto"]}', pessoa["nome"], depth,
                     "pessoa-foto", MEDIDAS_RETRATO)
    else:
        img = slot(pessoa.get("foto") or f'{pessoa["slug"]}.jpg', "1:1", pessoa["nome"], "slot-retrato")
    rotulo, _, ic = MODEL["pessoas"]["papeis"][pessoa["tipo"]]
    vinc = ""
    if com_vinculos and pessoa.get("vinculos"):
        itens = []
        for v in pessoa["vinculos"]:
            alvo = next((x for x in PROJECTS if x["slug"] == v["projeto"]), None)
            if not alvo:
                continue
            href = f'{p}projetos/{alvo["slug"]}/' + (f'{v["ano"]}/' if v.get("ano") else "")
            fonte = ""
            if v.get("fonte"):
                label, url = v["fonte"]
                fonte = (f'<a class="vinc-fonte" href="{e(url)}" target="_blank" rel="noopener noreferrer">'
                         f'{e(label)}</a>')
            itens.append(f'<li><a href="{href}">{e(alvo["name"])}'
                         f'{" " + str(v["ano"]) if v.get("ano") else ""}</a>'
                         f'<span>{e(v["papel"])}</span>{fonte}</li>')
        vinc = f'<ul class="vinculos">{"".join(itens)}</ul>'
    links = "".join(f'<a href="{e(u)}" target="_blank" rel="noopener noreferrer">{e(l)}</a>'
                    for l, u in pessoa.get("links", []))

    def pend(campo, oque):
        caminho = f'pessoas.equipe · {pessoa["slug"]} · {campo}'
        chip = f'<code>{e(caminho)}</code>' if MOSTRAR_CAMPOS else ""
        return f'<span class="tag-wait">{icon("search")} {e(oque)} a preencher</span>{chip}'

    cargo = e(pessoa["cargo"]) if pessoa.get("cargo") else pend("cargo", "Cargo")
    bio = e(pessoa["bio"]) if pessoa.get("bio") else pend("bio", "Bio")
    return f"""<article class="pessoa">{img}
<div class="pessoa-info"><span class="selo">{icon(ic)} {e(rotulo)}</span>
<h3>{e(pessoa['nome'])}</h3><p class="pessoa-cargo">{cargo}</p>
<p class="pessoa-bio">{bio}</p>{vinc}
{f'<p class="pessoa-links">{links}</p>' if links else ''}</div></article>"""


def creditos_projeto(pr, depth, year=None):
    """Quem assinou esta operação, com o papel de cada um nesta edição."""
    gente = []
    for pessoa in MODEL["pessoas"]["equipe"]:
        for v in pessoa.get("vinculos", []):
            if v["projeto"] != pr["slug"]:
                continue
            if year and v.get("ano") and v["ano"] != year:
                continue
            gente.append((pessoa, v))
            break
    if not gente:
        return ""
    p = rel(depth)
    linhas = []
    for pessoa, v in gente:
        rotulo = MODEL["pessoas"]["papeis"][pessoa["tipo"]][0]
        fonte = "—"
        if v.get("fonte"):
            label, url = v["fonte"]
            fonte = (f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">'
                     f'{e(label)}</a>')
        linhas.append(f'<tr><th scope="row"><a href="{p}equipe/#{pessoa["slug"]}">{e(pessoa["nome"])}</a>'
                      f'<small>{e(rotulo)}</small></th><td>{e(v["papel"])}</td><td>{fonte}</td></tr>')
    return f"""<section class="container reach-section"><hr class="rule">
<h2 class="section-title">PRODUÇÃO<span class="orange">.</span></h2>
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Quem</th><th scope="col">Papel aqui</th><th scope="col">Fonte</th></tr></thead>
<tbody>{''.join(linhas)}</tbody></table></div>
<p class="note">Lista do que está documentado. A ficha técnica completa de cada edição entra conforme for levantada.</p></section>"""


def case_block(pr, year):
    ficha = MODEL["cases"]["fichas"].get(f'{pr["slug"]}-{year}')
    if ficha is None:
        return ""
    campos = MODEL["cases"]["campos"]
    blocos = []
    for chave in ("desafio", "solucao"):
        titulo, ajuda = campos[chave]
        valor = ficha.get(chave)
        corpo = (f"<p>{e(valor)}</p>" if valor else
                 f'<p class="vazio">{icon("search")} A escrever · <code>cases.fichas.{pr["slug"]}-{year} · {chave}</code>'
                 f'<small>{e(ajuda)}</small></p>')
        blocos.append(f'<div class="case-bloco"><h3>{e(titulo)}</h3>{corpo}</div>')
    for chave in ("entrega", "resultado"):
        titulo, ajuda = campos[chave]
        itens = ficha.get(chave) or []
        marcador = icon("arrow_forward")
        corpo = ("<ul>" + "".join(f"<li>{marcador} {e(i)}</li>" for i in itens) + "</ul>"
                 if itens else
                 f'<p class="vazio">{icon("search")} A levantar · <code>cases.fichas.{pr["slug"]}-{year} · {chave}</code>'
                 f'<small>{e(ajuda)}</small></p>')
        blocos.append(f'<div class="case-bloco"><h3>{e(titulo)}</h3>{corpo}</div>')
    dep = ficha.get("depoimento") or {}
    if dep.get("texto"):
        depo = (f'<blockquote class="depoimento"><p>{e(dep["texto"])}</p>'
                f'<footer>{e(dep["autor"])}<span>{e(dep["cargo"])}</span></footer></blockquote>')
    else:
        depo = (f'<p class="vazio depoimento-vazio">{icon("groups")} Depoimento a colher · '
                f'<code>cases.fichas.{pr["slug"]}-{year} · depoimento</code>'
                f'<small>Fala de cliente, patrocinador ou entidade, com nome e cargo</small></p>')
    return f"""<section class="container case-section"><hr class="rule">
<h2 class="section-title">O CASE,<br><em>DO BRIEFING AO RESULTADO.</em></h2>
<div class="case-grid">{''.join(blocos)}</div>{depo}</section>"""


def youtube_id(url):
    """ID do vídeo em qualquer formato de link do YouTube, sem os parâmetros de rastreio."""
    from urllib.parse import urlparse, parse_qs
    u = urlparse(url)
    if "youtu.be" in u.netloc:
        return u.path.strip("/").split("/")[0]
    if u.path.startswith(("/embed/", "/shorts/", "/live/", "/v/")):
        return u.path.split("/")[2]
    return (parse_qs(u.query).get("v") or [""])[0]


def video_block(chave, titulo, depth=0):
    """Reel ou vídeo de projeto: embute quando há URL, reserva o espaço quando não há.

    O player de terceiro só carrega depois do clique: até lá, a página mostra a
    miniatura e não dispara requisição nem cookie para a plataforma.
    """
    data = MODEL["video"]
    fonte = data["reel"] if chave == "reel" else data["por_projeto"].get(chave)
    if not fonte:
        return ""
    url = fonte.get("url")
    if url:
        if "youtube" in url or "youtu.be" in url:
            vid = youtube_id(url)
            embed = f"https://www.youtube-nocookie.com/embed/{vid}"
            # A miniatura vinha de i.ytimg.com e carregava sozinha, entregando o
            # IP do visitante ao Google em quem so passou pela pagina sem clicar
            # em nada. Com um poster do proprio acervo, o unico contato com o
            # YouTube passa a ser o que o visitante pediu ao clicar.
            poster = fonte.get("poster") or ""
            if poster and (ROOT / poster).exists():
                capa = figura(poster, "", depth, "video-thumb",
                              "(min-width:900px) 900px, 100vw")
            else:
                capa = (f'<img class="video-thumb" src="https://i.ytimg.com/vi/{e(vid)}'
                        f'/maxresdefault.jpg" alt="" width="1280" height="720" '
                        f'loading="lazy" decoding="async">')
            player = (f'<button class="video-facade" type="button" data-embed="{e(embed)}" '
                      f'data-titulo="{e(titulo)}" aria-label="Assistir: {e(titulo)}">'
                      f'{capa}<span class="video-play">{icon("play_arrow")}</span>'
                      f'<span class="video-label">{e(titulo)}</span></button>'
                      f'<noscript><a class="video-link" href="{e(url)}" target="_blank" '
                      f'rel="noopener noreferrer">Assistir no YouTube</a></noscript>')
        elif "vimeo" in url:
            vid = url.rstrip("/").rsplit("/", 1)[-1].split("?")[0]
            player = (f'<iframe src="https://player.vimeo.com/video/{e(vid)}" title="{e(titulo)}" '
                      f'loading="lazy" allowfullscreen></iframe>')
        else:
            player = f'<video controls preload="none" poster="{e(fonte.get("poster") or "")}"><source src="{e(url)}"></video>'
        legenda = paragrafo_nota(fonte.get("nota"))
        # O titulo fica embaixo do quadro, nao dentro dele: e a mesma posicao
        # em que o cartao de evento poe o nome, logo abaixo da imagem.
        rotulo = f'<p class="video-titulo">{e(titulo)}</p>' if titulo else ""
        return f'<div class="video-wrap">{player}</div>{rotulo}{legenda}'
    return (f'<div class="video-wrap video-slot" role="img" aria-label="Espaço reservado para vídeo">'
            f'<span class="slot-mark">{icon("play_arrow")}</span><strong>{e(titulo)}</strong>'
            f'<code>{e(fonte.get("arquivo") or "video.mp4")}</code>'
            f'<small>{e(fonte.get("duracao") or "")} · arquivo local ou URL de YouTube e Vimeo</small></div>')


def ficha_atleta_card(x, depth):
    p = rel(depth)
    foto = ROOT / "assets" / "fotos" / (x.get("foto") or "")
    if x.get("foto") and foto.exists():
        img = figura(f'assets/fotos/{x["foto"]}', x["nome"], depth,
                     "pessoa-foto", MEDIDAS_RETRATO)
    else:
        img = slot(x.get("foto") or f'{x["slug"]}.jpg', "1:1", x["nome"], "slot-retrato", depth)
    n = len(x.get("participacoes") or [])
    return f"""<a class="atleta-card" href="{p}atletas/{x['slug']}/">
{img}<div class="atleta-info"><h3>{e(x['nome'])}</h3>
<span class="atleta-mod">{icon('skateboarding')} {e(x['modalidade'])}</span>
<span class="atleta-n">{plural(n, 'edição no acervo', 'edições no acervo')}</span></div></a>"""


def slugify(texto):
    """Nome de pessoa para endereço: sem acento, sem pontuação, separado por hífen."""
    import unicodedata, re as _re
    base = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return _re.sub(r"-+", "-", _re.sub(r"[^a-z0-9]+", "-", base.lower())).strip("-")


def ficha_simples(nome, papel, foto, href, depth):
    """Cartão no formato da ficha de atleta, para equipe e elenco artístico."""
    p = rel(depth)
    arq = ROOT / "assets" / "fotos" / (foto or "")
    if foto and arq.exists():
        img = figura(f'assets/fotos/{foto}', nome, depth,
                     "pessoa-foto", MEDIDAS_RETRATO)
    else:
        iniciais = "".join(w[0] for w in nome.split()[:2]).upper()
        img = f'<span class="pessoa-foto pessoa-iniciais" aria-hidden="true">{e(iniciais)}</span>'
    return (f'<a class="atleta-card" href="{p}{href}">{img}'
            f'<div class="atleta-info"><h3>{e(nome)}</h3>'
            f'<span class="atleta-mod">{e(papel)}</span></div></a>')


def page_pessoa(x):
    """Perfil de quem assina a casa: mesma estrutura da ficha de atleta."""
    depth, p = 2, rel(2)
    data = MODEL["pessoas"]
    trail_html, trail_ld = crumbs(depth, [("Equipe", p + "equipe/"), (x["nome"], None)])

    arq = ROOT / "assets" / "fotos" / (x.get("foto") or "")
    if x.get("foto") and arq.exists():
        img = (f'<figure class="atleta-figura">'
               + figura(f'assets/fotos/{x["foto"]}', x["nome"], depth,
                        "pessoa-foto", MEDIDAS_RETRATO) + '</figure>')
    else:
        img = slot(x.get("foto") or f'{x["slug"]}.jpg', "1:1", x["nome"], "slot-retrato", depth)

    by_slug = {pr["slug"]: pr for pr in PROJECTS}
    linhas = []
    for v in sorted(x.get("vinculos") or [], key=lambda v: -(v.get("ano") or 0)):
        pr = by_slug.get(v["projeto"])
        if not pr:
            continue
        _ids = [x for x in pr["years"] if v.get("ano") and ano_de(x) == v["ano"]]
        href = (f'{p}projetos/{pr["slug"]}/{_ids[0]}/' if len(_ids) == 1
                else f'{p}projetos/{pr["slug"]}/')
        linhas.append(f"""<tr><th scope="row"><a href="{href}">{e(pr['name'])}</a></th>
<td>{v.get('ano') or '—'}</td><td>{e(v['papel'])}</td><td>{fonte_link(v.get('fonte'))}</td></tr>""")
    tabela = (f"""<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Evento</th><th scope="col">Ano</th><th scope="col">Papel</th>
<th scope="col">Fonte</th></tr></thead><tbody>{''.join(linhas)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver o papel e a fonte.</p>"""
              if linhas else
              '<p class="note">Nenhum vínculo com fonte pública catalogado até agora. '
              'Entra aqui quando houver documento ou publicação que o registre.</p>')

    outros = [o for o in data["equipe"] if o["slug"] != x["slug"]][:4]
    relacionados = "".join(
        ficha_simples(o["nome"], o.get("cargo") or "Equipe", o.get("foto"),
                      f'equipe/{o["slug"]}/', depth) for o in outros)

    ld = {"@context": "https://schema.org", "@type": "Person", "name": x["nome"],
          "url": f"{BASE}/equipe/{x['slug']}/",
          "description": x.get("bio") or x.get("cargo") or ""}
    if x.get("cargo"):
        ld["jobTitle"] = x["cargo"]

    cargo = (f'<div class="taglist"><span>{icon("groups")} {e(x["cargo"])}</span></div>'
             if x.get("cargo") else "")
    bio = f'<p class="lede">{e(x["bio"])}</p>' if x.get("bio") else ""

    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="container atleta-hero">
<a class="back" href="{p}equipe/">{icon('arrow_back')} Toda a equipe</a>
<div class="atleta-topo"><div class="atleta-retrato">{img}</div>
<div><h1>{e(x['nome'])}<span class="orange">.</span></h1>
{bio}{cargo}</div></div></section>
<section class="container reach-section"><hr class="rule">
<h2 class="section-title">NO ACERVO<br><em>DA CADILLAC.</em></h2>
<p class="body-copy">Os eventos deste acervo em que o nome aparece, com o papel registrado
e a fonte de cada linha.</p>
{tabela}</section>
<section class="container reach-section"><hr class="rule">
<h2 class="section-title">OUTROS NOMES<br><em>DA CASA.</em></h2>
<div class="atletas-grid">{relacionados}</div>
<div class="section-end"><a class="pill-link" href="{p}equipe/">Ver a equipe {icon('arrow_outward')}</a></div></section></main>"""
    return write(f"equipe/{x['slug']}/index.html",
                 head(depth, f"{x['nome']} | Equipe | Cadillac Produções",
                      (x.get("bio") or f"{x['nome']}, {x.get('cargo') or 'equipe'} na Cadillac "
                       f"Produções.")[:160],
                      f"equipe/{x['slug']}/", [ld, trail_ld])
                 + header(depth, "produtora") + body + footer(depth))


def artistas_indexados():
    """Nome do artista → lista de (projeto, ano, papel, fonte), do mais novo ao mais antigo."""
    by_slug = {x["slug"]: x for x in PROJECTS}
    nomes = {}
    for chave, bloco in MODEL["elenco"]["por_edicao"].items():
        slug, _, ano = chave.rpartition("-")
        if not slug or slug not in by_slug:
            slug, ano = chave, ""
        if slug not in by_slug:
            continue
        for nome, papel in bloco.get("artistas", []):
            nomes.setdefault(nome, []).append((by_slug[slug], ano, papel, bloco.get("fonte")))
    for nome in nomes:
        nomes[nome].sort(key=lambda v: -(int(v[1]) if v[1].isdigit() else 0))
    return nomes


def page_artista(nome, onde):
    """Perfil do artista, na mesma estrutura da ficha de atleta."""
    depth, p = 2, rel(2)
    alvo = slugify(nome)
    trail_html, trail_ld = crumbs(depth, [("Artistas", p + "artistas/"), (nome, None)])

    ficha = MODEL["elenco"].get("fichas", {}).get(alvo, {})
    arq = ROOT / "assets" / "fotos" / (ficha.get("foto") or "")
    if ficha.get("foto") and arq.exists():
        img = (f'<figure class="atleta-figura">'
               + figura(f'assets/fotos/{ficha["foto"]}', nome, depth,
                        "pessoa-foto", MEDIDAS_RETRATO) + '</figure>')
    else:
        iniciais = "".join(w[0] for w in nome.split()[:2]).upper()
        img = (f'<figure class="atleta-figura">'
               f'<span class="pessoa-foto pessoa-iniciais" aria-hidden="true">{e(iniciais)}</span>'
               f'</figure>')

    destaques = "".join(
        f'<div class="fact"><span class="n">{i:02d}</span><p>{e(t)}'
        + (f'<small class="out">{fonte_link(f, "")}</small>' if f else "")
        + "</p></div>"
        for i, (t, f) in enumerate(ficha.get("destaques") or [], start=1))

    palcos = sorted({papel for _, _, papel, _ in onde})
    anos = sorted({a for _, a, _, _ in onde if a.isdigit()})
    eventos = sorted({pr["name"] for pr, _, _, _ in onde})
    resumo = (f'{nome} aparece em {plural(len(onde), "edição", "edições")} '
              f'deste acervo, em {plural(len(eventos), "evento", "eventos")}'
              + (f', entre {anos[0]} e {anos[-1]}' if len(anos) > 1 else
                 f', em {anos[0]}' if anos else '') + '.')

    linhas = []
    for pr, ano, papel, fonte in onde:
        _ids = [x for x in pr["years"] if ano.isdigit() and ano_de(x) == int(ano)]
        href = (f'{p}projetos/{pr["slug"]}/{_ids[0]}/' if len(_ids) == 1
                else f'{p}projetos/{pr["slug"]}/')
        linhas.append(f"""<tr><th scope="row"><a href="{href}">{e(pr['name'])}</a></th>
<td>{e(ano) if ano.isdigit() else '—'}</td><td>{e(papel)}</td><td>{fonte_link(fonte)}</td></tr>""")
    tabela = f"""<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Evento</th><th scope="col">Ano</th><th scope="col">Apresentação</th>
<th scope="col">Fonte</th></tr></thead><tbody>{''.join(linhas)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver a apresentação e a fonte.</p>"""

    todos = artistas_indexados()
    vizinhos = [n for n in sorted(todos, key=lambda x: x.lower()) if n != nome]
    i = 0
    for j, n in enumerate(sorted(todos, key=lambda x: x.lower())):
        if n == nome:
            i = j
            break
    perto = (vizinhos[max(0, i - 2):i] + vizinhos[i:i + 4])[:4]
    relacionados = "".join(
        ficha_simples(n, todos[n][0][2], "", f'artistas/{slugify(n)}/', depth) for n in perto)

    ld = {"@context": "https://schema.org", "@type": "Person", "name": nome,
          "url": f"{BASE}/artistas/{alvo}/",
          "description": f"{nome}: {onde[0][2]}"}
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="container atleta-hero">
<a class="back" href="{p}artistas/">{icon('arrow_back')} Todos os artistas</a>
<div class="atleta-topo"><div class="atleta-retrato">{img}</div>
<div><h1>{e(nome)}<span class="orange">.</span></h1>
<p class="lede">{e(ficha.get('bio') or onde[0][2])}</p>
<div class="taglist"><span>{icon('music_note')} {e(onde[0][2])}</span>
<span>{icon('calendar_month')} {plural(len(onde), 'edição no acervo', 'edições no acervo')}</span></div></div></div></section>
<section class="container facts-section"><hr class="rule">
<h2 class="section-title">DOSSIÊ<br><em>DO ARTISTA.</em></h2>
<div class="facts">{destaques or f'<div class="fact"><span class="n">01</span><p>{e(resumo)}</p></div>'}</div>
</section>
<section class="container reach-section"><hr class="rule">
<h2 class="section-title">NO ACERVO<br><em>DA CADILLAC.</em></h2>
<p class="body-copy">As edições deste acervo em que a apresentação está registrada, da mais
recente para a mais antiga.</p>
{tabela}</section>
<section class="container reach-section"><hr class="rule">
<h2 class="section-title">OUTROS NOMES<br><em>DO ELENCO.</em></h2>
<div class="atletas-grid">{relacionados}</div>
<div class="section-end"><a class="pill-link" href="{p}artistas/">Ver o elenco {icon('arrow_outward')}</a></div></section>
<section class="container sources"><hr class="rule">
<h2>SOBRE ESTA FICHA.</h2>
{paragrafo_nota(MODEL['elenco']['note'])}</section></main>"""
    return write(f"artistas/{alvo}/index.html",
                 head(depth, f"{nome} | Artistas | Cadillac Produções",
                      f"{nome}: {onde[0][2]}. Edições do acervo Cadillac em que a apresentação "
                      f"está registrada, com fonte.",
                      f"artistas/{alvo}/", [ld, trail_ld])
                 + header(depth, "produtora") + body + footer(depth))


def page_atletas():
    depth, p = 1, rel(1)
    data = MODEL["atletas"]
    trail_html, trail_ld = crumbs(depth, [("Atletas", None)])
    grupos = []
    for chave, (titulo, desc, ic) in data["grupos"].items():
        # Maior "ordem" primeiro; o nome desempata para a lista nao dancar
        # entre builds quando duas fichas tem o mesmo peso.
        gente = sorted([x for x in data["lista"] if x["grupo"] == chave],
                       key=lambda y: (-(y.get("ordem") or 0), y["nome"]))
        if not gente:
            continue
        grupos.append(f"""<section class="container reach-section" id="{chave}"><hr class="rule">
<div class="area-head"><div><h2>{e(titulo)}<span class="orange">.</span></h2><p class="lede">{e(desc)}</p></div></div>
<div class="atletas-grid">{''.join(ficha_atleta_card(x, depth) for x in gente)}</div></section>""")
    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "Atletas",
          "url": f"{BASE}/atletas/", "inLanguage": "pt-BR",
          "mainEntity": {"@type": "ItemList", "numberOfItems": len(data["lista"]),
                         "itemListElement": [
                             {"@type": "ListItem", "position": i, "name": x["nome"],
                              "url": f"{BASE}/atletas/{x['slug']}/"}
                             for i, x in enumerate(data["lista"], start=1)]}}
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>ATLETAS<span class="orange">.</span></h1>
<p class="lede">{e(data['lede'])}</p></section>
{''.join(grupos)}
<section class="container reach-section"><hr class="rule">
<h2 class="section-title">O QUE AINDA<br><em>PRECISA SER CONFIRMADO.</em></h2>
<ul class="pendencias">{''.join(f'<li>{icon("search")} {e(t)}</li>' for t in data.get("pendencias", []))}</ul>
{paragrafo_nota(data['nota'])}</section></main>"""
    return write("atletas/index.html",
                 head(depth, "Atletas | Quem compete nos eventos | Cadillac Produções",
                      "Fichas dos atletas que competem nos projetos da Cadillac: trajetória "
                      "documentada, edições em que aparecem e a fonte de cada informação.",
                      "atletas/", [ld, trail_ld]) + header(depth, "atletas") + body + footer(depth))


def page_atleta(x):
    depth, p = 2, rel(2)
    data = MODEL["atletas"]
    titulo_grupo, _, ic_grupo = data["grupos"][x["grupo"]]
    trail_html, trail_ld = crumbs(depth, [("Atletas", p + "atletas/"), (x["nome"], None)])

    foto = ROOT / "assets" / "fotos" / (x.get("foto") or "")
    if x.get("foto") and foto.exists():
        credito = MODEL["photos"].get("creditos", {}).get("atletas", "")
        img = (f'<figure class="atleta-figura">'
               + figura(f'assets/fotos/{x["foto"]}', x["nome"], depth,
                        "pessoa-foto", MEDIDAS_RETRATO)
               + (f'<figcaption>{icon("photo_camera")} {e(credito)}</figcaption>' if credito else "")
               + "</figure>")
    else:
        img = slot(x.get("foto") or f'{x["slug"]}.jpg', "1:1", x["nome"], "slot-retrato", depth)

    destaques = "".join(
        f'<div class="fact"><span class="n">{i:02d}</span><p>{e(t)}'
        + (f'<small class="out">{fonte_link(f, "")}</small>' if f else "")
        + "</p></div>"
        for i, (t, f) in enumerate(x.get("destaques") or [], start=1))

    by_slug = {pr["slug"]: pr for pr in PROJECTS}
    linhas = []
    for v in sorted(x.get("participacoes") or [], key=lambda v: -(v.get("ano") or 0)):
        pr = by_slug.get(v["projeto"])
        if not pr:
            continue
        _ids = [x for x in pr["years"] if v.get("ano") and ano_de(x) == v["ano"]]
        href = (f'{p}projetos/{pr["slug"]}/{_ids[0]}/' if len(_ids) == 1
                else f'{p}projetos/{pr["slug"]}/')
        quando = str(v["ano"]) if v.get("ano") else "—"
        linhas.append(f"""<tr><th scope="row"><a href="{href}">{e(pr['name'])}</a></th>
<td>{quando}</td><td>{e(v['papel'])}</td><td>{fonte_link(v.get('fonte'))}</td></tr>""")
    tabela = (f"""<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Evento</th><th scope="col">Ano</th><th scope="col">Participação</th>
<th scope="col">Fonte</th></tr></thead><tbody>{''.join(linhas)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver a participação e a fonte.</p>"""
              if linhas else '<p class="note">Nenhuma participação catalogada neste acervo até agora.</p>')

    outros = [o for o in data["lista"] if o["grupo"] == x["grupo"] and o["slug"] != x["slug"]][:4]
    relacionados = "".join(ficha_atleta_card(o, depth) for o in outros)

    ld = {"@context": "https://schema.org", "@type": "Person", "name": x["nome"],
          "url": f"{BASE}/atletas/{x['slug']}/", "jobTitle": x["modalidade"],
          "description": x.get("bio") or x["modalidade"]}
    if x.get("apelido"):
        ld["alternateName"] = x["apelido"]

    apelido = f'<span class="atleta-apelido">{e(x["apelido"])}</span>' if x.get("apelido") else ""
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="container atleta-hero">
<a class="back" href="{p}atletas/">{icon('arrow_back')} Todos os atletas</a>
<div class="atleta-topo"><div class="atleta-retrato">{img}</div>
<div><h1>{e(x['nome'])}<span class="orange">.</span></h1>{apelido}
<p class="lede">{e(x.get('bio') or '')}</p>
<div class="taglist"><span>{icon('skateboarding')} {e(x['modalidade'])}</span>
<span>{icon(ic_grupo)} {e(titulo_grupo)}</span></div></div></div></section>
<section class="container facts-section"><hr class="rule">
<h2 class="section-title">DOSSIÊ<br><em>DO ATLETA.</em></h2>
<div class="facts">{destaques or '<p class="note">Sem registro levantado até agora.</p>'}</div></section>
<section class="container reach-section"><hr class="rule">
<h2 class="section-title">NO ACERVO<br><em>DA CADILLAC.</em></h2>
<p class="body-copy">As edições deste acervo em que o atleta aparece, da mais recente para a mais antiga.</p>
{tabela}</section>
<section class="container reach-section"><hr class="rule">
<h2 class="section-title">OUTROS NOMES<br><em>DA MESMA FRENTE.</em></h2>
<div class="atletas-grid">{relacionados}</div>
<div class="section-end"><a class="pill-link" href="{p}atletas/">Ver todos os atletas {icon('arrow_outward')}</a></div></section>
<section class="container sources"><hr class="rule">
<h2>FONTE DESTA FICHA.</h2>{source_list([x["fonte"]] if x.get("fonte") else [])}
{paragrafo_nota(data['nota'])}</section></main>"""
    return write(f"atletas/{x['slug']}/index.html",
                 head(depth, f"{x['nome']} | Atletas | Cadillac Produções",
                      f"{x['nome']}, {x['modalidade'].lower()}: trajetória documentada e as edições "
                      f"do acervo Cadillac em que o atleta aparece, com fontes.",
                      f"atletas/{x['slug']}/", [ld, trail_ld])
                 + header(depth, "atletas") + body + footer(depth))


def page_produtora():
    depth, p = 1, rel(1)
    d = MODEL["produtora"]
    trail_html, trail_ld = crumbs(depth, [("Produtora", None)])

    h = d["historia"]
    def marco(m):
        ano, t, txt = m[0], m[1], m[2]
        alvo = m[3] if len(m) > 3 else ""
        corpo = (f'<span class="fase-ano">{e(ano)}</span>'
                 f'<div><strong>{e(t)}</strong><p>{e(txt)}</p>'
                 + (f'<span class="fase-ir">Ver a edição {icon("arrow_outward")}</span>' if alvo else "")
                 + '</div>')
        if alvo:
            return f'<a class="fase fase-link" href="{p}{alvo}">{corpo}</a>'
        return f'<div class="fase">{corpo}</div>'

    marcos = "".join(marco(m) for m in h["marcos"])

    man = d["manifesto"]
    linhas = "".join(f'<p class="manifesto-linha">{e(x)}</p>' for x in man["linhas"])
    corpo = "".join(f"<p>{e(x)}</p>" for x in man["texto"].split("\n\n"))

    n_atletas = len(MODEL["atletas"]["lista"])
    n_socios = sum(1 for x in MODEL["pessoas"]["equipe"] if x["tipo"] == "nucleo")
    n_equipe = len(MODEL["pessoas"]["equipe"])
    n_artistas = len({nome for b in MODEL["elenco"]["por_edicao"].values()
                      for nome, _ in b.get("artistas", [])})
    def ficha_pessoa(nome, papel, foto, href=""):
        """Retrato quando o arquivo existe; iniciais quando não. Nunca um vazio."""
        arq = ROOT / "assets" / "fotos" / foto if foto else None
        if arq and arq.exists():
            visual = (f'<img src="{p}assets/fotos/{e(foto)}" alt="" loading="lazy" '
                      f'decoding="async" width="800" height="800">')
        else:
            iniciais = "".join(x[0] for x in nome.split()[:2]).upper()
            visual = f'<span class="iniciais" aria-hidden="true">{e(iniciais)}</span>'
        corpo = (f'<span class="pess-retrato">{visual}</span>'
                 f'<strong>{e(nome)}</strong>'
                 f'<span class="pess-papel">{e(papel)}</span>')
        if href:
            return f'<a class="pess" href="{p}{href}">{corpo}</a>'
        return f'<div class="pess">{corpo}</div>'

    def grupo_pessoas(titulo, itens, alvo, rotulo_alvo):
        if not itens:
            return ""
        fichas = "".join(ficha_pessoa(*x) for x in itens)
        return (f'<div class="time-grupo"><div class="time-grupo-cab">'
                f'<h3>{e(titulo)}</h3>'
                f'<a class="pill-link" href="{p}{alvo}">{e(rotulo_alvo)} {icon("arrow_outward")}</a>'
                f'</div><div class="pess-grid">{fichas}</div></div>')

    equipe = ([(x["nome"], x.get("cargo", ""), x.get("foto", ""), f'equipe/{x["slug"]}/')
               for x in MODEL["pessoas"]["equipe"] if x.get("tipo") == "nucleo"]
              + [(x["nome"], x.get("cargo", ""), x.get("foto", ""), f'equipe/{x["slug"]}/')
                 for x in MODEL["pessoas"]["equipe"] if x.get("tipo") != "nucleo"])
    atletas = [(a["nome"], a.get("modalidade", ""), a.get("foto", ""),
                f'atletas/{a["slug"]}/') for a in MODEL["atletas"]["lista"]]
    vistos, artistas = set(), []
    for ed in MODEL["elenco"]["por_edicao"].values():
        for nome, papel in ed.get("artistas", []):
            if nome in vistos:
                continue
            vistos.add(nome)
            artistas.append((nome, papel, "", f"artistas/{slugify(nome)}/"))

    time_cards = (
        grupo_pessoas("Equipe", equipe, "equipe/", "Ver a equipe")
        + grupo_pessoas("Atletas", atletas, "atletas/", "Ver as fichas")
        + grupo_pessoas("Artistas", artistas, "artistas/", "Ver o elenco"))

    ess = d["essencia"]
    # Os quatro principios eram quatro secoes de largura inteira, cada uma com
    # um titulo gigante e um paragrafo de 110 caracteres por linha. Quem lia
    # rolava quatro telas para quatro frases, e a linha comprida demais cansa.
    # Em grade de dois por dois cabem numa tela so, com medida de leitura.
    cartoes = "".join(
        f'<article class="essencia-item" id="{bid}">'
        f'<h3>{e(t)}<span class="orange">.</span></h3><p>{e(txt)}</p></article>'
        for bid, t, ic, txt in ess["blocos"])

    ld = {"@context": "https://schema.org", "@type": "AboutPage", "name": "Produtora",
          "url": f"{BASE}/produtora/", "inLanguage": "pt-BR"}
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>PRODUTORA<span class="orange">.</span></h1>
<p class="lede">{e(d['lede'])}</p></section>

<section class="container plano-section" id="historia"><hr class="rule">
<h2 class="section-title">{e(h['titulo']).upper()}{f'<br><em>{e(h["lede"])}</em>' if h.get('lede') else '<span class="orange">.</span>'}</h2>
<div class="fases">{marcos}</div>
{f'{paragrafo_nota(h["nota"])}' if h.get('nota') else ''}</section>

<section class="container resumo-section" id="manifesto"><hr class="rule">
<div class="resumo-grid"><div><h2 class="section-title">{e(man['titulo']).upper()}<span class="orange">.</span></h2>
<div class="manifesto-linhas">{linhas}</div></div><div class="manifesto-corpo">{corpo}</div></div></section>

<section class="container reach-section" id="time"><hr class="rule">
<h2 class="section-title">NOSSO<br><em>TIME.</em></h2>
<div class="time-todos">{time_cards}</div></section>

<section class="container reach-section" id="essencia"><hr class="rule">
<h2 class="section-title">{e(ess['titulo']).upper()}<span class="orange">.</span></h2>
{paragrafo_nota(ess.get('aviso'))}
<div class="essencia-grade">{cartoes}</div></section></main>"""
    return write("produtora/index.html",
                 head(depth, "Produtora | História, manifesto e essência | Cadillac Produções",
                      "A Cadillac Produções e Filmes: história documentada, manifesto, time e os "
                      "princípios que orientam a operação dos projetos.",
                      "produtora/", [ld, trail_ld])
                 + header(depth, "produtora") + body + footer(depth))


def ficha_artista_card(nome, papel, onde, depth):
    """Mesmo cartão dos atletas. Sem retrato no acervo, entram as iniciais."""
    p = rel(depth)
    href = f'{p}artistas/{slugify(nome)}/'
    iniciais = "".join(x[0] for x in nome.split()[:2]).upper()
    return f"""<a class="atleta-card" href="{href}">
<span class="pessoa-foto pessoa-iniciais" aria-hidden="true">{e(iniciais)}</span>
<div class="atleta-info"><h3>{e(nome)}</h3>
<span class="atleta-mod">{icon('music_note')} {e(papel)}</span>
<span class="atleta-n">{plural(len(onde), 'edição no acervo', 'edições no acervo')}</span></div></a>"""


def page_artistas():
    depth, p = 1, rel(1)
    trail_html, trail_ld = crumbs(depth, [("Artistas", None)])
    by_slug = {x["slug"]: x for x in PROJECTS}
    nomes = {}
    for chave, bloco in MODEL["elenco"]["por_edicao"].items():
        slug, _, ano = chave.rpartition("-")
        if not slug or slug not in by_slug:
            slug, ano = chave, ""
        if slug not in by_slug:
            continue
        for nome, papel in bloco.get("artistas", []):
            nomes.setdefault(nome, []).append((by_slug[slug], ano, papel, bloco.get("fonte")))

    # Ordem de importancia. O unico sinal documentado aqui e quantas edicoes do
    # acervo cada nome assina: a lista era alfabetica, o que punha 2zdinizz na
    # frente de Nacao Zumbi. Quem aparece em mais edicoes vem primeiro, e o
    # alfabeto desempata. O campo elenco.ordem permite corrigir a mao.
    peso = MODEL["elenco"].get("ordem") or {}
    cartoes = []
    for nome in sorted(nomes, key=lambda x: (-(peso.get(x) or len(nomes[x])), x.lower())):
        onde = sorted(nomes[nome], key=lambda v: -(int(v[1]) if v[1].isdigit() else 0))
        cartoes.append(ficha_artista_card(nome, onde[0][2], onde, depth))

    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "Artistas",
          "url": f"{BASE}/artistas/", "inLanguage": "pt-BR",
          "mainEntity": {"@type": "ItemList", "numberOfItems": len(nomes),
                         "itemListElement": [
                             {"@type": "ListItem", "position": i, "name": n}
                             for i, n in enumerate(sorted(nomes, key=lambda x: x.lower()), start=1)]}}
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>ARTISTAS<span class="orange">.</span></h1>
<p class="lede">Quem passou pelos palcos dos projetos do acervo, com a edição em que cada
apresentação está registrada. {plural(len(nomes), 'nome catalogado', 'nomes catalogados')}.</p></section>
<section class="container reach-section"><hr class="rule">
<h2 class="sr-only">Artistas catalogados</h2>
<div class="atletas-grid">{''.join(cartoes)}</div></section>
<section class="container reach-section"><hr class="rule">
{paragrafo_nota(MODEL['elenco']['note'])}</section></main>"""
    return write("artistas/index.html",
                 head(depth, "Artistas | Quem passou pelos palcos | Cadillac Produções",
                      "Artistas e bandas registrados nas edições dos projetos Cadillac, com a "
                      "apresentação e a fonte de cada participação.",
                      "artistas/", [ld, trail_ld])
                 + header(depth, "produtora") + body + footer(depth))


def formulario(bid, form, caixa, depth):
    """Formulario que muda conforme a resposta, sem servidor.

    O site e estatico: nao ha para onde postar. O envio monta um e-mail com os
    campos preenchidos e o rotulo de cada um, na ordem do formulario, e abre o
    programa de e-mail da pessoa. Chega organizado, e quem envia ve o que
    enviou.

    Campo com "so_se" fica escondido ate a resposta que o convoca aparecer:
    quem vem oferecer um show nao precisa ler as perguntas de atleta.
    """
    campos = []
    for c in form["campos"]:
        nid = f'{bid}-{c["nome"]}'
        req = " required" if c.get("obrig") else ""
        cond = ""
        if c.get("so_se"):
            alvo, valor = next(iter(c["so_se"].items()))
            cond = f' data-so-se="{bid}-{e(alvo)}" data-valor="{e(valor)}" hidden'
        if c["tipo"] == "select":
            opts = "".join(f'<option>{e(o)}</option>' for o in c["opcoes"])
            entrada = f'<select id="{nid}" name="{e(c["rotulo"])}"{req}><option value="">Selecione</option>{opts}</select>'
        elif c["tipo"] == "textarea":
            entrada = f'<textarea id="{nid}" name="{e(c["rotulo"])}" rows="4"{req}></textarea>'
        else:
            entrada = f'<input id="{nid}" name="{e(c["rotulo"])}" type="{c["tipo"]}"{req}>'
        dica = f'<small class="campo-dica">{e(c["dica"])}</small>' if c.get("dica") else ""
        campos.append(f'<p class="campo"{cond}><label for="{nid}">{e(c["rotulo"])}'
                      + ("" if c.get("obrig") else ' <span>opcional</span>')
                      + f'</label>{entrada}{dica}</p>')
    # O formulario fica atras de um botao. Aberto de uma vez, uma pagina com
    # cinco deles vira uma parede de campos e ninguem acha o que procura.
    return f"""<details class="form-abre" id="form-{bid}">
<summary class="pill-link">{e(form['titulo'])} {icon('arrow_forward')}</summary>
<div class="form-corpo">
<form class="form-rel" data-form="{bid}" data-caixa="{e(caixa)}"
      data-assunto="{e(form['titulo'])}">
<p class="form-intro">{e(form['intro'])}</p>
<div class="campos">{''.join(campos)}</div>
<div class="form-pe"><button type="submit" class="pill-link">Enviar {icon('mail')}</button>
<small>Abre seu programa de e-mail com tudo preenchido. Anexo, se houver, entra ali.</small></div>
</form></div></details>"""


def contatos_rapidos(depth, titulo="Prefere outro caminho"):
    """Os canais diretos, repetidos depois de cada formulario."""
    c = MODEL["contato"]
    linhas = []
    for nome, valor, ic in c["canais"]:
        if not valor:
            continue
        if nome == "E-mail":
            alvo = f'mailto:{valor}'
        elif nome == "Telefone":
            alvo = 'tel:' + so_digitos(valor)
        elif nome == "WhatsApp":
            alvo = 'https://wa.me/' + so_digitos(valor).lstrip("+")
        elif nome == "Instagram":
            alvo = f'https://instagram.com/{valor.lstrip("@")}'
        else:
            alvo = valor if valor.startswith("http") else "#"
        fora = ' target="_blank" rel="noopener noreferrer"' if alvo.startswith("http") else ""
        linhas.append(f'<a href="{e(alvo)}"{fora}>{icon(ic)} <span>{e(valor)}</span></a>')
    if not linhas:
        return ""
    return (f'<div class="contatos-rapidos"><span class="cr-titulo">{e(titulo)}</span>'
            f'<div class="cr-links">{"".join(linhas)}</div></div>')


def page_relacionamento():
    depth, p = 1, rel(1)
    d = MODEL["relacionamento"]
    trail_html, trail_ld = crumbs(depth, [("Relacionamento", None)])
    # Os mesmos logotipos do mural da home e da pagina de parceiros. Aqui a
    # secao mostrava so o nome em texto, de quando nenhum arquivo existia.
    marcas_cel = []
    for c in MODEL["clientes"]["itens"]:
        arq = ROOT / "assets" / "marcas" / c["logo"]
        alt = c.get("altura")
        estilo = f' style="--logo-h:{int(alt)}px"' if alt else ""
        if arq.exists():
            lw, lh = dimensoes(f'assets/marcas/{c["logo"]}')
            visual = (f'<img src="{p}assets/marcas/{e(c["logo"])}" alt="{e(c["nome"])}" '
                      f'width="{lw}" height="{lh}" loading="lazy" decoding="async">')
        else:
            visual = f'<span class="logo-slot"><strong>{e(c["nome"])}</strong></span>'
        marcas_cel.append(
            f'<a class="logo-item" href="{p}projetos/{e(c["projeto"])}/" '
            f'title="{e(c["papel"])}"{estilo}>{visual}'
            f'<span class="logo-papel">{e(c["papel"])}</span></a>')
    marcas = "".join(marcas_cel)
    caixa = d.get("contato_form", {}).get("email") or SITE["email"]
    by_slug = {pr["slug"]: pr for pr in PROJECTS}
    blocos = []
    for b in d["blocos"]:
        itens = "".join(f'<li>{icon("arrow_forward")} {e(x)}</li>' for x in b.get("itens") or [])
        pend = paragrafo_nota(b.get("pendencia"))
        extra = ""
        if b["id"] == "marcas":
            extra = f'<div class="logo-wall">{marcas}</div>'
        if b.get("propriedades"):
            # as propriedades que se patrocinam, cada uma levando a propria pagina
            # Dois caminhos por propriedade: conhecer ou patrocinar. O segundo
            # abre o formulario do bloco com a propriedade ja escolhida.
            cartoes = "".join(
                f'<article class="prop-card">'
                f'<h3>{e(nome)}</h3><p>{e(desc)}</p>'
                f'<div class="prop-pe">'
                f'<a class="prop-ver" href="{p}projetos/{e(slug)}/">'
                f'Ver a propriedade {icon("arrow_outward")}</a>'
                + (f'<button type="button" class="prop-quero" '
                   f'data-abre="form-{b["id"]}" data-campo="{b["id"]}-propriedade" '
                   f'data-escolha="{e(nome)}">Quero patrocinar {icon("campaign")}</button>'
                   if b.get("form") else "")
                + '</div></article>'
                for slug, nome, desc in b["propriedades"] if slug in by_slug)
            extra += (f'<div class="prop-grade">{cartoes}</div>'
                      + paragrafo_nota(b.get("propriedades_nota")))
        if b.get("atuais"):
            linhas = "".join(f'<tr><th scope="row">{e(n)}</th><td>{e(cat)}</td></tr>'
                             for n, cat in b["atuais"])
            extra += (f'<h3 class="sub-titulo">Quem já atende a operação</h3>'
                      f'<div class="table-wrap"><table class="amounts"><tbody>{linhas}</tbody>'
                      f'</table></div>')
        form = (formulario(b["id"], b["form"], caixa, depth) + contatos_rapidos(depth)
                if b.get("form") else
                f'<div class="section-end"><a class="pill-link" href="{p}contato/">'
                f'Falar com a produção {icon("mail")}</a></div>')
        blocos.append(f"""<section class="container reach-section" id="{b['id']}"><hr class="rule">
<h2 class="section-title">{e(b['titulo']).upper()}<span class="orange">.</span></h2>
<p class="body-copy">{e(b['texto'])}</p>
{f'<ul class="entrega">{itens}</ul>' if itens else ''}{extra}{pend}
{form}</section>""")
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": "Relacionamento",
          "url": f"{BASE}/relacionamento/", "inLanguage": "pt-BR"}
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>RELACIONAMENTO<span class="orange">.</span></h1>
<p class="lede">{e(d['lede'])}</p></section>
{''.join(blocos)}
<section class="container reach-section"><hr class="rule">
{paragrafo_nota(d['nota'])}</section></main>"""
    return write("relacionamento/index.html",
                 head(depth, "Relacionamento | Patrocínio e novos negócios | Cadillac Produções",
                      "Patrocínios, marcas e ativações, novos negócios, fornecedores e talentos: "
                      "os caminhos para trabalhar com a Cadillac.",
                      "relacionamento/", [ld, trail_ld])
                 + header(depth, "relacionamento") + body + footer(depth))


def _secao_gov(s):
    """Uma secao de documento: paragrafos, listas, tabela, dados e destaques."""
    partes = [f'<h2>{e(s["titulo"])}</h2>']
    for par in s.get("paragrafos", []):
        partes.append(f'<p>{e(par)}</p>')
    if s.get("dados"):
        linhas = "".join(
            f'<tr><th scope="row">{e(k)}</th>'
            f'<td>{e(v) if v else "<span class=\"gov-falta\">a informar</span>"}</td></tr>'
            if v else
            f'<tr><th scope="row">{e(k)}</th>'
            f'<td><span class="gov-falta">{icon("search")} a informar</span></td></tr>'
            for k, v in s["dados"])
        partes.append(f'<div class="table-wrap"><table class="amounts gov-dados">'
                      f'<tbody>{linhas}</tbody></table></div>')
    if s.get("lista"):
        itens = "".join(f'<li>{icon("arrow_forward")} {e(x)}</li>' for x in s["lista"])
        partes.append(f'<ul class="entrega">{itens}</ul>')
    if s.get("numerada"):
        itens = "".join(f'<li>{e(x)}</li>' for x in s["numerada"])
        partes.append(f'<ol class="gov-passos">{itens}</ol>')
    if s.get("tabela"):
        tb = s["tabela"]
        cab = "".join(f'<th scope="col">{e(c)}</th>' for c in tb["cabecalho"])
        corpo = "".join('<tr>' + "".join(
            (f'<th scope="row">{e(c)}</th>' if i == 0 else f'<td>{e(c)}</td>')
            for i, c in enumerate(linha)) + '</tr>' for linha in tb["linhas"])
        partes.append(f'<div class="table-wrap"><table class="amounts">'
                      f'<thead><tr>{cab}</tr></thead><tbody>{corpo}</tbody></table></div>')
    if s.get("destaque"):
        partes.append(f'<p class="gov-destaque">{e(s["destaque"])}</p>')
    if s.get("aviso"):
        partes.append(f'<div class="papel-card gov-aviso"><h3>Por que não há '
                      f'formulário aqui</h3><p>{e(s["aviso"])}</p></div>')
    return f'<section class="gov-secao">{"".join(partes)}</section>'


def page_governanca_doc(doc):
    depth, p = 2, rel(2)
    d = MODEL["governanca"]
    rotulo, explica = d["estados"][doc["estado"]]
    classe_estado = "gov-vigente" if doc["estado"] == "vigente" else ""
    trail_html, trail_ld = crumbs(depth, [("Governança e políticas", p + "governanca/"),
                                          (doc["titulo"], None)])
    irmas = "".join(
        f'<a href="{p}governanca/{e(o["slug"])}/">{icon(o["icone"])} {e(o["titulo"])}</a>'
        for o in d["itens"] if o["slug"] != doc["slug"])
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": doc["titulo"],
          "url": f'{BASE}/governanca/{doc["slug"]}/', "inLanguage": "pt-BR",
          "isPartOf": {"@type": "WebPage", "name": d["titulo"],
                       "url": f"{BASE}/governanca/"}}
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><p class="gov-tipo">{icon(doc['icone'])} {e(doc['tipo'])}</p>
<h1>{e(doc['titulo']).upper()}<span class="orange">.</span></h1>
<p class="lede">{e(doc['resumo'])}</p>
<dl class="gov-ficha"><div><dt>Documento</dt><dd>{e(doc['codigo'])}</dd></div>
<div><dt>Versão</dt><dd>{e(doc['versao'])}</dd></div>
<div><dt>Situação</dt><dd>{e(rotulo)}</dd></div>
{f'<div><dt>Aprovado em</dt><dd>{e(dia_mes(doc["aprovado_em"], True))}</dd></div>' if doc.get('aprovado_em') else ''}
<div><dt>Atualizado em</dt><dd>{e(dia_mes(MODEL['updated'], True))}</dd></div></dl>
<div class="papel-card gov-estado {classe_estado}"><h2>{icon('verified') if doc['estado'] == 'vigente' else icon('search')} {e(rotulo)}</h2><p>{e(explica)}</p></div>
</section>
<section class="container gov-corpo">{''.join(_secao_gov(s) for s in doc['secoes'])}</section>
<section class="container gov-irmas"><h2 class="section-title">OUTROS<em> DOCUMENTOS.</em></h2>
<div class="gov-links">{irmas}<a class="gov-volta" href="{p}governanca/">{icon('arrow_outward')} Governança e políticas</a></div></section></main>"""
    return write(f'governanca/{doc["slug"]}/index.html',
                 head(depth, f'{doc["titulo"]} | Cadillac Produções', doc["resumo"],
                      f'governanca/{doc["slug"]}/', [ld, trail_ld])
                 + header(depth, "governanca") + body + footer(depth))


def page_governanca():
    depth, p = 1, rel(1)
    d = MODEL["governanca"]
    trail_html, trail_ld = crumbs(depth, [("Governança e políticas", None)])
    cartoes = "".join(
        f'<a class="gov-card" href="{p}governanca/{e(it["slug"])}/">'
        f'<span class="svc-i">{icon(it["icone"])}</span>'
        f'<h3>{e(it["titulo"])}</h3><p>{e(it["resumo"])}</p>'
        f'<span class="gov-card-pe"><small>{e(it["codigo"])} · versão {e(it["versao"])}</small>'
        f'{icon("arrow_outward")}</span></a>'
        for it in d["itens"])
    pend = "".join(f'<tr><th scope="row">{e(k)}</th><td>{e(v)}</td></tr>'
                   for k, v in d["pendencias"]["itens"])
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": d["titulo"],
          "url": f"{BASE}/governanca/", "inLanguage": "pt-BR",
          "hasPart": [{"@type": "WebPage", "name": it["titulo"],
                       "url": f'{BASE}/governanca/{it["slug"]}/'} for it in d["itens"]]}
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>GOVERNANÇA<br>E POLÍTICAS<span class="orange">.</span></h1>
<p class="lede">{e(d['lede'])}</p>
<div class="papel-card gov-estado gov-vigente"><h2>{icon('verified')} Aprovados e em vigor</h2>
<p>{e(d['aviso'])}</p></div></section>
<section class="container gov-grade"><h2 class="sr-only">Documentos de governança</h2>{cartoes}</section>
<section class="container reach-section"><h2 class="section-title">{e(d['pendencias']['titulo']).upper()}<span class="orange">.</span></h2>
<div class="table-wrap"><table class="amounts"><tbody>{pend}</tbody></table></div></section></main>"""
    return write("governanca/index.html",
                 head(depth, "Governança e políticas | Cadillac Produções",
                      "Código de ética, código de conduta, política de privacidade, política de "
                      "cookies, preferências e canal de ética da Cadillac Produções e Filmes.",
                      "governanca/", [ld, trail_ld])
                 + header(depth, "governanca") + body + footer(depth))


def page_parceiros():
    """Marcas e instituicoes do acervo, em pagina propria.

    O mural da home mostra os logotipos; aqui cada um ganha o papel que exerce
    e o evento em que a relacao esta registrada, que e o que um patrocinador
    novo quer conferir.
    """
    depth, p = 1, rel(depth := 1)
    d = MODEL["clientes"]
    by_slug = {pr["slug"]: pr for pr in PROJECTS}
    trail_html, trail_ld = crumbs(depth, [("Parceiros", None)])

    cartoes, linhas = [], []
    for c in d["itens"]:
        pr = by_slug.get(c["projeto"])
        alvo = f'{p}projetos/{c["projeto"]}/'
        arq = ROOT / "assets" / "marcas" / c["logo"]
        alt = c.get("altura")
        estilo = f' style="--logo-h:{int(alt)}px"' if alt else ""
        if arq.exists():
            lw, lh = dimensoes(f'assets/marcas/{c["logo"]}')
            marca = (f'<img src="{p}assets/marcas/{e(c["logo"])}" alt="{e(c["nome"])}" '
                     f'width="{lw}" height="{lh}" loading="lazy" decoding="async">')
        else:
            marca = f'<span class="logo-slot"><strong>{e(c["nome"])}</strong></span>'
        cartoes.append(f'<a class="logo-item" href="{alvo}" title="{e(c["papel"])}"{estilo}>'
                       f'{marca}<span class="logo-papel">{e(c["papel"])}</span></a>')
        onde = (f'<a href="{alvo}">{e(pr["name"])} {icon("arrow_outward")}</a>'
                if pr else e(c["projeto"]))
        linhas.append(f'<tr><th scope="row">{e(c["nome"])}</th>'
                      f'<td>{e(c["papel"])}</td><td>{onde}</td></tr>')

    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "Parceiros",
          "url": f"{BASE}/parceiros/", "inLanguage": "pt-BR",
          "mainEntity": {"@type": "ItemList", "numberOfItems": len(d["itens"]),
                         "itemListElement": [
                             {"@type": "ListItem", "position": i, "name": c["nome"]}
                             for i, c in enumerate(d["itens"], start=1)]}}
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>PARCEIROS<span class="orange">.</span></h1>
<p class="lede">{e(d['lede'])}</p></section>
<section class="clientes"><div class="container">
<h2 class="sr-only">Marcas e instituições</h2>
<div class="logo-wall">{''.join(cartoes)}</div></div></section>
<section class="container reach-section">
<h2 class="section-title">ONDE CADA<br><em>RELAÇÃO ESTÁ REGISTRADA.</em></h2>
<div class="table-wrap"><table class="amounts">
<thead><tr><th scope="col">Parceiro</th><th scope="col">Papel</th>
<th scope="col">Evento</th></tr></thead>
<tbody>{''.join(linhas)}</tbody></table></div>
<div class="section-end"><a class="pill-link" href="{p}relacionamento/">Falar sobre parceria {icon('arrow_outward')}</a></div>
</section></main>"""
    return write("parceiros/index.html",
                 head(depth, "Parceiros | Cadillac Produções",
                      "Marcas, instituições e entidades registradas nos projetos da Cadillac: "
                      "Banco do Brasil, Prefeitura de Niterói, CBSk, IBC World Tour, Funarte e CCBB.",
                      "parceiros/", [ld, trail_ld])
                 + header(depth, "produtora") + body + footer(depth))


def page_equipe():
    depth, p = 1, rel(1)
    data = MODEL["pessoas"]
    trail_html, trail_ld = crumbs(depth, [("Equipe", None)])
    grupos = []
    for chave, (titulo, desc, ic) in data["papeis"].items():
        gente = [x for x in data["equipe"] if x["tipo"] == chave]
        if not gente:
            continue
        # Mesmo cartao de Atletas e Artistas: retrato, nome, papel, e o clique
        # leva ao perfil. A pagina mostrava fichas abertas, cada uma com a lista
        # de vinculos: o visitante lia tudo de todo mundo antes de escolher
        # alguem. O detalhe fica no perfil, que ja existe para cada pessoa.
        cartoes = "".join(
            ficha_simples(x["nome"], x.get("cargo") or titulo, x.get("foto"),
                          f'equipe/{x["slug"]}/', depth)
            for x in gente)
        grupos.append(f"""<section class="container reach-section" id="{chave}"><hr class="rule">
<div class="area-head"><div><h2>{e(titulo)}<span class="orange">.</span></h2><p class="lede">{e(desc)}</p></div></div>
<div class="atletas-grid">{cartoes}</div></section>""")
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": "Equipe",
          "url": f"{BASE}/equipe/", "inLanguage": "pt-BR"}
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>EQUIPE<span class="orange">.</span></h1>
<p class="lede">{e(data['lede'])}</p></section>
{''.join(grupos)}
<section class="container reach-section"><hr class="rule">
{paragrafo_nota(data['nota'])}</section></main>"""
    return write("equipe/index.html",
                 head(depth, "Equipe | Quem assina os eventos | Cadillac Produções",
                      "Núcleo da Cadillac, sócios por projeto, especialistas e parceiros externos, "
                      "com o papel de cada um em cada evento.",
                      "equipe/", [ld, trail_ld]) + header(depth, "sobre") + body + footer(depth))


def numeros_block(depth):
    """O acervo em poucos números, um por dimensão, com o escopo dito.

    Estrutura emprestada de como as grandes operadoras de live entertainment
    abrem os seus números: um número por dimensão, uma linha de escopo, e
    grandezas diferentes nunca no mesmo total. A diferença é a origem — aqui
    tudo é contado do próprio acervo em tempo de geração, então nenhum destes
    números pode divergir do que as páginas mostram.

    Público e audiência ficam de fora de propósito: são declarados por
    terceiros, vivem nas famílias que não se somam, e misturá-los com contagem
    de acervo criaria exatamente o número sem lastro que o resto do site evita.
    """
    cidades, estados = set(), set()
    for pr in PROJECTS:
        loc = pr.get("location", "")
        if "," in loc:
            c, uf = loc.rsplit(",", 1)
            cidades.add(c.strip()); estados.add(uf.strip())
        for ed in (pr.get("editions") or {}).values():
            for sh in (ed.get("shows") or []):
                if sh.get("cidade"):
                    cidades.add(sh["cidade"].rsplit(",", 1)[0].strip())
    edicoes = sum(len(pr.get("years") or []) for pr in PROJECTS)
    etapas = sum(len(ed.get("etapas") or [])
                 for pr in PROJECTS for ed in (pr.get("editions") or {}).values())
    shows = sum(len(ed.get("shows") or [])
                for pr in PROJECTS for ed in (pr.get("editions") or {}).values())
    fatos = sum(len(v) for pr in PROJECTS for v in (pr.get("facts") or {}).values())
    fontes = set()
    for pr in PROJECTS:
        for _, u in (pr.get("sources") or []):
            if u: fontes.add(u)
        for ys in (pr.get("yearsources") or {}).values():
            for _, u in ys:
                if u: fontes.add(u)
    artistas = set()
    for ed in MODEL["elenco"]["por_edicao"].values():
        for nome, _ in ed.get("artistas", []):
            artistas.add(nome)

    linhas = [
        (len(PROJECTS), "Eventos", "propriedades com página própria no acervo", "festival"),
        (edicoes, "Edições", "anos catalogados, de 2018 a 2027", "calendar_month"),
        (etapas + shows, "Etapas e shows", "datas individuais dentro das edições", "place"),
        (len(cidades), "Cidades", f'em {plural(len(estados), "estado", "estados")}', "public"),
        (len(MODEL["atletas"]["lista"]), "Atletas", "fichas com trajetória e participações", "skateboarding"),
        (len(artistas), "Artistas", "nomes registrados nos palcos das edições", "music_note"),
        (fatos, "Registros", "fatos com fonte identificada", "description"),
        (len(fontes), "Fontes públicas", "links para a publicação original", "language"),
    ]
    tiles = "".join(
        f'<div class="num-tile"><span class="num-ic">{icon(ic)}</span>'
        f'<strong>{n}</strong><b>{e(rot)}</b><small>{e(sub)}</small></div>'
        for n, rot, sub, ic in linhas)
    return f"""<section class="container numeros-section" id="numeros"><hr class="rule">
<h2 class="section-title">CADILLAC<br><em>EM NÚMEROS.</em></h2>
<p class="body-copy">Tudo nesta faixa é contado do próprio acervo quando a página é
gerada. Nenhum destes números é digitado à mão, e por isso nenhum deles pode divergir
do que as páginas de evento mostram.</p>
<div class="num-grid">{tiles}</div>
<p class="note">Público e audiência não entram aqui. São declarados pelas produções,
medidos de formas diferentes e organizados em famílias que não se somam — estão logo
acima, cada um com a sua origem.</p></section>


"""


def perfil_block(depth):
    """Perfil do público declarado por cada produção.

    O gráfico é de faixas, não de barras: cada projeto ocupa o trecho de idade
    que declarou, num mesmo eixo. É o que torna visível a diferença entre um
    festival de rua de 10 a 60 anos e um evento de nicho de 25 a 35 — diferença
    que a tabela só dizia por extenso. Nada aqui soma: escolher um projeto mostra
    o que ele declarou, e só.
    """
    d = MODEL.get("perfil_publico")
    if not d:
        return ""
    by_slug = {x["slug"]: x for x in PROJECTS}
    eixo = d.get("eixo", {"min": 0, "max": 80})
    lo, hi = eixo["min"], eixo["max"]
    vao = max(hi - lo, 1)

    def pct(v):
        return round((v - lo) / vao * 100, 2)

    declarados = {x["projeto"] for x in d["linhas"]}
    sem_perfil = [pr for pr in PROJECTS if pr["slug"] not in declarados]
    faixas, painéis, abas = [], [], []
    marcas = "".join(
        f'<span class="pf-marca" style="left:{pct(v)}%"><i></i><b>{v}</b></span>'
        for v in range(lo, hi + 1, 10))

    for i, x in enumerate(d["linhas"]):
        pr = by_slug.get(x["projeto"])
        nome = pr["name"] if pr else x["projeto"]
        pid = f'pf-{x["projeto"]}'
        de, ate = x["de"], x["ate"]
        faixas.append(
            f'<button type="button" class="pf-linha" role="tab" id="{pid}-aba" '
            f'aria-controls="{pid}" aria-selected="{"true" if i == 0 else "false"}" '
            f'tabindex="{"0" if i == 0 else "-1"}">'
            f'<span class="pf-nome">{e(nome)}</span>'
            f'<span class="pf-trilho"><span class="pf-faixa" '
            f'style="left:{pct(de)}%;width:{pct(ate) - pct(de)}%">'
            f'<em>{de}</em><em>{ate}</em></span></span>'
            f'<span class="pf-amp">{ate - de} anos</span></button>')

        extras = []
        g = x.get("genero")
        if g:
            extras.append(
                f'<div class="pf-extra"><h4>Gênero declarado</h4>'
                f'<div class="pf-genero"><span style="width:{g["mulheres"]}%">'
                f'{g["mulheres"]}% mulheres</span>'
                f'<span style="width:{g["homens"]}%">{g["homens"]}% homens</span></div></div>')
        if x.get("classes"):
            chips = "".join(f'<b>{e(c)}</b>' for c in x["classes"])
            extras.append(f'<div class="pf-extra"><h4>Classes declaradas</h4>'
                          f'<div class="pf-classes">{chips}</div></div>')
        if x.get("geografia"):
            tiles = "".join(f'<span><strong>{e(n)}</strong>{e(r)}</span>'
                            for n, r in x["geografia"])
            extras.append(f'<div class="pf-extra"><h4>Origem do público</h4>'
                          f'<div class="pf-geo">{tiles}</div></div>')

        ir = (f'<a class="pill-link" href="{rel(depth)}projetos/{pr["slug"]}/">'
              f'Ver o projeto {icon("arrow_outward")}</a>') if pr else ""
        painéis.append(
            f'<div class="pf-painel" id="{pid}" role="tabpanel" '
            f'aria-labelledby="{pid}-aba"{"" if i == 0 else " hidden"}>'
            f'<div class="pf-painel-topo"><h3>{e(nome)}</h3>'
            f'<span class="pf-faixa-txt">{e(x["faixa"])}</span></div>'
            f'<p>{e(x["recorte"])}</p>'
            f'{"".join(extras)}'
            f'<p class="pf-fonte">{icon("description")} Declarado em {fonte_link(x.get("fonte"))}</p>'
            f'{ir}</div>')

    if sem_perfil:
        itens = "".join(
            f'<li><a href="{rel(depth)}projetos/{pr["slug"]}/">{e(pr["name"])}</a>'
            f'<span>{e(CATS[pr["category"]]["label"])}</span></li>' for pr in sem_perfil)
        pendentes = (
            f'<div class="pf-pendentes"><h3>{plural(len(sem_perfil), "evento ainda sem perfil declarado", "eventos ainda sem perfil declarado")}</h3>'
            f'<p>Entram nesta seção quando a produção enviar o recorte de público, '
            f'com a fonte. Até lá a faixa fica vazia em vez de estimada.</p>'
            f'<ul class="pf-lista">{itens}</ul></div>')
    else:
        pendentes = ""

    leitura = "".join(
        f'<div class="pf-leitura"><span>{e(t)}</span><strong>{e(q)}</strong>'
        f'<small>{e(txt)}</small></div>'
        for t, q, txt in d.get("leitura", []))

    return f"""<section class="container reach-section" id="perfil"><hr class="rule">
<h2 class="section-title">PERFIL<br><em>DO PÚBLICO.</em></h2>
<p class="body-copy">{e(d['lede'])}</p>
<div class="pf-bloco">
<div class="pf-grafico" role="tablist" aria-label="Faixa etária declarada por evento">
<div class="pf-eixo">{marcas}</div>
{''.join(faixas)}
<p class="pf-eixo-rotulo">Idade declarada, de {lo} a {hi} anos</p></div>
<div class="pf-paineis">{''.join(painéis)}</div></div>
<div class="pf-leituras">{leitura}</div>
{pendentes}
{paragrafo_nota(d['nota'])}</section>"""


def quadro_kpis(depth):
    """Quadro de indicadores por área, com o estado de cada um.

    O quadro só tem serventia se disser também o que ainda não tem número. Um
    painel que mostrasse apenas os seis indicadores já medidos pareceria
    completo e esconderia os dez que faltam — que é a informação de que um
    patrocinador precisa para saber o que vai receber.
    """
    d = MODEL.get("kpis")
    if not d:
        return ""
    p = rel(depth)
    estados = d["estados"]
    total = sum(len(a["kpis"]) for a in d["areas"])
    contagem = collections.Counter(k[1] for a in d["areas"] for k in a["kpis"])

    resumo = "".join(
        f'<div class="kpi-resumo-item kpi-{est.replace(" ", "-")}">'
        f'<strong>{contagem.get(est, 0)}</strong><b>{e(rot)}</b><small>{e(txt)}</small></div>'
        for est, (rot, txt, _) in estados.items())

    cartoes = []
    for a in d["areas"]:
        linhas = []
        for nome, estado, alvo in a["kpis"]:
            rot = estados[estado][0]
            selo = (f'<a class="kpi-selo kpi-{estado.replace(" ", "-")}" href="{p}{alvo}">'
                    f'{icon(estados[estado][2])} {e(rot)}</a>' if alvo else
                    f'<span class="kpi-selo kpi-{estado.replace(" ", "-")}">'
                    f'{icon(estados[estado][2])} {e(rot)}</span>')
            linhas.append(f'<li><span>{e(nome)}</span>{selo}</li>')
        cartoes.append(
            f'<div class="kpi-card"><h3>{e(a["nome"])}</h3>'
            f'<ul class="kpi-lista">{"".join(linhas)}</ul></div>')

    return f"""<section class="container reach-section" id="kpis"><hr class="rule">
<h2 class="section-title">QUADRO<br><em>DE INDICADORES.</em></h2>
<p class="body-copy">{e(d['lede'])}</p>
<div class="kpi-resumo">{resumo}</div>
<p class="kpi-total">{total} indicadores em {plural(len(d['areas']), 'área', 'áreas')}.</p>
<div class="kpi-grid">{''.join(cartoes)}</div>
{paragrafo_nota(d['nota'])}</section>


"""


def impacto_block(depth):
    d = MODEL.get("impacto")
    if not d:
        return ""
    tiles = "".join(
        f"""<div class="op-tile">{icon(ic)}<strong>{e(v)}</strong><span>{e(r)}</span>
<small>{e(nota)}</small></div>"""
        for v, r, nota, ic in d["itens"])
    return f"""<section class="container reach-section" id="impacto"><hr class="rule">
<h2 class="section-title">IMPACTO<br><em>E RESULTADOS.</em></h2>
<p class="body-copy">{e(d['lede'])}</p>
<div class="op-grid">{tiles}</div>
{paragrafo_nota(d['nota'])}</section>"""


def relatorios_block(depth):
    d = MODEL.get("relatorios")
    if not d:
        return ""
    linhas = "".join(
        f"""<tr><th scope="row">{e(x['titulo'])}<small>{e(x['o_que'])}</small></th>
<td>{e(x['quando'])}</td><td>{e(x['estado'])}</td></tr>"""
        for x in d["itens"])
    return f"""<section class="container reach-section" id="relatorios"><hr class="rule">
<h2 class="section-title">RELATÓRIOS<br><em>E ESTUDOS.</em></h2>
<p class="body-copy">{e(d['lede'])}</p>
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Documento</th><th scope="col">Período</th>
<th scope="col">Situação</th></tr></thead><tbody>{linhas}</tbody></table></div>
{paragrafo_nota(d['nota'])}</section>"""


def certificacoes_block(depth):
    d = MODEL.get("certificacoes")
    if not d:
        return ""
    cards = "".join(
        f"""<div class="frente"><h3>{e(t)}</h3><p>{e(txt)}</p>
<span class="atleta-n">{fonte_link(f, "")}</span></div>"""
        for t, txt, ic, f in d["itens"])
    return f"""<section class="container reach-section" id="certificacoes"><hr class="rule">
<h2 class="section-title">CERTIFICAÇÕES<br><em>E CHANCELAS.</em></h2>
<p class="body-copy">{e(d['lede'])}</p>
<div class="frentes-grid">{cards}</div>
{paragrafo_nota(d['nota'])}</section>"""


def page_data():
    depth, p = 1, rel(1)
    trail_html, trail_ld = crumbs(depth, [("Dados", None)])
    per_year = [(str(y), n) for y, n in M["per_year"].items()]
    facts_by_project = sorted(((pr["name"], project_facts(pr)) for pr in PROJECTS),
                              key=lambda x: -x[1])
    sources_by_project = sorted(((pr["name"], len(project_sources(pr))) for pr in PROJECTS),
                                key=lambda x: -x[1])
    cat_counts = sorted(((CATS[k]["label"], sum(1 for pr in PROJECTS if pr["category"] == k))
                         for k in M["categories"]), key=lambda x: -x[1])
    panels = [
        ("stacked_bar_chart", f"{M['projects']:02d}", "Eventos indexados"),
        ("calendar_month", f"{M['editions']:02d}", "Edições com página própria"),
        ("description", f"{M['facts']:02d}", "Registros documentados"),
        ("language", f"{M['sources']:02d}", "Fontes públicas citadas"),
        ("insights", M["span"], "Período coberto nesta versão"),
    ]
    # --d leva quantos caracteres o numero tem, para o CSS poder encolher a
    # fonte quando ele for longo. Sem isso, "325.000.000" sai no mesmo corpo
    # de "500" e vaza do cartao.
    panels_html = "".join(f'<div class="data-panel">{icon(ic)}'
                          f'<div><strong style="--d:{len(str(v))}">{v}</strong>'
                          f'<span>{l}</span></div></div>' for ic, v, l in panels)
    sector_html = "".join(f'<div><strong>{e(v)}</strong><span>{e(l)}</span></div>'
                          for v, l in MODEL["sector"]["items"])
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>DADOS<span class="orange">.</span></h1>
<p class="lede">Um acervo conectado de eventos, edições, território, modalidades, cobertura e fontes públicas — com a metodologia à vista.</p></section>
{numeros_block(depth)}
{audience_blocks(depth)}
{events_table(depth)}
{broadcast_block(depth)}
<section class="container charts">
<div class="chart-card"><h3>Edições por ano</h3>
<p class="chart-sub">Quantas edições a Cadillac tem documentadas em cada ano, do mais recente ao mais antigo.</p>
<figure>{bars_vertical(per_year, ('edição', 'edições'))}
<figcaption>Série única. Ano sem barra é ano sem edição catalogada aqui, não ano sem evento.</figcaption></figure></div>
<div class="chart-card"><h3>Eventos por área de atuação</h3>
<p class="chart-sub">Distribuição do acervo entre esporte, festivais, música e cultura.</p>
<figure>{bars_horizontal(cat_counts, ('evento', 'eventos'), w=560)}
<figcaption>Cada projeto é contado em uma única área, a predominante no registro.</figcaption></figure></div>
<div class="chart-card span-2"><h3>Cobertura por projeto e ano</h3>
<p class="chart-sub">Onde há edição documentada, a célula leva direto à página da edição.</p>
{coverage_matrix(depth)}<p class="table-hint">Arraste a tabela para o lado para ver todos os anos.</p></div>
<div class="chart-card span-2"><h3>Números divulgados por terceiros</h3>
<p class="chart-sub">Público, atletas, premiações e streams que aparecem em fontes públicas — com quem divulgou e o que cada número realmente mede.</p>
{declared_table(depth)}
<p class="table-hint">Arraste a tabela para o lado para ver a atribuição e a fonte.</p></div>
</section>
{perfil_block(depth)}
{quadro_kpis(depth)}
{impacto_block(depth)}
{certificacoes_block(depth)}
<section class="container sector" id="setor"><hr class="rule">
<h2 class="section-title">O SETOR EM QUE<br><em>A GENTE OPERA.</em></h2>
<div class="hero-metrics">{sector_html}</div>
{paragrafo_nota(MODEL['sector']['note'])}</section>
</main>"""
    ld = {"@context": "https://schema.org", "@type": "Dataset",
          "name": "Acervo documental Cadillac", "url": f"{BASE}/dados/",
          "description": "Eventos, edições, registros documentados e fontes públicas catalogados no portal Cadillac.",
          "inLanguage": "pt-BR", "creator": {"@type": "Organization", "name": SITE["name"]},
          "temporalCoverage": f"{M['years'][0]}/{M['years'][-1]}"}
    return write("dados/index.html",
                 head(depth, "Dados | Métricas, cobertura e metodologia | Cadillac Produções",
                      "Métricas do acervo Cadillac: projetos, edições, registros documentados, "
                      "fontes públicas, cobertura por ano e metodologia.",
                      "dados/", [ld, trail_ld]) + header(depth, "dados") + body + footer(depth))


def page_atuacao():
    depth, p = 1, rel(1)
    data = MODEL["atuacao"]
    trail_html, trail_ld = crumbs(depth, [("Atuação", None)])
    by_slug = {pr["slug"]: pr for pr in PROJECTS}

    method = "".join(
        f'<article><span class="step-i">{icon(ic)}</span><h3>{e(title)}</h3><p>{e(text)}</p></article>'
        for title, text, ic in data["method"])

    eco = MODEL["ecossistema"]
    papeis = "".join(
        f'<article><span class="step-i">{icon(ic)}</span><h3>{e(t)}</h3><p>{e(d)}</p></article>'
        for t, d, ic in eco["roles"])
    eco_linhas = []
    for nome, papel, onde, slug, nota, confirmado in eco["entities"]:
        selo = (f'<span class="tag-ok">{icon("verified")} Fonte pública</span>' if confirmado
                else f'<span class="tag-wait">{icon("description")} A confirmar</span>')
        link = (f'<a href="{p}projetos/{slug}/">{e(onde)} {icon("arrow_outward")}</a>'
                if slug else e(onde))
        eco_linhas.append(f'<tr><th scope="row">{e(nome)}</th><td>{e(papel)}</td>'
                          f'<td>{link}</td><td>{e(nota)}<small>{selo}</small></td></tr>')
    eco_linhas = "".join(eco_linhas)
    sections, index = [], []
    for a in data["areas"]:
        index.append(f'<a class="chip" href="#{a["slug"]}">{icon(a["icon"])} {e(a["title"])}</a>')
        items = "".join(f'<li>{icon("arrow_forward")} {e(d)}</li>' for d in a["deliverables"])
        cases = []
        for c in a["cases"]:
            label, url = c["source"]
            if url == "dados":
                link = f'<a href="{p}dados/">Metodologia e indicadores {icon("arrow_outward")}</a>'
            else:
                link = (f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">'
                        f'{e(label)}</a>')
            pr = by_slug.get(c["project"]) if c["project"] else None
            thumb = ""
            if pr:
                found = photo_for(pr, c.get("year"))
                if found:
                    thumb = (f'<img class="case-thumb" src="{p}{found}" alt="" '
                             f'loading="lazy" decoding="async" width="1600" height="1000">')
                else:
                    stem = pr["slug"] + (f'-{c["year"]}' if c.get("year") else "")
                    thumb = slot(f"{stem}.jpg", "16:10", "Imagem do case", "slot-thumb")
            if pr:
                href = href_edicao(pr, c.get("year"), p)
                page = (f'<a href="{href}">{icon("arrow_outward")} '
                        f'{e(pr["name"])}{" " + str(c["year"]) if c["year"] else ""}</a>')
            else:
                page = ""
            cases.append(f"""<article class="case">{thumb}<h4>{e(c["title"])}</h4><p>{e(c["text"])}</p>
<div class="case-links">{page}{link}</div></article>""")
        sections.append(f"""<section class="container area" id="{a["slug"]}">
<div class="area-head"><div><h2>{e(a["title"])}<span class="orange">.</span></h2><p class="lede">{e(a["lede"])}</p></div></div>
<div class="area-body"><div class="area-text">{"".join(f"<p>{e(t)}</p>" for t in a["paragraphs"])}</div>
<div class="area-list"><h3>Entregas</h3><ul>{items}</ul></div></div>
<h3 class="cases-title">Case</h3>
<div class="cases">{"".join(cases)}</div></section>""")

    index.append(f'<a class="chip" href="#sobre">{icon("verified")} A Cadillac</a>')
    index.append(f'<a class="chip" href="#ecossistema">{icon("public")} Ecossistema</a>')
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>ATUAÇÃO<span class="orange">.</span></h1>
<p class="lede">{e(data["lede"])}</p>
<div class="chips area-index">{"".join(index)}</div></section>
<section class="container method-section">
<h2 class="section-title">COMO UM PROJETO<br><em>SAI DO PAPEL.</em></h2>
<div class="method">{method}</div></section>
{"".join(sections)}
<section class="container area" id="sobre">
<div class="area-head"><div><h2>A Cadillac<span class="orange">.</span></h2>
<p class="lede">{e(SITE['tagline'])}</p></div></div>
<div class="area-body"><div class="area-text">{''.join(f'<p>{e(t)}</p>' for t in SITE['institutional'])}</div>
<div class="area-list"><h3>Identificação</h3><ul>
<li>{icon('verified')} {e(SITE['legal'])}</li>
<li>{icon('description')} CNPJ {SITE['cnpj']}</li>
<li>{icon('calendar_month')} Desde {e(SITE['founded'])}</li>
<li>{icon('place')} {e(SITE['origin'])}</li>
<li>{icon('mail')} {e(SITE['email'])}</li></ul></div></div></section>
<section class="container area" id="ecossistema">
<div class="area-head"><div><h2>Ecossistema<span class="orange">.</span></h2>
<p class="lede">{e(MODEL['ecossistema']['lede'])}</p></div></div>
<h3 class="cases-title">Cada um tem um papel</h3>
<div class="method">{papeis}</div>
<h3 class="cases-title">Quem aparece nos registros</h3>
<div class="table-wrap"><table class="amounts eco-table">
<thead><tr><th scope="col">Quem</th><th scope="col">Papel</th><th scope="col">Onde</th><th scope="col">O que o registro diz</th></tr></thead>
<tbody>{eco_linhas}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver o papel e o registro.</p>
{paragrafo_nota(MODEL['ecossistema']['note'])}</section>
<section class="container related">
<h2 class="section-title">VER TUDO<br><em>NO ACERVO.</em></h2>
<p class="body-copy">Cada caso acima tem página própria, com as outras edições, os fatos documentados e as fontes completas.</p>
<div class="section-end"><a class="pill-link" href="{p}projetos/">Explorar os eventos {icon('arrow_outward')}</a></div>
<p class="note">Os casos descrevem o que está documentado em fonte pública. Onde a atribuição depende de contrato ou ficha técnica ainda em validação, o texto diz isso em vez de afirmar autoria.</p>
</section></main>"""
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": "Atuação",
          "url": f"{BASE}/atuacao/", "inLanguage": "pt-BR",
          "about": [{"@type": "Service", "name": a["title"], "description": a["lede"]}
                    for a in data["areas"]]}
    return write("atuacao/index.html",
                 head(depth, "Atuação | O que fazemos e como | Cadillac Produções",
                      "Produção executiva, esportes e circuitos, cultura, marcas e conteúdo: "
                      "o que a Cadillac faz em cada frente, com casos documentados do acervo.",
                      "atuacao/", [ld, trail_ld]) + header(depth, "atuacao") + body + footer(depth))


def page_ecossistema():
    depth, p = 1, rel(1)
    data = MODEL["ecossistema"]
    trail_html, trail_ld = crumbs(depth, [("Ecossistema", None)])
    roles = "".join(
        f'<article><span class="step-i">{icon(ic)}</span><h3>{e(title)}</h3><p>{e(desc)}</p></article>'
        for title, desc, ic in data["roles"])
    rows = []
    for name, role, where, slug, note, confirmed in data["entities"]:
        status = (f'<span class="tag-ok">{icon("verified")} Fonte pública</span>' if confirmed
                  else f'<span class="tag-wait">{icon("description")} A confirmar</span>')
        link = f'<a href="{p}projetos/{slug}/">{e(where)} {icon("arrow_outward")}</a>' if slug else e(where)
        rows.append(f"""<tr><th scope="row">{e(name)}</th><td>{e(role)}</td>
<td>{link}</td><td>{e(note)}<small>{status}</small></td></tr>""")
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>ECOSSISTEMA<span class="orange">.</span></h1>
<p class="lede">{e(data["lede"])}</p></section>
<section class="container method-section"><hr class="rule">
<h2 class="section-title">CADA UM TEM<br><em>UM PAPEL.</em></h2>
<div class="method">{roles}</div></section>
<section class="container sources"><hr class="rule">
<h2 class="section-title">QUEM APARECE<br><em>NOS REGISTROS.</em></h2>
<div class="table-wrap"><table class="amounts eco-table">
<caption>Relações identificadas em fonte pública ou informadas pela direção do projeto, organizadas por papel.</caption>
<thead><tr><th scope="col">Quem</th><th scope="col">Papel</th><th scope="col">Onde</th><th scope="col">O que o registro diz</th></tr></thead>
<tbody>{"".join(rows)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver o papel e o registro.</p>
{paragrafo_nota(data["note"])}</section></main>"""
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": "Ecossistema",
          "url": f"{BASE}/ecossistema/", "inLanguage": "pt-BR"}
    return write("ecossistema/index.html",
                 head(depth, "Ecossistema | Parceiros, entidades e fornecedores | Cadillac Produções",
                      "Quem é patrocinador, titular, organizador, produtora, entidade esportiva, "
                      "órgão público, fornecedor, artista e imprensa em cada projeto do acervo Cadillac.",
                      "ecossistema/", [ld, trail_ld]) + header(depth, "ecossistema") + body + footer(depth))


def page_agenda():
    """Toda edição, etapa e show num calendário único, do mais recente ao mais antigo."""
    depth, p = 1, rel(1)
    trail_html, trail_ld = crumbs(depth, [("Agenda", None)])
    itens = []
    for pr in PROJECTS:
        href_pr = f'{p}projetos/{pr["slug"]}/'
        for year in pr["years"]:
            ed = pr["editions"].get(str(year), {})
            href = f'{href_pr}{year}/'
            rot = rotulo_ed(pr, year)
            ano = ano_de(year)
            etapas = ed.get("etapas") or []
            shows = ed.get("shows") or []
            if not etapas and not shows:
                itens.append({"nome": f'{pr["name"]} {rot}', "tipo": "Edição",
                              "local": ed.get("place", pr["location"]), "href": href,
                              "ingressos": pr.get("ingressos", ""),
                              "datas": ed.get("datas")})
            for et in etapas:
                itens.append({"nome": f'{pr["name"]} {rot} · {et["nome"]}', "tipo": "Etapa",
                              "local": et["nome"], "href": href,
                              "ingressos": pr.get("ingressos", ""),
                              "datas": ({"inicio": et["inicio"], "fim": et["fim"], "precisao": "dia",
                                         "status": et["status"]} if et["inicio"]
                                        else {"inicio": f"{ano}-01-01", "fim": f"{ano}-12-31",
                                              "precisao": "ano", "status": et["status"]})})
            for sh in shows:
                itens.append({"nome": f'{pr["name"]} {rot} · {sh["cidade"]}', "tipo": "Show",
                              "local": sh["cidade"], "href": href,
                              "ingressos": pr.get("ingressos", ""),
                              "datas": ({"inicio": sh["data"], "fim": sh["data"], "precisao": "dia",
                                         "status": sh["status"]} if sh.get("data")
                                        else {"inicio": f"{ano}-01-01", "fim": f"{ano}-12-31",
                                              "precisao": "ano", "status": sh["status"]})})
            for r in ed.get("relacionados", []):
                if not r.get("data"):
                    continue
                itens.append({"nome": f'{pr["name"]} · {r["o_que"]}', "tipo": "Relacionado",
                              "local": r["local"], "href": href,
                              "ingressos": pr.get("ingressos", ""),
                              "datas": ({"inicio": r["data"], "fim": r["data_fim"] or r["data"],
                                         "precisao": "dia", "status": r["status"]} if r.get("data")
                                        else {"inicio": f"{ano}-01-01", "fim": f"{ano}-12-31",
                                              "precisao": "ano", "status": r["status"]})})
        if not pr["years"] and pr.get("datas_projeto"):
            itens.append({"nome": pr["name"], "tipo": "Ação", "local": pr["location"],
                          "href": href_pr, "datas": pr["datas_projeto"],
                          "ingressos": pr.get("ingressos", "")})

    exatos = [x for x in itens if x["datas"] and x["datas"]["precisao"] != "ano"]
    exatos.sort(key=lambda x: x["datas"]["inicio"], reverse=True)

    def linha(x):
        txt, dias = periodo(x["datas"])
        if x["datas"] and x["datas"]["precisao"] == "ano":
            quando = f'<span class="val pend">{e(txt)}</span>'
        else:
            quando = e(txt) + (f'<small>{plural(dias, "dia", "dias")}</small>' if dias else "")
        return (f'<tr><th scope="row"><a href="{x["href"]}">{e(x["nome"])}</a>'
                f'<small>{e(x["tipo"])}</small></th><td>{quando}</td>'
                f'<td>{e(x["local"])}</td>'
                f'<td>{selo_data(x["datas"], x.get("ingressos", ""))}</td></tr>')

    cab = ('<thead><tr><th scope="col">O quê</th><th scope="col">Quando</th>'
           '<th scope="col">Onde</th><th scope="col">Situação da data</th></tr></thead>')
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>AGENDA<span class="orange">.</span></h1>
<p class="lede">Toda edição, etapa de circuito e show em um calendário único, do mais recente para o mais antigo. Cada linha diz de onde veio a data.</p>
</section>
<section class="container reach-section"><hr class="rule">
<h2 class="sr-only">Com data definida</h2>
<div class="table-wrap"><table class="amounts reach-table">{cab}
<tbody>{''.join(linha(x) for x in exatos)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver onde e a situação.</p></section>
</main>"""
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": "Agenda",
          "url": f"{BASE}/agenda/", "inLanguage": "pt-BR"}
    return write("agenda/index.html",
                 head(depth, "Agenda | Todas as edições, etapas e shows | Cadillac Produções",
                      "Calendário completo dos projetos Cadillac: edições, etapas de circuito e "
                      "shows, com data, local e a procedência de cada informação.",
                      "agenda/", [ld, trail_ld]) + header(depth, "agenda") + body + footer(depth))


def page_reservado():
    """Material interno: sem indexação, sem link no site e fora do sitemap."""
    depth, p = 1, rel(1)
    data = MODEL["reservado"]
    by_slug = {x["slug"]: x for x in PROJECTS}

    fin = []
    for r in data["financeiro"]:
        onde = (f'<a href="{p}projetos/{r["slug"]}/">{e(r["projeto"])} {icon("arrow_outward")}</a>'
                if r["slug"] in by_slug else e(r["projeto"]))
        fin.append(f"""<tr><th scope="row">{onde}<small>{e(r['registro'])}</small></th>
<td><span class="val">{brl(r['valor'])}</span></td>
<td>{e(r['natureza'])}<small class="out">{e(r['uso'])}</small></td>
<td>{fonte_link(r['fonte'])}</td></tr>""")
    total = sum(r["valor"] for r in data["financeiro"])

    dil = []
    for d in data["diligencias"]:
        fonte = "—"
        if d["fonte"]:
            label, url = d["fonte"]
            fonte = (f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">'
                     f'{e(label)}</a>')
        dil.append(f"""<tr><th scope="row">{e(d['assunto'])}</th><td>{e(d['detalhe'])}</td>
<td>{e(d['acao'])}</td><td>{fonte}</td></tr>""")

    sol = []
    for orgao, pedido, url in data["solicitacoes"]:
        onde = (f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">abrir</a>'
                if url else "—")
        sol.append(f'<tr><th scope="row">{e(orgao)}</th><td>{e(pedido)}</td><td>{onde}</td></tr>')

    linhas_aud = []
    for x in sorted(MODEL["audiencia"]["entries"], key=lambda x: (x["project"], -(x["year"] or 0))):
        pr = by_slug[x["project"]]
        valor = big(x["value"]) if x["value"] is not None else "—"
        fonte = fonte_link(x.get("source"))
        linhas_aud.append(f"""<tr><th scope="row">{e(pr['name'])}{' ' + str(x['year']) if x['year'] else ''}
<small>{e(x['label'])}</small></th><td>{valor}</td><td>{e(x.get('tipo', ''))}</td>
<td>{e(x.get('conta') or x.get('basis') or '—')}</td><td>{fonte}</td></tr>""")

    campos = MODEL["operacao"]["campos"]
    linhas_op = []
    for pr in PROJECTS:
        for y in pr["years"]:
            ficha = MODEL["operacao"]["fichas"].get(f'{pr["slug"]}-{y}', {})
            preenchidos = [f'{campos[k][0]}: {v[0] if isinstance(v, list) else v}'
                           for k, v in ficha.items() if v]
            faltam = [campos[k][0] for k in campos if not ficha.get(k)]
            linhas_op.append(f"""<tr><th scope="row"><a href="{p}projetos/{pr['slug']}/{y}/">{e(pr['name'])} {y}</a></th>
<td>{e(" · ".join(preenchidos)) or "—"}</td><td>{e(", ".join(faltam))}</td></tr>""")

    body = f"""<main id="conteudo"><span id="top"></span>
<section class="page-hero container"><p class="selo selo-a-confirmar">{icon('description')} Uso interno · sem indexação</p>
<h1>{e(data['titulo'])}<span class="orange">.</span></h1>
<p class="lede">{e(data['lede'])}</p></section>
<section class="container reach-section"><hr class="rule">
<h2 class="section-title">VALORES FORA<br><em>DO SITE.</em></h2>
<p class="body-copy">Soma nominal dos registros abaixo: <strong>{brl(total)}</strong>. Não é faturamento, captação efetiva nem receita: são valores que aparecem em documentos públicos e em propostas comerciais, cada um com natureza própria. Cotas de patrocínio são preço de tabela e alternativas entre si, então a soma não representa dinheiro disponível.</p>
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Projeto e registro</th><th scope="col">Valor</th><th scope="col">Natureza e por que saiu</th><th scope="col">Fonte</th></tr></thead>
<tbody>{''.join(fin)}</tbody></table></div></section>
<section class="container reach-section"><hr class="rule">
<h2 class="section-title">DILIGÊNCIAS<br><em>EM ABERTO.</em></h2>
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Assunto</th><th scope="col">O que se sabe</th><th scope="col">O que resolve</th><th scope="col">Fonte</th></tr></thead>
<tbody>{''.join(dil)}</tbody></table></div></section>
<section class="container reach-section"><hr class="rule">
<h2 class="section-title">PEDIDOS<br><em>A PROTOCOLAR.</em></h2>
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Órgão</th><th scope="col">O que pedir</th><th scope="col">Canal</th></tr></thead>
<tbody>{''.join(sol)}</tbody></table></div></section>
<section class="container reach-section"><hr class="rule">
<h2 class="section-title">AUDIÊNCIA,<br><em>LINHA A LINHA.</em></h2>
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Evento</th><th scope="col">Valor</th><th scope="col">Tipo</th><th scope="col">Base ou conta</th><th scope="col">Fonte</th></tr></thead>
<tbody>{''.join(linhas_aud)}</tbody></table></div></section>
<section class="container reach-section"><hr class="rule">
<h2 class="section-title">OPERAÇÃO<br><em>POR EDIÇÃO.</em></h2>
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Edição</th><th scope="col">Preenchido</th><th scope="col">Falta levantar</th></tr></thead>
<tbody>{''.join(linhas_op)}</tbody></table></div>
{paragrafo_nota(data['nota'])}</section></main>"""
    pagina = (head(depth, "Dados reservados | Uso interno",
                   "Material interno de estudo e referência. Página sem indexação.",
                   "reservado/") + header(depth) + body + footer(depth))
    pagina = pagina.replace('<meta name="robots" content="index,follow,max-image-preview:large">',
                            '<meta name="robots" content="noindex,nofollow,noarchive">')
    return write("reservado/index.html", pagina)


def page_imprensa():
    depth, p = 1, rel(1)
    data = MODEL["imprensa"]
    trail_html, trail_ld = crumbs(depth, [("Imprensa", None)])
    itens = []
    for it in data["itens"]:
        existe = (ROOT / it["arquivo"]).exists()
        if existe:
            acao = (f'<a class="pill-link" href="{p}{e(it["arquivo"])}" download>'
                    f'Baixar {e(it["formato"])} {icon("download")}</a>')
            marca = ""
        else:
            acao = f'<span class="selo selo-a-confirmar">{icon("search")} A produzir</span>'
            marca = f'<code>{e(it["arquivo"])}</code>'
        itens.append(f"""<article class="kit-item"><h3>{e(it['titulo'])}</h3>
<p>{e(it['descricao'])}</p>{marca}{acao}</article>""")
    rel_data = data.get("releases") or {"texto": "", "itens": []}
    releases_itens = "".join(f'<li>{icon("arrow_forward")} {e(x)}</li>'
                             for x in rel_data.get("itens") or [])
    ass = data["assessoria"]
    ass_email = next((v for k, v in ass["campos"] if k == "Contato" and v), SITE["email"])
    ass_linhas = "".join(
        f'<tr><th scope="row">{e(k)}</th><td>'
        + (f'<a href="mailto:{e(v)}">{e(v)}</a>' if v and "@" in v
           else (e(v) if v else f'<span class="gov-falta">{icon("search")} a informar</span>'))
        + '</td></tr>' for k, v in ass["campos"])
    ass_oferece = "".join(f'<li>{icon("arrow_forward")} {e(x)}</li>' for x in ass["oferece"])

    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": "Imprensa",
          "url": f"{BASE}/imprensa/", "inLanguage": "pt-BR"}
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>IMPRENSA<span class="orange">.</span></h1>
<p class="lede">{e(data['lede'])}</p></section>
<section class="container reach-section" id="fotos-videos"><hr class="rule">
<h2 class="section-title">PRESS KIT<span class="orange">.</span></h2>
<div class="kit-grid">{''.join(itens)}</div>
{paragrafo_nota(data.get('kit_nota'))}</section>
<section class="container reach-section" id="releases"><hr class="rule">
<h2 class="section-title">RELEASES<span class="orange">.</span></h2>
<p class="body-copy">{e(rel_data['texto'])}</p>
{f'<ul class="entrega">{releases_itens}</ul>' if releases_itens else ''}</section>
<section class="container reach-section" id="assessoria"><hr class="rule">
<h2 class="section-title">ASSESSORIA DE<br><em>IMPRENSA.</em></h2>
<p class="body-copy">{e(ass['intro'])}</p>
<div class="table-wrap"><table class="amounts gov-dados"><tbody>{ass_linhas}</tbody></table></div>
<h3>O que a assessoria atende</h3>
<ul class="entrega">{ass_oferece}</ul>
<p class="body-copy">{e(ass['pedido'])}</p>
<div class="section-end"><a class="pill-link" href="mailto:{e(ass_email)}">Escrever para a assessoria {icon('mail')}</a></div></section></main>"""
    return write("imprensa/index.html",
                 head(depth, "Imprensa | Material e contato | Cadillac Produções",
                      "Apresentação institucional, marca, fotos e ficha técnica dos projetos para "
                      "imprensa, patrocinadores e parceiros.",
                      "imprensa/", [ld, trail_ld]) + header(depth, "na-midia") + body + footer(depth))


def page_contato():
    depth, p = 1, rel(1)
    data = MODEL["contato"]
    trail_html, trail_ld = crumbs(depth, [("Contato", None)])
    campos = []
    for nome, rotulo, tipo, obrig in data["campos"]:
        req = " required" if obrig else ""
        if tipo == "textarea":
            campo = f'<textarea id="{nome}" name="{nome}" rows="6"{req}></textarea>'
        elif tipo == "select":
            opcoes = "".join(f'<option>{e(a)}</option>' for a in data["assuntos"])
            campo = f'<select id="{nome}" name="{nome}"{req}>{opcoes}</select>'
        else:
            campo = f'<input id="{nome}" name="{nome}" type="{tipo}"{req}>'
        campos.append(f'<p class="campo"><label for="{nome}">{e(rotulo)}'
                      f'{"" if obrig else " <span>opcional</span>"}</label>{campo}</p>')
    # Formulario vai para relacionamento@, nao para o contato geral: e a caixa
    # que recebe proposta, patrocinio, fornecedor e imprensa.
    caixa = data.get("email_formularios") or SITE["email"]
    destino = data["endpoint"] or f'mailto:{caixa}'
    metodo = "post" if data["endpoint"] else "get"
    aviso = ""
    # Telefone e WhatsApp sao para discar e abrir conversa, nao para copiar
    # a mao: cada um sai como link no aparelho de quem le.
    def canal(nome, valor, ic):
        if not valor:
            corpo = '<span class="vazio-inline">a informar</span>'
        elif nome == "E-mail":
            corpo = f'<a href="mailto:{e(valor)}">{e(valor)}</a>'
        elif nome == "Telefone":
            corpo = f'<a href="tel:{so_digitos(valor)}">{e(valor)}</a>'
        elif nome == "WhatsApp":
            corpo = (f'<a href="https://wa.me/{so_digitos(valor).lstrip("+")}" '
                     f'target="_blank" rel="noopener noreferrer">{e(valor)}</a>')
        elif nome == "Instagram":
            corpo = (f'<a href="https://instagram.com/{e(valor.lstrip("@"))}" '
                     f'target="_blank" rel="noopener noreferrer">{e(valor)}</a>')
        else:
            corpo = f'<span>{e(valor)}</span>'
        return f'<li>{icon(ic)} <strong>{e(nome)}</strong>{corpo}</li>'

    canais = "".join(canal(*c) for c in data["canais"])
    # Caixa certa para cada assunto: quem procura imprensa nao escreve para
    # relacionamento e espera dois dias para ser redirecionado.
    caixas = "".join(
        f'<a class="caixa-card" href="mailto:{e(v)}">'
        f'<span class="caixa-para">{e(k)}</span>'
        f'<strong>{e(v)}</strong>{icon("mail")}</a>'
        for k, v in data.get("caixas") or [])

    # Endereco com rota pronta. O visitante que vai ate la nao deveria ter de
    # copiar o endereco e colar no aplicativo: os dois botoes ja levam.
    ends = []
    fone = data.get("telefone")
    for en in data.get("enderecos") or []:
        linha = ", ".join(x for x in [en.get("logradouro"), en.get("bairro")] if x)
        completo = ", ".join(x for x in [linha, en["cidade"], en.get("cep")] if x)
        if en.get("logradouro"):
            consulta = quote(completo)
            rotas = (f'<div class="rotas">'
                     f'<a href="https://www.google.com/maps/search/?api=1&amp;query={consulta}" '
                     f'target="_blank" rel="noopener noreferrer">{icon("place")} Google Maps</a>'
                     f'<a href="https://waze.com/ul?q={consulta}&amp;navigate=yes" '
                     f'target="_blank" rel="noopener noreferrer">{icon("place")} Waze</a></div>')
            corpo = f'<p class="end-linha">{e(completo)}</p>{rotas}'
        else:
            corpo = (f'<p class="end-linha"><span class="vazio-inline">'
                     f'{icon("search")} endereço a informar</span></p>')
        if fone:
            corpo += (f'<p class="end-fone"><a href="tel:{so_digitos(fone)}">'
                      f'{icon("call")} {e(fone)}</a>'
                      f'<a href="https://wa.me/{so_digitos(fone).lstrip("+")}" '
                      f'target="_blank" rel="noopener noreferrer">'
                      f'{icon("chat")} WhatsApp</a></p>')
        ends.append(f'<article class="end-card"><span class="end-papel">{e(en["papel"])}</span>'
                    f'<h3>{e(en["cidade"])}</h3>{corpo}'
                    f'<p class="end-nota">{e(en.get("nota") or "")}</p></article>')

    ld = {"@context": "https://schema.org", "@type": "ContactPage", "name": "Contato",
          "url": f"{BASE}/contato/", "inLanguage": "pt-BR"}
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>CONTATO<span class="orange">.</span></h1>
<p class="lede">{e(data['lede'])}</p>
{f'<p class="contato-horario">{icon("calendar_month")} {e(data["horario"])}</p>' if data.get('horario') else ''}
</section>
<section class="container reach-section" id="caixas"><hr class="rule">
<h2 class="section-title">PARA ONDE<br><em>ESCREVER.</em></h2>
<div class="caixas-grade">{caixas}</div></section>
<section class="container contato-grid" id="mensagem"><hr class="rule">
<form class="contato-form" action="{e(destino)}" method="{metodo}">
<h2>Mande sua mensagem</h2>{''.join(campos)}
<button class="pill-link" type="submit">Enviar {icon('mail')}</button>{aviso}</form>
<div class="area-list"><h3>Canais diretos</h3><ul class="canais">{canais}</ul>
{paragrafo_nota(data['nota'])}</div></section>
<section class="container reach-section" id="enderecos"><hr class="rule">
<h2 class="section-title">ONDE<br><em>A GENTE ESTÁ.</em></h2>
<div class="end-grade">{''.join(ends)}</div></section></main>"""
    return write("contato/index.html",
                 head(depth, "Contato | Cadillac Produções",
                      "Fale com a Cadillac sobre projetos, parcerias, patrocínio ou imprensa.",
                      "contato/", [ld, trail_ld]) + header(depth, "contato") + body + footer(depth))


def page_en():
    depth, p = 1, rel(1)
    data = MODEL["en"]
    frentes = "".join(f'<article><h3>{e(t)}</h3><p>{e(d)}</p></article>' for t, d in data["frentes"])
    projetos = "".join(
        f'<tr><th scope="row"><a href="{p}projetos/{pr["slug"]}/">{e(pr["name"])}</a></th>'
        f'<td>{e(pr["kind"])}</td><td>{e(pr["location"])}</td><td>{e(pr["period"])}</td></tr>'
        for pr in PROJECTS)
    body = f"""<main id="conteudo"><span id="top"></span>
<section class="page-hero container"><p class="selo">{icon('language')} English overview</p>
<h1>{e(data['tagline'])}</h1>
<p class="lede">{e(data['lede'])}</p></section>
<section class="container area"><hr class="rule">
<div class="area-body"><div class="area-text">{''.join(f'<p>{e(t)}</p>' for t in data['sobre'])}</div>
<div class="area-list"><h2 class="area-list-title">Company</h2><ul>
<li>{icon('verified')} {e(SITE['legal'])}</li>
<li>{icon('description')} Tax ID {SITE['cnpj']}</li>
<li>{icon('place')} {e(SITE['origin'])}</li>
<li>{icon('mail')} <a href="mailto:{SITE['email']}">{e(SITE['email'])}</a></li></ul></div></div></section>
<section class="container method-section"><hr class="rule">
<h2 class="section-title">WHAT WE DO<span class="orange">.</span></h2>
<div class="method">{frentes}</div></section>
<section class="container reach-section"><hr class="rule">
<h2 class="section-title">PROJECTS<span class="orange">.</span></h2>
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Project</th><th scope="col">Type</th><th scope="col">Where</th><th scope="col">Period</th></tr></thead>
<tbody>{projetos}</tbody></table></div>
<p class="note">Project pages, editions, sources and data are published in Portuguese.</p>
<div class="section-end"><a class="pill-link" href="mailto:{SITE['email']}">{e(data['cta'])} {icon('mail')}</a></div></section></main>"""
    pagina = (head(depth, "Cadillac Produções & Filmes | English overview",
                   "Cadillac develops, enables and produces experiences in sport, culture and "
                   "entertainment in Brazil. Overview in English.",
                   "en/") + header(depth) + body + footer(depth))
    pagina = pagina.replace('<html lang="pt-BR">', '<html lang="en">')
    pagina = pagina.replace('<link rel="canonical"',
                            f'<link rel="alternate" hreflang="pt-BR" href="{BASE}/">'
                            f'<link rel="alternate" hreflang="en" href="{BASE}/en/">'
                            '<link rel="canonical"')
    return write("en/index.html", pagina)


def page_404():
    body = f"""<main id="conteudo"><span id="top"></span>
<section class="container error-page"><h1>404<span class="orange">.</span></h1>
<p>A página que você procurou saiu de cartaz. O acervo continua no ar — siga por um destes caminhos.</p>
<div class="error-actions">
<a class="pill-link" href="./projetos/">Ver eventos {icon('arrow_outward')}</a>
<a class="pill-link" href="./dados/">Ver dados {icon('insights')}</a>
<a class="pill-link" href="./">Página inicial {icon('home')}</a></div></section></main>"""
    page = (head(0, "Página não encontrada | Cadillac Produções",
                 "A página não foi encontrada. Navegue pelo acervo de eventos, edições e dados da Cadillac.",
                 "404.html") + header(0) + body + footer(0))
    # O Apache serve esta pagina para qualquer endereco perdido, inclusive
    # /eventos/algo/inexistente/, entao caminho relativo apontaria para o
    # lugar errado. Absolutizamos — mas so ate a barra, sem o dominio: assim a
    # mesma pagina funciona em cadillac.art.br e em instfy.com/cadillac
    # sem sair da origem, que e o que a politica de conteudo exige.
    raiz = BASE.split("//", 1)[-1]
    raiz = raiz[raiz.index("/"):] + "/" if "/" in raiz else "/"
    page = (page.replace('href="assets/', f'href="{raiz}assets/')
                .replace('src="assets/', f'src="{raiz}assets/')
                .replace('srcset="assets/', f'srcset="{raiz}assets/')
                .replace('href="./', raiz and f'href="{raiz}'))
    return write("404.html", page)


def page_sitemap():
    urls = ["", "projetos/", "atuacao/", "agenda/", "na-midia/", "dados/", "produtora/",
            "atletas/", "artistas/", "equipe/", "relacionamento/", "imprensa/",
            "governanca/", "contato/", "en/"]
    for pr in PROJECTS:
        urls.append(f"projetos/{pr['slug']}/")
        for y in pr["years"]:
            urls.append(f"projetos/{pr['slug']}/{y}/")
    for x in ATLETAS:
        urls.append(f"atletas/{x['slug']}/")
    for x in MODEL["pessoas"]["equipe"]:
        urls.append(f"equipe/{x['slug']}/")
    for nome in sorted(artistas_indexados(), key=lambda n: n.lower()):
        urls.append(f"artistas/{slugify(nome)}/")
    entries = "\n".join(
        f"<url><loc>{BASE}/{u}</loc><lastmod>{MODEL['updated']}</lastmod>"
        f"<priority>{'1.0' if u == '' else '0.8' if u.count('/') < 2 else '0.6'}</priority></url>"
        for u in urls)
    write("sitemap.xml",
          '<?xml version="1.0" encoding="UTF-8"?>\n'
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          f"{entries}\n</urlset>\n")
    write("robots.txt", f"User-agent: *\nAllow: /\n\nSitemap: {BASE}/sitemap.xml\n")
    return len(urls)


def main():
    written = [page_home(), page_projects(), page_atuacao(), page_agenda(), page_press(),
               page_data(), page_produtora(), page_atletas(), page_artistas(), page_equipe(),
               page_relacionamento(), page_imprensa(), page_contato(), page_governanca(),
        page_parceiros(),
        *[page_governanca_doc(x) for x in MODEL["governanca"]["itens"]],
               page_en(), page_reservado(), page_404()]
    for x in ATLETAS:
        written.append(page_atleta(x))
    for x in MODEL["pessoas"]["equipe"]:
        written.append(page_pessoa(x))
    _artistas = artistas_indexados()
    for nome in sorted(_artistas, key=lambda n: n.lower()):
        written.append(page_artista(nome, _artistas[nome]))
    for pr in PROJECTS:
        written.append(page_project(pr))
        for y in pr["years"]:
            written.append(page_edition(pr, y))
    n = page_sitemap()
    faltando = sorted(ICONES_PEDIDOS - ICONES)
    if faltando:
        raise SystemExit(
            "Ícones usados mas fora de ICONES, que vira o icon_names do Google Fonts: "
            + ", ".join(faltando)
            + "\nSem eles no subset o ícone sai como texto. Acrescente em ICONES e rode de novo.")
    ociosos = sorted(ICONES - ICONES_PEDIDOS - ICONES_DINAMICOS)
    if ociosos:
        print("aviso: baixados sem uso:", ", ".join(ociosos))
    print(f"{len(written)} páginas geradas, {n} URLs no sitemap.")
    for w in written:
        print("  ", w)


if __name__ == "__main__":
    main()
