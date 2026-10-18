#!/usr/bin/env python3
"""Gerador estático do portal Cadillac (V7).

Uso: python3 build.py
Lê content-model.json e escreve todas as páginas HTML, o sitemap e o robots.
Os assets (assets/site.css, assets/site.js) são mantidos à mão.
"""

import html
import json
import pathlib
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parent
MODEL = json.loads((ROOT / "content-model.json").read_text(encoding="utf-8"))
SITE = MODEL["site"]
BASE = SITE["url"].rstrip("/")
CATS = MODEL["categories"]
def _recencia(pr):
    """Ano mais recente do projeto; sem edição, lê o fim do período."""
    if pr["years"]:
        return max(pr["years"])
    digitos = [int(t) for t in __import__("re").findall(r"(20\d\d)", pr.get("period", ""))]
    return max(digitos) if digitos else 0


PROJECTS = sorted(MODEL["projects"], key=lambda pr: (-_recencia(pr), pr["name"]))

# Modo de preenchimento: mostra, em cada campo vazio, o caminho exato no
# content-model.json. Deixe False antes de publicar para o público.
MOSTRAR_CAMPOS = True

ICON_SUBSET = ",".join(sorted([
    "arrow_back", "arrow_forward", "arrow_outward", "calendar_month", "campaign",
    "chevron_right", "close", "description", "engineering", "expand_more", "festival",
    "filter_list", "home", "insights", "mail", "menu", "movie", "music_note", "north",
    "groups", "open_in_new", "palette", "photo_camera", "place", "public", "search", "skateboarding",
    "stacked_bar_chart", "verified",
]))

NAV = [
    ("Projetos", "projetos/", "projetos", "stacked_bar_chart"),
    ("Atuação", "atuacao/", "atuacao", "engineering"),
    ("Agenda", "agenda/", "agenda", "calendar_month"),
    ("Na Mídia", "na-midia/", "na-midia", "description"),
    ("Dados", "dados/", "dados", "insights"),
    ("Ecossistema", "ecossistema/", "ecossistema", "public"),
    ("Cadillac", "#sobre", "sobre", "verified"),
]


# --------------------------------------------------------------------------
# utilidades
# --------------------------------------------------------------------------
def e(text):
    return html.escape(str(text), quote=True)


def rel(depth):
    return "../" * depth


def icon(name, cls="cd-icon"):
    return f'<span aria-hidden="true" class="material-symbols-outlined {cls}">{name}</span>'


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
    fonts = (
        '<link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
        'family=Roboto+Condensed:wght@600;700;800&family=Manrope:wght@400;500;600;700'
        '&display=swap">'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
        f'family=Material+Symbols+Outlined&amp;icon_names={ICON_SUBSET}&amp;display=block">'
    )
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
<link rel="stylesheet" href="{p}assets/site.css">
<script defer src="{p}assets/site.js"></script>
{blocks}{extra}</head>"""


def header(depth, active=""):
    p = rel(depth)
    home = p if depth else "./"
    desk, mob = [], []
    for label, target, key, ic in NAV:
        url = (home + target) if not target.startswith("#") else (home + target)
        cur = ' aria-current="page"' if key == active else ""
        desk.append(f'<a href="{url}"{cur}>{label}</a>')
        mob.append(f'<a href="{url}"{cur}>{label} {icon("chevron_right")}</a>')
    mob.append(f'<a href="{home}#contato">Contato {icon("chevron_right")}</a>')
    return f"""<body><a class="skip-link" href="#conteudo">Ir para o conteúdo</a>
<header class="site-header"><div class="header-inner">
<a class="logo" href="{home}" aria-label="Cadillac Produções e Filmes, página inicial"><img class="logo-mark" src="{p}assets/logo-cadillac.png" alt="Cadillac" width="1619" height="511"><span class="logo-sub">Produções<br>&amp; Filmes</span></a>
<nav class="nav" aria-label="Menu principal">{''.join(desk)}</nav>
<a class="contact-nav" href="{home}#contato">Vamos conversar {icon('arrow_outward')}</a>
<button class="hamburger" id="menuToggle" aria-expanded="false" aria-label="Abrir menu" aria-controls="mobileNav">{icon('menu')}</button>
</div></header>
<nav class="mobile-nav" id="mobileNav" aria-label="Menu principal, versão compacta">{''.join(mob)}</nav>"""


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
    links = [("Projetos", home + "projetos/", "stacked_bar_chart"),
             ("Atuação", home + "atuacao/", "engineering"),
             ("Na Mídia", home + "na-midia/", "description"),
             ("Agenda", home + "agenda/", "calendar_month"),
             ("Dados", home + "dados/", "insights"),
             ("Ecossistema", home + "ecossistema/", "public"),
             ("Cadillac", home + "#sobre", "verified"),
             ("Contato", home + "#contato", "mail")]
    nav = "".join(f'<a href="{u}">{icon(i)} {l}</a>' for l, u, i in links)
    return f"""<footer class="footer"><div class="container foot-top">
