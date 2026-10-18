/**
 * Conta ATIVA fora do React. O AccountProvider escreve aqui sempre que a
 * conta aberta muda; funções soltas (ex.: callAIContextBuilder) leem pra
 * dizer ao servidor PRA QUAL CONTA é a chamada. O servidor confere o acesso
 * (conta_acessivel), então isto é só endereçamento, não permissão.
 */
let contaAtiva: string | null = null;

export function definirContaAtiva(id: string | null) {
  contaAtiva = id;
}

export function contaAtivaAtual(): string | null {
  return contaAtiva;
}
