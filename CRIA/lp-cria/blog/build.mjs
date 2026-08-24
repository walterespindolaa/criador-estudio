#!/usr/bin/env node
/*
 * Gerador do blog do CRIA.
 *
 * Como usar:
 *   node blog/build.mjs
 *
 * Lê os arquivos .md de blog/posts/, gera:
 *   blog/index.html          listagem com trilhas
 *   blog/<slug>.html         cada post
 *   blog/rss.xml             feed
 *   sitemap.xml              raiz (LP + blog)
 *   robots.txt               raiz
 *   llms.txt                 raiz (mapa do site pra IA)
 *
 * Sem dependências: só Node. O parser de markdown é pequeno de propósito,
 * cobre o que a gente usa e nada além disso.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM não tem __dirname: o repo tem "type": "module" no package.json.
const AQUI = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(AQUI, '..');           // lp-cria/
const POSTS_DIR = path.join(AQUI, 'posts');
const SITE = 'https://criasocialclub.com.br';
const APP = 'https://app.criasocialclub.com.br';

/* ------------------------------------------------------------------ *
 * Trilhas: cor, rótulo e descrição. A cor pinta o kicker e o cartão.
 * ------------------------------------------------------------------ */
const TRILHAS = {
  'situacao-ferramenta': {
    label: 'Uma situação, uma ferramenta',
    curto: 'Situação real',
    cor: 'var(--laranja)',
    texto: '#fff',
    desc: 'Uma cena do dia a dia de quem vive de conteúdo e o caminho pra sair dela.',
  },
  'rotina-social-media': {
    label: 'Rotina de social media',
    curto: 'Social media',
    cor: 'var(--azul)',
    texto: '#fff',
    desc: 'Atendimento, preço, prazo, relatório: a parte do trabalho que ninguém ensina.',
  },
  'oficio-criador': {
    label: 'Ofício de criador',
    curto: 'Criador',
    cor: 'var(--rosa)',
    texto: '#0A0A0A',
    desc: 'Ideia, roteiro, gravação e constância pra quem cria pro próprio perfil.',
  },
  'dados-tendencias': {
    label: 'Dados e tendências',
    curto: 'Tendências',
    cor: 'var(--verde)',
    texto: '#fff',
    desc: 'O que está mudando nas redes e o que fazer com isso na prática.',
  },
};

/* ------------------------------------------------------------------ *
 * Front matter (YAML bem simples: chave: valor, listas com - e blocos)
 * ------------------------------------------------------------------ */
function parseFrontMatter(raw) {
  if (!raw.startsWith('---')) return { meta: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { meta: {}, body: raw };
  const head = raw.slice(4, end).replace(/\r/g, '');
  const body = raw.slice(end + 4).replace(/^\n+/, '');
  const meta = {};
  let currentKey = null;
  let currentList = null;

  for (const line of head.split('\n')) {
    if (!line.trim()) continue;
    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem && currentList) {
      currentList.push(stripQuotes(listItem[1]));
      continue;
    }
    const kv = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (kv) {
      currentKey = kv[1];
      const value = kv[2].trim();
      if (value === '') {
        currentList = [];
        meta[currentKey] = currentList;
      } else {
        currentList = null;
        meta[currentKey] = stripQuotes(value);
      }
    }
  }
  return { meta, body };
}
function stripQuotes(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    // \" dentro do valor vira aspas de verdade (título que começa com fala).
    return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  return t;
}

