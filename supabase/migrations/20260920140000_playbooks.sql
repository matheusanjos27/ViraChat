-- DEV-06 — Playbooks de conversa (roteiro estruturado genérico)

create type public.playbook_trigger as enum ('new_contact', 'keyword', 'manual');

create table public.playbooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  trigger public.playbook_trigger not null default 'new_contact',
  trigger_keyword text,
  is_active boolean not null default true,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index playbooks_tenant_active_idx
  on public.playbooks (tenant_id, is_active);

create trigger playbooks_updated_at
  before update on public.playbooks
  for each row execute function public.set_updated_at();

alter table public.playbooks enable row level security;

create policy playbooks_tenant_all
  on public.playbooks for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

grant select, insert, update, delete on public.playbooks to authenticated;

-- Default playbook template (generic B2B — no industry hardcode)
create or replace function public.default_playbook_content()
returns text
language sql
immutable
as $$
  select $pb$# Objetivo
Qualificar o lead, entender a necessidade, coletar dados e apresentar um orçamento claro — como um consultor comercial humano, sem parecer formulário robótico.

# Tom de voz
Português do Brasil, cordial, objetivo. Mensagens curtas (WhatsApp). Uma pergunta por vez quando estiver coletando dados.

# Abertura
Cumprimente, apresente-se pela empresa e pergunte como pode ajudar.
Se o lead já disser o que quer (orçamento, informação, suporte), vá direto ao ponto.

# Dados a coletar
Use os CAMPOS A COLETAR injetados pelo sistema. Priorize os obrigatórios.
Não peça tudo de uma vez — converse naturalmente.
Quando o lead informar um dado, registre em "collected" no JSON.

# Diagnóstico
Depois dos dados básicos, faça perguntas curtas para entender:
- O que a pessoa precisa resolver agora
- Urgência (hoje / esta semana / só pesquisando)
- Se já usa algum fornecedor/concorrente
Adapte as perguntas ao ramo/setor informado — não use checklist genérico demais.

# Orçamento
Só precifique quando tiver a quantidade (ou o campo de porte) e souber quais serviços se aplicam.
Use EXCLUSIVAMENTE o CATÁLOGO / ORÇAMENTO PRÉ-CALCULADO do sistema.
Nunca invente preços.
Apresente a proposta de forma clara, separe o que é recorrente do que é avulso, e pergunte se quer ajustar.

# Objeções
Se disser que está caro: não entre em defensiva. Ofereça revisar o escopo (o essencial agora vs. depois).
Se pedir desconto especial ou negociação fora da tabela: transfira para humano (handoff).

# Fechamento
Confirme resumo (empresa, responsável, serviços, valor) e pergunte se pode seguir para contratação.
Se confirmar: agradeça, diga que a equipe dará sequência e faça handoff se necessário.

# Transferir para humano quando
- Cliente pedir atendente/humano explicitamente
- Pedir desconto ou condição especial
- Empresa muito grande / caso complexo
- Reclamação, fiscalização, urgência crítica
- Dúvida técnica que você não consegue responder com as instruções

# O que NÃO fazer
- Não inventar produtos, prazos ou preços
- Não insistir se o lead disser que não tem interesse
- Não enviar menus numerados longos sem necessidade
$pb$;
$$;

-- Extend CRM seed to include default playbook
create or replace function public.seed_tenant_crm(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.deal_stages where tenant_id = p_tenant_id) then
    insert into public.deal_stages (tenant_id, name, color, sort_order, is_closed_won, is_closed_lost)
    values
      (p_tenant_id, 'Novo lead',     '#64748b', 0, false, false),
      (p_tenant_id, 'Qualificado',   '#3b82f6', 1, false, false),
      (p_tenant_id, 'Orçamento',     '#8b5cf6', 2, false, false),
      (p_tenant_id, 'Proposta',      '#f59e0b', 3, false, false),
      (p_tenant_id, 'Negociação',    '#ef4444', 4, false, false),
      (p_tenant_id, 'Fechado',       '#16a34a', 5, true,  false),
      (p_tenant_id, 'Perdido',       '#94a3b8', 6, false, true);
  end if;

  if not exists (select 1 from public.contact_attributes where tenant_id = p_tenant_id) then
    insert into public.contact_attributes
      (tenant_id, key, label, type, required, collect_via_ai, sort_order)
    values
      (p_tenant_id, 'empresa',      'Empresa',            'text',   true,  true, 0),
      (p_tenant_id, 'email',        'E-mail',             'email',  false, true, 1),
      (p_tenant_id, 'responsavel',  'Nome do responsável','text',   true,  true, 2),
      (p_tenant_id, 'setor',        'Setor / ramo',       'text',   false, true, 3),
      (p_tenant_id, 'tamanho',      'Porte (ex: nº pessoas)', 'number', false, true, 4);
  end if;

  if not exists (select 1 from public.playbooks where tenant_id = p_tenant_id) then
    insert into public.playbooks (tenant_id, name, trigger, is_active, content)
    values (
      p_tenant_id,
      'Atendimento comercial padrão',
      'new_contact',
      true,
      public.default_playbook_content()
    );
  end if;
end;
$$;

-- Seed playbooks for existing tenants
do $$
declare
  r record;
begin
  for r in select id from public.tenants loop
    perform public.seed_tenant_crm(r.id);
  end loop;
end;
$$;
