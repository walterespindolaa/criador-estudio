# Monta o Manual da Social Mídia (Geral): recorta os prints, posiciona os pinos e gera o HTML.
# Pinos são dados em fração da imagem inteira (x, y) e convertidos pra % do recorte.
import os, shutil, html
from PIL import Image

SRC = '/mnt/user-data/uploads/criador-estudio/CRIA/manual-social-midia/prints'
ASSETS = '/mnt/user-data/uploads/criador-estudio/CRIA/manual-criador'
OUT = '/home/claude/msm/post/out'
os.makedirs(OUT, exist_ok=True)

for f in os.listdir(ASSETS):
    if f.endswith(('.woff2', '.png')) and not f.startswith('pg-'):
        shutil.copy(os.path.join(ASSETS, f), OUT)

_crops = {}
def crop(nome, arq, box, maxw=2200):
    """box = (x0, y0, x1, y1) em fração da imagem inteira."""
    im = Image.open(os.path.join(SRC, arq + '.jpg')).convert('RGB')
    W, H = im.size
    x0, y0, x1, y1 = box
    c = im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))
    if c.width > maxw:
        c = c.resize((maxw, int(c.height * maxw / c.width)), Image.LANCZOS)
    c.save(os.path.join(OUT, nome + '.jpg'), quality=88)
    _crops[nome] = box
    return nome

def fig(nome, pins=(), style=''):
    x0, y0, x1, y1 = _crops[nome]
    ps = []
    for i, (x, y) in enumerate(pins, 1):
        px = (x - x0) / (x1 - x0) * 100
        py = (y - y0) / (y1 - y0) * 100
        ps.append(f'<span class="pin" style="left:{px:.1f}%;top:{py:.1f}%">{i}</span>')
    st = f' style="{style}"' if style else ''
    return f'<figure class="print"{st}><img src="{nome}.jpg" alt="">{"".join(ps)}</figure>'

def leg(itens, duas=True):
    cls = 'leg duas' if duas else 'leg'
    return f'<ol class="{cls}">' + ''.join(f'<li>{i}</li>' for i in itens) + '</ol>'

PAGINAS = []
def pagina(corpo, cls=''):
    PAGINAS.append((cls, corpo))

def abre(cor, n, titulo, sub, amarelo=False):
    extra = ' amarelo' if amarelo else ''
    return (f'<div class="abre bg-{cor}{extra}"><div class="bolha" style="width:60mm;height:60mm;right:-14mm;top:-22mm"></div>'
            f'<div class="n">{n}</div><h2>{titulo}</h2><p>{sub}</p></div>')

def dica(txt, alerta=False):
    if alerta:
        return f'<div class="alerta"><span class="ic">!</span><div><p>{txt}</p></div></div>'
    return f'<div class="dica"><span class="ic">!</span><div><p>{txt}</p></div></div>'

MAN = 'Manual da Social Mídia'
