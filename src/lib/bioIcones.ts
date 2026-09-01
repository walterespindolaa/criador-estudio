import {
  BookOpen, Calendar, Camera, Coffee, CreditCard, Download, Gift, Globe,
  GraduationCap, Heart, Instagram, Link as LinkIcon, Mail, MapPin,
  MessageCircle, Music, Phone, Scissors, ShoppingBag, ShoppingCart, Sparkles,
  Star, Ticket, Utensils, Video, Zap, type LucideIcon,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   ÍCONES DOS BOTÕES DA BIO

   Catálogo fechado de propósito: um campo de emoji livre deixava cada botão
   de um jeito (emoji do iPhone, do Android, quadradinho vazio no Windows).
   Ícone do Lucide desenha igual em todo lugar e conversa com o resto da
   página. O valor guardado é "lucide:id"; o que não começar com "lucide:" é
   emoji antigo e continua aparecendo como texto, nada quebra.
   ═══════════════════════════════════════════════════════════════════════════ */

export const ICONES_BLOCO: { id: string; nome: string; Icone: LucideIcon }[] = [
  { id: "conversa", nome: "Conversa", Icone: MessageCircle },
  { id: "site", nome: "Site", Icone: Globe },
  { id: "carrinho", nome: "Carrinho", Icone: ShoppingCart },
  { id: "sacola", nome: "Sacola", Icone: ShoppingBag },
  { id: "cardapio", nome: "Cardápio", Icone: Utensils },
  { id: "agenda", nome: "Agenda", Icone: Calendar },
  { id: "local", nome: "Localização", Icone: MapPin },
  { id: "telefone", nome: "Telefone", Icone: Phone },
  { id: "email", nome: "E-mail", Icone: Mail },
  { id: "instagram", nome: "Instagram", Icone: Instagram },
  { id: "estrela", nome: "Estrela", Icone: Star },
  { id: "coracao", nome: "Coração", Icone: Heart },
  { id: "presente", nome: "Presente", Icone: Gift },
  { id: "brilho", nome: "Brilho", Icone: Sparkles },
  { id: "raio", nome: "Novidade", Icone: Zap },
  { id: "musica", nome: "Música", Icone: Music },
  { id: "video", nome: "Vídeo", Icone: Video },
  { id: "camera", nome: "Câmera", Icone: Camera },
  { id: "livro", nome: "Livro", Icone: BookOpen },
  { id: "curso", nome: "Curso", Icone: GraduationCap },
  { id: "download", nome: "Download", Icone: Download },
  { id: "ingresso", nome: "Ingresso", Icone: Ticket },
  { id: "cafe", nome: "Café", Icone: Coffee },
  { id: "pagamento", nome: "Pagamento", Icone: CreditCard },
  { id: "beleza", nome: "Beleza", Icone: Scissors },
  { id: "link", nome: "Link", Icone: LinkIcon },
];

/** Resolve "lucide:id" pro componente; qualquer outra coisa devolve null. */
export function iconeLucide(valor: string): LucideIcon | null {
  if (!valor || !valor.startsWith("lucide:")) return null;
  return ICONES_BLOCO.find((i) => i.id === valor.slice(7))?.Icone ?? null;
}
