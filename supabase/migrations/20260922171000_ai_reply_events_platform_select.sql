-- Platform admin pode ler eventos de resposta IA (resumo por cliente).

drop policy if exists ai_reply_events_platform_select on public.ai_reply_events;
create policy ai_reply_events_platform_select
  on public.ai_reply_events for select
  to authenticated
  using (public.is_platform_admin());

grant select on public.ai_reply_events to authenticated;