<a class="footer-logo" href="{home}" aria-label="Cadillac Produções e Filmes, página inicial"><img src="{p}assets/logo-cadillac-branco.png" alt="Cadillac" width="1619" height="511"><span>Produções &amp; Filmes</span></a>
<nav class="foot-nav" aria-label="Rodapé">{nav}</nav></div>
<div class="container foot-bottom"><span>© 2026 {e(SITE['name'])} Ltda.</span>
<span>Informações documentais e imagens de terceiros identificadas por suas fontes. Layout original da Cadillac.</span>
<a href="#top">{icon('north')} Voltar ao topo</a></div></footer>
<a class="to-top" href="#top" aria-label="Voltar ao topo">{icon('north')}</a>
</body></html>"""


def source_list(sources):
    if not sources:
        return ('<p class="note">Nenhuma fonte pública recuperada até agora para este registro. '
                'A ficha técnica institucional está sendo solicitada e entra aqui assim que chegar.</p>')
    rows = []
    for label, url in sources:
        rows.append(
            f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">'
            f'<span class="s-main"><span class="s-label">{e(label)}</span>'
            f'<span class="s-host">{e(host_of(url))}</span></span>'
            f'{icon("open_in_new")}</a>'
        )
    return f'<div class="source-list">{"".join(rows)}</div>'


def photo_for(project, year=None):
    """Foto do acervo, se o arquivo já estiver em assets/fotos."""
    stems = [project["slug"] + (f"-{year}" if year else "")]
    if year:
        stems.append(project["slug"])
    for stem in stems:
        for ext in ("jpg", "jpeg", "png", "webp"):
            if (ROOT / "assets" / "fotos" / f"{stem}.{ext}").exists():
                return f"assets/fotos/{stem}.{ext}"
    return None


def og_for(project, year=None):
    for stem in ([f'{project["slug"]}-{year}'] if year else []) + [project["slug"]]:
        if (ROOT / "assets" / "og" / f"{stem}.jpg").exists():
            return f"{BASE}/assets/og/{stem}.jpg"
    return None


def slot(name, ratio, what, extra=""):
    """Espaço reservado para a imagem oficial que ainda vai entrar."""
    caminho = f"assets/fotos/{name}"
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
        img = {"url": rel(depth) + local,
               "alt": f"{project['name']}{edicao}",
               "credit": "Acervo Cadillac"}
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
        loading = "" if eager else ' loading="lazy"'
        inner.append(
            f'<img class="media-img" src="{e(img["url"])}" alt="{e(img["alt"])}"'
            f'{loading} decoding="async">'
        )
    inner.append(f'<span class="media-code">CADILLAC / ACERVO</span>')
    inner.append(f'<span class="media-symbol">{e(project["name"].upper())}</span>')
    if img and img.get("credit"):
        inner.append(f'<span class="source-credit">{e(img["credit"])}</span>')
    role = "" if img else ' role="img" aria-label="Capa editorial de ' + e(project["name"]) + '"'
    return (f'<div class="media-surface {theme} {classes}"{role}>' + "".join(inner) + "</div>")


def faq_block(project, number):
    if not project.get("faq"):
        return "", None
    rows = "".join(
        f'<details><summary>{e(q)} {icon("expand_more")}</summary><p>{e(a)}</p></details>'
        for q, a in project["faq"]
    )
    section = f"""<section class="container faq-section"><hr class="rule">
<h2 class="section-title">O QUE PERGUNTAM<br><em>SOBRE O PROJETO.</em></h2>
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
    meta = (f'<span>{icon(cat["icon"])} {e(cat["label"])}</span>'
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
    years = sorted({y for pr in PROJECTS for y in pr["years"]}, reverse=True)
    all_sources = set()
    for pr in PROJECTS:
        all_sources |= project_sources(pr)
    per_year = {}
    for pr in PROJECTS:
        for y in pr["years"]:
            per_year[y] = per_year.get(y, 0) + 1
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
            if y in pr["years"]:
                cells.append(f'<td><a class="cell" href="{p}projetos/{pr["slug"]}/{y}/" '
                             f'aria-label="{e(pr["name"])} {y}, edição documentada">{y}</a></td>')
            else:
                cells.append('<td><span class="cell" aria-label="sem registro catalogado">—</span></td>')
        rows.append(f'<tr><th scope="row">{e(pr["name"])}</th>{"".join(cells)}</tr>')
    return f"""<div class="table-wrap"><table class="matrix">
<caption>Cada célula preenchida é uma edição com página própria e fontes. O traço indica ausência de registro catalogado nesta versão, não ausência de evento.</caption>
<thead><tr><th scope="col">Projeto</th>{head_cells}</tr></thead>
<tbody>{"".join(rows)}</tbody></table></div>"""


def declared_table(depth):
    p = rel(depth)
    rows = []
    for d in MODEL["declared_metrics"]:
        label, url = d["source"]
        rows.append(f"""<tr><th scope="row"><a href="{p}{d['href']}">{e(d['event'])}</a></th>
<td><span class="val">{e(d['value'])}</span><small>{e(d['what'])}</small></td>
<td>{e(d['nature'])}</td>
<td><a href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(label)} {icon('open_in_new')}</a></td></tr>""")
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
<td><a href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(label)} {icon('open_in_new')}</a></td></tr>""")
    if not rows:
        return ""
    return f"""<div class="table-wrap"><table class="amounts">
<caption>Valores que aparecem em documentos públicos. São valores de projeto aprovado ou de objeto contratado — não representam receita, captação efetiva nem resultado da Cadillac.</caption>
<thead><tr><th scope="col">Projeto</th><th scope="col">Registro</th><th scope="col">Valor</th><th scope="col">Fonte</th></tr></thead>
<tbody>{"".join(rows)}</tbody></table></div>"""


# --------------------------------------------------------------------------
# páginas
# --------------------------------------------------------------------------
def write(path, content):
    f = ROOT / path
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(content, encoding="utf-8")
    return path


def page_home():
    org = {"@context": "https://schema.org", "@type": "Organization",
           "name": SITE["name"], "url": BASE, "email": SITE["email"],
           "description": SITE["tagline"],
           "address": {"@type": "PostalAddress", "addressCountry": "BR"}}
    website = {"@context": "https://schema.org", "@type": "WebSite", "name": SITE["name"],
               "url": BASE + "/", "inLanguage": "pt-BR"}
    cards = "".join(card(pr, 0, eager=(i == 0)) for i, pr in enumerate(PROJECTS))
    services = "".join(
        f'<a class="service-row" href="./atuacao/#{a["slug"]}">'
        f'<span class="svc-i">{icon(a["icon"])}</span><h3>{e(a["title"])}</h3>'
        f'<p>{e(a["lede"])}</p><span class="card-arrow">{icon("arrow_outward")}</span></a>'
        for a in MODEL["atuacao"]["areas"])
    highlights = []
    for pr in PROJECTS[-3:]:
        cat = CATS[pr["category"]]
        highlights.append(f"""<article>
<h3>{e(pr['name'])}</h3><p>{e(pr['desc'])}</p>
<a class="pill-link" href="./projetos/{pr['slug']}/">Conhecer {icon('arrow_outward')}</a></article>""")
    press_html = "".join(
        f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">'
        f'<h3>{e(title)}</h3><small>{icon("open_in_new")} {e(outlet)} · cobertura externa</small></a>'
        for i, (outlet, title, url) in enumerate(MODEL["featured_press"], start=1))
    body = f"""<main id="conteudo"><span id="top"></span>
