#!/usr/bin/env python3
"""
Liga os prints de Insights na LP.

Por que existe: `prints/insights.webp` era um screenshot da PRÓPRIA landing page
(menu, headline "Numa aba só", botão Testar grátis) e estava no ar em
Funcionalidades legendado como se fosse a tela de Insights. Tirei do ar e deixei
um bloco de texto honesto no lugar. Este script repõe o card com o print de
verdade assim que os dois arquivos existirem.

COMO USAR
  1. Salve os dois prints nesta pasta (prints/), com estes nomes exatos:
       _insights-1.png   -> a tela de Insights (cabeçalho, seguidores/alcance/
                            interações/visitas, os dois gráficos)
       _insights-2.png   -> o bloco "O que postar mais" (Direcionamento +
                            alcance médio por formato, por dia e por período)
  2. Rode, da pasta lp-cria:
       python3 prints/_insights.py
  3. Confira em prints/card/ e suba:
       npx vercel --prod

O que ele faz: converte os PNG em webp na largura padrão dos outros prints,
gera o recorte de card (a versão que aparece pequena, pra o texto do app ficar
legível) e devolve o card de imagem ao funcionalidades.html, com o print inteiro
no clique de ampliar.
"""

import io
import os
import sys

try:
    from PIL import Image
except ImportError:
    # O Python do macOS vem sem a Pillow e, desde o Sonoma, o pip recusa instalar
    # sem --break-system-packages. Instala sozinho em vez de mandar o erro seco.
    import subprocess
    print("Instalando a Pillow (uma vez só)...")
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "--quiet", "--break-system-packages", "--user", "Pillow"],
        check=False,
    )
    try:
        from PIL import Image
    except ImportError:
        sys.exit("Não consegui instalar sozinho. Rode:\n  pip3 install --break-system-packages Pillow")

AQUI = os.path.dirname(os.path.abspath(__file__))
LP = os.path.dirname(AQUI)
LARGURA = 2200          # mesma dos outros prints da LP
QUALIDADE = 90

# (arquivo de origem, nome final, fração do recorte, âncora x, âncora y)
# A fração é igual nos dois eixos: a proporção não muda, então o layout do card
# continua idêntico. A âncora funciona igual ao object-position (0 = topo/esq).
TAREFAS = [
    ("_insights-1.png", "insights",         0.62, 0.00, 0.74),  # números + gráficos
    ("_insights-2.png", "insights-postar",  0.66, 0.00, 0.00),  # direcionamento + barras
]


def preparar():
    feitos = []
    for origem, nome, frac, ax, ay in TAREFAS:
        src = os.path.join(AQUI, origem)
        if not os.path.exists(src):
            print(f"  faltando: prints/{origem}")
            continue

        im = Image.open(src).convert("RGB")
        if im.size[0] != LARGURA:
            im = im.resize((LARGURA, LARGURA * im.size[1] // im.size[0]), Image.LANCZOS)

        cheio = os.path.join(AQUI, f"{nome}.webp")
        im.save(cheio, "WEBP", quality=QUALIDADE, method=6)

        w, h = im.size
        cw, ch = int(w * frac), int(h * frac)
        x0, y0 = int((w - cw) * ax), int((h - ch) * ay)
        os.makedirs(os.path.join(AQUI, "card"), exist_ok=True)
        im.crop((x0, y0, x0 + cw, y0 + ch)).save(
            os.path.join(AQUI, "card", f"{nome}.webp"), "WEBP", quality=94, method=6
        )
        print(f"  ok: prints/{nome}.webp ({w}x{h}) + prints/card/{nome}.webp ({cw}x{ch})")
        feitos.append(nome)
    return feitos


def religar_o_card():
    p = os.path.join(LP, "funcionalidades.html")
    s = io.open(p, encoding="utf-8").read()

    texto_honesto = (
        '<div class="mod-visual" style="background:var(--verde)">'
        '<p class="mod-ph">Alcance, salvamentos e melhor horário chegam do próprio '
        'Instagram, colados em cada post do seu histórico.</p></div>'
    )
    card_com_print = (
        '<div class="mod-visual" style="background:var(--verde)">'
        '<div class="mock mock--wide"><div class="mock-bar"><i></i><i></i><i></i></div>'
        '<img class="mock-img zoom" loading="lazy" src="prints/card/insights.webp" '
        'data-full="prints/insights.webp" '
        'alt="Tela de Insights do CRIA com alcance, interações e crescimento de seguidores">'
        '<span class="mk-label">Alcance, interações e crescimento do seu perfil, '
        'direto da API do Instagram.</span></div></div>'
    )

    if card_com_print in s:
        print("  o card já está ligado, nada a fazer")
        return
    if texto_honesto not in s:
        print("  ATENÇÃO: não achei o bloco de texto pra trocar. Edite à mão em funcionalidades.html")
        return
    io.open(p, "w", encoding="utf-8").write(s.replace(texto_honesto, card_com_print))
    print("  ok: card de Insights religado em funcionalidades.html")


if __name__ == "__main__":
    print("Preparando os prints de Insights...")
    feitos = preparar()
    if "insights" in feitos:
        religar_o_card()
        print("\nPronto. Confira e suba:  npx vercel --prod")
    else:
        print("\nSalve os PNG em prints/ com os nomes _insights-1.png e _insights-2.png e rode de novo.")
