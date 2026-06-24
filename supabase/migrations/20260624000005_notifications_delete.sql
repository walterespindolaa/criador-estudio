-- Permite o usuário excluir as próprias notificações (botão "Limpar").
drop policy if exists "Users delete own notifications" on public.notifications;
create policy "Users delete own notifications" on public.notifications
  for delete using (auth.uid() = user_id);
