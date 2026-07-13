/* ═══════════════════════════════════════════════════════════════════════════
   PERSISTÊNCIA DO CACHE (IndexedDB)

   O problema: o QueryClient estava com gcTime de 24h, mas isso só vale enquanto
   a aba está VIVA. Fechou o PWA, o cache morre junto. Reabriu → esqueleto, rede,
   espera. No celular, que mata o app em segundo plano o tempo todo, isso é o
   comportamento padrão: sempre começar do zero.

   Aqui a gente desidrata o cache pro IndexedDB e reidrata na abertura. O app
   volta com os dados da última sessão JÁ PINTADOS e revalida por baixo. É o que
   faz o Trello/Notion parecerem instantâneos.

   Sem dependência nova: `dehydrate`/`hydrate` já vêm no @tanstack/react-query,
   e o IndexedDB é do navegador. (localStorage não serve: é síncrono, trava a
   thread principal e estoura em 5MB.)
   ═══════════════════════════════════════════════════════════════════════════ */

import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";

const DB = "cria-cache";
const STORE = "rq";
const KEY = "dehydrated";

/** Sobe a versão pra invalidar o cache antigo depois de um deploy que muda o formato. */
const SCHEMA = 1;
/** Cache mais velho que isso não vale mais a pena reidratar. */
const MAX_IDADE = 1000 * 60 * 60 * 24 * 3; // 3 dias

type Envelope = { schema: number; em: number; usuario: string | null; estado: unknown };

function abrir(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function ler(): Promise<Envelope | null> {
  const db = await abrir();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as Envelope) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function gravar(env: Envelope): Promise<void> {
  const db = await abrir();
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).put(env, KEY);
  } catch {
    /* cota cheia, modo privado: não é fatal, só perde o "abre instantâneo" */
  }
}

export async function limparCachePersistido(): Promise<void> {
  const db = await abrir();
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).delete(KEY);
  } catch {
    /* ignora */
  }
}

/**
 * Reidrata o cache salvo. Chamar ANTES de renderizar o app.
 * @param usuarioId id do usuário logado, pra NUNCA mostrar dado de outra conta.
 */
export async function restaurarCache(client: QueryClient, usuarioId: string | null): Promise<void> {
  const env = await ler();
  if (!env) return;

  // Três motivos pra jogar fora: formato velho, cache velho, ou cache de OUTRA
  // pessoa (trocou de conta / logou outro usuário no mesmo celular). O terceiro
  // é o mais importante: vazar dado entre contas seria grave.
  const invalido =
    env.schema !== SCHEMA || Date.now() - env.em > MAX_IDADE || env.usuario !== usuarioId;

  if (invalido) {
    await limparCachePersistido();
    return;
  }

  try {
    hydrate(client, env.estado);
  } catch {
    await limparCachePersistido();
  }
}

/**
 * Passa a salvar o cache a cada mudança (debounced) e quando o app vai pro fundo.
 * Retorna a função de desligar.
 */
export function iniciarPersistencia(client: QueryClient, usuarioId: string | null): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const salvar = () => {
    const estado = dehydrate(client, {
      // Só o que já respondeu com sucesso. Query em erro ou carregando não
      // serve pra nada guardada, e ainda faria a tela abrir mostrando o erro
      // da sessão passada.
      shouldDehydrateQuery: (q) => q.state.status === "success",
    });
    void gravar({ schema: SCHEMA, em: Date.now(), usuario: usuarioId, estado });
  };

  const agendar = () => {
    if (timer) clearTimeout(timer);
    // 1,5s de calmaria: durante um scroll que dispara 10 queries, salva UMA vez.
    timer = setTimeout(salvar, 1500);
  };

  const unsub = client.getQueryCache().subscribe(agendar);

  // O celular mata o app sem avisar. `visibilitychange` é o último momento
  // garantido pra gravar: `beforeunload` não roda de forma confiável no iOS.
  const aoEsconder = () => {
    if (document.visibilityState === "hidden") {
      if (timer) clearTimeout(timer);
      salvar();
    }
  };
  document.addEventListener("visibilitychange", aoEsconder);

  return () => {
    unsub();
    document.removeEventListener("visibilitychange", aoEsconder);
    if (timer) clearTimeout(timer);
  };
}
