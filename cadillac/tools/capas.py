#!/usr/bin/env python3
"""Gera as capas editoriais originais da Cadillac.

Uso: python3 tools/capas.py
Cria assets/capas/<slug>.jpg e <slug>-<ano>.jpg (16:10) e assets/og/<slug>.jpg (1200x630).
São composições geométricas próprias, na paleta da marca — não usam fotografia de
terceiros. Uma foto real colocada em assets/fotos/ tem prioridade sobre a capa gerada.
"""
import hashlib
import json
import math
import pathlib
import random

from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODEL = json.loads((ROOT / "content-model.json").read_text(encoding="utf-8"))

INK = (16, 16, 16)
GRAPHITE = (29, 29, 30)
ORANGE = (255, 89, 0)
PAPER = (247, 246, 243)
SS = 2  # supersampling


def seeded(*parts):
    h = hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()
    return random.Random(int(h[:12], 16))


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def base_canvas(w, h, rng, dark=True):
    """Fundo com gradiente diagonal e um halo quente fora de centro."""
    top = mix(GRAPHITE, (58, 56, 60), rng.uniform(.1, .35)) if dark else PAPER
    bottom = (8, 8, 9) if dark else mix(PAPER, (228, 226, 220), .6)
    img = Image.new("RGB", (w, h), top)
    d = ImageDraw.Draw(img)
    for y in range(h):
        d.line([(0, y), (w, y)], fill=mix(top, bottom, y / h))
    halo = Image.new("L", (w, h), 0)
    hd = ImageDraw.Draw(halo)
    cx, cy = rng.uniform(.55, .9) * w, rng.uniform(.1, .45) * h
    r = rng.uniform(.3, .5) * w
    for i in range(26):
        k = i / 26
        hd.ellipse([cx - r * (1 - k), cy - r * (1 - k), cx + r * (1 - k), cy + r * (1 - k)],
                   fill=int(120 * k ** 2))
    halo = halo.filter(ImageFilter.GaussianBlur(w * .06))
    img = Image.composite(Image.new("RGB", (w, h), ORANGE), img, halo)
    return img


def grain(img, amount=9):
    w, h = img.size
    noise = Image.effect_noise((w, h), 48).convert("L").point(lambda v: 128 + (v - 128) * amount / 100)
    return Image.blend(img, Image.merge("RGB", (noise, noise, noise)), .07)


def vignette(img):
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse([-w * .25, -h * .35, w * 1.25, h * 1.35], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(w * .08))
    return Image.composite(img, Image.new("RGB", (w, h), (0, 0, 0)), mask)


# --- motivos por tema -------------------------------------------------------
# Três "tintas": MASS é massa sólida clara, LINE é traço branco, ACCENT é laranja.
MASS = (1, 1, 1)
LINE = (255, 255, 255)
ACCENT = ORANGE


def curve(w, h, power, top, start=0.0):
    """Pontos de uma transição que sobe da esquerda para a direita."""
    return [(w * t, h - h * top * (max(t - start, 0) / max(1 - start, .001)) ** power)
            for t in [i / 90 for i in range(91)]]


def motif_wave(d, w, h, rng):
    """Swell: arrebentação em arcos concêntricos e o sol baixo."""
    cx, cy = w * rng.uniform(.28, .46), h * 1.5
    for i in range(18):
        r = w * (.26 + i * .07)
        strong = i % 4 == 1
        d.arc([cx - r, cy - r * .66, cx + r, cy + r * .66], 196, 344,
              fill=ACCENT if strong else LINE, width=int(h * (.011 if strong else .0035)))
    sr = w * rng.uniform(.075, .105)
    sx, sy = w * rng.uniform(.66, .8), h * rng.uniform(.24, .34)
    d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=ACCENT)
    base = curve(w, h, 2.6, .34, .35)
    d.polygon(base + [(w, h), (0, h)], fill=MASS)


