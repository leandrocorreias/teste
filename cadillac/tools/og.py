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
        base = Image.blend(base, veu, 0.26)
        grad = Image.new("L", (1, A))
        for y in range(A):
            t = y / (A - 1)
            grad.putpixel((0, y), int(255 * min(1.0, max(0.0, (t - 0.35) / 0.65) ** 1.8 * 0.55)))
        base = Image.composite(veu.resize((L, A)), base, grad.resize((L, A)))
    return base


def cartao(caminho_foto, arquivo, invertido=False):
    """Foto do assunto e o logotipo. Sem texto: o título já vai no cartão.

    O WhatsApp e as redes mostram o título e a descrição logo abaixo da
    imagem. Escrever o mesmo título dentro da foto repetia tudo duas vezes e
    tapava justamente o que o cartão tem de melhor, que é a imagem do evento.
    """
    if caminho_foto and (RAIZ / caminho_foto).exists():
        with Image.open(RAIZ / caminho_foto) as teste:
            if teste.width < 900:
                invertido = True   # foto pequena ampliada sai serrilhada
    if invertido:
        im = Image.new("RGB", (L, A), TINTA)
    else:
        im = fundo(caminho_foto)
    marca = Image.open(RAIZ / "assets" / "logo-cadillac-branco.png").convert("RGBA")
    mw = 420
    marca = marca.resize((mw, round(marca.height * mw / marca.width)), Image.LANCZOS)
    x, y = (L - mw) // 2, (A - marca.height) // 2 - 10

    # Sem sombra: a marca entra limpa, em branco chapado. O contraste vem do
    # véu sobre a foto, não de um borrão atrás das letras.
    im.paste(marca, (x, y), marca)

    d = ImageDraw.Draw(im)
    traco = 92
    d.rectangle([(L - traco) // 2, y + marca.height + 26,
                 (L + traco) // 2, y + marca.height + 31], fill=LARANJA)

    DESTINO.mkdir(parents=True, exist_ok=True)
    im.save(DESTINO / arquivo, quality=86, optimize=True, progressive=True)
    return arquivo


def chave(caminho):
    """A mesma chave que o build procura: o caminho da página com hífens."""
    return (caminho.strip("/").replace("/", "-") or "home") + ".jpg"


def paginas():
    """Cada página com a foto do que ela trata."""
    foto = build.photo_for
    por_slug = {pr["slug"]: pr for pr in build.PROJECTS}

    def f(slug):
        return foto(por_slug[slug]) if slug in por_slug else None

    itens = [("", None, True)]  # a home é o cartão invertido, só a marca
    for pr in build.PROJECTS:
        itens.append((f'projetos/{pr["slug"]}/', foto(pr), False))
        for y in pr["years"]:
            itens.append((f'projetos/{pr["slug"]}/{y}/', foto(pr, y), False))
    secoes = [
        ("projetos/", f("vert-battle")),
        ("produtora/", f("tamo-junto-bb")),
        ("equipe/", f("mr-moo-festival")),
        ("atletas/", f("vert-battle")),
        ("artistas/", f("dominguinho")),
        ("parceiros/", f("tamo-junto-bb")),
        ("dados/", f("itacoatiara-pro")),
        ("agenda/", f("connect-heroes")),
        ("relacionamento/", f("vert-battle")),
        ("imprensa/", f("arte-em-circuito")),
        ("na-midia/", f("festival-de-tribos-juruti")),
        ("atuacao/", f("mr-moo-festival")),
        ("contato/", f("itacoatiara-pro")),
        ("governanca/", f("ccbb-mac-bahia")),
    ]
    for caminho, img in secoes:
        itens.append((caminho, img, False))
    return itens


def main():
    feitos = 0
    for caminho, img, invertido in paginas():
        cartao(img, chave(caminho), invertido)
        feitos += 1
    print(f"{feitos} imagens de compartilhamento em assets/og/")


if __name__ == "__main__":
    main()
