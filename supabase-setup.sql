-- Run this in your Supabase dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- 1. Create the pins table
create table if not exists pins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null default '',
  lat         double precision not null,
  lng         double precision not null,
  type        text not null default 'curiosity' check (type in ('curiosity','favorite','food','history')),
  question    text,
  answer      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. Auto-update updated_at on row changes
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger pins_updated_at
  before update on pins
  for each row execute function update_updated_at();

-- 3. Enable Row Level Security — users can ONLY see their own pins
alter table pins enable row level security;

create policy "Users can read own pins"
  on pins for select
  using (auth.uid() = user_id);

create policy "Users can insert own pins"
  on pins for insert
  with check (auth.uid() = user_id);

create policy "Users can update own pins"
  on pins for update
  using (auth.uid() = user_id);

create policy "Users can delete own pins"
  on pins for delete
  using (auth.uid() = user_id);

-- 4. Index for fast user lookups
create index pins_user_id_idx on pins(user_id);
create index pins_created_at_idx on pins(created_at desc);
