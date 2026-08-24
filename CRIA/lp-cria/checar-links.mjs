#!/usr/bin/env node
/*
 * Verificador de links da LP e do blog do CRIA.
 *
 *   node checar-links.mjs           confere os arquivos da pasta
 *   node checar-links.mjs --online  confere também o site publicado (status HTTP)
 *
 * O que ele olha:
 *   1. todo href interno aponta pra um arquivo que existe
 *   2. toda âncora (#secao) existe na página de destino
 *   3. toda imagem, css e script local existe no disco
 *   4. o sitemap.xml lista só URLs que existem, e não esquece nenhuma
 *   5. cada página tem title, description e canonical
 *   6. com --online, cada URL do sitemap responde 200
 *
 * Sai com código 1 se achar problema, então dá pra usar em automação.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const SITE = 'https://criasocialclub.com.br';
const ONLINE = process.argv.includes('--online');

// pastas que não são o site publicado
const IGNORAR_DIR = new Set(['node_modules', '.git', '.vercel', 'prints', 'stickers']);
// arquivos que existem no repo mas não vão pro ar
const IGNORAR_ARQ = /\.(bak|md|zip|py)$/i;

function listarHtml(dir, achados = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (!IGNORAR_DIR.has(item.name) && !item.name.startsWith('_')) listarHtml(path.join(dir, item.name), achados);
    } else if (item.name.endsWith('.html') && !IGNORAR_ARQ.test(item.name)) {
      achados.push(path.join(dir, item.name));
    }
  }
  return achados;
}

const problemas = [];
const avisos = [];
function erro(arq, msg) { problemas.push(`${path.relative(RAIZ, arq)}: ${msg}`); }
function aviso(arq, msg) { avisos.push(`${path.relative(RAIZ, arq)}: ${msg}`); }

// ---------- carrega tudo ----------
const paginas = listarHtml(RAIZ);
const conteudo = new Map();
const ids = new Map();

for (const arq of paginas) {
  const html = fs.readFileSync(arq, 'utf8');
  conteudo.set(arq, html);
  ids.set(arq, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
}

// resolve um href pra um arquivo do disco. devolve null se for externo.
function resolver(href, arqOrigem) {
  if (/^(https?:|mailto:|tel:|javascript:|data:)/i.test(href)) return null;
  let alvo = href.split('#')[0].split('?')[0];
  if (alvo === '') return { arquivo: arqOrigem, ancora: href.split('#')[1] };

  let base;
  if (alvo.startsWith('/')) base = path.join(RAIZ, alvo.slice(1));
  else base = path.resolve(path.dirname(arqOrigem), alvo);

  const candidatos = [base, base + '.html', path.join(base, 'index.html')];
  for (const c of candidatos) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return { arquivo: c, ancora: href.split('#')[1] };
  }
  return { arquivo: null, tentou: candidatos.map((c) => path.relative(RAIZ, c)), ancora: href.split('#')[1] };
}

// ---------- 1, 2 e 3: links e assets ----------
let totalLinks = 0, totalAssets = 0, externos = new Set();

for (const arq of paginas) {
  const html = conteudo.get(arq);

  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"/g)) {
    const href = m[1];
    totalLinks++;
    if (/^https?:/i.test(href)) { externos.add(href); continue; }
    if (/^(mailto:|tel:)/i.test(href)) continue;

    const r = resolver(href, arq);
    if (!r) continue;
    if (!r.arquivo) { erro(arq, `link quebrado: ${href} (procurei em ${r.tentou.join(', ')})`); continue; }
    if (r.ancora && !ids.get(r.arquivo)?.has(r.ancora)) {
      erro(arq, `âncora inexistente: ${href} (a página ${path.relative(RAIZ, r.arquivo)} não tem id="${r.ancora}")`);
    }
  }

  for (const m of html.matchAll(/<(?:img|script|link|source)\s[^>]*(?:src|href)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|data:|mailto:|#)/i.test(url)) continue;
    totalAssets++;
    const r = resolver(url, arq);
    if (r && !r.arquivo) erro(arq, `arquivo não encontrado: ${url}`);
  }

  // ---------- 5: meta obrigatória ----------
  if (!/<title>[^<]{5,}<\/title>/.test(html)) erro(arq, 'sem <title>');
  if (!/<meta name="description" content="[^"]{20,}"/.test(html)) erro(arq, 'sem meta description');
  if (!/<link rel="canonical"/.test(html)) aviso(arq, 'sem canonical');
  const og = html.match(/<meta property="og:url" content="([^"]+)"/);
  if (og && !og[1].startsWith(SITE)) aviso(arq, `og:url aponta pra fora: ${og[1]}`);
}

// ---------- 4: sitemap ----------
const sitemapPath = path.join(RAIZ, 'sitemap.xml');
let urlsSitemap = [];
if (!fs.existsSync(sitemapPath)) {
  problemas.push('sitemap.xml: não existe na raiz');
} else {
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  urlsSitemap = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  for (const url of urlsSitemap) {
    const caminho = url.replace(SITE, '') || '/';
    const r = resolver(caminho === '/' ? '/index.html' : caminho, path.join(RAIZ, 'x.html'));
    if (r && !r.arquivo) problemas.push(`sitemap.xml: lista ${url}, que não existe no disco`);
  }

  // páginas publicáveis que ficaram de fora do sitemap
  for (const arq of paginas) {
    const rel = path.relative(RAIZ, arq).replace(/\\/g, '/');
    if (rel.startsWith('comprar/')) continue;
    const limpo = rel.replace(/index\.html$/, '').replace(/\.html$/, '');
    const url = `${SITE}/${limpo}`.replace(/\/$/, '') || SITE;
    const achou = urlsSitemap.some((u) => u.replace(/\/$/, '') === url.replace(/\/$/, ''));
    if (!achou) aviso(arq, 'não está no sitemap.xml');
  }
}

// ---------- 6: online ----------
async function checarOnline() {
  console.log(`\nConferindo ${urlsSitemap.length} URLs no ar...`);
  for (const url of urlsSitemap) {
    try {
      const r = await fetch(url, { redirect: 'manual' });
      const marca = r.status === 200 ? 'ok ' : 'ERRO';
      if (r.status !== 200) problemas.push(`online: ${url} respondeu ${r.status}`);
      console.log(`  ${marca} ${r.status}  ${url}`);
    } catch (e) {
      problemas.push(`online: ${url} não respondeu (${e.message})`);
      console.log(`  ERRO ---  ${url}`);
    }
  }
}

// ---------- relatório ----------
const relatorio = async () => {
  if (ONLINE && urlsSitemap.length) await checarOnline();

  console.log(`\n${paginas.length} páginas · ${totalLinks} links · ${totalAssets} arquivos referenciados · ${externos.size} links externos`);

  if (externos.size) {
    console.log('\nLinks externos (confira na mão se algum mudou):');
    [...externos].sort().forEach((u) => console.log(`  ${u}`));
  }

  if (avisos.length) {
    console.log(`\nAvisos (${avisos.length}), nada quebrado:`);
    avisos.forEach((a) => console.log(`  ${a}`));
  }

  if (problemas.length) {
    console.log(`\nPROBLEMAS (${problemas.length}):`);
    problemas.forEach((p) => console.log(`  ${p}`));
    process.exit(1);
  }
  console.log('\nNenhum link quebrado. Pode publicar.');
};

relatorio();
