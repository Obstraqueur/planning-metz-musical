-- =====================================================================
-- Rétroplanning Neverland Cure (version du 16/11/2026)
-- À exécuter UNE FOIS dans Supabase → SQL Editor → New query → Run.
--
-- Ce script :
--   1. retire l'ancien planning à partir du 20/11/2026 (jeudis jusqu'au 8 avril,
--      week-end, générales et représentation d'avril) ;
--      ces créneaux restent restaurables depuis la cloche du site ;
--   2. ajoute les 36 créneaux du rétroplanning (représentation le 24 mars 2027) ;
--   3. note les deux opérations dans le centre de notifications.
-- Les créneaux ajoutés à la main par la troupe ne sont pas touchés.
-- Si le rétroplanning est déjà importé, le script s'arrête sans rien changer.
-- =====================================================================

begin;

do $$ begin
  if exists (select 1 from public.events where series_id like 'retro-2026-11%') then
    raise exception 'Le rétroplanning est déjà importé : rien n''a été modifié.';
  end if;
end $$;

-- 1. Ancien planning (copie gardée dans le journal pour pouvoir le restaurer)
with gone as (
  delete from public.events
  where (series_id in ('acteurs-s1', 'acteurs-s2') and date >= '2026-11-20')
     or (series_id is null and (title, date) in (
          ('Week-end de répétition', '2027-04-03'::date),
          ('Pré-générale', '2027-04-10'::date),
          ('Générale', '2027-04-12'::date),
          ('Neverland Cure — Représentation', '2027-04-13'::date)))
  returning *
)
insert into public.activity (action, author, summary, event_date, pole, count, snapshot)
select 'suppression', 'Edmond',
       'l''ancien planning (jeudis jusqu''au 8 avril, générales et représentation d''avril), remplacé par le rétroplanning',
       min(date), 'acteurs', count(*),
       jsonb_agg(to_jsonb(gone) - 'created_at' - 'updated_at' order by date)
from gone
having count(*) > 0;

-- 2. Rétroplanning
insert into public.events (title, pole, date, end_date, all_day, start_time, end_time, location, notes, series_id, created_by, updated_by)
select title, pole, date, end_date, all_day, start_time, end_time, location, notes,
       'retro-2026-11-' || row_number() over (), 'Edmond', 'Edmond'
