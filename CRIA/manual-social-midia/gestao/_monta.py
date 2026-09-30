# ── Montagem ────────────────────────────────────────────────────────────
css = open('/home/claude/msm/base.css').read() + open('/home/claude/msm/extra.css').read()
partes = []
CORES = {'rosa':'#D6337F','laranja':'#E0441A','azul':'#0061EE','verde':'#01934A','lilas':'#5F74E3','amarelo':'#141311'}
cor_atual = CORES['rosa']
import re as _re
for n, (cls, corpo) in enumerate(PAGINAS, 1):
    mm = _re.search(r'class="abre bg-(\w+)', corpo)
    if mm: cor_atual = CORES.get(mm.group(1), cor_atual)
    corpo = corpo  # cor do pino segue a seção
    capa = cls == 'capa'
    cls = (cls + '" style="--pin:' + cor_atual).strip()
    rod = '' if capa else f'<div class="rodape"><img src="logo-cria.png" alt=""><span>{MAN}</span><span class="num">{n}</span></div>'
    partes.append(f'<section class="page {cls}">{corpo}{rod}</section>')
doc = ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Manual da Social Mídia · Cria</title><style>'
       + css + '</style></head><body>' + '\n'.join(partes) + '</body></html>')
open(os.path.join(OUT, 'manual.html'), 'w').write(doc)
print('paginas', len(PAGINAS))
