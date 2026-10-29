-- =====================================================================
-- Planning Metz Musical : base de données Supabase
-- À exécuter UNE FOIS dans Supabase → SQL Editor → New query → Run.
-- =====================================================================

-- 1. Créneaux --------------------------------------------------------------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 80),
  pole        text not null default 'autre' check (char_length(pole) <= 30),
  date        date not null,
  end_date    date,
  all_day     boolean not null default false,
  start_time  text check (start_time is null or start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  end_time    text check (end_time is null or end_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  location    text not null default '' check (char_length(location) <= 80),
  notes       text not null default '' check (char_length(notes) <= 500),
  color       text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  series_id   text,
  created_by  text check (char_length(created_by) <= 40),
  updated_by  text check (char_length(updated_by) <= 40),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists events_date_idx on public.events (date);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

-- 2. Centre de notifications (journal des ajouts / modifications) ----------
create table if not exists public.activity (
  id          bigint generated always as identity primary key,
  action      text not null check (action in ('ajout','modification','suppression','restauration')),
  author      text not null check (char_length(author) between 1 and 40),
  summary     text not null check (char_length(summary) <= 200),
  event_id    uuid,
  event_date  date,
  pole        text,
  count       int not null default 1,
  snapshot    jsonb,            -- copie des créneaux supprimés, pour pouvoir les restaurer
  created_at  timestamptz not null default now()
);
create index if not exists activity_created_idx on public.activity (created_at desc);

-- 3. Droits : tout le monde (sans compte) lit, ajoute, modifie, supprime -----
--    Le journal, lui, ne peut être ni modifié ni effacé depuis le site.
alter table public.events   enable row level security;
alter table public.activity enable row level security;

drop policy if exists "events lecture"      on public.events;
drop policy if exists "events ajout"        on public.events;
drop policy if exists "events modification" on public.events;
drop policy if exists "events suppression"  on public.events;
create policy "events lecture"      on public.events for select using (true);
create policy "events ajout"        on public.events for insert with check (true);
create policy "events modification" on public.events for update using (true) with check (true);
create policy "events suppression"  on public.events for delete using (true);

drop policy if exists "activity lecture" on public.activity;
drop policy if exists "activity ajout"   on public.activity;
create policy "activity lecture" on public.activity for select using (true);
create policy "activity ajout"   on public.activity for insert with check (true);

grant select, insert, update, delete on public.events   to anon, authenticated;
grant select, insert                 on public.activity to anon, authenticated;

-- 4. Mises à jour en direct ------------------------------------------------
do $$ begin
  begin alter publication supabase_realtime add table public.events;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.activity; exception when duplicate_object then null; end;
end $$;

-- 5. Créneaux de départ (une seule fois : ne rien faire si la table est déjà remplie)
insert into public.events (title, pole, date, end_date, all_day, start_time, end_time, notes, series_id, created_by, updated_by)
select title, pole, date::date, end_date::date, all_day, start_time, end_time, coalesce(notes, ''), series_id, created_by, updated_by from (values
  ('Répétition acteurs', 'acteurs', '2026-10-29', null, false, '17:00', '18:30', null, 'acteurs-s1', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2026-11-05', null, false, '17:00', '18:30', null, 'acteurs-s1', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2026-11-12', null, false, '17:00', '18:30', null, 'acteurs-s1', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2026-11-19', null, false, '17:00', '18:30', null, 'acteurs-s1', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2026-11-26', null, false, '17:00', '18:30', null, 'acteurs-s1', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2026-12-03', null, false, '17:00', '18:30', null, 'acteurs-s1', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2026-12-10', null, false, '17:00', '18:30', null, 'acteurs-s1', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2026-12-17', null, false, '17:00', '18:30', null, 'acteurs-s1', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2027-01-07', null, false, '17:00', '19:00', null, 'acteurs-s2', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2027-01-14', null, false, '17:00', '19:00', null, 'acteurs-s2', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2027-01-21', null, false, '17:00', '19:00', null, 'acteurs-s2', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2027-01-28', null, false, '17:00', '19:00', null, 'acteurs-s2', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2027-02-04', null, false, '17:00', '19:00', null, 'acteurs-s2', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2027-02-11', null, false, '17:00', '19:00', null, 'acteurs-s2', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2027-02-18', null, false, '17:00', '19:00', null, 'acteurs-s2', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2027-02-25', null, false, '17:00', '19:00', null, 'acteurs-s2', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2027-03-04', null, false, '17:00', '19:00', null, 'acteurs-s2', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2027-03-11', null, false, '17:00', '19:00', null, 'acteurs-s2', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2027-03-18', null, false, '17:00', '19:00', null, 'acteurs-s2', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2027-03-25', null, false, '17:00', '19:00', null, 'acteurs-s2', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2027-04-01', null, false, '17:00', '19:00', null, 'acteurs-s2', 'Edmond', 'Edmond'),
  ('Répétition acteurs', 'acteurs', '2027-04-08', null, false, '17:00', '19:00', null, 'acteurs-s2', 'Edmond', 'Edmond'),
  ('Week-end de répétition', 'weekend', '2027-04-03', '2027-04-04', true, null, null, 'Toute la troupe. Horaires à préciser.', null, 'Edmond', 'Edmond'),
  ('Pré-générale', 'generale', '2027-04-10', null, true, null, null, 'Horaires à préciser.', null, 'Edmond', 'Edmond'),
  ('Générale', 'generale', '2027-04-12', null, true, null, null, 'Horaires à préciser.', null, 'Edmond', 'Edmond'),
  ('Neverland Cure — Représentation', 'spectacle', '2027-04-13', null, true, null, null, 'Horaire et lieu à confirmer.', null, 'Edmond', 'Edmond')
) as v(title, pole, date, end_date, all_day, start_time, end_time, notes, series_id, created_by, updated_by)
where not exists (select 1 from public.events);
