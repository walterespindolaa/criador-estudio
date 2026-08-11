// ── NOME EXIBIDO DO CLIENTE (só pro GESTOR) ──
// A regra de qual nome mostrar pro gestor num lugar só, pra não repetir (e não
// divergir) entre o cockpit, a lista de clientes e a agenda.
//
// PRECEDÊNCIA:
//   1) display_name (apelido do gestor) -> se ele definiu, ganha sempre
//   2) nome ao vivo da conta Cria        -> senão, o nome atual do profile
//   3) crm_clients.name                  -> senão, o nome do CRM
//
// O apelido (display_name) é SÓ do gestor: não vai pro portal do cliente nem
// muda a conta Cria dele. Ver migration 20260811000002_apelido_do_cliente.sql.
//
// Onde não dá pra ter o nome ao vivo do Cria à mão, é só passar criaLiveName
// undefined/null: aí a regra vira display_name || name, que já resolve o caso.

export type ClienteNome = {
  display_name?: string | null;
  name?: string | null;
};

export function nomeExibidoCliente(
  client: ClienteNome | null | undefined,
  criaLiveName?: string | null,
): string {
  const apelido = client?.display_name?.trim();
  if (apelido) return apelido;
  const live = criaLiveName?.trim();
  if (live) return live;
  return client?.name?.trim() || "";
}
