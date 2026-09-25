# Motor de anúncios CRIA (motion em JavaScript)

- videos/    MP4 prontos (25s, 1080x1920, som -14 LUFS)
- preview/   um .html por vídeo: abre no Chrome, toca com som, arrasta a linha do tempo, liga a guia de área segura e grava de novo
- roteiros/  um arquivo por vídeo (textos, cenas, efeitos). É aqui que se ajusta um detalhe
- engine.js  motor comum (fundo, lâmpada, texto, trilha, CTA)

## Ajustar um vídeo e gerar de novo (Mac)
1. Edite roteiros/<id>.js (ou peça ao Claude)
2. python3 build.py <id>                 -> gera preview/.. (em out/)
3. node export.mjs <id>                  -> gera out/<id>.mp4

Preparação (uma vez): brew install ffmpeg && npm install && npx playwright install chromium