<section class="hero container">
<div class="hero-big"><h1>{SITE['headline'][0]}<br><em>{SITE['headline'][1]}</em><br>{SITE['headline'][2]}</h1>
<a class="circle-link" href="./projetos/" aria-label="Ver o acervo de projetos">{icon('arrow_outward')}</a></div>
<div class="hero-bottom"><p>{e(SITE['support'])}</p>
<span>EXPLORE OS PROJETOS {icon('expand_more')}</span></div></section>
<section class="container showcase" id="projetos">
<h2 class="sr-only">Projetos em destaque</h2><hr class="rule">
<div class="works-grid">{cards}</div>
<div class="section-end"><a class="pill-link" href="./projetos/">Explorar o acervo completo {icon('arrow_outward')}</a></div></section>
<section class="container editorial" id="historias">
<hr class="rule">
<h2 class="section-title">HISTÓRIAS QUE <em>CONTINUAM.</em></h2>
<div class="article-grid">{''.join(highlights)}</div></section>
<section class="statement" id="sobre"><div class="container statement-grid">
<div><h2>O IMPOSSÍVEL<br>NÃO ENTRA <em>NA PLANILHA.</em></h2>
{''.join(f'<p>{e(t)}</p>' for t in SITE['institutional'])}
<p class="statement-meta">{e(SITE['legal'])} · CNPJ {SITE['cnpj']} · Desde {e(SITE['founded'])} · {e(SITE['origin'])}</p></div></div></section>
<section class="container services" id="atuacao">
<hr class="rule">
<h2 class="section-title">DA IDEIA À<br><em>EXPERIÊNCIA.</em></h2>
<div class="service-list">{services}</div>
<div class="section-end"><a class="pill-link" href="./atuacao/">Como a gente trabalha, com casos {icon('arrow_outward')}</a></div></section>
<section class="dark-strip"><div class="container"><h2>NÃO É SÓ O QUE<br>ACONTECE. <em>É O QUE FICA.</em></h2></div></section>
<section class="container editorial">
<hr class="rule">
<div class="editorial-header"><h2 class="section-title">HISTÓRIAS<br>QUE CIRCULAM.</h2>
<a class="pill-link" href="./na-midia/">Ver todas as fontes {icon('arrow_outward')}</a></div>
<div class="article-grid">{press_html}</div></section>
<section class="contact" id="contato"><div class="container"><h2>TEM UMA IDEIA GRANDE?<br><em>ENTÃO CHAMA A GENTE.</em></h2>
<p>Projetos, parcerias, imprensa ou produção.</p>
<a class="contact-link" href="mailto:{SITE['email']}">{icon('mail')} FALE COM A CADILLAC</a>
<div class="contact-ways"><a class="pill-link" href="./projetos/">Ver projetos {icon('arrow_outward')}</a>
<a class="pill-link" href="./dados/">Ver dados {icon('insights')}</a></div>
<small>Caixa postal de contato sugerida: configurar antes da publicação definitiva.</small></div></section>
</main>"""
    return write("index.html",
                 head(0, "Experiências, esportes, cultura e produções | Cadillac Produções",
                      "Conheça o universo Cadillac: projetos esportivos, festivais, edições históricas, "
                      "notícias e dados documentados com fontes públicas.",
                      "", [org, website]) + header(0, "home") + body + footer(0))


def page_projects():
    trail_html, trail_ld = crumbs(1, [("Projetos", None)])
    cat_chips = ['<button class="chip" data-filter="categoria" data-value="todos" aria-pressed="true">'
                 f'{icon("filter_list")} Todos</button>']
    for key in M["categories"]:
        c = CATS[key]
        cat_chips.append(f'<button class="chip" data-filter="categoria" data-value="{key}" '
                         f'aria-pressed="false">{icon(c["icon"])} {e(c["label"])}</button>')
    year_chips = ['<button class="chip" data-filter="ano" data-value="todos" aria-pressed="true">'
                  f'{icon("calendar_month")} Todos</button>']
    for y in reversed(M["years"]):
        year_chips.append(f'<button class="chip" data-filter="ano" data-value="{y}" '
                          f'aria-pressed="false">{y}</button>')
    cards = "".join(card(pr, 1, eager=(i == 0)) for i, pr in enumerate(PROJECTS))
    ld = {"@context": "https://schema.org", "@type": "CollectionPage",
          "name": "Projetos e cases", "url": f"{BASE}/projetos/",
          "mainEntity": {"@type": "ItemList", "numberOfItems": len(PROJECTS),
                         "itemListElement": [
                             {"@type": "ListItem", "position": i,
                              "name": pr["name"],
                              "url": f"{BASE}/projetos/{pr['slug']}/"}
                             for i, pr in enumerate(PROJECTS, start=1)]}}
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>PROJETOS<span class="orange">.</span></h1>
<p class="lede">Propriedades, produções e histórias reunidas em um acervo vivo. Filtre por área, por ano ou busque pelo nome do projeto.</p></section>
<section class="container index-grid">
<h2 class="sr-only">Acervo de projetos</h2><hr class="rule">
<div class="filters">
<div class="filter-group"><span>Área de atuação</span><div class="chips">{''.join(cat_chips)}</div></div>
<div class="filter-group"><span>Ano com edição catalogada</span><div class="chips">{''.join(year_chips)}</div></div>
<div class="filter-group"><span>Buscar</span>
<label class="search-field">{icon('search')}<span class="sr-only">Buscar projeto</span>
<input id="projectSearch" type="search" placeholder="Nome, modalidade ou cidade" autocomplete="off"></label>
<span class="filter-count" id="filterCount" role="status">{M['projects']} projetos</span></div></div>
<div class="works-grid" id="projectBoard">{cards}</div>
<p class="empty-state" id="emptyState">Nenhum projeto corresponde a esta combinação de filtros. Limpe a busca ou escolha <strong>Todos</strong>.</p>
<p class="note">O acervo cresce por documentação. A ausência de um ano ou de um projeto nesta lista significa que o registro ainda não foi catalogado aqui, não que o evento não tenha existido.</p>
</section></main>"""
    return write("projetos/index.html",
                 head(1, "Projetos e cases | Cadillac Produções",
                      "Acervo de projetos da Cadillac: Itacoatiara Pro, Vert Battle, Tamo Junto BB, "
                      "Dominguinho, Bob Burnquist, Arte em Circuito e Festival de Tribos de Juruti.",
                      "projetos/", [ld, trail_ld]) + header(1, "projetos") + body + footer(1))


