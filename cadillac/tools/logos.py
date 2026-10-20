#!/usr/bin/env python3
"""Regera os derivados do logotipo oficial da Cadillac.

Uso: python3 tools/logos.py caminho/para/logo-oficial.png
O arquivo de origem deve ser o logotipo em preto com fundo transparente, na maior
resolução disponível. Todos os derivados são gravados em assets/.
"""
import pathlib
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
PAPER = (247, 246, 243, 255)
INK = (17, 17, 17)
ORANGE = (233, 79, 0, 255)


def main(src):
    im = Image.open(src).convert("RGBA")
    im = im.crop(im.getchannel("A").getbbox())

    def render(width, rgb):
        h = round(im.height * width / im.width)
        base = im.resize((width, h), Image.LANCZOS)
        out = Image.new("RGBA", base.size, rgb + (0,))
        out.putalpha(base.getchannel("A"))
        return out

    render(900, INK).save(ASSETS / "logo-cadillac.png", optimize=True)
    render(900, (255, 255, 255)).save(ASSETS / "logo-cadillac-branco.png", optimize=True)

    c = im.crop((0, 0, round(im.width * 0.3), im.height))
    for size in (32, 180):
        pad = round(size * 0.14)
        inner = size - pad * 2
        w = round(c.width * inner / c.height)
        glyph = c.resize((min(w, inner), inner), Image.LANCZOS)
        canvas = Image.new("RGBA", (size, size), PAPER)
        canvas.alpha_composite(glyph, ((size - glyph.width) // 2, pad))
        canvas.save(ASSETS / f"favicon-{size}.png", optimize=True)

    og = Image.new("RGBA", (1200, 630), PAPER)
    logo = render(760, INK)
    og.alpha_composite(logo, ((1200 - logo.width) // 2, (630 - logo.height) // 2 - 10))
    og.alpha_composite(Image.new("RGBA", (120, 6), ORANGE), (540, 510))
    og.convert("RGB").save(ASSETS / "og-cadillac.jpg", quality=88, optimize=True)
    print("derivados gravados em", ASSETS)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
