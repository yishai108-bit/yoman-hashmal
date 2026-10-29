-- יומן אתר על Supabase: מאגר אחד לכל האתרים.
-- המבנה מחקה את מאגר המסמכים של ה-artifact (אוסף / מזהה / JSON), כדי שהאפליקציה תעבור
-- עם שכבת חיבור דקה ובלי לשכתב את החישובים. כל מסמך מסומן לאיזה אתר הוא שייך.
-- ההרשאות זהות למה שיש היום (artifact/capabilities.json):
--   צופה: קריאה בלבד · עורך: כותב לכל האוספים חוץ מ-settings · בעלים: הכול
--   settings/cba ו-settings/prices: קריאה לבעלים בלבד (היום prices פתוח לקריאה; כאן הוא נסגר)

create table if not exists sites (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,              -- ein-tamar, moledet, beer-tuvia
  name        text not null,                     -- «אתר הקמה עין תמר»
  created_at  timestamptz not null default now()
);

create table if not exists members (
  site_id  uuid not null references sites(id) on delete cascade,
  user_id  uuid not null,                        -- auth.users.id
  role     text not null check (role in ('owner','editor','viewer')),
  primary key (site_id, user_id)
);

create table if not exists docs (
  site_id     uuid not null references sites(id) on delete cascade,
  coll        text not null,                     -- deliveries, moves, counts, settings, …
  id          text not null,
  data        jsonb not null,
  ts          timestamptz generated always as (to_timestamp(((data->>'ts')::double precision) / 1000)) stored,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  primary key (site_id, coll, id)
);
create index if not exists docs_coll_ts on docs (site_id, coll, ts desc);

create or replace function site_role(s uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from members where site_id = s and user_id = auth.uid()
$$;

create or replace function docs_stamp() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists docs_stamp on docs;
create trigger docs_stamp before insert or update on docs for each row execute function docs_stamp();

alter table sites   enable row level security;
alter table members enable row level security;
alter table docs    enable row level security;

drop policy if exists sites_read on sites;
create policy sites_read on sites for select using (site_role(id) is not null);

drop policy if exists members_read on members;
create policy members_read on members for select using (user_id = auth.uid() or site_role(site_id) = 'owner');
drop policy if exists members_owner on members;
create policy members_owner on members for all using (site_role(site_id) = 'owner') with check (site_role(site_id) = 'owner');

drop policy if exists docs_read on docs;
create policy docs_read on docs for select using (
  site_role(site_id) is not null
  and (coll <> 'settings' or id not in ('cba','prices') or site_role(site_id) = 'owner'));

drop policy if exists docs_write on docs;
create policy docs_write on docs for all using (
  site_role(site_id) = 'owner' or (site_role(site_id) = 'editor' and coll <> 'settings'))
  with check (
  site_role(site_id) = 'owner' or (site_role(site_id) = 'editor' and coll <> 'settings'));

-- לשינויים בזמן אמת (מקביל ל-onSnapshot של ה-artifact)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table docs;
  end if;
exception when duplicate_object then null; end $$;