def page_project(pr):
    depth, p = 2, rel(2)
    slug = pr["slug"]
    cat = CATS[pr["category"]]
    trail_html, trail_ld = crumbs(depth, [("Projetos", p + "projetos/"), (pr["name"], None)])
    n_facts, n_sources = project_facts(pr), len(project_sources(pr))
    metric = ""

    sections, n = [], 1

    sections.append(f"""<section class="container detail-intro">
<div><h2>UM PROJETO.<br>MUITAS HISTÓRIAS.</h2></div>
<div><p>{e(pr['intro'])}</p>
<div class="taglist"><span>{icon(cat['icon'])} {e(cat['label'])}</span>
<span>{icon('festival')} {e(pr['kind'])}</span>
<span>{icon('place')} {e(pr['location'])}</span>
<span>{icon('calendar_month')} {e(pr['period'])}</span></div></div></section>""")
    n += 1

    if pr["years"]:
        rows = []
        for y in pr["years"]:
            ed = pr.get("editions", {}).get(str(y), {})
            txt, dias = periodo(ed.get("datas"))
            note = " · ".join(x for x in [txt or ed.get("period"), ed.get("place"),
                                          plural(dias, "dia", "dias") if dias else None] if x)
            rows.append(f"""<a class="year-row" href="{p}projetos/{slug}/{y}/">
<span class="yr">{y}</span><span><strong>{e(pr['name'])} {y}</strong>
<span class="yr-note">{e(note) if note else 'Edição catalogada'}</span></span>
<span class="yr-go">Explorar edição {icon('arrow_outward')}</span></a>""")
        chart = bars_horizontal([(str(y), len(pr["facts"].get(str(y), []))) for y in sorted(pr["years"], reverse=True)],
                                ("registro", "registros"), w=560, row=38)
        sections.append(f"""<section class="container timeline">
<hr class="rule">
<h2 class="section-title">TODAS AS<br><em>EDIÇÕES NO ACERVO.</em></h2>{''.join(rows)}
<div class="charts" style="padding-top:clamp(34px,5vw,60px)"><div class="chart-card">
<h3>Registros por edição</h3><p class="chart-sub">Quantidade de fatos com fonte identificada em cada ano catalogado.</p>
<figure>{chart}<figcaption>Série única. O número indica registros documentados nesta versão do acervo, não o tamanho do evento.</figcaption></figure>
</div></div></section>""")
        n += 1
    else:
        facts = "".join(
            f'<div class="fact"><span class="n">{i:02d}</span><p>{e(t)}</p></div>'
            for i, t in enumerate(pr.get("records", []), start=1))
        sections.append(f"""<section class="container facts-section">
<hr class="rule">
<h2 class="section-title">O QUE ESTÁ<br><em>DOCUMENTADO.</em></h2>
<div class="facts">{facts}</div>
<p class="note">Este projeto ainda não tem edições anuais catalogadas. Quando houver documentação por ano, cada edição ganha página própria com fontes.</p></section>""")
        n += 1

    faq_html, faq_ld = faq_block(pr, f"{n:02d}")
    if faq_html:
        sections.append(faq_html)
        n += 1

    sections.append(participacoes_block(pr, depth))
    sections.append(cast_block(pr))
    sections.append(op_project(pr))
    sections.append(f"""<section class="container sources">
<hr class="rule">
<h2>FONTES PARA IR ALÉM.</h2>{source_list(pr['sources'])}</section>""")
    n += 1

    related = [x for x in PROJECTS if x["slug"] != slug and x["category"] == pr["category"]]
    related += [x for x in PROJECTS if x["slug"] != slug and x not in related]
    rel_cards = "".join(card(x, depth) for x in related[:2])
    sections.append(f"""<section class="container related">
<hr class="rule">
<h2 class="section-title">OUTRAS HISTÓRIAS<br><em>DO ACERVO.</em></h2>
<div class="works-grid">{rel_cards}</div>
<div class="section-end"><a class="pill-link" href="{p}projetos/">Todos os projetos {icon('arrow_outward')}</a></div></section>""")

    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": pr["name"],
          "url": f"{BASE}/projetos/{slug}/", "description": pr["desc"], "inLanguage": "pt-BR",
          "publisher": {"@type": "Organization", "name": SITE["name"]}}
    blocks = [ld, trail_ld] + ([faq_ld] if faq_ld else [])
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="project-hero container">
<a class="back" href="{p}projetos/">{icon('arrow_back')} Todos os projetos</a>
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
        label, url = sh["fonte"]
        linhas.append(f"""<tr><th scope="row">{e(sh['cidade'])}</th><td>{quando}</td>
<td>{e(sh.get('local') or '—')}</td>
<td><span class="selo selo-{sh['status'].replace(' ', '-')}">{icon(ic)} {e(rotulo)}</span></td>
<td><a href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(label)} {icon("open_in_new")}</a></td></tr>""")
    rel = []
    for r in ed.get("relacionados", []):
        if r.get("data"):
            txt, _ = periodo({"inicio": r["data"], "fim": r["data_fim"] or r["data"], "precisao": "dia"})
            quando = e(txt)
        else:
            quando = '<span class="val pend">data a levantar</span>'
        rotulo, _, ic = MODEL["datas"]["status"][r["status"]]
        label, url = r["fonte"]
        rel.append(f"""<tr><th scope="row">{e(r['o_que'])}<small>{e(r['nota'])}</small></th>
<td>{quando}</td><td>{e(r['local'])}</td>
<td><span class="selo selo-{r['status'].replace(' ', '-')}">{icon(ic)} {e(rotulo)}</span></td>
<td><a href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(label)} {icon("open_in_new")}</a></td></tr>""")
    cabecalho = ('<thead><tr><th scope="col">Cidade</th><th scope="col">Quando</th>'
                 '<th scope="col">Local</th><th scope="col">Situação</th>'
                 '<th scope="col">Fonte</th></tr></thead>')
    painel = ""
    if total:
        falta = total - len(shows)
        painel = f"""<div class="op-grid" style="margin-bottom:clamp(22px,3vw,32px)">
<div class="op-tile">{icon('music_note')}<strong>{total}</strong><span>Shows informados</span><small>{e(nota_total)}</small></div>
<div class="op-tile">{icon('place')}<strong>{len(shows):02d}</strong><span>Cidades citadas</span><small>Nomeadas na cobertura da imprensa</small></div>
<div class="op-tile pend">{icon('search')}<strong>{falta}</strong><span>Apresentações sem registro</span><small>Dependem do mapa de turnê da produção</small></div>
<div class="op-tile pend">{icon('calendar_month')}<strong>a levantar</strong><span>Datas por cidade</span><small>Nenhuma data individual foi publicada nas fontes recuperadas</small></div></div>"""
    return f"""<section class="container reach-section" id="agenda"><hr class="rule">
<h2 class="section-title">AGENDA<br><em>DA TURNÊ.</em></h2>
{painel}
<div class="table-wrap"><table class="amounts reach-table">{cabecalho}
<tbody>{''.join(linhas)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver local, situação e fonte.</p>
{f'<h3 class="cases-title">Apresentações relacionadas</h3><div class="table-wrap"><table class="amounts reach-table">{cabecalho}<tbody>{"".join(rel)}</tbody></table></div>' if rel else ''}
<p class="note">{e(ed.get('note_shows', ''))}</p></section>"""


