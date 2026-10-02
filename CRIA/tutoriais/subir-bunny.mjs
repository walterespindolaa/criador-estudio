#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Sobe os vídeos tutoriais pro Bunny (library cria-tutoriais) e preenche o
// catálogo public.tutoriais. Roda no seu computador, sem instalar nada (Node 18+).
//
//   node CRIA/tutoriais/subir-bunny.mjs                     sobe o que ainda não subiu
//   node CRIA/tutoriais/subir-bunny.mjs --so=10-criador-06-prompter --substituir
//                                                           troca um vídeo (pente fino)
//   node CRIA/tutoriais/subir-bunny.mjs --sincronizar       só confere o processamento
//
// Pede seu e-mail e senha de admin aqui no terminal (a senha não aparece) e usa
// só pra pegar a sessão na Supabase. A chave do Bunny nunca passa por aqui:
// a função tutorial-bunny devolve uma assinatura que vale 1h pra cada vídeo.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const AQUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(AQUI, "../..");
const PASTA = join(AQUI, "videos");

// .env do repo: URL e chave pública (a mesma que vai no site)
const env = {};
for (const nome of [".env", ".env.local"]) {
  const p = join(REPO, nome);
  if (!existsSync(p)) continue;
  for (const l of readFileSync(p, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
}
const URL_SB = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!URL_SB || !ANON) { console.error("Não achei VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY no .env"); process.exit(1); }

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? true];
}));
const so = typeof args.so === "string" ? new Set(args.so.split(",")) : null;

function perguntar(texto, oculto = false) {
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) rl._writeToOutput = (s) => { if (s.includes(texto)) process.stdout.write(s); };
    rl.question(texto, (r) => { rl.close(); if (oculto) process.stdout.write("\n"); ok(r.trim()); });
  });
}

async function login() {
  const email = await perguntar("E-mail de admin do Cria: ");
  const senha = await perguntar("Senha (não aparece): ", true);
  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: senha }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) { console.error("Login recusado:", j.error_description || j.msg || r.status); process.exit(1); }
  return j.access_token;
}

async function funcao(token, corpo) {
  const r = await fetch(`${URL_SB}/functions/v1/tutorial-bunny`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${j.error || ""} ${j.detalhe || ""}`.trim());
  return j;
}

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

// Upload TUS do Bunny: cria a sessão e manda o arquivo inteiro num PATCH
// (os tutoriais têm menos de 20 MB cada).
async function enviarTus(caminho, slug, ass) {
  const tamanho = statSync(caminho).size;
  const cab = {
    AuthorizationSignature: ass.signature,
    AuthorizationExpire: String(ass.expiration),
    VideoId: ass.videoGuid,
    LibraryId: String(ass.libraryId),
    "Tus-Resumable": "1.0.0",
  };
  const base = "https://video.bunnycdn.com/tusupload";
  const c = await fetch(base, {
    method: "POST",
    headers: { ...cab, "Upload-Length": String(tamanho), "Upload-Metadata": `filetype ${b64("video/mp4")},title ${b64(slug)}` },
  });
  if (c.status !== 201) throw new Error(`TUS recusou a criação (${c.status}) ${await c.text()}`);
  const local = new URL(c.headers.get("location"), base).toString();
  const p = await fetch(local, {
    method: "PATCH",
    headers: { ...cab, "Upload-Offset": "0", "Content-Type": "application/offset+octet-stream" },
    body: readFileSync(caminho),
  });
  if (p.status !== 204) throw new Error(`TUS recusou o envio (${p.status}) ${await p.text()}`);
  const off = Number(p.headers.get("upload-offset"));
  if (off !== tamanho) throw new Error(`envio incompleto: ${off} de ${tamanho} bytes`);
}

const token = await login();

if (!args.sincronizar) {
  const lista = JSON.parse(readFileSync(join(PASTA, "manifesto.json"), "utf8"))
    .filter((v) => !so || so.has(v.slug));
  if (so && lista.length !== so.size) console.warn("Atenção: algum slug do --so não está no manifesto.");
  let subiu = 0, pulou = 0, falhou = 0;
  for (const v of lista) {
    const caminho = join(PASTA, v.arquivo);
    if (!existsSync(caminho)) { console.log(`--  ${v.slug}: arquivo não encontrado, pulei`); pulou++; continue; }
    try {
      const { arquivo, ...meta } = v;
      const r = await funcao(token, { acao: "subir", ...meta, substituir: args.substituir === true });
      if (r.jaExiste) { console.log(`ok  ${v.slug}: já está no Bunny (${r.status})`); pulou++; continue; }
      process.stdout.write(`>>  ${v.slug} (${(statSync(caminho).size / 1e6).toFixed(1)} MB)... `);
      await enviarTus(caminho, v.slug, r);
      console.log("enviado");
      subiu++;
    } catch (e) {
      console.log(`\nERRO ${v.slug}: ${e.message}\n    Rode de novo só esse com --so=${v.slug} --substituir`);
      falhou++;
    }
  }
  console.log(`\nEnviados: ${subiu} · já estavam: ${pulou} · com erro: ${falhou}`);
}

const s = await funcao(token, { acao: "sincronizar" });
const linhas = Object.entries(s.resultado || {});
if (!linhas.length) console.log("Nada processando no Bunny.");
for (const [slug, st] of linhas) console.log(`    ${slug}: ${st}`);
if (linhas.some(([, st]) => st.startsWith("processando")))
  console.log("\nO Bunny ainda está convertendo. Daqui uns minutos rode com --sincronizar pra marcar os prontos.");
