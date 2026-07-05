-- Phase 10: Organisation membership and org-scoped saved searches
-- Requires: 008_user_auth_rls.sql

-- ---------------------------------------------------------------------------
-- Org membership
-- ---------------------------------------------------------------------------
create table if not exists org_members (
  org_id uuid not null references organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists org_members_user on org_members (user_id);

alter table org_members enable row level security;

create policy org_members_self_select on org_members
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Auto-enroll new users in default org
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do update set email = excluded.email, updated_at = now();

  insert into public.org_members (org_id, user_id, role)
  values ('00000000-0000-0000-0000-000000000001', new.id, 'member')
  on conflict do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Saved searches — org-scoped for authenticated users
-- ---------------------------------------------------------------------------
alter table saved_searches add column if not exists owner_id uuid references auth.users(id);

drop policy if exists deny_anon_saved_searches on saved_searches;
drop policy if exists saved_searches_org_select on saved_searches;
drop policy if exists saved_searches_org_insert on saved_searches;
drop policy if exists saved_searches_org_update on saved_searches;
drop policy if exists saved_searches_org_delete on saved_searches;

create policy saved_searches_org_select on saved_searches
  for select to authenticated using (
    org_id in (select org_id from org_members where user_id = auth.uid())
    or owner_id = auth.uid()
  );

create policy saved_searches_org_insert on saved_searches
  for insert to authenticated with check (
    org_id in (select org_id from org_members where user_id = auth.uid())
    and (owner_id is null or owner_id = auth.uid())
  );

create policy saved_searches_org_update on saved_searches
  for update to authenticated using (
    owner_id = auth.uid()
    or org_id in (select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin'))
  ) with check (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );

create policy saved_searches_org_delete on saved_searches
  for delete to authenticated using (
    owner_id = auth.uid()
    or org_id in (select org_id from org_members where user_id = auth.uid() and role in ('owner', 'admin'))
  );

insert into feature_flags (key, enabled, description) values
  ('aisstream_maritime', true, 'AISStream WebSocket fallback for global AIS')
on conflict (key) do update set description = excluded.description;