def page_edition(pr, year):
    depth, p = 3, rel(3)
    slug, ystr = pr["slug"], str(year)
    ed = pr.get("editions", {}).get(ystr, {})
    trail_html, trail_ld = crumbs(depth, [("Projetos", p + "projetos/"),
                                          (pr["name"], p + f"projetos/{slug}/"),
                                          (f"Edição {year}", None)])
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
        nav_links.append(f'<a href="{p}projetos/{slug}/{prev}/">{icon("arrow_back")} Edição {prev}</a>')
    if idx < len(years_sorted) - 1:
        nxt = years_sorted[idx + 1]
        nav_links.append(f'<a href="{p}projetos/{slug}/{nxt}/">Edição {nxt} {icon("arrow_forward")}</a>')
    others = [y for y in pr["years"] if y != year]
    other_html = "".join(f'<a href="{p}projetos/{slug}/{y}/">{y} {icon("arrow_outward")}</a>'
                         for y in others) or "<span>Primeira edição catalogada</span>"

    ld = {"@context": "https://schema.org", "@type": "WebPage",
          "name": f"{pr['name']} {year}", "url": f"{BASE}/projetos/{slug}/{year}/",
          "inLanguage": "pt-BR",
          "about": {"@type": "Event", "name": f"{pr['name']} {year}",
                    "location": {"@type": "Place", "name": ed.get("place", pr["location"])}}}
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="edition-hero container">
<a class="back" href="{p}projetos/{slug}/">{icon('arrow_back')} Histórico de {e(pr['name'])}</a>
<h1>{e(pr['name'])}<br><em>{year}.</em></h1>
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
{cast_block(pr, year)}
{op_edition(pr, year)}
<section class="container gallery-section">
<hr class="rule">
<h2 class="section-title">POR DENTRO<br><em>DO ACONTECIMENTO.</em></h2>
<div class="gallery">
{slot(f'{slug}-{year}-01.jpg', '16:9', 'Foto principal da edição', 'slot-wide')}
{slot(f'{slug}-{year}-02.jpg', '4:5', 'Bastidores')}
{slot(f'{slug}-{year}-03.jpg', '4:5', 'Atletas e público')}</div>
<p class="note">Os três espaços acima entram no ar assim que os arquivos forem colocados em <code>assets/fotos/</code> com esses nomes. Publique apenas imagem com direito de uso verificado.</p></section>
<section class="container insights">
<hr class="rule">
<div class="insight-content"><h2>ALÉM DA ARENA.</h2>
<p>Projetos como este articulam pessoas, território, produção e marcas. A leitura da Cadillac apresenta contexto e oportunidades do setor sem inventar métricas de público, resultados ou atribuições contratuais.</p>
<a class="pill-link" href="{p}dados/">Explorar dados e métricas {icon('insights')}</a></div></section>
<section class="container sources">
<hr class="rule">
<h2>FONTES E DOCUMENTAÇÃO.</h2>{source_list(sources)}
<div class="year-links"><span>Navegar nas edições</span>{''.join(nav_links)}</div>
<div class="year-links"><span>Outros anos</span>{other_html}</div></section></main>"""
    return write(f"projetos/{slug}/{year}/index.html",
                 head(depth, f"{pr['name']} {year} | Cadillac Produções",
                      f"{pr['name']} {year}: datas, fatos documentados, elenco e fontes públicas da edição.",
                      f"projetos/{slug}/{year}/", [ld, trail_ld], og_image=og_for(pr, year))
                 + header(depth, "projetos") + body + footer(depth))


def page_press():
    depth, p = 1, rel(1)
    trail_html, trail_ld = crumbs(depth, [("Na Mídia", None)])
    groups, total, hosts = [], 0, set()
    for pr in PROJECTS:
        items = list(pr["sources"])
        for y in sorted(pr["yearsources"], reverse=True):
            for label, url in pr["yearsources"][y]:
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
<a href="{p}projetos/{pr['slug']}/">Página do projeto {icon('arrow_outward')}</a></div></article>""")
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>NA MÍDIA<span class="orange">.</span></h1>
<p class="lede">Histórias que ganharam as ruas, as arenas e a imprensa. Cada item aponta para a publicação original, agrupado pelo projeto a que se refere.</p>
</section>
<section class="container sources">
{''.join(groups)}
<p class="note">Reunimos links para as publicações originais e não reproduzimos matérias integrais nem fotografias jornalísticas sem licença. A citação de um veículo não implica parceria, patrocínio ou endosso.</p></section></main>"""
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


def selo_data(datas):
    if not datas:
        return ""
    rotulo, _, ic = MODEL["datas"]["status"][datas["status"]]
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
        fonte = ""
        if et.get("fonte"):
            label, url = et["fonte"]
            fonte = (f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">'
                     f'{e(label)} {icon("open_in_new")}</a>')
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
<div><strong>{big(t['sum'])}</strong><span>{e(label)}</span></div>
<p class="reach-note">{plural(t['n'], 'registro somado', 'registros somados')} · {plural(t['pend'], 'linha a preencher', 'linhas a preencher')}</p></div>""")

    rows = []
    for x in sorted(data["entries"], key=lambda x: (x["project"], -(x["year"] or 0))):
        pr = by_slug[x["project"]]
        href = f'{p}projetos/{pr["slug"]}/' + (f'{x["year"]}/' if x["year"] else "")
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
            label, url = x["source"]
            src = (f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">'
                   f'{e(label)} {icon("open_in_new")}</a>')
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
<h2 class="section-title">QUANTA GENTE<br><em>A GENTE ALCANÇA.</em></h2>
<p class="body-copy">{e(data['lede'])}</p>
<div class="data-stats reach-grid">{''.join(panels)}</div>
<div class="charts"><div class="chart-card span-2"><h3>Linha a linha, com o responsável pelo número</h3>
<p class="chart-sub">Cada registro mostra quem divulgou e o que o número mede. As linhas em branco são as que faltam levantar: preencha em <code>content-model.json</code> e rode o gerador.</p>
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Evento</th><th scope="col">Grandeza</th><th scope="col">Número</th><th scope="col">Base</th><th scope="col">Quem divulgou</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver a base e a fonte.</p></div>
{f'<div class="chart-card span-2"><h3>Público presente por evento</h3><p class="chart-sub">Somente registros com número e origem. Projeções ficam de fora.</p><figure>{chart}<figcaption>Série única, em pessoas. Cresce conforme as linhas em branco forem preenchidas.</figcaption></figure></div>' if chart else ''}
</div>
<div class="area-list reach-method"><h3>Como este número é construído</h3><ul>{method}</ul></div>
<p class="note">Hoje {plural(pend, 'linha depende', 'linhas dependem')} de dado que só a produção tem: bilheteria, contagem de credencial, relatório de plataforma ou laudo de público. Enquanto não chegam, o total mostra menos do que a Cadillac realmente alcançou — e é assim que deve ser, porque número sem origem não se defende em reunião de patrocínio.</p>
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
<td><a href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(label)} {icon('open_in_new')}</a></td></tr>""")
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
<h2 class="section-title">PORTE DA<br><em>OPERAÇÃO.</em></h2>
<p class="body-copy">O que este projeto mobiliza para acontecer. Os campos preenchidos têm origem identificada; os demais dependem de dado da produção.</p>
{op_tiles(perfil, f'operacao.perfil.{pr["slug"]}', order)}</section>"""


