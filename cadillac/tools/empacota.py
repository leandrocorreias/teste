"""Monta a pasta de publicacao. Dois destinos, com uma diferenca que importa."""
import json, os, shutil, subprocess, collections, sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent
D = Path(os.environ.get('SAIDA_PACOTE') or (SRC.parent / 'publicar'))
destino = sys.argv[1] if len(sys.argv) > 1 else 'previa'

if destino == 'previa':
    URL, DST, SUB = 'https://instfy.com/cadillac', D / 'publicar-previa', '/cadillac'
else:
    URL, DST, SUB = 'https://cadillac.art.br', D / 'publicar-oficial', ''

if DST.exists():
    shutil.rmtree(DST)
modelo = SRC / 'content-model.json'
guardado = modelo.read_text(encoding='utf-8')
m = json.loads(guardado, object_pairs_hook=collections.OrderedDict)
m['site']['url'] = URL
modelo.write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
try:
    subprocess.run(['python3', 'build.py'], cwd=SRC, check=True, capture_output=True)
finally:
    modelo.write_text(guardado, encoding='utf-8')

PULAR_DIR = {'tools', 'reservado', '.git', '__pycache__'}
PULAR_ARQ = {'build.py', 'content-model.json', 'htaccess-producao.txt'}
n = 0
for src in SRC.rglob('*'):
    rel = src.relative_to(SRC)
    if src.is_dir() or rel.parts[0] in PULAR_DIR:
        continue
    if src.name in PULAR_ARQ or src.suffix == '.md':
        continue
    if destino == 'previa' and src.name == 'robots.txt':
        continue
    out = DST / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, out)
    n += 1

ht = (SRC / 'htaccess-producao.txt').read_text(encoding='utf-8')
ht = ht.replace('/cadillac/reservado', f'{SUB}/reservado')
ht = ht.replace('^/cadillac/projetos', f'^{SUB}/projetos')
ht = ht.replace('/cadillac/eventos$1', f'{SUB}/eventos$1')
ht = ht.replace('ErrorDocument 404 /cadillac/404.html', f'ErrorDocument 404 {SUB}/404.html')
if destino == 'previa':
    # A previa e uma copia do site oficial. Sem isto, o Google indexa as duas e
    # elas competem entre si pelo mesmo conteudo, com a copia as vezes ganhando.
    ht += ('\n# Copia de pre-visualizacao: nao deve ser indexada em hipotese alguma.\n'
           '<IfModule mod_headers.c>\n'
           '  Header always set X-Robots-Tag "noindex, nofollow"\n'
           '</IfModule>\n')
(DST / '.htaccess').write_text(ht, encoding='utf-8')
# A previa e construida com o endereco do instfy. Sem reconstruir no fim, o
# repositorio fica com as paginas apontando para a copia -- e e o repositorio
# que o Deploy do cPanel publica em cadillac.art.br.
if destino != 'oficial':
    subprocess.run(['python3', 'build.py'], cwd=SRC, check=True, capture_output=True)
print(f'{destino}: {n} arquivos + .htaccess -> {DST}')
