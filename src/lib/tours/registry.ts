/**
 * Tour guiado do CRIA — registry config-driven.
 * Adicionar um tour novo = adicionar um config aqui (ou num arquivo de área) e
 * marcar os alvos com data-tour="chave" na tela. Zero acoplamento com as páginas.
 */
import { TOURS_CRIADOR } from "./criador";

export type TourStep = {
  /** Seletor do alvo: '[data-tour="chave"]'. Se o elemento não existir, o passo é pulado. */
  target: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
  /** Se presente, mostra o botão "Fazer com a Cria IA" que abre o painel com esse prompt. */
  aiPrompt?: string;
};

export type TourConfig = {
  id: string;
  /** Rota exata que ativa o tour (pathname). */
  route: string;
  title: string;
  /** Por que a tela existe / que problema resolve — mostrado no card de abertura. */
  valueProp: string;
  benefits: string[];
  steps: TourStep[];
};

export const TOURS: TourConfig[] = [...TOURS_CRIADOR];

export function findTourByRoute(pathname: string): TourConfig | undefined {
  return TOURS.find(t => t.route === pathname);
}

export function findTourById(id: string): TourConfig | undefined {
  return TOURS.find(t => t.id === id);
}