def op_edition(pr, year):
    key = f'{pr["slug"]}-{year}'
    ficha = MODEL["operacao"]["fichas"].get(key, {})
    order = ["inscritos", "publico", "capacidade", "staff", "fornecedores",
             "dias_evento", "dias_montagem", "modalidades", "palcos", "transmissao"]
    return f"""<section class="container op-section"><hr class="rule">
<h2 class="section-title">A OPERAÇÃO<br><em>DESTA EDIÇÃO.</em></h2>
{op_tiles(ficha, f'operacao.fichas.{key}', order)}
<p class="note">{e(MODEL["operacao"]["note"])}</p></section>"""


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
        href = f'{p}projetos/{pr["slug"]}/' + (f'{r["year"]}/' if r["year"] else "")
        if r["metrica"]:
            metric = (f'<span class="val">{e(r["metrica"])}</span>'
                      f'<small>lido em {e(r["capturado_em"])}</small>')
        else:
            metric = '<span class="val pend">a medir</span>'
        link = (f'<a href="{e(r["url"])}" target="_blank" rel="noopener noreferrer">'
                f'abrir {icon("open_in_new")}</a>' if r["url"] else
                '<span class="tag-wait">URL a registrar</span>')
        fonte = ""
        if r["fonte"]:
            label, url = r["fonte"]
            fonte = (f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">'
                     f'{e(label)} {icon("open_in_new")}</a>')
        rows.append(f"""<tr><th scope="row"><a href="{href}">{e(pr['name'])}{' ' + str(r['year']) if r['year'] else ''}</a>
<small>{e(r['o_que'])}</small></th>
<td>{e(r['parceiro'])}<small>{e(r['canal'])}</small></td>
<td>{metric}</td><td>{link}</td><td>{fonte or '—'}</td></tr>""")
    pend = sum(1 for r in data["registros"] if not r["metrica"])
    return f"""<section class="container reach-section" id="transmissoes"><hr class="rule">
<h2 class="section-title">O QUE FOI<br><em>AO AR.</em></h2>
<p class="body-copy">{e(data['lede'])}</p>
<div class="charts"><div class="chart-card span-2"><h3>Transmissões por evento e parceiro</h3>
<p class="chart-sub">{plural(pend, 'linha aguarda', 'linhas aguardam')} a leitura na plataforma.</p>
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Evento</th><th scope="col">Parceiro e canal</th><th scope="col">Audiência</th><th scope="col">Registro</th><th scope="col">Referência</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver o registro e a referência.</p></div></div>
<h3 class="cases-title">Como cada número é lido</h3>
<div class="method">{how}</div>
<p class="note">{e(data['note'])}</p></section>"""


def cast_block(pr, year=None, numero="05"):
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
        itens = "".join(f'<li><strong>{e(nome)}</strong><span>{e(papel)}</span></li>'
                        for nome, papel in gente)
        colunas.append(f"""<div class="cast-col"><h3>{icon(ic)} {titulo}</h3><ul>{itens}</ul></div>""")
    fonte = ""
    if bloco.get("fonte"):
        label, url = bloco["fonte"]
        fonte = (f'<p class="cast-source">Fonte: <a href="{e(url)}" target="_blank" '
                 f'rel="noopener noreferrer">{e(label)} {icon("open_in_new")}</a></p>')
    return f"""<section class="container cast-section"><hr class="rule">
<h2 class="section-title">QUEM ESTEVE<br><em>EM CENA.</em></h2>
<div class="cast-grid">{''.join(colunas)}</div>{fonte}
<p class="note">{e(data["note"])}</p></section>"""


