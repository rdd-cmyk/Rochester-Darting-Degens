-- Advanced-statistics foundation.
--
-- This migration is additive and keeps every historical match valid. It must
-- be tested against an exported copy of the hosted schema and RLS policies
-- before it is applied to project hrqsbzmsfichiimtxijj.

begin;

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint seasons_name_not_blank check (length(trim(name)) > 0),
  constraint seasons_dates_in_order check (ends_on is null or ends_on >= starts_on)
);

create unique index if not exists seasons_single_active_idx
  on public.seasons (is_active)
  where is_active;

alter table public.seasons enable row level security;

drop policy if exists "seasons are publicly readable" on public.seasons;
create policy "seasons are publicly readable"
  on public.seasons
  for select
  using (true);

alter table public.matches
  add column if not exists season_id uuid references public.seasons(id),
  add column if not exists detail_level text not null default 'summary',
  add column if not exists entry_source text not null default 'manual',
  add column if not exists format_best_of smallint,
  add column if not exists updated_at timestamptz not null default now();

alter table public.match_players
  add column if not exists throw_order smallint,
  add column if not exists legs_won smallint,
  add column if not exists legs_lost smallint,
  add column if not exists darts_thrown integer,
  add column if not exists x01_points_scored integer,
  add column if not exists cricket_marks integer,
  add column if not exists first_nine_average numeric(7, 2),
  add column if not exists checkout_attempts integer,
  add column if not exists checkouts_made integer,
  add column if not exists highest_checkout smallint,
  add column if not exists scores_100_plus integer,
  add column if not exists scores_140_plus integer,
  add column if not exists scores_180 integer,
  add column if not exists cricket_misses integer,
  add column if not exists cricket_triple_bull_hits integer,
  add column if not exists marks_5_plus integer,
  add column if not exists marks_7_plus integer,
  add column if not exists marks_9 integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_detail_level_valid'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches add constraint matches_detail_level_valid
      check (detail_level in ('summary', 'enhanced', 'turn')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_entry_source_valid'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches add constraint matches_entry_source_valid
      check (entry_source in ('manual', 'csv', 'scoreboard_image', 'integration')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_format_best_of_positive'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches add constraint matches_format_best_of_positive
      check (format_best_of is null or format_best_of > 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'match_players_advanced_counts_nonnegative'
      and conrelid = 'public.match_players'::regclass
  ) then
    alter table public.match_players add constraint match_players_advanced_counts_nonnegative
      check (
        (throw_order is null or throw_order > 0)
        and (legs_won is null or legs_won >= 0)
        and (legs_lost is null or legs_lost >= 0)
        and (darts_thrown is null or darts_thrown > 0)
        and (x01_points_scored is null or x01_points_scored >= 0)
        and (cricket_marks is null or cricket_marks >= 0)
        and (first_nine_average is null or first_nine_average between 0 and 180)
        and (checkout_attempts is null or checkout_attempts >= 0)
        and (checkouts_made is null or checkouts_made >= 0)
        and (
          checkouts_made is null
          or checkout_attempts is null
          or checkouts_made <= checkout_attempts
        )
        and (highest_checkout is null or highest_checkout between 0 and 170)
        and (scores_100_plus is null or scores_100_plus >= 0)
        and (scores_140_plus is null or scores_140_plus >= 0)
        and (scores_180 is null or scores_180 >= 0)
        and (cricket_misses is null or cricket_misses >= 0)
        and (cricket_triple_bull_hits is null or cricket_triple_bull_hits >= 0)
        and (marks_5_plus is null or marks_5_plus >= 0)
        and (marks_7_plus is null or marks_7_plus >= 0)
        and (marks_9 is null or marks_9 >= 0)
      ) not valid;
  end if;
end
$$;

create or replace function public.set_matches_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists matches_set_updated_at on public.matches;
create trigger matches_set_updated_at
before update on public.matches
for each row execute function public.set_matches_updated_at();

create index if not exists matches_season_played_at_idx
  on public.matches (season_id, played_at desc);

comment on column public.matches.detail_level is
  'Completeness of the captured match: summary, enhanced, or turn.';
comment on column public.matches.entry_source is
  'How the record entered the system: manual, csv, scoreboard_image, or integration.';
comment on column public.match_players.darts_thrown is
  'Raw denominator for exact X01 3DA or Cricket MPR calculations.';
comment on column public.match_players.x01_points_scored is
  'Raw X01 points scored for exact aggregate 3DA calculations.';
comment on column public.match_players.cricket_marks is
  'Raw Cricket marks for exact aggregate MPR calculations.';

create or replace view public.stats_match_facts
with (security_invoker = true)
as
select
  mp.id as match_player_id,
  mp.match_id,
  mp.player_id,
  mp.is_winner,
  mp.score,
  mp.points_scored as legacy_cricket_points,
  mp.darts_thrown,
  mp.x01_points_scored,
  mp.cricket_marks,
  m.played_at,
  m.game_type,
  m.board_type,
  m.venue,
  m.season_id,
  m.detail_level,
  m.entry_source,
  p.display_name,
  p.first_name,
  p.include_first_name_in_display
from public.match_players mp
join public.matches m on m.id = mp.match_id
left join public.profiles p on p.id = mp.player_id;

grant select on public.stats_match_facts to anon, authenticated;

commit;
