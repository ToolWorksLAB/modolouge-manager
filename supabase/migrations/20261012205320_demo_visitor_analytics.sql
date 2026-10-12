create table public.modolouge_demo_visits (
  id uuid primary key,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  last_active timestamptz,
  active_seconds integer not null default 0 check (active_seconds between 0 and 21600),
  sequence integer not null default 0,
  ended boolean not null default false,
  section text not null default 'intro',
  events jsonb not null default '{}',
  country text not null default 'Unknown',
  region text not null default '',
  city text not null default '',
  masked_ip text,
  referrer text,
  device text not null,
  browser text not null,
  os text not null
);
comment on table public.modolouge_demo_visits is 'Opt-in demo page visits, not identified people. No full IP, fingerprint, account identifier, precise location or raw user-agent. Retained 90 days.';
alter table public.modolouge_demo_visits enable row level security;
revoke all on public.modolouge_demo_visits from public, anon, authenticated;
grant select, insert, update, delete on public.modolouge_demo_visits to service_role;
create index modolouge_demo_visits_created on public.modolouge_demo_visits (created_at desc);

create function public.modolouge_demo_pulse(p_id uuid, p_seq integer, p_active integer, p_events jsonb, p_section text, p_ended boolean)
returns void language sql security invoker set search_path='' as $$
  update public.modolouge_demo_visits
  set active_seconds = greatest(active_seconds, least(p_active, 21600, greatest(0, floor(extract(epoch from (now()-created_at)))::integer))),
      last_active = case when p_active > active_seconds then now() else last_active end,
      last_seen = now(), sequence = p_seq, section = p_section, ended = p_ended,
      events = (select coalesce(jsonb_object_agg(k, greatest(coalesce((events->>k)::integer,0), least(10000,greatest(0,(p_events->>k)::integer)))),'{}')
        from jsonb_object_keys(p_events) as k)
  where id=p_id and sequence<p_seq and created_at>now()-interval '6 hours';
$$;

create function public.modolouge_demo_report(p_days integer default 7, p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
  with visits as materialized (
    select * from public.modolouge_demo_visits
    where created_at>=now()-make_interval(days=>least(90,greatest(1,p_days)))
  ), totals as (
    select count(*) visits, coalesce(sum(active_seconds),0) active_seconds,
      coalesce(round(avg(active_seconds)),0) average_seconds,
      count(*) filter (where not ended and last_active>now()-interval '75 seconds') active_now,
      count(*) filter (where active_seconds>=10) engaged_visits,
      count(distinct country) filter (where country not in ('Unknown','Local')) countries
    from visits
  ), daily as (
    select (created_at at time zone 'UTC')::date as day, count(*) visits, sum(active_seconds) active_seconds from visits group by 1 order by 1
  ), places as (
    select country as label, count(*) visits from visits group by country order by visits desc limit 10
  ), devices as (
    select device as label, count(*) visits from visits group by device order by visits desc
  ), browsers as (
    select browser as label, count(*) visits from visits group by browser order by visits desc
  ), actions as (
    select e.key as label, sum(e.value::integer) count from visits cross join lateral jsonb_each_text(events) e group by e.key having sum(e.value::integer)>0 order by count desc
  ), recent as (
    select *, (not ended and last_active>now()-interval '75 seconds') as active_now
    from visits order by created_at desc limit 50 offset greatest(0,least(p_offset,100000))
  )
  select jsonb_build_object('summary',(select to_jsonb(totals) from totals),
    'daily',coalesce((select jsonb_agg(daily) from daily),'[]'),
    'countries',coalesce((select jsonb_agg(places) from places),'[]'),
    'devices',coalesce((select jsonb_agg(devices) from devices),'[]'),
    'browsers',coalesce((select jsonb_agg(browsers) from browsers),'[]'),
    'actions',coalesce((select jsonb_agg(actions) from actions),'[]'),
    'visits',coalesce((select jsonb_agg(recent) from recent),'[]'),
    'days',p_days,'offset',p_offset,'updated_at',now());
$$;

create function public.modolouge_prune_demo_visits()
returns void language sql security invoker set search_path='' as $$
  delete from public.modolouge_demo_visits where created_at<now()-interval '90 days';
$$;
revoke all on function public.modolouge_demo_pulse(uuid,integer,integer,jsonb,text,boolean), public.modolouge_demo_report(integer,integer), public.modolouge_prune_demo_visits() from public,anon,authenticated;
grant execute on function public.modolouge_demo_pulse(uuid,integer,integer,jsonb,text,boolean), public.modolouge_demo_report(integer,integer), public.modolouge_prune_demo_visits() to service_role;
select cron.schedule('modolouge-demo-retention','50 3 * * *','select public.modolouge_prune_demo_visits()');