/* ------------------------------------------------------------------ *
 * Markdown mínimo
 * ------------------------------------------------------------------ */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function inline(s) {
  return s
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" decoding="async">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, href) => {
      const externo = /^https?:\/\//.test(href) && !href.includes('criasocialclub.com.br');
      const rel = externo ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${href}"${rel}>${txt}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}
function slugify(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function markdown(src) {
  const lines = src.replace(/\r/g, '').split('\n');
  const out = [];
  const sumario = [];
  let i = 0;
  let paragrafo = [];

  const flushP = () => {
    if (paragrafo.length) {
      out.push(`<p>${inline(paragrafo.join(' '))}</p>`);
      paragrafo = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // blocos especiais :::tipo Título
    const bloco = line.match(/^:::(\w[\w-]*)\s*(.*)$/);
    if (bloco) {
      flushP();
      const tipo = bloco[1];
      const titulo = bloco[2].trim();
      const conteudo = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) { conteudo.push(lines[i]); i++; }
      i++;
      const interno = markdown(conteudo.join('\n')).html;
      out.push(renderBloco(tipo, titulo, interno));
      continue;
    }

    // heading
    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) {
      flushP();
      const nivel = h[1].length;
      const texto = h[2].trim();
      const id = slugify(texto);
      if (nivel === 2) sumario.push({ id, texto });
      out.push(`<h${nivel} id="${id}">${inline(texto)}</h${nivel}>`);
      i++;
      continue;
    }

    // hr
    if (/^---+\s*$/.test(line)) { flushP(); out.push('<hr>'); i++; continue; }

    // citação
    if (/^>\s?/.test(line)) {
      flushP();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote>${markdown(buf.join('\n')).html}</blockquote>`);
      continue;
    }

    // lista numerada
    if (/^\d+\.\s+/.test(line)) {
      flushP();
      const itens = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        let txt = lines[i].replace(/^\d+\.\s+/, '');
        i++;
        while (i < lines.length && /^\s{3,}\S/.test(lines[i])) { txt += ' ' + lines[i].trim(); i++; }
        itens.push(`<li>${inline(txt)}</li>`);
      }
      out.push(`<ol>${itens.join('')}</ol>`);
      continue;
    }

    // lista com marcador
    if (/^[-*]\s+/.test(line)) {
      flushP();
      const itens = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        let txt = lines[i].replace(/^[-*]\s+/, '');
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) { txt += ' ' + lines[i].trim(); i++; }
        itens.push(`<li>${inline(txt)}</li>`);
      }
      out.push(`<ul>${itens.join('')}</ul>`);
      continue;
    }

    // tabela
    if (/^\|/.test(line) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      flushP();
      const cabec = line.split('|').slice(1, -1).map((c) => c.trim());
      i += 2;
      const linhas = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        linhas.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      out.push(
        `<div class="tabela-wrap"><table><thead><tr>${cabec.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` +
        `<tbody>${linhas.map((l) => `<tr>${l.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      );
      continue;
    }

    if (!line.trim()) { flushP(); i++; continue; }

    paragrafo.push(line.trim());
    i++;
  }
  flushP();
  return { html: out.join('\n'), sumario };
}

function renderBloco(tipo, titulo, interno) {
  switch (tipo) {
    case 'resposta':
      return `<aside class="bloco-resposta"><span class="bloco-tag">${esc(titulo || 'Resposta rápida')}</span>${interno}</aside>`;
    case 'cria':
      return `<aside class="bloco-cria"><span class="bloco-tag">${esc(titulo || 'No CRIA')}</span>${interno}</aside>`;
    case 'checklist':
      return `<aside class="bloco-checklist"><span class="bloco-tag">${esc(titulo || 'Checklist')}</span>${interno}</aside>`;
    case 'nota':
      return `<aside class="bloco-nota">${titulo ? `<span class="bloco-tag">${esc(titulo)}</span>` : ''}${interno}</aside>`;
    case 'destaque':
      return `<aside class="bloco-destaque">${interno}</aside>`;
    default:
      return `<aside class="bloco-nota">${interno}</aside>`;
  }
}

/* ------------------------------------------------------------------ *
 * Pedaços de página compartilhados
 * ------------------------------------------------------------------ */
const NAV = `
<nav id="navbar">
  <a class="logo" href="/"><img src="/logo-cria.webp" alt="Cria" style="height:30px;width:auto;display:block"></a>
  <div class="nav2-meio">
    <div class="nav2-item tem-drop">
      <button class="nav2-link" aria-expanded="false">Produto <span class="seta"></span></button>
      <div class="nav2-drop">
        <a href="/" style="--cor:var(--laranja)"><b>Pra criadores</b><small>Quem cria pro próprio perfil</small></a>
        <a href="/social-media" style="--cor:var(--azul)"><b>Pra social medias</b><small>Quem atende clientes</small></a>
        <a href="/funcionalidades" style="--cor:var(--rosa)"><b>Funcionalidades</b><small>A lista completa do que tem lá</small></a>
      </div>
    </div>
    <div class="nav2-item"><a class="nav2-link" href="/#planos">Planos</a></div>
    <div class="nav2-item tem-drop">
      <button class="nav2-link nav2-atual" aria-expanded="false">Conteúdo <span class="seta"></span></button>
      <div class="nav2-drop">
        <a href="/blog" style="--cor:var(--amarelo)"><b>Blog</b><small>Uma situação real por semana, e como sair dela</small></a>
        <a href="/#faq" style="--cor:var(--azul)"><b>Dúvidas frequentes</b><small>Preço, cancelamento, como começar</small></a>
      </div>
    </div>
  </div>
  <div class="nav2-dir">
    <a href="${APP}/login" class="nav-login">Entrar</a>
    <a href="${APP}/signup" class="btn btn-laranja nav-cta">Testar grátis</a>
    <button class="nav2-burger" aria-label="Abrir menu" aria-expanded="false" aria-controls="menu-mobile"><i></i><i></i><i></i></button>
  </div>
</nav>
<div class="nav2-painel" id="menu-mobile">
  <details class="grupo"><summary class="grupo-h">Produto <span class="mais"></span></summary>
    <div class="grupo-c">
      <a href="/" style="--cor:var(--laranja)">Pra criadores</a>
      <a href="/social-media" style="--cor:var(--azul)">Pra social medias</a>
      <a href="/funcionalidades" style="--cor:var(--rosa)">Funcionalidades</a>
    </div>
  </details>
  <a class="solo" href="/#planos">Planos <span class="mais" style="transform:rotate(-45deg) translate(-2px,-2px)"></span></a>
  <details class="grupo" open><summary class="grupo-h">Conteúdo <span class="mais"></span></summary>
    <div class="grupo-c">
      <a href="/blog" style="--cor:var(--amarelo)">Blog</a>
      <a href="/#faq" style="--cor:var(--azul)">Dúvidas frequentes</a>
    </div>
  </details>
  <div class="nav2-pe">
    <div class="pe-linha">
      <a class="pe-entrar" href="${APP}/login">Entrar</a>
      <a class="pe-cta" href="${APP}/signup">Testar grátis</a>
    </div>
  </div>
</div>`;

const FOOTER = `
<footer>
  <div class="container">
    <img src="/logo-cria-white.webp" alt="CRIA" style="height:30px;width:auto;display:block;margin:0 auto 10px">
    <p>© ${new Date().getFullYear()} CRIA Social Club · Feito no Brasil</p>
    <nav class="footer-links" aria-label="Links institucionais e legais">
      <a href="/">Pra criadores</a>
      <a href="/social-media">Pra social medias</a>
      <a href="/funcionalidades">Funcionalidades</a>
      <a href="/blog">Blog</a>
      <a href="${APP}/termos">Termos de uso</a>
      <a href="${APP}/privacidade">Política de privacidade</a>
    </nav>
    <p class="footer-contato">Fale com a gente: <a href="mailto:contato@criasocialclub.com.br">contato@criasocialclub.com.br</a></p>
  </div>
</footer>`;

function head({ title, description, canonical, image, tipo, extra }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/favicon-512.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta property="og:type" content="${tipo || 'website'}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image || SITE + '/og.png'}">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="CRIA Social Club">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<link rel="alternate" type="application/rss+xml" title="Blog do CRIA" href="/blog/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Roboto:wght@300;400;500;700&family=Grand+Hotel&display=swap" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Roboto:wght@300;400;500;700&family=Grand+Hotel&display=swap"></noscript>
<link rel="stylesheet" href="/blog/blog.css">
<script defer src="/track.js"></script>
${extra || ''}
</head>
<body>`;
}

/* ------------------------------------------------------------------ *
 * Leitura dos posts
 * ------------------------------------------------------------------ */
function lerPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8');
      const { meta, body } = parseFrontMatter(raw);
      const slug = meta.slug || slugify(meta.title || f.replace(/\.md$/, ''));
      const { html, sumario } = markdown(body);
      const palavras = body.split(/\s+/).length;
      return {
        arquivo: f,
        slug,
        title: meta.title || slug,
        titleSeo: meta.title_seo || meta.title || slug,
        description: meta.description || '',
        date: meta.date,
        updated: meta.updated || meta.date,
        trilha: meta.trilha && TRILHAS[meta.trilha] ? meta.trilha : 'situacao-ferramenta',
        publico: meta.publico || '',
        keyword: meta.keyword || '',
        cta_titulo: meta.cta_titulo || '',
        cta_texto: meta.cta_texto || '',
        cta_botao: meta.cta_botao || 'Criar conta grátis',
        cta_link: meta.cta_link || `${APP}/signup`,
        destaque: meta.destaque === 'true',
        faq: Array.isArray(meta.faq) ? meta.faq : [],
        leitura: meta.leitura || Math.max(2, Math.round(palavras / 220)),
        html,
        sumario,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function dataBr(iso) {
  const [a, m, d] = String(iso).split('-');
  return `${Number(d)} de ${MESES[Number(m) - 1]}. de ${a}`;
}

/* ------------------------------------------------------------------ *
 * Página de post
 * ------------------------------------------------------------------ */
function paginaPost(post, todos) {
  const t = TRILHAS[post.trilha];
  const url = `${SITE}/blog/${post.slug}`;

  const faqPares = post.faq.map((linha) => {
    const idx = linha.indexOf('||');
    return idx === -1 ? null : { p: linha.slice(0, idx).trim(), r: linha.slice(idx + 2).trim() };
  }).filter(Boolean);

  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      inLanguage: 'pt-BR',
      datePublished: post.date,
      dateModified: post.updated,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      url,
      image: `${SITE}/og.png`,
      articleSection: t.label,
      keywords: post.keyword,
      author: { '@type': 'Organization', name: 'CRIA Social Club', url: SITE },
      publisher: {
        '@type': 'Organization',
        name: 'CRIA Social Club',
        url: SITE,
        logo: { '@type': 'ImageObject', url: `${SITE}/logo-cria.png` },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'CRIA', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog` },
        { '@type': 'ListItem', position: 3, name: post.title, item: url },
      ],
    },
  ];
  if (faqPares.length) {
    jsonld.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqPares.map((f) => ({
        '@type': 'Question',
        name: f.p,
        acceptedAnswer: { '@type': 'Answer', text: f.r },
      })),
    });
  }

  const relacionados = todos
    .filter((p) => p.slug !== post.slug)
    .sort((a, b) => (a.trilha === post.trilha ? -1 : 1))
    .slice(0, 3);

  const sumario = post.sumario.length > 2
    ? `<nav class="sumario" aria-label="Neste texto">
        <span class="sumario-titulo">Neste texto</span>
        <ol>${post.sumario.map((s) => `<li><a href="#${s.id}">${esc(s.texto)}</a></li>`).join('')}</ol>
       </nav>`
    : '';

  const faqHtml = faqPares.length
    ? `<section class="faq-post" id="perguntas-frequentes">
        <h2 id="perguntas-frequentes-titulo">Perguntas frequentes</h2>
        ${faqPares.map((f) => `<details class="faq-item"><summary>${inline(f.p)}</summary><div class="faq-r"><p>${inline(f.r)}</p></div></details>`).join('')}
       </section>`
    : '';

  return `${head({
    title: post.titleSeo,
    description: post.description,
    canonical: url,
    tipo: 'article',
    extra: `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`,
  })}
${NAV}

<article class="post">
  <header class="post-head">
    <div class="container-post">
      <a class="voltar" href="/blog">‹ Blog do CRIA</a>
      <span class="kicker" style="background:${t.cor};color:${t.texto}">${esc(t.label)}</span>
      <h1>${inline(post.title)}</h1>
      <p class="post-sub">${inline(post.description)}</p>
      <p class="post-meta">
        <time datetime="${post.date}">${dataBr(post.date)}</time>
        <span aria-hidden="true">·</span>
        <span>${post.leitura} min de leitura</span>
        ${post.publico ? `<span aria-hidden="true">·</span><span>Pra ${esc(post.publico)}</span>` : ''}
      </p>
    </div>
  </header>

  <div class="post-layout">
    ${sumario}
    <div class="post-corpo">
    ${post.html}
    ${faqHtml}

    <section class="cta-final">
      <h2>${esc(post.cta_titulo || 'Testa isso no CRIA')}</h2>
      <p>${inline(post.cta_texto || 'O CRIA junta ideia, produção, aprovação e resultado no mesmo lugar. Conta grátis, sem cartão.')}</p>
      <a class="btn btn-laranja" href="${post.cta_link}">${esc(post.cta_botao)}</a>
    </section>

    ${relacionados.length ? `<section class="relacionados">
      <h2>Pra ler depois</h2>
      <div class="rel-grid">
        ${relacionados.map((p) => {
          const rt = TRILHAS[p.trilha];
          return `<a class="rel-card" href="/blog/${p.slug}">
            <span class="rel-tag" style="background:${rt.cor};color:${rt.texto}">${esc(rt.curto)}</span>
            <strong>${esc(p.title)}</strong>
            <span class="rel-meta">${p.leitura} min</span>
          </a>`;
        }).join('')}
      </div>
    </section>` : ''}
    </div>
  </div>
</article>

${FOOTER}
<!-- Navbar v2: submenu no clique (desktop) e painel no celular.
     O hover cobre o mouse; o clique cobre teclado e telas de toque. -->
<script>
(function(){
  var itens = document.querySelectorAll('.nav2-item.tem-drop');
  itens.forEach(function(item){
    var botao = item.querySelector('.nav2-link');
    if(!botao) return;
    botao.addEventListener('click', function(e){
      e.preventDefault();
      var jaAberto = item.classList.contains('aberto');
      itens.forEach(function(o){ o.classList.remove('aberto'); o.querySelector('.nav2-link').setAttribute('aria-expanded','false'); });
      if(!jaAberto){ item.classList.add('aberto'); botao.setAttribute('aria-expanded','true'); }
    });
  });
  document.addEventListener('click', function(e){
    if(e.target.closest('.nav2-item')) return;
    itens.forEach(function(o){ o.classList.remove('aberto'); o.querySelector('.nav2-link').setAttribute('aria-expanded','false'); });
  });

  var burger = document.querySelector('.nav2-burger');
  var painel = document.querySelector('.nav2-painel');
  if(burger && painel){
    var alterna = function(abrir){
      painel.classList.toggle('aberto', abrir);
      burger.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      document.body.classList.toggle('nav2-travado', abrir);
    };
    burger.addEventListener('click', function(){ alterna(!painel.classList.contains('aberto')); });
    painel.addEventListener('click', function(e){ if(e.target.closest('a')) alterna(false); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') alterna(false); });
  }
})();
</script>
</body>
</html>`;
}

/* ------------------------------------------------------------------ *
 * Página de listagem
 * ------------------------------------------------------------------ */
function paginaIndex(posts) {
  const destaque = posts.find((p) => p.destaque) || posts[0];
  const restantes = posts.filter((p) => p.slug !== (destaque && destaque.slug));

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Blog do CRIA',
    description: 'Situações reais de quem vive de conteúdo e o caminho pra sair delas.',
    url: `${SITE}/blog`,
    inLanguage: 'pt-BR',
    publisher: { '@type': 'Organization', name: 'CRIA Social Club', url: SITE },
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${SITE}/blog/${p.slug}`,
      datePublished: p.date,
      description: p.description,
    })),
  };

  const chips = Object.entries(TRILHAS)
    .filter(([k]) => posts.some((p) => p.trilha === k))
    .map(([k, v]) => `<button class="chip" data-trilha="${k}" style="--chip:${v.cor};--chip-txt:${v.texto}">${esc(v.label)}</button>`)
    .join('');

  const card = (p) => {
    const t = TRILHAS[p.trilha];
    return `<a class="card" href="/blog/${p.slug}" data-trilha="${p.trilha}">
      <span class="card-tag" style="background:${t.cor};color:${t.texto}">${esc(t.curto)}</span>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.description)}</p>
      <span class="card-meta"><time datetime="${p.date}">${dataBr(p.date)}</time> · ${p.leitura} min</span>
    </a>`;
  };

  return `${head({
    title: 'Blog do CRIA | Conteúdo pra quem vive de redes sociais',
    description: 'Situações reais do dia a dia de criadores e social medias, com o caminho prático pra resolver cada uma. Texto direto, sem enrolação, toda semana.',
    canonical: `${SITE}/blog`,
    extra: `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`,
  })}
${NAV}

<header id="blog-hero">
  <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
  <div class="container">
    <span class="kicker" style="background:var(--amarelo);color:#0A0A0A">Blog do CRIA</span>
    <h1>Uma situação de verdade,<span class="script">e o jeito de sair dela</span></h1>
    <p class="hero-sub">Toda semana a gente pega uma cena que acontece de verdade com criador e social media (o cliente que some, a ideia que não vem, o mês que fecha no vermelho) e mostra o caminho até o outro lado.</p>
  </div>
</header>

<main class="container blog-main">
  ${destaque ? `<a class="destaque" href="/blog/${destaque.slug}">
    <div class="destaque-txt">
      <span class="card-tag" style="background:${TRILHAS[destaque.trilha].cor};color:${TRILHAS[destaque.trilha].texto}">${esc(TRILHAS[destaque.trilha].curto)}</span>
      <h2>${esc(destaque.title)}</h2>
      <p>${esc(destaque.description)}</p>
      <span class="card-meta"><time datetime="${destaque.date}">${dataBr(destaque.date)}</time> · ${destaque.leitura} min de leitura</span>
    </div>
  </a>` : ''}

  <div class="filtros" role="group" aria-label="Filtrar por trilha">
    <button class="chip ativo" data-trilha="todas">Tudo</button>
    ${chips}
  </div>

  <div class="grid" id="lista">
    ${restantes.map(card).join('\n')}
  </div>
  <p class="vazio" hidden>Nada nessa trilha ainda. Volta semana que vem.</p>

  <section class="trilhas-explica">
    <h2>As trilhas do blog</h2>
    <div class="tr-grid">
      ${Object.entries(TRILHAS).map(([k, v]) => `<div class="tr-item" style="border-left:5px solid ${v.cor}">
        <strong>${esc(v.label)}</strong>
        <p>${esc(v.desc)}</p>
      </div>`).join('')}
    </div>
  </section>
</main>

${FOOTER}
<script>
// Filtro de trilha: só mostra e esconde cartão, sem recarregar a página.
(function(){
  var chips = document.querySelectorAll('.chip');
  var cards = document.querySelectorAll('#lista .card');
  var vazio = document.querySelector('.vazio');
  chips.forEach(function(c){
    c.addEventListener('click', function(){
      chips.forEach(function(x){ x.classList.remove('ativo'); });
      c.classList.add('ativo');
      var t = c.dataset.trilha, visiveis = 0;
      cards.forEach(function(card){
        var ok = (t === 'todas' || card.dataset.trilha === t);
        card.style.display = ok ? '' : 'none';
        if (ok) visiveis++;
      });
      if (vazio) vazio.hidden = visiveis > 0;
    });
  });
})();
</script>
<!-- Navbar v2: submenu no clique (desktop) e painel no celular.
     O hover cobre o mouse; o clique cobre teclado e telas de toque. -->
<script>
(function(){
  var itens = document.querySelectorAll('.nav2-item.tem-drop');
  itens.forEach(function(item){
    var botao = item.querySelector('.nav2-link');
    if(!botao) return;
    botao.addEventListener('click', function(e){
      e.preventDefault();
      var jaAberto = item.classList.contains('aberto');
      itens.forEach(function(o){ o.classList.remove('aberto'); o.querySelector('.nav2-link').setAttribute('aria-expanded','false'); });
      if(!jaAberto){ item.classList.add('aberto'); botao.setAttribute('aria-expanded','true'); }
    });
  });
  document.addEventListener('click', function(e){
    if(e.target.closest('.nav2-item')) return;
    itens.forEach(function(o){ o.classList.remove('aberto'); o.querySelector('.nav2-link').setAttribute('aria-expanded','false'); });
  });

  var burger = document.querySelector('.nav2-burger');
  var painel = document.querySelector('.nav2-painel');
  if(burger && painel){
    var alterna = function(abrir){
      painel.classList.toggle('aberto', abrir);
      burger.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      document.body.classList.toggle('nav2-travado', abrir);
    };
    burger.addEventListener('click', function(){ alterna(!painel.classList.contains('aberto')); });
    painel.addEventListener('click', function(e){ if(e.target.closest('a')) alterna(false); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') alterna(false); });
  }
})();
</script>
</body>
</html>`;
}

/* ------------------------------------------------------------------ *
 * RSS, sitemap, robots, llms.txt
 * ------------------------------------------------------------------ */
function rss(posts) {
  const itens = posts.map((p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${SITE}/blog/${p.slug}</link>
    <guid isPermaLink="true">${SITE}/blog/${p.slug}</guid>
    <description>${esc(p.description)}</description>
    <pubDate>${new Date(p.date + 'T09:00:00-03:00').toUTCString()}</pubDate>
    <category>${esc(TRILHAS[p.trilha].label)}</category>
  </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Blog do CRIA</title>
  <link>${SITE}/blog</link>
  <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml"/>
  <description>Situações reais de quem vive de conteúdo e o caminho pra sair delas.</description>
  <language>pt-BR</language>
${itens}
</channel>
</rss>`;
}

function sitemap(posts) {
  const hoje = new Date().toISOString().slice(0, 10);
  const fixas = [
    { loc: `${SITE}/`, pri: '1.0', freq: 'weekly' },
    { loc: `${SITE}/social-media`, pri: '0.9', freq: 'weekly' },
    { loc: `${SITE}/funcionalidades`, pri: '0.7', freq: 'monthly' },
    { loc: `${SITE}/blog`, pri: '0.8', freq: 'weekly' },
  ];
  const urls = fixas.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${hoje}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`)
    .concat(posts.map((p) => `  <url><loc>${SITE}/blog/${p.slug}</loc><lastmod>${p.updated}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

function robots() {
  return `User-agent: *
Allow: /

# Rastreadores de IA liberados de propósito: a gente quer ser citado.
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;
}

function llms(posts) {
  const linhas = posts.map((p) => `- [${p.title}](${SITE}/blog/${p.slug}): ${p.description}`).join('\n');
  return `# CRIA Social Club

> CRIA é um software brasileiro para criadores de conteúdo e social medias. Ele cobre o ciclo inteiro do conteúdo: ideia, planejamento, produção, aprovação do cliente, publicação e análise de resultado. Interface em português, preços em real.

## O que o CRIA resolve

- Criador de conteúdo solo: banco de ideias, calendário editorial, roteiro, teleprompter, mídia kit, link na bio e leitura das métricas do Instagram.
- Social media e agência: carteira de clientes, aprovação de post por link (sem o cliente precisar de conta), CRM de propostas e contratos, financeiro por cliente, captação de conteúdo e relatório white-label.

## Como o produto é vendido

- Conta de gestor de redes sociais: grátis, com módulos pagos avulsos.
- Planos do criador: Essencial, Pro e Studio, com 7 dias grátis.
- Site: ${SITE} · App: ${APP}

## Páginas principais

- [CRIA pra criadores](${SITE}/): visão geral pra quem cria pro próprio perfil.
- [CRIA pra social medias](${SITE}/social-media): módulos e preços pra quem atende clientes.
- [Funcionalidades](${SITE}/funcionalidades): lista detalhada de recursos.
- [Blog](${SITE}/blog): conteúdo semanal sobre a rotina de criadores e social medias.

## Textos do blog

${linhas}
`;
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */
// Data de hoje no fuso de Brasília, no formato AAAA-MM-DD.
function hojeBr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function build() {
  const todos = lerPosts();
  if (!todos.length) {
    console.log('Nenhum post em blog/posts. Nada a fazer.');
    return;
  }

  // Fila: post com data no futuro fica guardado e entra sozinho no dia certo.
  // `--tudo` força a geração de todos, pra revisar um agendado antes da hora.
  const forcar = process.argv.includes('--tudo');
  const hoje = hojeBr();
  const posts = forcar ? todos : todos.filter((p) => String(p.date) <= hoje);
  const fila = todos.filter((p) => String(p.date) > hoje);

  if (!posts.length) {
    console.log(`Nenhum post com data até hoje (${hoje}). ${fila.length} na fila.`);
    return;
  }

  posts.forEach((p) => {
    fs.writeFileSync(path.join(AQUI, `${p.slug}.html`), paginaPost(p, posts));
    console.log(`ok  blog/${p.slug}.html`);
  });
  fs.writeFileSync(path.join(AQUI, 'index.html'), paginaIndex(posts));
  fs.writeFileSync(path.join(AQUI, 'rss.xml'), rss(posts));
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap(posts));
  fs.writeFileSync(path.join(ROOT, 'robots.txt'), robots());
  fs.writeFileSync(path.join(ROOT, 'llms.txt'), llms(posts));
  console.log(`ok  blog/index.html`);
  console.log(`ok  blog/rss.xml`);
  console.log(`ok  sitemap.xml, robots.txt, llms.txt`);
  console.log(`\n${posts.length} post(s) no ar.`);
  if (fila.length) {
    console.log(`${fila.length} na fila, esperando a data:`);
    fila.slice().reverse().forEach((p) => console.log(`    ${p.date}  ${p.title}`));
  }
}

build();
