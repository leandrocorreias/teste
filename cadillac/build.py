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
PROJECTS = MODEL["projects"]

ICON_SUBSET = ",".join(sorted([
    "arrow_back", "arrow_forward", "arrow_outward", "calendar_month", "campaign",
    "chevron_right", "close", "description", "engineering", "expand_more", "festival",
    "filter_list", "home", "insights", "mail", "menu", "movie", "music_note", "north",
    "open_in_new", "palette", "place", "search", "skateboarding", "stacked_bar_chart",
    "verified",
]))

NAV = [
    ("Projetos", "projetos/", "projetos", "stacked_bar_chart"),
    ("Na Mídia", "na-midia/", "na-midia", "description"),
    ("Dados", "dados/", "dados", "insights"),
    ("Atuação", "#atuacao", "atuacao", "engineering"),
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
def head(depth, title, desc, path, jsonld=(), extra=""):
    p = rel(depth)
    url = f"{BASE}/{path}" if path else f"{BASE}/"
    blocks = "".join(
        f'<script type="application/ld+json">{json.dumps(b, ensure_ascii=False)}</script>'
        for b in jsonld
    )
    fonts = (
        '<link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
        'family=Barlow+Condensed:wght@600;700;800&family=DM+Sans:wght@400;500;600;700'
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
<meta property="og:image" content="{BASE}/assets/og-cadillac.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Logotipo da Cadillac Produções e Filmes">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(title)}">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{BASE}/assets/og-cadillac.jpg">
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
             ("Na Mídia", home + "na-midia/", "description"),
             ("Dados", home + "dados/", "insights"),
             ("Atuação", home + "#atuacao", "engineering"),
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
    rows = []
    for label, url in sources:
        rows.append(
            f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">'
            f'<span class="s-main"><span class="s-label">{e(label)}</span>'
            f'<span class="s-host">{e(host_of(url))}</span></span>'
            f'{icon("open_in_new")}</a>'
        )
    return f'<div class="source-list">{"".join(rows)}</div>'


def media(project, classes="", eager=False):
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
    if img:
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
    section = f"""<section class="container faq-section"><div class="section-kicker">
<span>{number} / PERGUNTAS FREQUENTES</span><span>RESPOSTAS CURTAS E VERIFICÁVEIS</span></div>
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
    return f"""<a class="work-card" data-project data-categoria="{project['category']}" data-anos="{years}" data-busca="{e(search_blob)}" href="{p}projetos/{project['slug']}/">
{media(project, eager=eager)}
<div class="card-info"><div><span class="eyebrow">{e(project['kind'])} / {e(project['period'])}</span>
<h3>{e(project['name'])}</h3><div class="card-meta">{meta}</div></div>
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
    years = sorted({y for pr in PROJECTS for y in pr["years"]})
    all_sources = set()
    for pr in PROJECTS:
        all_sources |= project_sources(pr)
    per_year = {}
    for pr in PROJECTS:
        for y in pr["years"]:
            per_year[y] = per_year.get(y, 0) + 1
    return {
        "projects": len(PROJECTS),
        "editions": sum(len(pr["years"]) for pr in PROJECTS),
        "years": years,
        "span": f"{years[0]}–{str(years[-1])[2:]}" if years else "—",
        "sources": len(all_sources),
        "facts": sum(project_facts(pr) for pr in PROJECTS),
        "per_year": dict(sorted(per_year.items())),
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
        f'<div class="service-row"><span class="svc-i">{icon(ic)}</span><h3>{e(title)}</h3>'
        f'<p>{e(desc)}</p><span class="card-arrow">{icon("arrow_outward")}</span></div>'
        for title, desc, ic in MODEL["services"])
    highlights = []
    for pr in PROJECTS[-3:]:
        cat = CATS[pr["category"]]
        highlights.append(f"""<article><span class="eyebrow">{icon(cat['icon'])} {e(cat['label'])}</span>
<h3>{e(pr['name'])}</h3><p>{e(pr['desc'])}</p>
<a class="pill-link" href="./projetos/{pr['slug']}/">Conhecer {icon('arrow_outward')}</a></article>""")
    press_html = "".join(
        f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">'
        f'<span class="article-idx">{i:02d} / {e(outlet.upper())}</span>'
        f'<h3>{e(title)}</h3><small>{icon("open_in_new")} Cobertura externa</small></a>'
        for i, (outlet, title, url) in enumerate(MODEL["featured_press"], start=1))
    body = f"""<main id="conteudo"><span id="top"></span>
<section class="hero container">
<div class="hero-meta"><span>PRODUÇÃO · ESPORTE · CULTURA</span><span>RIO DE JANEIRO, BRASIL / DESDE {SITE['base_year']}</span></div>
<div class="hero-big"><h1>A GENTE FAZ.<br>A GENTE RESOLVE.<br><em>O EXTRAORDINÁRIO ACONTECE.</em></h1>
<a class="circle-link" href="./projetos/" aria-label="Ver o acervo de projetos">{icon('arrow_outward')}</a></div>
<div class="hero-bottom"><p>Do primeiro rabisco ao último aplauso. A gente transforma desafios em experiências que movem pessoas, marcas e cidades.</p>
<span>EXPLORE OS PROJETOS {icon('expand_more')}</span></div></section>
<section class="container"><div class="hero-metrics">
<div><strong>{M['projects']:02d}</strong><span>Projetos documentados</span></div>
<div><strong>{M['editions']:02d}</strong><span>Edições com página própria</span></div>
<div><strong>{M['span']}</strong><span>Período coberto</span></div>
<div><strong>{M['sources']:02d}</strong><span>Fontes públicas citadas</span></div>
</div></section>
<section class="container showcase" id="projetos">
<div class="section-kicker"><span>01 / EM DESTAQUE</span><span>UMA SELEÇÃO DO NOSSO UNIVERSO</span></div>
<div class="works-grid">{cards}</div>
<div class="section-end"><a class="pill-link" href="./projetos/">Explorar o acervo completo {icon('arrow_outward')}</a></div></section>
<section class="container editorial" id="historias">
<div class="section-kicker"><span>02 / HISTÓRIAS</span><span>O QUE ESTÁ POR TRÁS DAS EXPERIÊNCIAS</span></div>
<h2 class="section-title">HISTÓRIAS QUE <em>CONTINUAM.</em></h2>
<div class="article-grid">{''.join(highlights)}</div></section>
<section class="statement" id="sobre"><div class="container statement-grid">
<span class="eyebrow">03 / SOBRE A CADILLAC</span>
<div><h2>O IMPOSSÍVEL<br>NÃO ENTRA <em>NA PLANILHA.</em></h2>
<p>A Cadillac reúne trajetória em produção artística, esportes e entretenimento. Este portal documenta cada projeto com contexto, edições, registros e fontes. O que merece ficar não termina quando o evento acaba.</p>
<p>Cada afirmação publicada aqui tem origem identificada. Quando um dado depende de contrato, ficha técnica ou autorização ainda em validação, dizemos isso na própria página.</p></div></div></section>
<section class="container services" id="atuacao">
<div class="section-kicker"><span>04 / ATUAÇÃO</span><span>COMPETÊNCIAS E CONEXÕES</span></div>
<h2 class="section-title">DA IDEIA À<br><em>EXPERIÊNCIA.</em></h2>
<div class="service-list">{services}</div></section>
<section class="dark-strip"><div class="container"><span class="eyebrow">CADILLAC / NOSSO OLHAR</span>
<h2>NÃO É SÓ O QUE<br>ACONTECE. <em>É O QUE FICA.</em></h2></div></section>
<section class="container editorial">
<div class="section-kicker"><span>05 / NA MÍDIA</span><span>REGISTROS, REPORTAGENS E REFERÊNCIAS</span></div>
<div class="editorial-header"><h2 class="section-title">HISTÓRIAS<br>QUE CIRCULAM.</h2>
<a class="pill-link" href="./na-midia/">Ver todas as fontes {icon('arrow_outward')}</a></div>
<div class="article-grid">{press_html}</div></section>
<section class="contact" id="contato"><div class="container"><span class="eyebrow">06 / CONTATO</span>
<h2>TEM UMA IDEIA GRANDE?<br><em>ENTÃO CHAMA A GENTE.</em></h2>
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
<section class="page-hero container"><span class="eyebrow">ACERVO CADILLAC / 01</span>
<h1>PROJETOS<span class="orange">.</span></h1>
<p class="lede">Propriedades, produções e histórias reunidas em um acervo vivo. Filtre por área, por ano ou busque pelo nome do projeto.</p>
<div class="metric-row">
<div><strong>{M['projects']:02d}</strong><span>Projetos</span></div>
<div><strong>{M['editions']:02d}</strong><span>Edições com página</span></div>
<div><strong>{M['facts']:02d}</strong><span>Registros documentados</span></div>
<div><strong>{M['sources']:02d}</strong><span>Fontes citadas</span></div></div></section>
<section class="container index-grid">
<div class="section-kicker"><span>EXPLORAR PORTFÓLIO</span><span>{M['projects']:02d} PROJETOS DOCUMENTADOS</span></div>
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
    metric = f"""<div class="metric-row">
<div><strong>{len(pr['years']) or '—'}</strong><span>Edições catalogadas</span></div>
<div><strong>{n_facts:02d}</strong><span>Registros documentados</span></div>
<div><strong>{n_sources:02d}</strong><span>Fontes públicas</span></div>
<div><strong>{e(pr['period'])}</strong><span>Período coberto</span></div></div>"""

    sections, n = [], 1

    sections.append(f"""<section class="container detail-intro">
<div><span class="eyebrow">{n:02d} / VISÃO GERAL</span><h2>UM PROJETO.<br>MUITAS HISTÓRIAS.</h2></div>
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
            note = " · ".join(x for x in [ed.get("period"), ed.get("place"), ed.get("note")] if x)
            rows.append(f"""<a class="year-row" href="{p}projetos/{slug}/{y}/">
<span class="yr">{y}</span><span><strong>{e(pr['name'])} {y}</strong>
<span class="yr-note">{e(note) if note else 'Edição catalogada'}</span></span>
<span class="yr-go">Explorar edição {icon('arrow_outward')}</span></a>""")
        chart = bars_horizontal([(str(y), len(pr["facts"].get(str(y), []))) for y in sorted(pr["years"])],
                                ("registro", "registros"), w=560, row=38)
        sections.append(f"""<section class="container timeline">
<div class="section-kicker"><span>{n:02d} / HISTÓRICO</span><span>NAVEGUE POR ANO</span></div>
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
<div class="section-kicker"><span>{n:02d} / REGISTROS DOCUMENTADOS</span><span>{e(pr['period'])}</span></div>
<h2 class="section-title">O QUE ESTÁ<br><em>DOCUMENTADO.</em></h2>
<div class="facts">{facts}</div>
<p class="note">Este projeto ainda não tem edições anuais catalogadas. Quando houver documentação por ano, cada edição ganha página própria com fontes.</p></section>""")
        n += 1

    faq_html, faq_ld = faq_block(pr, f"{n:02d}")
    if faq_html:
        sections.append(faq_html)
        n += 1

    sections.append(f"""<section class="container sources">
<div class="section-kicker"><span>{n:02d} / REFERÊNCIAS</span><span>FONTES PÚBLICAS E CRÉDITOS</span></div>
<h2>FONTES PARA IR ALÉM.</h2>{source_list(pr['sources'])}</section>""")
    n += 1

    related = [x for x in PROJECTS if x["slug"] != slug and x["category"] == pr["category"]]
    related += [x for x in PROJECTS if x["slug"] != slug and x not in related]
    rel_cards = "".join(card(x, depth) for x in related[:2])
    sections.append(f"""<section class="container related">
<div class="section-kicker"><span>{n:02d} / CONTINUE NAVEGANDO</span><span>PROJETOS RELACIONADOS</span></div>
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
<div class="project-title"><span class="eyebrow">{e(pr['kind'])} / {e(pr['location'])}</span>
<h1>{e(pr['name'])}<span class="orange">.</span></h1><p>{e(pr['desc'])}</p></div>
{media(pr, 'banner', eager=True)}{metric}</section>
{''.join(sections)}</main>"""
    return write(f"projetos/{slug}/index.html",
                 head(depth, f"{pr['name']} | Histórico e edições | Cadillac Produções",
                      f"{pr['name']}: histórico, edições, fatos documentados e fontes públicas. {pr['desc']}",
                      f"projetos/{slug}/", blocks) + header(depth, "projetos") + body + footer(depth))


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
    meta_tags = [f'<span>{icon("calendar_month")} {e(ed.get("period", ystr))}</span>']
    if ed.get("place"):
        meta_tags.append(f'<span>{icon("place")} {e(ed["place"])}</span>')
    if ed.get("note"):
        meta_tags.append(f'<span>{icon("verified")} {e(ed["note"])}</span>')

    years_sorted = sorted(pr["years"])
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
<span class="eyebrow">{e(pr['kind'])} / EDIÇÃO {year}</span>
<h1>{e(pr['name'])}<br><em>{year}.</em></h1>
<p class="lede">{e(pr['desc'])}</p>
<div class="taglist">{''.join(meta_tags)}</div>
{media(pr, 'banner', eager=True)}
<div class="metric-row">
<div><strong>{len(facts):02d}</strong><span>Fatos documentados</span></div>
<div><strong>{len(sources):02d}</strong><span>Fontes desta edição</span></div>
<div><strong>{year}</strong><span>Edição</span></div>
<div><strong>{len(pr['years']):02d}</strong><span>Edições no acervo</span></div></div></section>
<section class="container detail-intro">
<div><span class="eyebrow">01 / CONTEXTO</span><h2>O QUE MARCOU<br>ESTA EDIÇÃO.</h2></div>
<div><p>Esta página é um registro editorial em atualização contínua. Apresentamos somente informações sustentadas por referências identificáveis, com prioridade para documentos oficiais e fontes da organização.</p>
<p>{e(pr['intro'])}</p></div></section>
<section class="container facts-section">
<div class="section-kicker"><span>02 / FATOS DOCUMENTADOS</span><span>EDIÇÃO {year}</span></div>
<div class="facts">{facts_html}</div></section>
<section class="container gallery-section">
<div class="section-kicker"><span>03 / ACERVO VISUAL</span><span>IMAGENS COM AUTORIZAÇÃO</span></div>
<h2 class="section-title">POR DENTRO<br><em>DO ACONTECIMENTO.</em></h2>
<div class="gallery">
<div class="gallery-slot wide">FOTO PRINCIPAL / 16:9<small>Espaço reservado. Crédito, titularidade e licença a validar antes da publicação.</small></div>
<div class="gallery-slot">BASTIDORES / 4:5<small>Espaço reservado para imagem editorial autorizada.</small></div>
<div class="gallery-slot">ATLETAS E PÚBLICO / 4:5<small>Espaço reservado para imagem editorial autorizada.</small></div></div></section>
<section class="container insights">
<div class="section-kicker"><span>04 / LEITURAS CADILLAC</span><span>CONTEXTO E INTERPRETAÇÃO</span></div>
<div class="insight-content"><h2>ALÉM DA ARENA.</h2>
<p>Projetos como este articulam pessoas, território, produção e marcas. A leitura da Cadillac apresenta contexto e oportunidades do setor sem inventar métricas de público, resultados ou atribuições contratuais.</p>
<a class="pill-link" href="{p}dados/">Explorar dados e métricas {icon('insights')}</a></div></section>
<section class="container sources">
<div class="section-kicker"><span>05 / EVIDÊNCIAS</span><span>REFERÊNCIAS DESTA EDIÇÃO</span></div>
<h2>FONTES E DOCUMENTAÇÃO.</h2>{source_list(sources)}
<div class="year-links"><span>Navegar nas edições</span>{''.join(nav_links)}</div>
<div class="year-links"><span>Outros anos</span>{other_html}</div></section></main>"""
    return write(f"projetos/{slug}/{year}/index.html",
                 head(depth, f"{pr['name']} {year} | Fatos, cobertura e fontes | Cadillac Produções",
                      f"{pr['name']} {year}: contexto, fatos documentados e fontes públicas sobre a edição.",
                      f"projetos/{slug}/{year}/", [ld, trail_ld])
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
        groups.append(f"""<article class="press-group"><div class="section-kicker">
<span>{icon(cat['icon'])} {e(pr['name'])}</span><span>{plural(len(uniq), 'FONTE', 'FONTES')}</span></div>
{source_list(uniq)}
<div class="year-links"><span>Contexto</span>
<a href="{p}projetos/{pr['slug']}/">Página do projeto {icon('arrow_outward')}</a></div></article>""")
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><span class="eyebrow">EDITORIAL / IMPRENSA</span>
<h1>NA MÍDIA<span class="orange">.</span></h1>
<p class="lede">Histórias que ganharam as ruas, as arenas e a imprensa. Cada item aponta para a publicação original, agrupado pelo projeto a que se refere.</p>
<div class="metric-row">
<div><strong>{total:02d}</strong><span>Referências catalogadas</span></div>
<div><strong>{len(hosts):02d}</strong><span>Veículos e domínios</span></div>
<div><strong>{M['projects']:02d}</strong><span>Projetos cobertos</span></div>
<div><strong>{M['span']}</strong><span>Período</span></div></div></section>
<section class="container sources">
<div class="section-kicker"><span>REPERCUSSÃO</span><span>LINKS PARA AS PUBLICAÇÕES ORIGINAIS</span></div>
{''.join(groups)}
<p class="note">Reunimos links para as publicações originais e não reproduzimos matérias integrais nem fotografias jornalísticas sem licença. A citação de um veículo não implica parceria, patrocínio ou endosso.</p></section></main>"""
    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "Na Mídia",
          "url": f"{BASE}/na-midia/", "inLanguage": "pt-BR"}
    return write("na-midia/index.html",
                 head(depth, "Na Mídia | Reportagens, cobertura e fontes | Cadillac Produções",
                      "Repercussão dos projetos Cadillac na imprensa: reportagens, documentos oficiais "
                      "e referências públicas organizadas por projeto.",
                      "na-midia/", [ld, trail_ld]) + header(depth, "na-midia") + body + footer(depth))


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
    body = f"""<main id="conteudo"><span id="top"></span>{trail_html}
<section class="page-hero container"><span class="eyebrow">PESQUISA / INTELIGÊNCIA</span>
<h1>DADOS<span class="orange">.</span></h1>
<p class="lede">Um acervo conectado de projetos, edições, território, modalidades, cobertura e fontes públicas — com a metodologia à vista.</p></section>
<section class="container data-stats">{panels_html}</section>
<section class="container charts">
<div class="chart-card"><h3>Edições catalogadas por ano</h3>
<p class="chart-sub">Quantas edições de projeto têm página própria em cada ano do acervo.</p>
<figure>{bars_vertical(per_year, ('edição', 'edições'))}
<figcaption>Série única: edições catalogadas. Os anos sem barra não aparecem porque nenhuma edição foi catalogada neles nesta versão.</figcaption></figure></div>
<div class="chart-card"><h3>Projetos por área de atuação</h3>
<p class="chart-sub">Distribuição do acervo entre esporte, festivais, música e cultura.</p>
<figure>{bars_horizontal(cat_counts, ('projeto', 'projetos'), w=560)}
<figcaption>Cada projeto é contado em uma única área, a predominante no registro.</figcaption></figure></div>
<div class="chart-card"><h3>Registros documentados por projeto</h3>
<p class="chart-sub">Fatos com fonte identificada em cada projeto, somando todas as edições.</p>
<figure>{bars_horizontal(facts_by_project, ('registro', 'registros'), w=620)}
<figcaption>Volume de documentação, não tamanho ou importância do evento.</figcaption></figure></div>
<div class="chart-card"><h3>Fontes públicas por projeto</h3>
<p class="chart-sub">Links únicos para documentos oficiais, sites de organização e imprensa.</p>
<figure>{bars_horizontal(sources_by_project, ('fonte', 'fontes'), w=620)}
<figcaption>URLs distintas. Uma mesma fonte citada em dois anos é contada uma vez.</figcaption></figure></div>
<div class="chart-card span-2"><h3>Cobertura por projeto e ano</h3>
<p class="chart-sub">Onde há edição documentada, a célula leva direto à página da edição.</p>
{coverage_matrix(depth)}<p class="table-hint">Arraste a tabela para o lado para ver todos os anos.</p></div>
<div class="chart-card span-2"><h3>Valores em registros públicos</h3>
<p class="chart-sub">Os únicos valores financeiros que este portal publica são os que constam em documentos públicos, com a fonte ao lado.</p>
{amounts_table()}<p class="table-hint">Arraste a tabela para o lado para ver valor e fonte.</p></div>
</section>
<section class="container sources">
<div class="section-kicker"><span>BASE EDITORIAL</span><span>METODOLOGIA</span></div>
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


def page_404():
    body = f"""<main id="conteudo"><span id="top"></span>
<section class="container error-page"><span class="eyebrow">ERRO 404</span>
<h1>404<span class="orange">.</span></h1>
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
    urls = ["", "projetos/", "na-midia/", "dados/"]
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
    written = [page_home(), page_projects(), page_press(), page_data(), page_404()]
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
