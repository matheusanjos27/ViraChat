-- Separar "Como ela se apresenta" do "Prompt inicial" (duas colunas).
-- Antes ficavam juntos em instructions com separador \n---\n.

alter table public.ai_configs
  add column if not exists presentation text not null default '';

comment on column public.ai_configs.presentation is
  'Frase de apresentação no WhatsApp (1ª mensagem). Separada do prompt/instruções.';

comment on column public.ai_configs.instructions is
  'Prompt inicial / notas para a IA (cérebro). Juntado com presentation só na hora do modelo.';

-- Backfill a partir do formato legado presentation\n---\nprompt
do $$
declare
  r record;
  sep constant text := E'\n---\n';
  idx int;
begin
  for r in
    select id, instructions
    from public.ai_configs
    where position(sep in instructions) > 0
  loop
    idx := position(sep in r.instructions);
    update public.ai_configs
    set
      presentation = trim(both from substring(r.instructions from 1 for idx - 1)),
      instructions = trim(both from substring(r.instructions from idx + length(sep)))
    where id = r.id;
  end loop;
end $$;
