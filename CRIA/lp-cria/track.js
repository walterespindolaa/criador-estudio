/* ═══════════════════════════════════════════════════════════════════════════
   RASTREAMENTO DAS LANDING PAGES DO CRIA

   Estado que este arquivo veio consertar: as três páginas rodavam SEM pixel
   nenhum. O bloco do Meta estava comentado no index com o texto "SEU_PIXEL_ID"
   e nem existia nas outras duas. Ou seja: dava pra pagar anúncio, mas não dava
   pra saber quem chegou, montar público de remarketing, nem dizer ao algoritmo
   o que é uma conversão. O funil só começava a ser medido DEPOIS do cadastro,
   dentro do app.

   E o passthrough de UTM que existia tinha dois furos: só reescrevia links pro
   /signup (os três botões de checkout perdiam o fbclid inteiro) e rodava uma
   vez no load, então qualquer link que aparecesse depois ficava sem nada.

   ─────────────────────────────────────────────────────────────────────────
   PRA LIGAR: preencha o ID logo abaixo. É o único lugar. Enquanto estiver
   vazio, tudo aqui roda em modo silencioso: nada quebra, nada dispara, e o
   console avisa uma vez. Assim o site pode ir pro ar antes do pixel existir.
   ═══════════════════════════════════════════════════════════════════════════ */

var CRIA_TRACK = {
  // Este ID já existia: estava em VITE_META_PIXEL_ID no .env do app, medindo do
  // cadastro pra frente. É o MESMO pixel de propósito: assim a Meta costura o
  // anúncio, a visita na LP e a assinatura numa jornada só.
  metaPixelId: "1760482638731506",

  // ads.openai.com > Tools > Conversions > Data Source (Web).
  chatgptAdsId: "4TCiBRJhEggrMkWpvG3KhE",

  // Logs no console, pra conferir os disparos sem abrir os gerenciadores.
  // Já foi validado em 18/08: o console mostrou os dois pixels iniciando.
  // Ligue de novo quando precisar depurar um evento específico.
  debug: false,
};

