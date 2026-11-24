-- E-mail "Novidade do Cria" (Walter, 24/11/2026: "criar emails pras pessoas que
-- nao acessam a mais de 3 dias o sistema falando de alguma novidade do cria").
-- Cada linha é uma novidade. O robô lifecycle-emails manda UMA por vez pra quem
-- já usou o Cria e não entra há 3 a 13 dias, nunca a mesma duas vezes, no máximo
-- um e-mail de reengajamento por semana. Novidade nova = uma linha nova, sem código.
-- Só o robô (service_role) lê: RLS ligada e nenhuma policy.

create table if not exists public.novidades_email (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  persona text not null default 'todos' check (persona in ('criador', 'sm', 'todos')),
  assunto text not null,
  titulo text not null,
  paragrafos text[] not null,
  botao_texto text not null,
  botao_url text not null,            -- caminho do app (/app/...) ou link completo
  tag text not null default 'Novidade',
  tema text not null default 'amarelo' check (tema in ('verde', 'azul', 'rosa', 'amarelo', 'laranja', 'preto')),
  exige_plano text[],                  -- criador: só manda pra esses planos (null = todos)
  pular_quem_entrou_comunidade boolean not null default false,
  ordem int not null default 100,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.novidades_email enable row level security;
revoke all on public.novidades_email from anon, authenticated;

insert into public.novidades_email (slug, persona, assunto, titulo, paragrafos, botao_texto, botao_url, tag, tema, exige_plano, pular_quem_entrou_comunidade, ordem) values
('publicar-instagram-criador', 'criador',
 'Agora o Cria posta por você no Instagram',
 'Monta, marca a data e esquece',
 array[
   'Desde a última vez que você passou por aqui, o Cria aprendeu a publicar direto no Instagram: na hora ou no dia e horário que você marcar.',
   'Abre um post pronto, escolhe quando ele sai e pronto. Reels, carrossel e foto, sem precisar abrir o Instagram.'
 ],
 'Agendar meu próximo post', '/app/criando', 'Novidade', 'laranja', array['pro', 'studio', 'trial'], false, 10),

('tendencias-stories', 'criador',
 'Ideia de story pronta pra gravar',
 'Stories que estão em alta, com exemplo',
 array[
   'Separamos as tendências de stories numa aba só delas. Cada uma vem com um exemplo do que gravar e o porquê de estar em alta agora.',
   'Gostou de uma? O botão "Criar este story" já monta o story pra você ajustar.'
 ],
 'Ver as tendências de stories', '/app/tendencias', 'Novidade', 'rosa', array['pro', 'studio', 'trial'], false, 20),

('publicar-instagram-sm', 'sm',
 'O cliente aprovou? O post sai sozinho',
 'Um passo a menos na sua semana',
 array[
   'Agora, depois que o cliente aprova pelo link, o Cria Post publica no Instagram dele: na hora ou no dia e horário que você marcou.',
   'O cliente conecta o Instagram uma vez, por um convite, e você não precisa mais pedir a senha nem publicar pelo celular dele.'
 ],
 'Ver meus posts', '/socialmidia/criapost', 'Novidade', 'laranja', null, false, 10),

('comunidade-whatsapp', 'todos',
 'Entra na comunidade do Cria',
 'Dicas, novidades e cupons no WhatsApp',
 array[
   'Abrimos uma comunidade do Cria no WhatsApp: dicas de conteúdo toda semana, as novidades do app antes de todo mundo e cupons que não saem em outro lugar.',
   'Você entra com um toque e sai quando quiser.'
 ],
 'Quero entrar', 'https://chat.whatsapp.com/BHcrv0BicjR4Hv7QYTbOJY', 'Comunidade', 'verde', null, true, 30)
on conflict (slug) do nothing;
