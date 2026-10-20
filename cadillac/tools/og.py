"""Gera a imagem de compartilhamento de cada página, em assets/og/.

Quem recebe um link no WhatsApp decide se clica pelo cartão, e o cartão era
sempre o mesmo logotipo em fundo claro: dez links iguais na conversa. Aqui
cada página ganha a própria imagem, com a foto do que ela trata ao fundo,
escurecida o bastante para o texto ler por cima.

Roda à parte do build, como tools/logos.py: o build só procura o arquivo
pronto. Depende de Pillow; o build continua sem dependência nenhuma.

    python3 tools/og.py
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))
import build  # noqa: E402  (o modelo e as regras de foto vêm do próprio gerador)

L, A = 1200, 630
MARGEM = 72
LARANJA = (232, 78, 16)
PAPEL = (247, 246, 243)
TINTA = (18, 18, 18)
DESTINO = RAIZ / "assets" / "og"
FONTE_TITULO = RAIZ / "tools" / "fontes" / "roboto-condensed-var.ttf"
FONTE_TEXTO = RAIZ / "tools" / "fontes" / "manrope-var.ttf"


def fonte(caminho, tamanho, peso):
    f = ImageFont.truetype(str(caminho), tamanho)
    f.set_variation_by_axes([peso])
    return f


def largura(desenho, texto, f):
    return desenho.textbbox((0, 0), texto, font=f)[2]


def quebra(desenho, texto, f, limite):
    """Quebra o título em linhas que cabem na largura útil."""
    linhas, atual = [], ""
    for palavra in texto.split():
        teste = f"{atual} {palavra}".strip()
        if largura(desenho, teste, f) <= limite or not atual:
            atual = teste
        else:
            linhas.append(atual)
            atual = palavra
    if atual:
        linhas.append(atual)
    return linhas


def fundo(caminho_foto):
    """A foto cobrindo 1200x630, escurecida por baixo para o texto ler."""
    base = Image.new("RGB", (L, A), TINTA)
    if caminho_foto and (RAIZ / caminho_foto).exists():
        foto = ImageOps.exif_transpose(Image.open(RAIZ / caminho_foto)).convert("RGB")
        base = ImageOps.fit(foto, (L, A), Image.LANCZOS, centering=(0.5, 0.38))
        base = base.filter(ImageFilter.GaussianBlur(0.6))
        # Véu em duas camadas: um geral, que dá contraste em qualquer foto, e
        # um gradiente que fecha a parte de baixo, onde fica o título.
        veu = Image.new("RGB", (L, A), (10, 10, 10))
        base = Image.blend(base, veu, 0.34)
        grad = Image.new("L", (1, A))
        for y in range(A):
            t = y / (A - 1)
            grad.putpixel((0, y), int(255 * min(1.0, max(0.0, (t - 0.18) / 0.82) ** 1.5 * 0.92)))
        base = Image.composite(veu.resize((L, A)), base, grad.resize((L, A)))
    return base


def cartao(caminho_foto, chapeu, titulo, linha, arquivo):
    im = fundo(caminho_foto)
    d = ImageDraw.Draw(im)
    util = L - MARGEM * 2

    # Logotipo no alto, com sombra leve para não sumir em foto clara.
    marca = Image.open(RAIZ / "assets" / "logo-cadillac-branco.png").convert("RGBA")
    mw = 232
    marca = marca.resize((mw, round(marca.height * mw / marca.width)), Image.LANCZOS)
    sombra = Image.new("RGBA", (L, A), (0, 0, 0, 0))
    sombra.paste(marca.filter(ImageFilter.GaussianBlur(9)), (MARGEM, MARGEM - 4), marca)
    im.paste(Image.alpha_composite(im.convert("RGBA"), sombra).convert("RGB"), (0, 0))
    im.paste(marca, (MARGEM, MARGEM - 8), marca)

    f_chapeu = fonte(FONTE_TEXTO, 21, 700)
    f_linha = fonte(FONTE_TEXTO, 25, 600)
    tam = 86 if len(titulo) <= 22 else (72 if len(titulo) <= 34 else 60)
    f_titulo = fonte(FONTE_TITULO, tam, 800)
    linhas = quebra(d, titulo.upper(), f_titulo, util)
    while len(linhas) > 3 and tam > 40:
        tam -= 8
        f_titulo = fonte(FONTE_TITULO, tam, 800)
        linhas = quebra(d, titulo.upper(), f_titulo, util)

    alt_titulo = len(linhas) * round(tam * 0.98)
    y = A - MARGEM - alt_titulo - (46 if linha else 10)
    if chapeu:
        d.text((MARGEM, y - 46), chapeu.upper(), font=f_chapeu, fill=LARANJA,
               stroke_width=0, features=None)
        d.rectangle([MARGEM, y - 14, MARGEM + 56, y - 10], fill=LARANJA)

    for i, ln in enumerate(linhas):
        yy = y + i * round(tam * 0.98)
        d.text((MARGEM + 2, yy + 3), ln, font=f_titulo, fill=(0, 0, 0))
        d.text((MARGEM, yy), ln, font=f_titulo, fill=(255, 255, 255))
    if linha:
        d.text((MARGEM, A - MARGEM - 30), linha, font=f_linha, fill=(226, 223, 218))

    DESTINO.mkdir(parents=True, exist_ok=True)
    im.save(DESTINO / arquivo, quality=86, optimize=True, progressive=True)
    return arquivo


def chave(caminho):
    """A mesma chave que o build procura: o caminho da página com hífens."""
    return (caminho.strip("/").replace("/", "-") or "home") + ".jpg"


def paginas():
    M, S = build.MODEL, build.SITE
    itens = [("", "Cadillac Produções e Filmes", " ".join(S["headline"]).replace("  ", " "),
              S["tagline"], build.photo_for(build.PROJECTS[0]))]
    for pr in build.PROJECTS:
        linha = " · ".join(x for x in [pr["kind"], pr["location"], pr["period"]] if x)
        itens.append((f'projetos/{pr["slug"]}/', pr["category"].upper(), pr["name"], linha,
                      build.photo_for(pr)))
        for y in pr["years"]:
            ed = (pr.get("editions") or {}).get(str(y), {})
            rot = build.rotulo_ed(pr, y)
            sub = " · ".join(x for x in [ed.get("period"), ed.get("place")] if x)
            itens.append((f'projetos/{pr["slug"]}/{y}/', rot, pr["name"], sub,
                          build.photo_for(pr, y)))
    secoes = [
        ("projetos/", "Acervo", "Eventos", "Todos os eventos produzidos e documentados", 0),
        ("produtora/", "Produtora", "Quem é a Cadillac", "História, manifesto, atuação e time", 1),
        ("equipe/", "Time", "Equipe", "Quem toca a casa no dia a dia", 2),
        ("atletas/", "Time", "Atletas", "Atletas citados no acervo", 3),
        ("artistas/", "Time", "Artistas", "Quem passou pelos palcos do acervo", 4),
        ("parceiros/", "Time", "Parceiros", "Marcas e instituições nos projetos", 5),
        ("dados/", "Dados", "Números do acervo", "Alcance, operação e transmissões, com fonte", 6),
        ("agenda/", "Agenda", "O que vem pela frente", "Datas confirmadas e anunciadas", 7),
        ("relacionamento/", "Relacionamento", "Trabalhe com a Cadillac",
         "Patrocínio, novos negócios, fornecedores e talentos", 8),
        ("imprensa/", "Imprensa", "Sala de imprensa", "Releases, press kit e assessoria", 0),
        ("na-midia/", "Imprensa", "Na mídia", "O que publicaram sobre os projetos", 1),
        ("atuacao/", "Atuação", "Conheça nosso trabalho", "Da execução aos dados", 2),
        ("contato/", "Contato", "Fale com a Cadillac", "Eventos, parcerias, patrocínio ou imprensa", 3),
        ("governanca/", "Governança", "Governança e políticas",
         "Ética, conduta, privacidade e cookies", 4),
    ]
    for caminho, chapeu, titulo, linha, i in secoes:
        pr = build.PROJECTS[i % len(build.PROJECTS)]
        itens.append((caminho, chapeu, titulo, linha, build.photo_for(pr)))
    return itens


def main():
    feitos = 0
    for caminho, chapeu, titulo, linha, foto in paginas():
        cartao(foto, chapeu, titulo, linha, chave(caminho))
        feitos += 1
    print(f"{feitos} imagens de compartilhamento em assets/og/")


if __name__ == "__main__":
    main()