from (values
  ('Finir l’écriture de la pièce', 'ecriture', '2026-11-16'::date, '2026-11-26'::date, true, null, null, '', 'Phase 0 · Finir la pièce. Finir l’Acte II : sc. 8 (Wendy vs Hook), sc. 9 (évasion), sc. 10 (épilogue) + paroles de « Whatever the cost », « The Other Plan », « Your therapy cures nothing » et de la chanson finale.'),
  ('Financement FACS', 'jalon', '2026-11-20'::date, null::date, true, null, null, '', 'Phase 0 · Finir la pièce. Dossier de subvention FACS.'),
  ('Script verrouillé + lecture complète', 'jalon', '2026-11-26'::date, null::date, false, '17:00', '19:00', '', 'Phase 0 · Finir la pièce. Lecture complète de la pièce et minutage (objectif ~2 h 15).'),
  ('Costumes : prêts de la troupe + friperies', 'decors', '2026-12-01'::date, '2026-12-13'::date, true, null, null, '', 'Phase 1 · Acteurs. Inventaire des prêts dans la troupe + tournée des friperies (Emmaüs, Le Bardak).'),
  ('Décors : chiner le mobilier d’occasion', 'decors', '2026-12-01'::date, '2026-12-13'::date, true, null, null, '', 'Phase 1 · Acteurs. Lit acier, miroir, malle, banc, cheval à bascule, bureau, 2 chaises + récupérer 20 palettes et des vieux journaux.'),
  ('Répétition acteurs – Acte I sc. 1, 2, 4, 6', 'acteurs', '2026-12-03'::date, null::date, false, '17:00', '19:00', '', 'Phase 1 · Acteurs. Mise en place : Hook, Shadow, Wendy, Tiger Lily, Wendy adulte / Jane.'),
  ('Répétition musique – chansons de l’Acte I', 'musique', '2026-12-03'::date, null::date, false, '19:00', '20:30', '', 'Phase 1 · Acteurs. Chanteurs + musiciens : apprentissage des chansons de l’Acte I. Horaire de fin à confirmer.'),
  ('Répétition acteurs – scènes de groupe de l’Acte I', 'acteurs', '2026-12-10'::date, null::date, false, '17:00', '19:00', '', 'Phase 1 · Acteurs. Sc. 3 « Welcome to Neverland » et sc. 7 « Play with me » (avec les enfants perdus) + sc. 5 (Pure Imagination).'),
  ('Répétition acteurs – Acte I sc. 8 à 12', 'acteurs', '2026-12-17'::date, null::date, false, '17:00', '19:00', '', 'Phase 1 · Acteurs. Wendy & Shadow, cauchemar de Peter, Belle & Hook, plan de Belle, « Croco’time ».'),
  ('Vacances : apprendre le texte de l’Acte I', 'acteurs', '2026-12-21'::date, '2027-01-03'::date, true, null, null, '', 'Phase 1 · Acteurs. Chacun apprend son texte de l’Acte I ; les musiciens travaillent les partitions.'),
  ('Décors : commandes (tasseaux, vis, tissus)', 'decors', '2027-01-04'::date, '2027-01-08'::date, true, null, null, '', 'Phase 1 · Acteurs. Tasseaux et vis (Leroy Merlin), tissus noir et blanc cassé.'),
  ('Répétition acteurs – italienne Acte I + Acte II sc. 1-2', 'acteurs', '2027-01-07'::date, null::date, false, '17:00', '19:00', '', 'Phase 1 · Acteurs. Italienne de l’Acte I + mise en place Acte II sc. 1 (théorie de Wendy + Supremacy) et sc. 2 (sentence de Hook).'),
  ('Costumes : compléments seconde main + accessoires', 'decors', '2027-01-11'::date, '2027-01-29'::date, true, null, null, '', 'Phase 1 · Acteurs. Vinted : blouse de Hook, muselière de Crocohyde, écharpes de Peter et de Shadow…'),
  ('Répétition acteurs – Acte II sc. 3 à 6', 'acteurs', '2027-01-14'::date, null::date, false, '17:00', '19:00', '', 'Phase 1 · Acteurs. Sc. 3 « Whatever the cost » (avec les danseurs), sc. 4, 5 et 6 (mort de Belle). Texte de l’Acte I su.'),
  ('Répétition musique – chansons de l’Acte II', 'musique', '2027-01-14'::date, null::date, false, '19:00', '20:30', '', 'Phase 1 · Acteurs. Chanteurs + musiciens : chansons de l’Acte II + « The Stars ».'),
  ('Répétition acteurs – Acte II sc. 7 à 10 + épilogue', 'acteurs', '2027-01-21'::date, null::date, false, '17:00', '19:00', '', 'Phase 1 · Acteurs. Sc. 7 « Confrontation », sc. 8, 9, 10 + épilogue.'),
  ('Répétition danse – chorégraphies finalisées', 'danse', '2027-01-21'::date, null::date, false, '17:00', '19:00', '', 'Phase 1 · Acteurs. En parallèle, autre salle : Welcome, Supremacy, Whatever the cost, Croco’time, transitions.'),
  ('Filage acteurs – Acte I', 'acteurs', '2027-01-28'::date, null::date, false, '17:00', '19:00', '', 'Phase 1 · Acteurs. Filage sans texte en main.'),
  ('Filage acteurs – Acte II + raccords chansons', 'acteurs', '2027-02-04'::date, null::date, false, '17:00', '19:00', '', 'Phase 2 · Acteurs + musique + danse. Texte de l’Acte II su ; raccords des chansons avec les musiciens.'),
  ('Acte I avec musique et danse', 'commune', '2027-02-11'::date, null::date, false, '17:00', '19:00', '', 'Phase 2 · Acteurs + musique + danse. Acte I sc. 1 à 12 avec musique live et chorégraphies.'),
  ('Indisponible : anniversaire d’Edmond', 'autre', '2027-02-12'::date, '2027-02-13'::date, true, null, null, '', 'Week-end pris pour l’anniversaire d’Edmond.'),
  ('Acte II avec musique et danse', 'commune', '2027-02-18'::date, null::date, false, '17:00', '19:00', '', 'Phase 2 · Acteurs + musique + danse. Préparation du week-end cohésion.'),
  ('Week-end cohésion', 'weekend', '2027-02-20'::date, '2027-02-21'::date, true, null, null, '', 'Phase 2 · Acteurs + musique + danse. Jeux de troupe, numéros de groupe (Welcome, Croco’time, épilogue / « The Stars »), transitions de décor par les danseurs, essayages costumes n°1 ; dimanche après-midi = filage complet n°1 chronométré.'),
  ('Costumes : retouches', 'decors', '2027-02-22'::date, '2027-03-05'::date, true, null, null, '', 'Phase 2 · Acteurs + musique + danse. Retouches après les essayages (machine à coudre CSart).'),
  ('Travail des scènes faibles du filage n°1', 'commune', '2027-02-25'::date, null::date, false, '17:00', '19:00', '', 'Phase 2 · Acteurs + musique + danse.'),
  ('Décors terminés', 'jalon', '2027-02-26'::date, null::date, true, null, null, '', 'Phase 2 · Acteurs + musique + danse.'),
  ('Montage décors + Acte I avec décors et costumes', 'commune', '2027-03-04'::date, null::date, false, '17:00', '21:00', '', 'Phase 3 · Tous. Jeudi rallongé : montage des décors en salle de répétition + Acte I avec décors et costumes.'),
  ('Costumes terminés', 'jalon', '2027-03-05'::date, null::date, true, null, null, '', 'Phase 3 · Tous.'),
  ('Filage complet n°2 (décors, costumes, régie)', 'commune', '2027-03-06'::date, null::date, false, '10:00', '17:00', '', 'Phase 3 · Tous. Filage complet avec décors, costumes et régie (son, micros serre-tête, lumière).'),
  ('Acte II avec décors et costumes', 'commune', '2027-03-11'::date, null::date, false, '17:00', '20:30', '', 'Phase 3 · Tous. Changements rapides de costume + reprise des notes du filage n°2.'),
  ('Raccords + filage chronométré', 'commune', '2027-03-18'::date, null::date, false, '17:00', '21:00', '', 'Phase 3 · Tous. Jeudi rallongé.'),
  ('Pré-générale', 'generale', '2027-03-20'::date, null::date, false, '10:00', '17:00', '', 'Phase 3 · Tous. Pré-générale en conditions réelles (filage complet n°3 avec régie).'),
  ('Montage des décors + réglages à l’IRTS', 'decors', '2027-03-24'::date, null::date, false, '08:00', '12:30', 'IRTS de Metz', 'Phase 3 · Tous. Transport des décors + montage + réglages lumière et son (camion à prévoir).'),
  ('Générale', 'generale', '2027-03-24'::date, null::date, false, '13:30', '17:00', 'IRTS de Metz', 'Phase 3 · Tous.'),
  ('Neverland Cure — Représentation', 'spectacle', '2027-03-24'::date, null::date, false, '19:00', '21:30', 'IRTS de Metz', '240 places. Durée ~2 h 15 avec l’entracte.'),
  ('Démontage + rangement + bilan', 'decors', '2027-03-25'::date, null::date, true, null, null, '', 'Phase 3 · Tous. Démontage, rangement de la costumerie et des décors, bilan.')
) as v(title, pole, date, end_date, all_day, start_time, end_time, location, notes);

insert into public.activity (action, author, summary, event_date, pole, count)
values ('ajout', 'Edmond', 'le rétroplanning jusqu''à la représentation du 24 mars 2027 (36 créneaux)', '2026-11-16', 'commune', 36);

commit;
