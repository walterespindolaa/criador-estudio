# Gera comprar/pro.html e comprar/studio.html a partir de um template único.
# Rodar: python3 _template.py
TPL = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Assinar CRIA {NOME}</title>
<meta name="description" content="Assine o CRIA {NOME} por R${PRECO}/mês. Acesso imediato, sem fidelidade, cancela quando quiser.">
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Roboto:wght@300;400;500;700&family=Grand+Hotel&display=swap" rel="stylesheet">
<style>
:root{{--creme:#F4EFE3;--creme-2:#EEE8D8;--ink:#151412;--laranja:#CE4A1D;--azul:#2A4BDF;--rosa:#F27EB5;--amarelo:#F2C21E;--verde:#3E9152;--branco:#FDFBF5;--font-display:'Baloo 2',sans-serif;--font-body:'Roboto',sans-serif;--font-script:'Grand Hotel',cursive}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:var(--font-body);background:var(--creme);color:var(--ink);line-height:1.6;min-height:100svh}}
h1,h2,h3{{font-family:var(--font-display);font-weight:800;line-height:1.1}}
a{{color:inherit;text-decoration:none}}
.topbar{{display:flex;align-items:center;justify-content:space-between;padding:18px min(5vw,48px)}}
.logo{{font-family:var(--font-display);font-weight:800;font-size:1.4rem}}
.logo span{{color:var(--laranja)}}
.voltar{{font-size:.9rem;opacity:.7}}
.voltar:hover{{opacity:1}}
.wrap{{width:min(1020px,94%);margin:10px auto 60px;display:grid;grid-template-columns:1fr 1.05fr;gap:28px;align-items:start}}
.resumo{{background:{CARD_BG};color:{CARD_FG};border-radius:28px;padding:38px 34px;{CARD_EXTRA}}}
.resumo .badge{{display:inline-block;background:var(--laranja);color:#fff;font-family:var(--font-display);font-weight:700;font-size:.78rem;padding:6px 14px;border-radius:999px;margin-bottom:14px}}
.resumo h1{{font-size:2rem}}
.resumo .preco{{font-family:var(--font-display);font-weight:800;font-size:2.8rem;margin:12px 0 2px}}
.resumo .preco small{{font-size:1rem;opacity:.7;font-weight:600}}
.resumo .trial{{font-family:var(--font-script);font-size:1.5rem;color:{SCRIPT_COLOR};transform:rotate(-1.5deg);display:inline-block;margin-bottom:18px}}
.resumo ul{{list-style:none;display:flex;flex-direction:column;gap:10px;font-size:.94rem;margin:14px 0 22px}}
.resumo li{{display:flex;gap:10px;align-items:flex-start}}
.resumo li b{{color:{CHECK_COLOR};flex-shrink:0}}
.selo{{display:flex;gap:12px;align-items:center;background:{SELO_BG};border-radius:16px;padding:14px 16px;font-size:.85rem}}
.selo svg{{width:26px;height:26px;fill:none;stroke:{CHECK_COLOR};stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}}
.form-card{{background:var(--branco);border:2px solid var(--ink);border-radius:28px;padding:38px 34px;box-shadow:0 10px 0 rgba(21,20,18,.9)}}
.form-card h2{{font-size:1.4rem;margin-bottom:6px}}
.form-card .sub{{font-size:.9rem;opacity:.7;margin-bottom:24px}}
label{{display:block;font-weight:700;font-size:.85rem;margin:16px 0 6px;font-family:var(--font-display)}}
input{{width:100%;padding:15px 18px;border:2px solid rgba(21,20,18,.25);border-radius:14px;font-size:1rem;font-family:var(--font-body);background:var(--branco);transition:border-color .2s}}
input:focus{{outline:none;border-color:var(--azul)}}
input.erro{{border-color:var(--laranja)}}
.btn{{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;font-family:var(--font-display);font-weight:700;font-size:1.08rem;padding:17px 24px;border-radius:999px;border:none;cursor:pointer;background:var(--laranja);color:#fff;box-shadow:0 6px 0 rgba(21,20,18,.9);transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .25s;margin-top:26px}}
.btn:hover{{transform:translateY(-3px);box-shadow:0 9px 0 rgba(21,20,18,.9)}}
.btn:disabled{{opacity:.6;cursor:wait;transform:none}}
.micro{{text-align:center;font-size:.78rem;opacity:.65;margin-top:12px}}
.seguro{{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:18px;font-size:.8rem;opacity:.6}}
.seguro svg{{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}}
@media(max-width:860px){{.wrap{{grid-template-columns:1fr;margin-top:0}}.resumo{{padding:30px 26px}}.form-card{{padding:30px 26px}}.resumo h1{{font-size:1.7rem}}}}
</style>
</head>
<body>

<div class="topbar">
  <a class="logo" href="/">CRIA<span>.</span></a>
  <a class="voltar" href="/#planos">← Voltar pros planos</a>
</div>

<div class="wrap">
  <div class="resumo">
    <span class="badge">{BADGE}</span>
    <h1>CRIA {NOME}</h1>
    <div class="preco">R${PRECO}<small>/mês</small></div>
    <span class="trial">sem fidelidade, cancela quando quiser!</span>
    <ul>
{FEATURES}
    </ul>
    <div class="selo">
      <svg viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
      <span>Acesso liberado na hora, assim que o pagamento confirmar. Não curtiu? Cancela dentro do app, sem burocracia.</span>
    </div>
  </div>

  <div class="form-card">
    <h2>Falta pouco</h2>
    <p class="sub">Preenche seus dados que a gente já cria sua fatura certinha e libera seu acesso.</p>
    <form id="checkout-form" novalidate>
      <label for="nome">Seu nome completo</label>
      <input type="text" id="nome" name="nome" autocomplete="name" placeholder="Maria da Silva" required>
      <label for="email">Seu melhor e-mail</label>
      <input type="email" id="email" name="email" autocomplete="email" placeholder="voce@email.com" required>
      <label for="whats">WhatsApp (com DDD)</label>
      <input type="tel" id="whats" name="whats" autocomplete="tel" placeholder="(41) 99999-9999" required>
      <button type="submit" class="btn" id="btn-pagar">Ir pro pagamento seguro →</button>
    </form>
    <p class="micro">R${PRECO}/mês · Sem fidelidade · Cancela quando quiser</p>
    <div class="seguro">
      <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      Pagamento processado com segurança pelo Stripe
    </div>
  </div>
</div>

<script>
/* ============================================================
   CONFIG STRIPE — cole aqui o Payment Link do plano {NOME}
   (Stripe Dashboard → Payment Links → criar link do preço {NOME})
   ============================================================ */
var STRIPE_LINK = "{STRIPE_LINK}"; // ex: https://buy.stripe.com/xxxxx
var FALLBACK    = "https://app.criasocialclub.com.br/login?plan={SLUG}";

(function(){{
  var form = document.getElementById('checkout-form');
  var btn  = document.getElementById('btn-pagar');

  /* máscara simples de WhatsApp */
  var whats = document.getElementById('whats');
  whats.addEventListener('input', function(){{
    var v = this.value.replace(/\\D/g,'').slice(0,11);
    if(v.length > 6) this.value = '('+v.slice(0,2)+') '+v.slice(2,7)+'-'+v.slice(7);
    else if(v.length > 2) this.value = '('+v.slice(0,2)+') '+v.slice(2);
    else this.value = v;
  }});

  form.addEventListener('submit', function(e){{
    e.preventDefault();
    var ok = true;
    ['nome','email','whats'].forEach(function(id){{
      var el = document.getElementById(id);
      var valido = el.value.trim().length > 2 && (id !== 'email' || /.+@.+\\..+/.test(el.value));
      el.classList.toggle('erro', !valido);
      if(!valido) ok = false;
    }});
    if(!ok) return;

    btn.disabled = true; btn.textContent = 'Te levando pro pagamento…';

    var nome  = document.getElementById('nome').value.trim();
    var email = document.getElementById('email').value.trim();
    var fone  = whats.value.replace(/\\D/g,'');

    /* guarda os dados pro app resgatar depois do pagamento */
    try {{ localStorage.setItem('cria_checkout', JSON.stringify({{plan:'{SLUG}',nome:nome,email:email,whats:fone,ts:Date.now()}})); }} catch(err) {{}}

    var utms = '';
    try {{
      var keep = new URLSearchParams();
      new URLSearchParams(window.location.search).forEach(function(v,k){{ if(/^utm_|^fbclid$|^gclid$/i.test(k)) keep.append(k,v); }});
      utms = keep.toString();
    }} catch(err) {{}}

    var dest;
    if (STRIPE_LINK && STRIPE_LINK.indexOf('http') === 0) {{
      /* Payment Link com e-mail preenchido + referência do lead */
      var ref = encodeURIComponent(('{SLUG}|'+fone+'|'+nome).slice(0,190));
      dest = STRIPE_LINK + (STRIPE_LINK.indexOf('?')>-1?'&':'?') +
             'prefilled_email=' + encodeURIComponent(email) +
             '&client_reference_id=' + ref;
    }} else {{
      dest = FALLBACK + '&email=' + encodeURIComponent(email);
    }}
    if (utms) dest += '&' + utms;
    window.location.href = dest;
  }});
}})();
</script>
</body>
</html>
"""

def feat(items):
    return "\n".join('      <li><b>✓</b> %s</li>' % i for i in items)

# ATENÇÃO — o que estava aqui era MENTIRA e ia gerar reembolso:
#   - o Studio prometia "Cria Post", "CRM", "Cria Caixa" e "HUB CRIA" dentro dos
#     R$49,90. Esses são MÓDULOS vendidos à parte (R$19,90 / R$29,90 / R$24,90).
#   - o Pro prometia "Cria Stories", que é do Studio.
#   - o Pro prometia agendamento em outros lugares da LP. O CRIA NÃO AGENDA.
# Agora isto espelha src/lib/plans.ts, que é o que o sistema realmente libera.
planos = {
    "essencial": dict(
        NOME="Essencial", SLUG="essencial", PRECO="19,90", BADGE="Pra organizar",
        CARD_BG="var(--branco)", CARD_FG="var(--ink)", CARD_EXTRA="border:2px solid var(--ink);",
        SCRIPT_COLOR="var(--verde)", CHECK_COLOR="var(--verde)", SELO_BG="var(--creme-2)",
        STRIPE_LINK="",
        FEATURES=feat([
            "Banco de ideias ilimitado",
            "Kanban da produção: da ideia ao publicado",
            "Calendário, tarefas e metas",
            "Brandbook + link in bio",
            "Cria IA: 10 gerações/mês (pra experimentar)",
        ])),
    "pro": dict(
        NOME="Pro", SLUG="pro", PRECO="32,90", BADGE="Mais escolhido",
        CARD_BG="var(--ink)", CARD_FG="var(--creme)", CARD_EXTRA="box-shadow:0 10px 0 var(--laranja);",
        SCRIPT_COLOR="var(--amarelo)", CHECK_COLOR="var(--amarelo)", SELO_BG="rgba(253,251,245,.08)",
        STRIPE_LINK="",
        FEATURES=feat([
            "Tudo do Essencial, e mais:",
            "Cria IA: 150 gerações/mês (legendas, roteiros, ganchos, score)",
            "Insights reais do Instagram + Meu Feed",
            "Melhor horário pra postar",
            "Tendências do seu nicho + Media Kit automático",
        ])),
    "studio": dict(
        NOME="Studio", SLUG="studio", PRECO="49,90", BADGE="A IA cria por você",
        CARD_BG="var(--branco)", CARD_FG="var(--ink)", CARD_EXTRA="border:2px solid var(--ink);",
        SCRIPT_COLOR="var(--azul)", CHECK_COLOR="var(--verde)", SELO_BG="var(--creme-2)",
        STRIPE_LINK="",
        FEATURES=feat([
            "Tudo do Pro, e mais:",
            "Cria Plano: a IA monta o seu mês inteiro",
            "Cria Stories: o plano semanal de stories",
            "Collabs: parcerias, propostas e cachê",
            "Cria IA: 500 gerações/mês",
        ])),
}

for slug, ctx in planos.items():
    html = TPL
    for k, v in ctx.items():
        html = html.replace("{%s}" % k, v)
    # desfaz o escape das chaves de CSS/JS
    html = html.replace("{{", "{").replace("}}", "}")
    open("%s.html" % slug, "w").write(html)
    print(slug + ".html ok")
