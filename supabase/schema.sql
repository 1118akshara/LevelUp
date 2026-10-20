-- LevelUp database schema (run in Supabase SQL Editor).
-- RLS is enabled on every user-owned table. Never use a service-role key in the browser.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Kolkata',
  theme text not null default 'system' check (theme in ('light','dark','system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  category text not null default 'personal',
  start_date date not null default current_date,
  target_date date,
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  status text not null default 'active' check (status in ('not_started','active','paused','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.goals add column if not exists progress integer not null default 0 check (progress between 0 and 100);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  due_date date,
  position integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  milestone_id uuid references public.milestones(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  scheduled_date date not null default current_date,
  estimated_minutes integer not null default 30 check (estimated_minutes >= 0),
  actual_minutes integer not null default 0 check (actual_minutes >= 0),
  status text not null default 'pending' check (status in ('pending','completed','skipped')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  habit_type text not null default 'boolean' check (habit_type in ('boolean','duration','count','quantity')),
  target_value numeric,
  unit text,
  schedule_days smallint[] not null default array[1,2,3,4,5,6,7],
  reminder_time time,
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  log_date date not null,
  status text not null check (status in ('completed','partial','missed')),
  value numeric,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  status text not null default 'completed' check (status in ('running','completed','interrupted')),
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  reflection text not null default '',
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, period_start, period_end)
);

create index if not exists goals_user_status_idx on public.goals(user_id, status);
create index if not exists tasks_user_date_idx on public.tasks(user_id, scheduled_date);
create index if not exists habits_user_status_idx on public.habits(user_id, status);
create index if not exists habit_logs_user_date_idx on public.habit_logs(user_id, log_date);
create index if not exists focus_sessions_user_started_idx on public.focus_sessions(user_id, started_at desc);
create index if not exists milestones_goal_position_idx on public.milestones(goal_id, position);

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.weekly_reviews enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "goals_own_all" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "milestones_own_all" on public.milestones for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_own_all" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habits_own_all" on public.habits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habit_logs_own_all" on public.habit_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "focus_sessions_own_all" on public.focus_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weekly_reviews_own_all" on public.weekly_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Automatically create a profile record when a new auth user registers.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