(function () {
  "use strict";

  var ORIGENS = ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","utm_id","fbclid","gclid","ttclid","msclkid"];
  var CHAVE = "cria_origem";
  var APP = "app.criasocialclub.com.br";

  function log() {
    if (!CRIA_TRACK.debug) return;
    try { console.log.apply(console, ["[cria-track]"].concat([].slice.call(arguments))); } catch (e) {}
  }

  /* ── 1. DE ONDE A PESSOA VEIO ─────────────────────────────────────────────
     Guardado na sessão porque o caminho real quase nunca é uma página só: o
     anúncio cai no index, ela abre funcionalidades, volta, e só então clica em
     testar. Sem guardar, o fbclid morre no primeiro clique interno e a Meta
     perde a atribuição da venda. */
  function guardarOrigem() {
    var q = new URLSearchParams(location.search);
    var achou = {};
    var tem = false;
    ORIGENS.forEach(function (k) {
      var v = q.get(k);
      if (v) { achou[k] = v; tem = true; }
    });
    if (!tem) return;
    // Se já existe origem guardada, a PRIMEIRA vence: é ela que trouxe a pessoa.
    try {
      if (sessionStorage.getItem(CHAVE)) return;
      achou._referrer = document.referrer || "";
      achou._landing = location.pathname;
      sessionStorage.setItem(CHAVE, JSON.stringify(achou));
      log("origem guardada", achou);
    } catch (e) {}
  }

  function lerOrigem() {
    try { return JSON.parse(sessionStorage.getItem(CHAVE) || "{}"); } catch (e) { return {}; }
  }

  /** Cola a origem em qualquer URL de saída (app, checkout, o que for nosso). */
  function comOrigem(url) {
    var o = lerOrigem();
    var chaves = Object.keys(o).filter(function (k) { return k.charAt(0) !== "_"; });
    if (!chaves.length) return url;
    try {
      var u = new URL(url, location.href);
      chaves.forEach(function (k) { if (!u.searchParams.has(k)) u.searchParams.set(k, o[k]); });
      return u.toString();
    } catch (e) { return url; }
  }

  /* ── 1b. CONTAGEM NOSSA (motor de tráfego, 21/10/2026) ───────────────────
     O pixel só mede quem aceitou cookie e o número fica dentro da Meta. Isto
     conta visita, leitura e clique em "testar" no NOSSO banco (edge
     site-track), com a UTM que trouxe a pessoa. Sem cookie, sem IP, sem
     e-mail: só uma sessão aleatória da aba. É o que alimenta a aba Tráfego do
     admin (criador x social mídia, anúncio x link da bio). */
  var SITE_TRACK = "https://ecbzfjzoqidowrsfsfih.supabase.co/functions/v1/site-track";
  function sessao() {
    try {
      var s = sessionStorage.getItem("cria_sessao");
      if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem("cria_sessao", s); }
      return s;
    } catch (e) { return null; }
  }
  var jaContou = {};
  function basePayload(evento) {
    var o = lerOrigem();
    var q = new URLSearchParams(location.search);
    var utm = {};
    ["utm_source","utm_medium","utm_campaign","utm_content"].forEach(function (k) { utm[k] = o[k] || q.get(k) || undefined; });
    utm.fbclid = o.fbclid || q.get("fbclid") ? 1 : 0;
    return {
      evento: evento, pagina: location.pathname.replace(/\.html$/, "") || "/", sessao: sessao(), utm: utm,
      ref: o._referrer || document.referrer || "",
      disp: window.matchMedia && window.matchMedia("(max-width: 820px)").matches ? "mobile" : "desktop",
    };
  }
  function contar(evento, alvo, extra) {
    if (evento !== "cta" && evento !== "clique" && jaContou[evento]) return;
    jaContou[evento] = true;
    var dados = basePayload(evento);
    dados.alvo = alvo || null;
    if (extra) for (var k in extra) dados[k] = extra[k];
    enviar(dados);
  }
  function enviar(dados) {
    var corpo = JSON.stringify(dados);
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(SITE_TRACK, new Blob([corpo], { type: "text/plain" }));
      else fetch(SITE_TRACK, { method: "POST", body: corpo, keepalive: true, headers: { "Content-Type": "text/plain" } });
    } catch (e) {}
  }
  function contagemDeLeitura() {
    function noScroll() {
      var altura = document.documentElement.scrollHeight - window.innerHeight;
      if (altura > 0 && window.scrollY / altura >= 0.5) { contar("leu"); window.removeEventListener("scroll", noScroll); }
    }
    window.addEventListener("scroll", noScroll, { passive: true });
    var t = setTimeout(function () { contar("ficou30"); }, 30000);
    window.addEventListener("pagehide", function () { clearTimeout(t); }, { once: true });
  }

  /* ── 1b. COMPORTAMENTO NA PÁGINA (21/10/2026) ───────────────────────────────
     Walter: "entender até onde a pessoa normalmente acessa, onde ela clica, o
     que faz, quanto tempo fica na tela". Tudo somado aqui no navegador e
     mandado como UM acumulado por carregamento de página (edge site-track,
     evento "leitura" -> site_leituras), quando a aba some e a cada 15s:
       · tempo ATIVO: aba visível e alguém mexeu nos últimos 30s (aba
         esquecida aberta não infla a média);
       · rolagem máxima, em % da página que já passou pela tela;
       · segundos em cada <section id>: a seção que está no meio da tela leva
         o segundo; seção que entrou na tela conta como vista (0s), assim
         "chegou até aqui" não depende de parar nela;
       · seção em que estava quando saiu, quantos cliques, se converteu.
     E cada clique em link, botão ou imagem vai na hora (evento "clique"),
     com a seção e a altura da página. Clique em imagem que não é link é o
     "clique morto": a pessoa achou que ali abria alguma coisa.
     Mesmo princípio do resto: sem cookie, sem IP, sem texto digitado. */
  var VISITA = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  var converteu = false;
  function comportamento() {
    var secs = [].slice.call(document.querySelectorAll("section[id], footer"));
    if (!secs.length) return;
    var mapa = secs.map(function (el) { return el.id || "rodape"; });
    var tempo = {}, ativo = 0, scrollMax = 0, atual = null, nCliques = 0, enviado = "", ultimoGesto = Date.now();
    function mexeu() { ultimoGesto = Date.now(); }
    ["scroll", "pointerdown", "keydown", "mousemove", "touchstart", "wheel"].forEach(function (ev) {
      window.addEventListener(ev, mexeu, { passive: true });
    });
    function olhar() {
      var vh = window.innerHeight, meio = vh * 0.45;
      for (var i = 0; i < secs.length; i++) {
        var r = secs[i].getBoundingClientRect();
        if (r.height === 0) continue;
        if (r.top < vh * 0.85 && !(mapa[i] in tempo)) tempo[mapa[i]] = 0;
        if (r.top <= meio && r.bottom > meio) atual = mapa[i];
      }
      var h = document.documentElement.scrollHeight;
      if (h > 0) {
        var p = Math.min(100, Math.round(100 * (window.scrollY + vh) / h));
        if (p > scrollMax) scrollMax = p;
      }
    }
    function mandar() {
      // Só reenvia se algo mudou (o clique em "testar" muda converteu mesmo
      // sem segundo novo, e é justo o envio que mais importa).
      var assinatura = [ativo, scrollMax, nCliques, converteu, atual].join("|");
      if (assinatura === enviado) return;
      enviado = assinatura;
      var dados = basePayload("leitura");
      dados.visita = VISITA; dados.tempo = ativo; dados.scroll = scrollMax; dados.secoes = tempo;
      dados.mapa = mapa; dados.saida = atual; dados.cliques = nCliques; dados.converteu = converteu;
      enviar(dados);
    }
    olhar();
    window.addEventListener("scroll", olhar, { passive: true });
    setInterval(function () {
      if (document.visibilityState !== "visible" || Date.now() - ultimoGesto > 30000) return;
      ativo++;
      olhar();
      if (atual) tempo[atual] = (tempo[atual] || 0) + 1;
      if (ativo % 15 === 0) mandar();
    }, 1000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") mandar(); });
    window.addEventListener("pagehide", mandar);

    document.addEventListener("click", function (e) {
      var t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
      var alvo = t.closest("a[href], button, summary, [role=button], label, input[type=submit]");
      var morto = false;
      if (!alvo) { alvo = t.closest("img, picture, video, figure"); morto = !!alvo; }
      if (!alvo || nCliques >= 60) return;
      nCliques++;
      var img = alvo.querySelector ? alvo.querySelector("img") : null;
      // Texto primeiro, igual ao contador de "testar", pra o mesmo botão ter
      // o mesmo nome nos dois lugares.
      var rotulo = (alvo.textContent || "").replace(/\s+/g, " ").trim() || alvo.getAttribute("aria-label") ||
        alvo.getAttribute("data-track") || alvo.getAttribute("alt") || (img && img.getAttribute("alt")) || alvo.tagName.toLowerCase();
      if (morto) rotulo = "imagem: " + rotulo;
      var sec = alvo.closest("section[id], footer");
      var h = document.documentElement.scrollHeight || 1;
      var y = alvo.getBoundingClientRect().top + window.scrollY;
      contar("clique", rotulo.slice(0, 60), { secao: sec ? (sec.id || "rodape") : null, pos_y: Math.round(100 * y / h) });
    }, true);
  }

  /* ── 2. META PIXEL ────────────────────────────────────────────────────────
     Só carrega o script da Meta se houver ID. Sem isso a página baixava (ou
     baixaria) um script de terceiro pra não fazer nada. */
  function carregarMeta() {
    if (!CRIA_TRACK.metaPixelId) {
      log("sem metaPixelId: pixel desligado");
      return false;
    }
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq("init", CRIA_TRACK.metaPixelId);
    window.fbq("track", "PageView");
    log("pixel iniciado", CRIA_TRACK.metaPixelId);
    return true;
  }

  /* ── 3. ANÚNCIOS NO CHATGPT ───────────────────────────────────────────────
     Deixado pronto e desligado. A OpenAI ainda estava expandindo o formato no
     Brasil quando isto foi escrito, então em vez de chutar um endpoint que pode
     mudar, o gancho fica aqui: assim que a conta existir, é preencher o id e,
     se eles exigirem um script próprio, trocar a linha de dentro. */
  function carregarChatGPT() {
    if (!CRIA_TRACK.chatgptAdsId) { log("sem chatgptAdsId: desligado"); return false; }
    // Snippet oficial (developers.openai.com/ads/measurement-pixel). Ele guarda
    // o `oppref` do clique num cookie primeiro-parte e cuida sozinho de origem,
    // horário e lote dos eventos.
    (function (w, d, s, u) {
      if (w.oaiq) return;
      var q = function () { q.q.push(arguments); };
      q.q = [];
      w.oaiq = q;
      var js = d.createElement(s); js.async = true; js.src = u;
      var f = d.getElementsByTagName(s)[0];
      f.parentNode.insertBefore(js, f);
    })(window, document, "script", "https://bzrcdn.openai.com/sdk/oaiq.min.js");
    window.oaiq("init", { pixelId: CRIA_TRACK.chatgptAdsId, debug: !!CRIA_TRACK.debug });
    window.oaiq("measure", "page_viewed", {
      type: "contents",
      contents: [{ id: location.pathname, name: document.title, content_type: "page" }],
    });
    log("chatgpt ads iniciado", CRIA_TRACK.chatgptAdsId);
    return true;
  }

  /* Meta e OpenAI têm vocabulários diferentes pro mesmo acontecimento. Em vez de
     espalhar `if` pela página, traduzimos aqui: quem chama fala em Meta, e a
     tabela cuida do resto. `type` é a forma do dado que a OpenAI espera. */
  var TRADUZ = {
    PageView:         { oa: "page_viewed",      type: "contents" },
    ViewContent:      { oa: "contents_viewed",  type: "contents" },
    Lead:             { oa: "lead_created",     type: "customer_action" },
    InitiateCheckout: { oa: "checkout_started", type: "contents" },
    Contact:          { oa: "custom",           type: "custom", nomeCustom: "login_clicado" },
  };

  /** Um disparo só, que serve pros dois destinos. */
  function evento(nome, dados) {
    dados = dados || {};
    if (window.fbq) window.fbq("track", nome, dados);

    var t = TRADUZ[nome];
    if (window.oaiq && t) {
      var corpo = { type: t.type };
      if (t.type === "contents" && dados.content_name) {
        corpo.contents = [{ id: dados.content_category || "lp", name: dados.content_name, content_type: "page" }];
      }
      var opcoes = t.nomeCustom ? { custom_event_name: t.nomeCustom } : undefined;
      if (opcoes) window.oaiq("measure", t.oa, corpo, opcoes);
      else window.oaiq("measure", t.oa, corpo);
    }

    if (window.dataLayer) window.dataLayer.push(Object.assign({ event: nome }, dados));
    log("evento", nome, dados);
  }

  /* ── 4. QUANDO A PESSOA DEMONSTRA INTERESSE ───────────────────────────────
     Sem isto, o único sinal que a Meta recebe é "abriu a página", e ela não
     consegue separar quem leu de quem quicou. Três sinais, do mais fraco pro
     mais forte: leu metade, chegou no preço, clicou pra testar. */
  function sinaisDeLeitura() {
    var jaLeu = false, jaViuPreco = false;

    function noScroll() {
      if (!jaLeu) {
        var altura = document.documentElement.scrollHeight - window.innerHeight;
        if (altura > 0 && window.scrollY / altura >= 0.5) {
          jaLeu = true;
          evento("ViewContent", { content_name: document.title, content_category: "leitura_50" });
        }
      }
      if (!jaViuPreco) {
        var preco = document.getElementById("planos") || document.getElementById("precos");
        if (preco) {
          var r = preco.getBoundingClientRect();
          if (r.top < window.innerHeight * 0.8) {
            jaViuPreco = true;
            evento("ViewContent", { content_name: "tabela_de_precos", content_category: "preco" });
          }
        }
      }
      if (jaLeu && jaViuPreco) window.removeEventListener("scroll", noScroll);
    }
    window.addEventListener("scroll", noScroll, { passive: true });
    noScroll();
  }

  /* ── 5. OS CLIQUES DE SAÍDA ───────────────────────────────────────────────
     Por delegação no documento inteiro, e não reescrevendo href no load: assim
     pega também o CTA fixo do celular, os links dentro de texto e qualquer
     coisa que apareça depois. A origem é colada na hora do clique. */
  function cliques() {
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      var href = a.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#") return;

      var vaiProApp = href.indexOf(APP) !== -1;
      var vaiProCheckout = href.indexOf("comprar/") !== -1;
      if (!vaiProApp && !vaiProCheckout) return;

      // Cola UTM/fbclid no destino. Era isto que faltava nos três botões de
      // checkout do index: eles perdiam a origem inteira.
      var novo = comOrigem(a.href);
      if (novo !== a.href) a.href = novo;

      var rotulo = (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
      if (href.indexOf("/signup") !== -1 || vaiProCheckout) converteu = true;
      if (href.indexOf("/signup") !== -1) {
        contar("cta", rotulo);
        // A conversão que o algoritmo vai otimizar acontece no app
        // (CompleteRegistration). Aqui marcamos a intenção, que é o que permite
        // criar público de remarketing de "clicou e não terminou".
        evento("Lead", { content_name: rotulo, content_category: "clique_testar" });
      } else if (vaiProCheckout) {
        evento("InitiateCheckout", { content_name: rotulo, content_category: "assinar_direto" });
      } else if (href.indexOf("/login") !== -1) {
        evento("Contact", { content_name: "login" });
      }
    }, true);
  }

  /* ── 6. QUANTO TEMPO ELA FICOU ────────────────────────────────────────────
     Um sinal barato e honesto de qualidade de tráfego: campanha que traz gente
     que fica menos de 10s está trazendo clique acidental. */
  function tempoNaPagina() {
    var t = setTimeout(function () {
      evento("ViewContent", { content_name: document.title, content_category: "ficou_30s" });
    }, 30000);
    window.addEventListener("pagehide", function () { clearTimeout(t); }, { once: true });
  }

  /* ── QUANDO CADA COISA COMEÇA ─────────────────────────────────────────────
     O Lighthouse mediu 169 KiB do fbevents mais 26 KiB do SDK da OpenAI
     brigando com a primeira pintura da página, e a LCP foi pra 6,8 s. Nenhum
     dos dois precisa estar lá: pixel serve pra medir quem chegou, e quem
     chegou continua chegando se ele subir dois segundos depois.

     Então dividimos em duas partes:
     · AGORA (no DOM pronto): guardar a origem e ligar os cliques. Isso não faz
       requisição nenhuma, e precisa estar ativo desde o primeiro segundo,
       senão um clique rápido no "testar grátis" perde o fbclid e a Meta não
       liga o anúncio à venda.
     · DEPOIS (janela ociosa após o load): carregar os pixels e os sinais de
       leitura. O PageView continua sendo disparado, só que fora do caminho
       crítico. */
  function agora() {
    guardarOrigem();
    cliques();
    contar("view");
    contagemDeLeitura();
    comportamento();
  }

  function depois() {
    var temMeta = carregarMeta();
    carregarChatGPT();
    if (!temMeta && !window.oaiq) return;
    sinaisDeLeitura();
    tempoNaPagina();
  }

  function quandoSobrar(fn) {
    if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 3000 });
    else setTimeout(fn, 1200);
  }

  /* ── CONSENTIMENTO (Walter, 19/10/2026, opção A) ─────────────────────────
     Um aviso só pra LP e app. Antes a LP disparava o pixel pra todo mundo e o
     app só depois do aceite; quem aceitava aqui chegava no cadastro do app com
     o aviso de novo e, sem clicar, o cadastro sumia da Meta. Agora a escolha
     fica num cookie do domínio .criasocialclub.com.br, lido pelos dois lados.
     Sem "aceito", nenhum script de terceiro (Meta, OpenAI) entra na página.
     Guardar a origem e colar UTM nos links não depende disto: é dado nosso,
     não sai pra ninguém. */
  var COOKIE = "cria_consent";
  var CHAVE_LS = "cria.consentimento";
  var DOMINIO = "criasocialclub.com.br";

  function noDominio() {
    var h = location.hostname;
    return h === DOMINIO || h.slice(-(DOMINIO.length + 1)) === "." + DOMINIO;
  }

  function lerConsent() {
    var m = document.cookie.match(new RegExp("(?:^|; )" + COOKIE + "=([^;]*)"));
    var v = m ? decodeURIComponent(m[1]) : null;
    if (v !== "aceito" && v !== "recusado") {
      try { v = localStorage.getItem(CHAVE_LS); } catch (e) { v = null; }
    }
    return v === "aceito" || v === "recusado" ? v : null;
  }

  function gravarConsent(v) {
    var c = COOKIE + "=" + v + "; path=/; max-age=31536000; SameSite=Lax";
    if (noDominio()) c += "; domain=." + DOMINIO + "; Secure";
    else if (location.protocol === "https:") c += "; Secure";
    document.cookie = c;
    try { localStorage.setItem(CHAVE_LS, v); } catch (e) {}
  }

  function mostrarAviso(aoAceitar) {
    if (document.getElementById("cria-consent")) return;
    var css = document.createElement("style");
    css.textContent =
      "#cria-consent{position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:420px;margin-left:auto;" +
      "background:#fffdf8;color:#1b1a18;border:1px solid #e8e1d4;border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,.12);" +
      "padding:10px 12px;padding-bottom:max(10px,env(safe-area-inset-bottom));font-family:inherit;font-size:12.5px;line-height:1.4}" +
      "#cria-consent p{margin:0}#cria-consent a{color:inherit;text-decoration:underline;text-underline-offset:2px}" +
      "#cria-consent .acoes{display:flex;gap:8px;margin-top:8px}" +
      "#cria-consent button{flex:1;height:36px;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer}" +
      "#cria-consent .sim{background:#1b1a18;color:#fff;border:0}" +
      "#cria-consent .nao{background:transparent;color:#1b1a18;border:1px solid #e8e1d4}";
    document.head.appendChild(css);
    var box = document.createElement("div");
    box.id = "cria-consent";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Aviso de cookies");
    box.innerHTML =
      // Aviso enxuto (22/10/2026): o antigo cobria ~20% da primeira tela no
      // celular, bem onde a visita do anúncio decide se fica.
      '<p>Cookies essenciais pra usar o Cria e, se você permitir, o pixel da Meta pra medir anúncios. Nada de venda de dados. ' +
      '<a href="https://app.criasocialclub.com.br/privacidade" target="_blank" rel="noopener">Saiba mais</a></p>' +
      '<div class="acoes"><button type="button" class="sim">Aceitar</button><button type="button" class="nao">Só o essencial</button></div>';
    document.body.appendChild(box);
    box.querySelector(".sim").addEventListener("click", function () {
      gravarConsent("aceito"); box.remove(); aoAceitar();
    });
    box.querySelector(".nao").addEventListener("click", function () {
      gravarConsent("recusado"); box.remove();
    });
  }

  function iniciar() {
    agora();
    var c = lerConsent();
    // Escolha feita no app (localStorage antigo) ou aqui: espalha pro cookie.
    if (c && noDominio() && document.cookie.indexOf(COOKIE + "=") === -1) gravarConsent(c);
    if (c === "recusado") { log("rastreamento recusado"); return; }
    if (c === "aceito") {
      if (document.readyState === "complete") quandoSobrar(depois);
      else window.addEventListener("load", function () { quandoSobrar(depois); }, { once: true });
      return;
    }
    // Sem decisão: um respiro antes do aviso, como no app.
    setTimeout(function () { mostrarAviso(depois); }, 900);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

  // Exposto pra quem quiser disparar algo pontual de dentro da página.
  window.criaTrack = { evento: evento, comOrigem: comOrigem, lerOrigem: lerOrigem, consentimento: lerConsent };
})();
