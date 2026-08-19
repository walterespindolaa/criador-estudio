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
  // LIGADO agora porque os dois pixels acabaram de subir e precisam ser
  // validados. Depois de confirmar que os eventos chegam, volte pra false:
  // em produção isso é só ruído no console de quem visita.
  debug: true,
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
      if (href.indexOf("/signup") !== -1) {
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

  function iniciar() {
    guardarOrigem();
    var temMeta = carregarMeta();
    carregarChatGPT();
    cliques();          // vale mesmo sem pixel: a origem precisa ser colada de qualquer jeito
    if (!temMeta && !window.oaiq) return;
    sinaisDeLeitura();
    tempoNaPagina();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

  // Exposto pra quem quiser disparar algo pontual de dentro da página.
  window.criaTrack = { evento: evento, comOrigem: comOrigem, lerOrigem: lerOrigem };
})();