def motif_vert(d, w, h, rng):
    """Transição de rampa: massa da pista, coping laranja e ecos da curva."""
    ramp = curve(w, h, 2.3, .82, rng.uniform(.04, .16))
    d.polygon(ramp + [(w, h), (0, h)], fill=MASS)
    d.line(ramp, fill=ACCENT, width=int(h * .014))
    for i in range(1, 5):
        echo = [(x, y - h * .055 * i) for x, y in ramp]
        d.line(echo, fill=LINE, width=int(h * .0032))
    y = h * rng.uniform(.16, .26)
    d.line([(0, y), (w * .62, y - h * .05)], fill=LINE, width=int(h * .0045))


def motif_festival(d, w, h, rng):
    """Arena: varais de luz sobre o recorte do palco."""
    d.polygon([(w * .12, h), (w * .3, h * .52), (w * .7, h * .52), (w * .88, h)], fill=MASS)
    for i in range(5):
        y0 = h * (.1 + i * .1)
        pts = [(x, y0 + math.sin(x / w * math.pi * rng.uniform(1.3, 2.3) + i) * h * .06)
               for x in range(0, w + 1, max(1, w // 70))]
        d.line(pts, fill=LINE, width=int(h * .0024))
        for x, y in pts[::4]:
            r = h * rng.uniform(.007, .017)
            d.ellipse([x - r, y - r, x + r, y + r], fill=ACCENT if rng.random() < .32 else LINE)
    d.rectangle([w * .3, h * .5, w * .7, h * .53], fill=ACCENT)


def motif_culture(d, w, h, rng):
    """Grafismo urbano: malha de chevrons com falhas e uma faixa de destaque."""
    step = w // 13
    for row in range(int(h / step) + 2):
        for col in range(15):
            x, y = col * step - (row % 2) * step / 2, row * step - step * .4
            if rng.random() < .2:
                continue
            color = ACCENT if rng.random() < .16 else LINE
            d.line([(x, y + step * .62), (x + step * .5, y + step * .16),
                    (x + step, y + step * .62)], fill=color, width=int(step * .06))
    band = h * rng.uniform(.52, .66)
    d.polygon([(0, band), (w, band - h * .08), (w, band + h * .12), (0, band + h * .2)], fill=MASS)


def motif_music(d, w, h, rng):
    """Onda sonora: equalizador com batida irregular sobre a linha de base."""
    n = 44
    bw = w / n
    for i in range(n):
        env = math.sin(i / n * math.pi) ** .6
        bh = h * env * rng.uniform(.2, .66)
        x = i * bw
        d.rounded_rectangle([x + bw * .2, h * .56 - bh / 2, x + bw * .8, h * .56 + bh / 2],
                            radius=bw * .26, fill=ACCENT if i % 6 == 0 else LINE)
    d.rectangle([0, h * .555, w, h * .565], fill=ACCENT)
    d.polygon([(0, h * .82), (w, h * .78), (w, h), (0, h)], fill=MASS)


def motif_grid(d, w, h, rng):
    """Parede de galeria: malha modular com alguns módulos acesos."""
    cols, rows = 7, 5
    cw, ch = w / cols, h / rows
    for r in range(rows):
        for c in range(cols):
            x, y = c * cw, r * ch
            pad = min(cw, ch) * .09
            box = [x + pad, y + pad, x + cw - pad, y + ch - pad]
            roll = rng.random()
            if roll < .14:
                d.rectangle(box, fill=ACCENT)
            elif roll < .34:
                d.rectangle(box, fill=MASS)
            else:
                d.rectangle(box, outline=LINE, width=int(min(cw, ch) * .035))
    d.line([(0, h * .5), (w, h * .5)], fill=ACCENT, width=int(h * .012))


def motif_street(d, w, h, rng):
    """Street: corrimão, escada e blocos de concreto vistos de lado."""
    steps = 5
    sw, sh = w * .12, h * .1
    x0, y0 = w * .08, h * .9
    for i in range(steps):
        d.rectangle([x0 + i * sw * .62, y0 - i * sh, x0 + (i + 1.6) * sw, y0 - i * sh + sh], fill=MASS)
    rail = [(x0 + w * .02, y0 - h * .02), (x0 + steps * sw * .78, y0 - steps * sh + h * .02)]
    d.line(rail, fill=ACCENT, width=int(h * .016))
    d.rectangle([w * .66, h * .58, w * .95, h * .64], fill=MASS)
    d.rectangle([w * .66, h * .56, w * .95, h * .58], fill=ACCENT)
    for i in range(7):
        y = h * (.1 + i * .045)
        d.line([(w * .52, y), (w, y - h * .02)], fill=LINE, width=int(h * .0026))


MOTIFS = {"grid": motif_grid, "street": motif_street, "wave": motif_wave, "vert": motif_vert, "festival": motif_festival,
          "culture": motif_culture, "music": motif_music}


def compose(theme, key, size):
    w, h = size[0] * SS, size[1] * SS
    rng = seeded(theme, key)
    img = base_canvas(w, h, rng)
    layer = Image.new("RGB", (w, h), (0, 0, 0))
    mask = Image.new("L", (w, h), 0)
    ld, md = ImageDraw.Draw(layer), ImageDraw.Draw(mask)

    tints = {ACCENT: (ORANGE, 240), LINE: ((255, 255, 255), 96), MASS: ((126, 123, 130), 118)}

    class Dual:  # desenha na camada e na máscara de uma vez
        def __getattr__(self, name):
            def call(*a, **k):
                layer_kw, mask_kw = dict(k), dict(k)
                for key in ("fill", "outline"):
                    if key in k:
                        color, alpha = tints[k[key]]
                        layer_kw[key], mask_kw[key] = color, alpha
                getattr(ld, name)(*a, **layer_kw)
                getattr(md, name)(*a, **mask_kw)
            return call

    MOTIFS[theme](Dual(), w, h, rng)
    img = Image.composite(layer, img, mask)
    img = vignette(grain(img))
    return img.resize(size, Image.LANCZOS)


def save(img, path, quality=86):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, quality=quality, optimize=True, progressive=True)


def og_card(cover, name):
    """Imagem de compartilhamento: capa escurecida com a assinatura da marca."""
    og = cover.resize((1200, 630), Image.LANCZOS)
    shade = Image.new("RGB", (1200, 630), (0, 0, 0))
    og = Image.blend(og, shade, .35)
    logo_path = ROOT / "assets" / "logo-cadillac-branco.png"
    if logo_path.exists():
        logo = Image.open(logo_path).convert("RGBA")
        lw = 340
        logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
        og.paste(logo, (70, 630 - logo.height - 70), logo)
    d = ImageDraw.Draw(og)
    d.rectangle([70, 70, 70 + 120, 76], fill=ORANGE)
    return og


def main():
    made = 0
    for pr in MODEL["projects"]:
        theme = pr.get("theme") or "culture"
        cover = compose(theme, pr["slug"], (1600, 1000))
        save(cover, ROOT / "assets" / "capas" / f'{pr["slug"]}.jpg')
        save(og_card(cover, pr["name"]), ROOT / "assets" / "og" / f'{pr["slug"]}.jpg')
        made += 2
        for year in pr["years"]:
            ed = compose(theme, f'{pr["slug"]}-{year}', (1600, 1000))
            save(ed, ROOT / "assets" / "capas" / f'{pr["slug"]}-{year}.jpg')
            save(og_card(ed, f'{pr["name"]} {year}'), ROOT / "assets" / "og" / f'{pr["slug"]}-{year}.jpg')
            made += 2
    print(f"{made} imagens geradas em assets/capas e assets/og")


if __name__ == "__main__":
    main()
