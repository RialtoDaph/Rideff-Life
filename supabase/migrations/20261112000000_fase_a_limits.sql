-- Fase A: closes three ways to use paid things for free.
--   1. The 14-day trial ends: after it, a household that has not paid counts as Life.
--   2. Reading files with AI and the Home briefing get a cap per person per day.
--   3. A Stripe event is applied once, and an older event never overwrites a newer one.

-- 1. The plan in force ---------------------------------------------------------------
-- Before: only "cancelled" fell back to Life, so a trial stayed Together for ever.
create or replace function private.ai_plan(p_household uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select case
                            when status = 'cancelled' then 'life'
                            when status = 'trial' and current_period_end < now() then 'life'
                            else plan
                          end
                   from public.subscriptions_billing where household_id = p_household), 'life')
$$;
revoke all on function private.ai_plan(uuid) from public, anon, authenticated;

-- 2. Daily caps ----------------------------------------------------------------------
-- No client access at all: only ai_use() below writes here.
create table if not exists public.ai_daily (
  member_id uuid not null references public.members (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('read', 'briefing')),
  n integer not null default 0,
  primary key (member_id, day, kind)
);
alter table public.ai_daily enable row level security;
revoke all on public.ai_daily from public, anon, authenticated;

-- Counts one use and returns how many are left today; raises ai_quota when the day is full.
--   read      a receipt, statement or roster: 15 a day on Life, 60 on Life Plus and Together
--   briefing  the Home briefing: 12 a day on every plan
create or replace function public.ai_use(p_kind text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  hh uuid := private.my_household();
  today date := (now() at time zone 'Europe/Berlin')::date;
  cap integer;
  used integer;
begin
  if me is null or hh is null then raise exception 'not_member'; end if;
  cap := case p_kind
           when 'read' then case private.ai_plan(hh) when 'life' then 15 else 60 end
           when 'briefing' then 12
         end;
  if cap is null then raise exception 'bad_kind'; end if;

  insert into public.ai_daily as d (member_id, day, kind, n) values (me, today, p_kind, 1)
  on conflict (member_id, day, kind) do update set n = d.n + 1 where d.n < cap
  returning d.n into used;
  if used is null then raise exception 'ai_quota'; end if;

  if used = 1 then delete from public.ai_daily where member_id = me and day < today - 31; end if;
  return cap - used;
end $$;
revoke all on function public.ai_use(text) from public, anon;
grant execute on function public.ai_use(text) to authenticated;

-- 3. Stripe events -------------------------------------------------------------------
alter table public.subscriptions_billing add column if not exists provider_event_at timestamptz;

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from public, anon, authenticated;

-- Called by the Stripe webhook with the server key. Returns 'applied', 'duplicate'
-- (this event was already handled) or 'stale' (a newer event is already in, or no such household).
create or replace function public.billing_apply(
  p_event text, p_type text, p_event_at timestamptz, p_household uuid,
  p_plan text, p_interval text, p_status text, p_seats smallint, p_customer text, p_period_end timestamptz
) returns text language plpgsql security definer set search_path = '' as $$
begin
  insert into public.stripe_events (id, type) values (p_event, p_type) on conflict (id) do nothing;
  if not found then return 'duplicate'; end if;

  update public.subscriptions_billing
     set plan = p_plan, interval = p_interval, status = p_status, seats = p_seats,
         provider_ref = p_customer, current_period_end = p_period_end,
         provider_event_at = p_event_at, updated_at = now()
   where household_id = p_household and (provider_event_at is null or provider_event_at <= p_event_at);
  if not found then return 'stale'; end if;
  return 'applied';
end $$;
revoke all on function public.billing_apply(text, text, timestamptz, uuid, text, text, text, smallint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.billing_apply(text, text, timestamptz, uuid, text, text, text, smallint, text, timestamptz) to service_role;