def events_table(depth):
    """Uma linha por edição, da mais recente para a mais antiga."""
    p = rel(depth)
    op = MODEL["operacao"]["fichas"]
    elenco = MODEL["elenco"]["por_edicao"]
    aud = MODEL["audiencia"]["entries"]
    linhas = []
    edicoes = [(pr, y) for pr in PROJECTS for y in pr["years"]]
    edicoes.sort(key=lambda t: (-t[1], t[0]["name"]))
    for pr, year in edicoes:
        key = f'{pr["slug"]}-{year}'
        ed = pr.get("editions", {}).get(str(year), {})
        ficha = op.get(key, {})
        bruto = ficha.get("inscritos")
        inscritos = bruto[0] if isinstance(bruto, list) else bruto
        # número declarado vence estimativa, que vence projeção
        prioridade = {"declarado": 0, "estimado": 1, "projecao": 2}
        candidatos = sorted(
            (x for x in aud if x["project"] == pr["slug"] and x["year"] == year
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
<h2 class="section-title">EVENTO<br><em>POR EVENTO.</em></h2>
<p class="body-copy">Cada edição com data, local, público, inscritos e quem esteve em cena. Da mais recente para a mais antiga.</p>
<div class="charts"><div class="chart-card span-2">
<div class="table-wrap"><table class="amounts reach-table">
<thead><tr><th scope="col">Edição</th><th scope="col">Quando</th><th scope="col">Onde</th><th scope="col">Público</th><th scope="col">Em cena</th></tr></thead>
<tbody>{''.join(linhas)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver público, inscritos e elenco.</p></div></div>
<div class="section-end"><a class="pill-link" href="{p}agenda/">Ver a agenda completa {icon('calendar_month')}</a></div></section>"""


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
        ("stacked_bar_chart", f"{M['projects']:02d}", "Projetos indexados"),
        ("calendar_month", f"{M['editions']:02d}", "Edições com página própria"),
        ("description", f"{M['facts']:02d}", "Registros documentados"),
        ("open_in_new", f"{M['sources']:02d}", "Fontes públicas citadas"),
        ("insights", M["span"], "Período coberto nesta versão"),
    ]
    panels_html = "".join(f'<div class="data-panel">{icon(ic)}<div><strong>{v}</strong>'
                          f'<span>{l}</span></div></div>' for ic, v, l in panels)
    sector_html = "".join(f'<div><strong>{e(v)}</strong><span>{e(l)}</span></div>'
                          for v, l in MODEL["sector"]["items"])
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>DADOS<span class="orange">.</span></h1>
<p class="lede">Um acervo conectado de projetos, edições, território, modalidades, cobertura e fontes públicas — com a metodologia à vista.</p></section>
{audience_blocks(depth)}
{events_table(depth)}
{broadcast_block(depth)}
<section class="container charts">
<div class="chart-card"><h3>Edições por ano</h3>
<p class="chart-sub">Quantas edições a Cadillac tem documentadas em cada ano, do mais recente ao mais antigo.</p>
<figure>{bars_vertical(per_year, ('edição', 'edições'))}
<figcaption>Série única. Ano sem barra é ano sem edição catalogada aqui, não ano sem evento.</figcaption></figure></div>
<div class="chart-card"><h3>Projetos por área de atuação</h3>
<p class="chart-sub">Distribuição do acervo entre esporte, festivais, música e cultura.</p>
<figure>{bars_horizontal(cat_counts, ('projeto', 'projetos'), w=560)}
<figcaption>Cada projeto é contado em uma única área, a predominante no registro.</figcaption></figure></div>
<div class="chart-card span-2"><h3>Cobertura por projeto e ano</h3>
<p class="chart-sub">Onde há edição documentada, a célula leva direto à página da edição.</p>
{coverage_matrix(depth)}<p class="table-hint">Arraste a tabela para o lado para ver todos os anos.</p></div>
<div class="chart-card span-2"><h3>Números divulgados por terceiros</h3>
<p class="chart-sub">Público, atletas, premiações e streams que aparecem em fontes públicas — com quem divulgou e o que cada número realmente mede.</p>
{declared_table(depth)}
<p class="table-hint">Arraste a tabela para o lado para ver a atribuição e a fonte.</p></div>
<div class="chart-card span-2"><h3>Valores em registros públicos</h3>
<p class="chart-sub">Os únicos valores financeiros que este portal publica são os que constam em documentos públicos, com a fonte ao lado.</p>
{amounts_table()}<p class="table-hint">Arraste a tabela para o lado para ver valor e fonte.</p></div>
</section>
<section class="container sector"><hr class="rule">
<h2 class="section-title">O SETOR EM QUE<br><em>A GENTE OPERA.</em></h2>
<div class="hero-metrics">{sector_html}</div>
<p class="note">{e(MODEL['sector']['note'])}</p></section>
<section class="container sources">
<hr class="rule">
<h2>DADOS COM ORIGEM.</h2>
<p class="body-copy">Os indicadores desta página descrevem o conteúdo catalogado neste portal, não o total histórico de eventos da Cadillac. Cada número é calculado a partir do mesmo modelo de conteúdo que gera as páginas: um projeto é contado quando tem página própria, uma edição quando tem ano documentado, um registro quando tem fonte identificável e uma fonte quando tem URL pública.</p>
<p class="body-copy">Informações sobre audiência, contratos, alcance ou impacto econômico só serão publicadas após identificação de metodologia e fonte verificável. Valores financeiros aparecem apenas como constam em documento público, com a natureza explicitada: valor aprovado para captação não é valor captado, e valor de objeto contratado não é receita.</p>
<div class="source-list">
<a href="{p}projetos/"><span class="s-main"><span class="s-label">Consultar projetos e edições</span>
<span class="s-host">{plural(M['projects'], 'projeto', 'projetos')} · {plural(M['editions'], 'edição', 'edições')}</span></span>{icon('arrow_outward')}</a>
<a href="{p}na-midia/"><span class="s-main"><span class="s-label">Consultar imprensa e referências</span>
<span class="s-host">{plural(M['sources'], 'fonte pública', 'fontes públicas')}</span></span>{icon('arrow_outward')}</a>
</div>
<p class="note">Atualizado em {e(MODEL['updated'])}. O acervo é incremental: novos projetos, edições e fontes alteram todos os indicadores desta página automaticamente na próxima geração.</p>
</section></main>"""
    ld = {"@context": "https://schema.org", "@type": "Dataset",
          "name": "Acervo documental Cadillac", "url": f"{BASE}/dados/",
          "description": "Projetos, edições, registros documentados e fontes públicas catalogados no portal Cadillac.",
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
                        f'{e(label)} {icon("open_in_new")}</a>')
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
                href = f'{p}projetos/{pr["slug"]}/' + (f'{c["year"]}/' if c["year"] else "")
                page = (f'<a href="{href}">{icon("arrow_outward")} '
                        f'{e(pr["name"])}{" " + str(c["year"]) if c["year"] else ""}</a>')
            else:
                page = ""
            cases.append(f"""<article class="case">{thumb}<h4>{e(c["title"])}</h4><p>{e(c["text"])}</p>
<div class="case-links">{page}{link}</div></article>""")
        sections.append(f"""<section class="container area" id="{a["slug"]}"><hr class="rule">
<div class="area-head"><span class="svc-i">{icon(a["icon"])}</span>
<div><h2>{e(a["title"])}<span class="orange">.</span></h2><p class="lede">{e(a["lede"])}</p></div></div>
<div class="area-body"><div class="area-text">{"".join(f"<p>{e(t)}</p>" for t in a["paragraphs"])}</div>
<div class="area-list"><h3>O que entregamos</h3><ul>{items}</ul></div></div>
<h3 class="cases-title">Casos no acervo</h3>
<div class="cases">{"".join(cases)}</div></section>""")

    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>ATUAÇÃO<span class="orange">.</span></h1>
<p class="lede">{e(data["lede"])}</p>
<div class="chips area-index">{"".join(index)}</div></section>
<section class="container method-section"><hr class="rule">
<h2 class="section-title">COMO UM PROJETO<br><em>SAI DO PAPEL.</em></h2>
<div class="method">{method}</div></section>
{"".join(sections)}
<section class="container related"><hr class="rule">
<h2 class="section-title">VER TUDO<br><em>NO ACERVO.</em></h2>
<p class="body-copy">Cada caso acima tem página própria, com as outras edições, os fatos documentados e as fontes completas.</p>
<div class="section-end"><a class="pill-link" href="{p}projetos/">Explorar os projetos {icon('arrow_outward')}</a></div>
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
<p class="note">{e(data["note"])}</p></section></main>"""
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
            etapas = ed.get("etapas") or []
            shows = ed.get("shows") or []
            if not etapas and not shows:
                itens.append({"nome": f'{pr["name"]} {year}', "tipo": "Edição",
                              "local": ed.get("place", pr["location"]), "href": href,
                              "datas": ed.get("datas")})
            for et in etapas:
                itens.append({"nome": f'{pr["name"]} {year} · {et["nome"]}', "tipo": "Etapa",
                              "local": et["nome"], "href": href,
                              "datas": ({"inicio": et["inicio"], "fim": et["fim"], "precisao": "dia",
                                         "status": et["status"]} if et["inicio"]
                                        else {"inicio": f"{year}-01-01", "fim": f"{year}-12-31",
                                              "precisao": "ano", "status": et["status"]})})
            for sh in shows:
                itens.append({"nome": f'{pr["name"]} {year} · {sh["cidade"]}', "tipo": "Show",
                              "local": sh["cidade"], "href": href,
                              "datas": ({"inicio": sh["data"], "fim": sh["data"], "precisao": "dia",
                                         "status": sh["status"]} if sh.get("data")
                                        else {"inicio": f"{year}-01-01", "fim": f"{year}-12-31",
                                              "precisao": "ano", "status": sh["status"]})})
            for r in ed.get("relacionados", []):
                itens.append({"nome": f'{pr["name"]} · {r["o_que"]}', "tipo": "Relacionado",
                              "local": r["local"], "href": href,
                              "datas": ({"inicio": r["data"], "fim": r["data_fim"] or r["data"],
                                         "precisao": "dia", "status": r["status"]} if r.get("data")
                                        else {"inicio": f"{year}-01-01", "fim": f"{year}-12-31",
                                              "precisao": "ano", "status": r["status"]})})
        if not pr["years"] and pr.get("datas_projeto"):
            itens.append({"nome": pr["name"], "tipo": "Ação", "local": pr["location"],
                          "href": href_pr, "datas": pr["datas_projeto"]})

    exatos = [x for x in itens if x["datas"] and x["datas"]["precisao"] != "ano"]
    sem_dia = [x for x in itens if not x["datas"] or x["datas"]["precisao"] == "ano"]
    exatos.sort(key=lambda x: x["datas"]["inicio"], reverse=True)
    sem_dia.sort(key=lambda x: (x["datas"]["inicio"] if x["datas"] else ""), reverse=True)

    def linha(x):
        txt, dias = periodo(x["datas"])
        if x["datas"] and x["datas"]["precisao"] == "ano":
            quando = f'<span class="val pend">{e(txt)}</span>'
        else:
            quando = e(txt) + (f'<small>{plural(dias, "dia", "dias")}</small>' if dias else "")
        return (f'<tr><th scope="row"><a href="{x["href"]}">{e(x["nome"])}</a>'
                f'<small>{e(x["tipo"])}</small></th><td>{quando}</td>'
                f'<td>{e(x["local"])}</td><td>{selo_data(x["datas"])}</td></tr>')

    cab = ('<thead><tr><th scope="col">O quê</th><th scope="col">Quando</th>'
           '<th scope="col">Onde</th><th scope="col">Situação da data</th></tr></thead>')
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><h1>AGENDA<span class="orange">.</span></h1>
<p class="lede">Toda edição, etapa de circuito e show em um calendário único, do mais recente para o mais antigo. Cada linha diz de onde veio a data.</p>
</section>
<section class="container reach-section"><hr class="rule">
<h2 class="section-title">COM DATA<br><em>DEFINIDA.</em></h2>
<div class="table-wrap"><table class="amounts reach-table">{cab}
<tbody>{''.join(linha(x) for x in exatos)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver onde e a situação.</p></section>
<section class="container reach-section"><hr class="rule">
<h2 class="section-title">AINDA SEM<br><em>DIA E MÊS.</em></h2>
<p class="body-copy">Aconteceram, mas só o ano está documentado. Cada uma destas linhas vira data exata com o cronograma, o contrato ou o mapa de turnê da edição.</p>
<div class="table-wrap"><table class="amounts reach-table">{cab}
<tbody>{''.join(linha(x) for x in sem_dia)}</tbody></table></div>
<p class="table-hint">Arraste a tabela para o lado para ver onde e a situação.</p>
<p class="note">{e(MODEL['datas']['note'])}</p></section></main>"""
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": "Agenda",
          "url": f"{BASE}/agenda/", "inLanguage": "pt-BR"}
    return write("agenda/index.html",
                 head(depth, "Agenda | Todas as edições, etapas e shows | Cadillac Produções",
                      "Calendário completo dos projetos Cadillac: edições, etapas de circuito e "
                      "shows, com data, local e a procedência de cada informação.",
                      "agenda/", [ld, trail_ld]) + header(depth, "agenda") + body + footer(depth))


def page_404():
    body = f"""<main id="conteudo"><span id="top"></span>
<section class="container error-page"><h1>404<span class="orange">.</span></h1>
<p>A página que você procurou saiu de cartaz. O acervo continua no ar — siga por um destes caminhos.</p>
<div class="error-actions">
<a class="pill-link" href="./projetos/">Ver projetos {icon('arrow_outward')}</a>
<a class="pill-link" href="./dados/">Ver dados {icon('insights')}</a>
<a class="pill-link" href="./">Página inicial {icon('home')}</a></div></section></main>"""
    page = (head(0, "Página não encontrada | Cadillac Produções",
                 "A página não foi encontrada. Navegue pelo acervo de projetos, edições e dados da Cadillac.",
                 "404.html") + header(0) + body + footer(0))
    page = (page.replace('href="assets/', f'href="{BASE}/assets/')
                .replace('src="assets/', f'src="{BASE}/assets/')
                .replace('href="./', f'href="{BASE}/'))
    return write("404.html", page)


def page_sitemap():
    urls = ["", "projetos/", "atuacao/", "agenda/", "na-midia/", "dados/", "ecossistema/"]
    for pr in PROJECTS:
        urls.append(f"projetos/{pr['slug']}/")
        for y in pr["years"]:
            urls.append(f"projetos/{pr['slug']}/{y}/")
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
               page_data(), page_ecossistema(), page_404()]
    for pr in PROJECTS:
        written.append(page_project(pr))
        for y in pr["years"]:
            written.append(page_edition(pr, y))
    n = page_sitemap()
    print(f"{len(written)} páginas geradas, {n} URLs no sitemap.")
    for w in written:
        print("  ", w)


if __name__ == "__main__":
    main()
