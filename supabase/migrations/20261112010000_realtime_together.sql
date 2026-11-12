-- Realtime for the Together plan: what a partner adds shows up without a refresh.
-- Row Level Security still applies: a person only receives rows they may read, so private rows never arrive.
do $$
declare t text;
begin
  foreach t in array array['categories', 'transactions', 'incomes', 'recurring', 'goals', 'week_priorities', 'yearly_goals'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
