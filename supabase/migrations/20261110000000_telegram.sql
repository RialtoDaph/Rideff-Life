-- Clopar in Telegram (README → Telegram). Each member links their own Telegram chat
-- once, with a one-time code made in Settings. The bot's server (Vercel) reaches these
-- tables only through the functions below, with the server key; signed-in people only
-- make a code, see their own link and remove it.

create table if not exists private.telegram_links (
  member_id uuid primary key references public.members (id) on delete cascade,
  chat_id bigint unique,
  username text,
  code_hash text unique,
  code_expires timestamptz,
  linked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Telegram may send an update twice; each one is handled once.
create table if not exists private.telegram_updates (
  update_id bigint primary key,
  at timestamptz not null default now()
);

-- Where the reminder function hands Telegram reminders to the app's server, and the
-- secret it proves itself with. Written by the app's server when someone links.
create table if not exists private.telegram_config (
  id smallint primary key default 1 check (id = 1),
  notify_url text not null,
  secret text not null,
  updated_at timestamptz not null default now()
);

-- Signed in: a code for t.me/<bot>?start=<code>, valid 15 minutes.
create or replace function public.telegram_link_create()
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  code text;
begin
  if me is null or not exists (select 1 from public.members where id = me) then raise exception 'not_member'; end if;
  code := 'c' || encode(extensions.gen_random_bytes(16), 'hex');
  insert into private.telegram_links (member_id, code_hash, code_expires)
  values (me, encode(extensions.digest(code, 'sha256'), 'hex'), now() + interval '15 minutes')
  on conflict (member_id) do update set code_hash = excluded.code_hash, code_expires = excluded.code_expires;
  return code;
end $$;

create or replace function public.telegram_status()
returns table (linked boolean, username text, linked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.chat_id is not null, l.username, l.linked_at from private.telegram_links l where l.member_id = auth.uid()
$$;

create or replace function public.telegram_unlink()
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  chat bigint;
begin
  delete from private.telegram_links where member_id = auth.uid() returning chat_id into chat;
  return chat;
end $$;

-- Server: the bot got /start <code>. Links that chat to the code's member (a chat
-- belongs to one member only) and returns who it is, or nothing for a bad code.
create or replace function public.telegram_claim(p_code text, p_chat bigint, p_username text)
returns table (member_id uuid, display_name text, lang text)
language plpgsql security definer set search_path = '' as $$
declare
  who uuid;
begin
  select l.member_id into who from private.telegram_links l
  where l.code_hash = encode(extensions.digest(p_code, 'sha256'), 'hex') and l.code_expires > now();
  if who is null then return; end if;
  update private.telegram_links set chat_id = null, linked_at = null where chat_id = p_chat and private.telegram_links.member_id <> who;
  update private.telegram_links
  set chat_id = p_chat, username = left(p_username, 64), linked_at = now(), code_hash = null, code_expires = null
  where private.telegram_links.member_id = who;
  return query
    select m.id, m.display_name, coalesce(s.lang, 'en')
    from public.members m left join public.member_settings s on s.member_id = m.id where m.id = who;
end $$;

-- Server: who writes from this chat. The e-mail lets the server sign in as that
-- person, so Row Level Security decides what the bot can read, as in the app.
create or replace function public.telegram_member(p_chat bigint)
returns table (member_id uuid, email text, display_name text, lang text, ai_name text, memory_on boolean)
language sql stable security definer set search_path = '' as $$
  select m.id, u.email::text, m.display_name, coalesce(s.lang, 'en'), s.ai_name, coalesce(s.memory_on, true)
  from private.telegram_links l
  join public.members m on m.id = l.member_id
  join auth.users u on u.id = m.id
  left join public.member_settings s on s.member_id = m.id
  where l.chat_id = p_chat
$$;

-- Server: true the first time an update arrives. Keeps two days.
create or replace function public.telegram_seen(p_update bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  fresh boolean;
begin
  delete from private.telegram_updates where at < now() - interval '2 days';
  insert into private.telegram_updates (update_id) values (p_update) on conflict do nothing returning true into fresh;
  return coalesce(fresh, false);
end $$;

create or replace function public.telegram_config_set(p_url text, p_secret text)
returns void language sql security definer set search_path = '' as $$
  insert into private.telegram_config (id, notify_url, secret) values (1, p_url, p_secret)
  on conflict (id) do update set notify_url = excluded.notify_url, secret = excluded.secret, updated_at = now()
$$;

revoke all on function public.telegram_link_create(), public.telegram_status(), public.telegram_unlink() from public, anon;
grant execute on function public.telegram_link_create(), public.telegram_status(), public.telegram_unlink() to authenticated;
revoke all on function public.telegram_claim(text, bigint, text), public.telegram_member(bigint), public.telegram_seen(bigint),
  public.telegram_config_set(text, text) from public, anon, authenticated;
grant execute on function public.telegram_claim(text, bigint, text), public.telegram_member(bigint), public.telegram_seen(bigint),
  public.telegram_config_set(text, text) to service_role;

-- Reminders: also for members who use Telegram and have no phone set up for Web Push.
-- Same as 20261108000000_billing_push.sql, except who is in `mem`.
create or replace function private.push_due(p_now timestamptz default now())
returns table (member_id uuid, key text, title text, body text, url text)
language sql security definer set search_path = '' as $$
with clock as (
  select (p_now at time zone 'Europe/Berlin') as loc
),
c as (
  select loc, loc::date as today, loc::time as hm, to_char(loc, 'YYYY-MM') as ym,
         date_trunc('month', loc)::date as m0
  from clock
),
mem as (
  select m.id, m.household_id,
         coalesce(s.notif, '{}'::jsonb) as notif,
         coalesce(s.warn_pct, 80) as warn_pct,
         coalesce(s.lang, 'en') as lang,
         coalesce(s.brief_at, '07:00') as at
  from public.members m
  left join public.member_settings s on s.member_id = m.id
  where exists (select 1 from public.push_subscriptions p where p.member_id = m.id)
     or exists (select 1 from private.telegram_links t where t.member_id = m.id and t.chat_id is not null)
),
flag as (
  select id, household_id, warn_pct, notif, lang, at,
         coalesce((notif ->> 'bills')::boolean, true) as bills,
         coalesce((notif ->> 'tax')::boolean, true) as tax,
         coalesce((notif ->> 'budget')::boolean, true) as budget,
         coalesce((notif ->> 'goals')::boolean, true) as goals,
         coalesce((notif ->> 'shifts')::boolean, true) as shifts
  from mem
),
-- Recurring payments that leave tomorrow and are not posted yet.
bills as (
  select f.id as member_id, r.id, r.name, r.amount
  from flag f, c, public.recurring r
  where r.household_id = f.household_id and (r.visibility = 'family' or r.owner_id = f.id)
    and r.active and r.amount < 0
    and r.day_of_month = extract(day from c.today + 1)
    and r.last_posted_month is distinct from to_char(c.today + 1, 'YYYY-MM')
),
taxes as (
  select f.id as member_id, t.id, t.title, t.amount, t.due_date
  from flag f, c, public.tax_deadlines t
  where t.household_id = f.household_id and (t.visibility = 'family' or t.owner_id = f.id)
    and not t.done and t.due_date between c.today and c.today + 7
),
-- Family budget, same rules as the app: family transactions this month.
spend as (
  select f.id as member_id, k.id, k.name, k.monthly_limit, k.is_fixed,
         coalesce((select sum(-x.amount) from public.transactions x, c
                   where x.category_id = k.id and x.visibility = 'family'
                     and x.date >= c.m0 and x.date < (c.m0 + interval '1 month')::date), 0) as spent
  from flag f join public.categories k on k.household_id = f.household_id
),
cats as (
  select s.*, f.warn_pct, case when s.monthly_limit > 0 then s.spent / s.monthly_limit * 100 else 0 end as pct
  from spend s join flag f on f.id = s.member_id
),
cand as (
  -- Morning summary (window of 2 hours after the chosen time, once a day).
  select f.id as member_id, 'summary:' || c.today as key,
    case when n.cnt = 0 then private.pt(f.lang, 'All calm today', 'Heute alles ruhig', 'Hari ini tenang')
         else n.cnt || private.pt(f.lang, case when n.cnt = 1 then ' thing to know today' else ' things to know today' end, ' Dinge für heute', ' hal untuk hari ini') end as title,
    concat_ws(' · ', n.items, private.eur(greatest(fl.left_, 0)) || private.pt(f.lang, ' flexible money left', ' frei verfügbar', ' uang fleksibel tersisa')) as body,
    '/' as url
  from flag f cross join c
  cross join lateral (
    select count(*)::int as cnt, string_agg(t, ' · ') filter (where rn <= 3) as items
    from (
      select row_number() over () as rn, t from (
        select b.name || private.pt(f.lang, ' tomorrow (', ' morgen (', ' besok (') || private.eur(b.amount) || ')' as t from bills b where b.member_id = f.id
        union all
        select x.title || private.pt(f.lang, ' due ', ' fällig ', ' jatuh tempo ') || to_char(x.due_date, 'DD.MM.') from taxes x where x.member_id = f.id
        union all
        select k.name || private.pt(f.lang, ' over budget', ' über Budget', ' melebihi anggaran') from cats k where k.member_id = f.id and not k.is_fixed and k.pct > 100
      ) items
    ) numbered
  ) n
  cross join lateral (
    select coalesce(sum(k.monthly_limit - k.spent), 0) as left_
    from cats k where k.member_id = f.id and not k.is_fixed
  ) fl
  where c.hm >= f.at and (c.hm < f.at + interval '2 hours' or f.at >= '22:00')

  union all
  -- Bills: the day before, from 09:00.
  select b.member_id, 'bill:' || b.id || ':' || (c.today + 1),
    b.name || private.pt(f.lang, ' goes out tomorrow', ' wird morgen abgebucht', ' keluar besok'), private.eur(b.amount) || ' · ' || to_char(c.today + 1, 'DD.MM.'), '/recur'
  from bills b join flag f on f.id = b.member_id cross join c
  where f.bills and c.hm >= '09:00' and c.hm < '21:00'

  union all
  -- Tax deadlines: 3 days before, from 09:00.
  select x.member_id, 'tax:' || x.id, private.pt(f.lang, 'Tax deadline in 3 days', 'Steuerfrist in 3 Tagen', 'Tenggat pajak 3 hari lagi'),
    x.title || coalesce(' · ' || private.eur(x.amount), '') || ' · ' || to_char(x.due_date, 'DD.MM.'), '/tax'
  from taxes x join flag f on f.id = x.member_id cross join c
  where f.tax and x.due_date = c.today + 3 and c.hm >= '09:00' and c.hm < '21:00'

  union all
  -- Budget: a flexible category crosses warn% or its limit (daytime only).
  select k.member_id,
    (case when k.pct > 100 then 'over:' else 'near:' end) || k.id || ':' || c.ym,
    case when k.pct > 100 then k.name || private.pt(f.lang, ' is over budget', ' ist über Budget', ' melebihi anggaran') else k.name || private.pt(f.lang, ' is at ', ' liegt bei ', ' sudah ') || round(k.pct) || '%' end,
    private.eur(k.spent) || private.pt(f.lang, ' of ', ' von ', ' dari ') || private.eur(k.monthly_limit) || private.pt(f.lang, ' spent this month', ' diesen Monat ausgegeben', ' terpakai bulan ini'), '/budget'
  from cats k join flag f on f.id = k.member_id cross join c
  where f.budget and not k.is_fixed and k.monthly_limit > 0 and k.pct >= k.warn_pct
    and c.hm >= '08:00' and c.hm < '21:00'

  union all
  -- Goals: Sunday from 19:00.
  select f.id, 'goals:' || c.today, private.pt(f.lang, 'Your goals this week', 'Deine Ziele diese Woche', 'Targetmu minggu ini'), g.body, '/'
  from flag f cross join c
  cross join lateral (
    select string_agg(g.name || ' ' || round(least(g.current / g.target, 1) * 100) || '%', ' · ' order by g.name) as body
    from public.goals g
    where g.household_id = f.household_id and (g.visibility = 'family' or g.owner_id = f.id)
      and not g.is_emergency_fund and g.target > 0
  ) g
  where f.goals and g.body is not null and extract(isodow from c.today) = 7
    and c.hm >= '19:00' and c.hm < '21:00'
  union all
  -- Shifts: 2 hours before the start, to the person working it.
  select e.owner_id, 'shift:' || e.id || ':' || e.date,
    private.pt(f.lang, 'Shift at ', 'Schicht um ', 'Shift pukul ') || to_char(e.start_time, 'HH24:MI'),
    e.title || ' · ' || to_char(e.start_time, 'HH24:MI') || coalesce('–' || to_char(e.end_time, 'HH24:MI'), ''), '/shifts'
  from public.events e join flag f on f.id = e.owner_id
  where e.kind = 'shift' and f.shifts and e.start_time is not null
    and p_now >= ((e.date + e.start_time) at time zone 'Europe/Berlin') - interval '2 hours'
    and p_now < ((e.date + e.start_time) at time zone 'Europe/Berlin')

  union all
  -- Calendar events with a reminder: to the person it is for, or both if Together.
  select f.id, 'event:' || e.id || ':' || e.date, e.title,
    private.pt(f.lang, 'At ', 'Um ', 'Pukul ') || to_char(e.start_time, 'HH24:MI') || ' · ' || to_char(e.date, 'DD.MM.'), '/week'
  from public.events e join flag f on f.household_id = e.household_id
  where e.kind = 'event' and e.remind_min is not null and e.start_time is not null
    and (e.visibility = 'family' or e.owner_id = f.id)
    and (e.who is null or e.who = f.id)
    and p_now >= ((e.date + e.start_time) at time zone 'Europe/Berlin') - make_interval(mins => e.remind_min)
    and p_now < ((e.date + e.start_time) at time zone 'Europe/Berlin')
),
claimed as (
  insert into private.push_log (member_id, key)
  select cand.member_id, cand.key from cand
  on conflict do nothing
  returning push_log.member_id, push_log.key
)
select cand.member_id, cand.key, cand.title, cand.body, cand.url
from cand join claimed on claimed.member_id = cand.member_id and claimed.key = cand.key
$$;
revoke execute on function private.push_due(timestamptz) from public, anon, authenticated;
