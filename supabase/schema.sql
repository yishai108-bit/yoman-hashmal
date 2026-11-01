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

-- ================= גרסה 25: אפליקציה עצמאית לכמה חברות ואתרים =================
-- כל חברה (S.E.E, MSE) = אפליקציה משלה עם אותו מאגר; האתרים מסומנים לפי חברה.
-- «האתרים שלי» = האתרים של החברה שבהם המשתמש חבר (members). בעלים מזמין לפי מייל (invites),
-- וכשהמוזמן נכנס בפעם הראשונה ההזמנה הופכת לחברות (claim_invites).
alter table sites add column if not exists company  text not null default 'see';
alter table sites add column if not exists location text;
alter table sites add column if not exists photo    text;                 -- כתובת תמונה לכרטיס באתרים שלי (ריק = איור)
create index if not exists sites_company on sites (company);

create table if not exists invites (
  site_id    uuid not null references sites(id) on delete cascade,
  email      text not null check (email = lower(email)),
  role       text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (site_id, email)
);
alter table invites enable row level security;
drop policy if exists invites_owner on invites;
create policy invites_owner on invites for all using (site_role(site_id) = 'owner') with check (site_role(site_id) = 'owner');

-- שמות להצגה (יומן פעולות): כל אחד כותב את שלו, ורואים את מי שחולק איתך אתר
create table if not exists profiles (
  user_id uuid primary key,
  name    text not null default ''
);
alter table profiles enable row level security;
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists profiles_mates on profiles;
create policy profiles_mates on profiles for select using (exists (
  select 1 from members a join members b on a.site_id = b.site_id where a.user_id = auth.uid() and b.user_id = profiles.user_id));

-- ההזמנות של המייל המחובר הופכות לחברות. מחזיר כמה אתרים נוספו.
create or replace function claim_invites() returns integer
language plpgsql security definer set search_path = public as $$
declare e text := lower(coalesce(auth.jwt() ->> 'email', '')); n integer;
begin
  if auth.uid() is null or e = '' then return 0; end if;
  insert into members (site_id, user_id, role)
    select site_id, auth.uid(), role from invites where email = e
  on conflict (site_id, user_id) do update set role = excluded.role;
  get diagnostics n = row_count;
  delete from invites where email = e;
  return n;
end $$;

-- אתר חדש: רק מי שבעלים באתר כלשהו של אותה חברה. היוצר נעשה בעלים.
-- האתר הראשון של חברה נוצר ידנית ב-SQL Editor (supabase/README.md), כדי שמשתמש זר שנרשם לא יוכל «לתפוס» חברה.
create or replace function create_site(p_company text, p_name text, p_location text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from sites s join members m on m.site_id = s.id
                 where s.company = p_company and m.user_id = auth.uid() and m.role = 'owner') then
    raise exception 'not an owner in this company';
  end if;
  insert into sites (slug, name, company, location)
    values (p_company || '-' || substr(md5(random()::text), 1, 8), trim(p_name), p_company, nullif(trim(p_location), ''))
    returning id into sid;
  insert into members values (sid, auth.uid(), 'owner');
  return sid;
end $$;

-- קבצים (תמונות, חתימות): bucket «files», תיקייה לכל אתר (<site_id>/<random>). קריאה בכתובת לא ניתנת לניחוש; העלאה רק לעורך / בעלים של האתר.
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('files', 'files', true) on conflict (id) do nothing;
    drop policy if exists files_write on storage.objects;
    create policy files_write on storage.objects for insert to authenticated with check (
      bucket_id = 'files' and site_role(((storage.foldername(name))[1])::uuid) in ('owner','editor'));
  end if;
end $$;
