-- PharmaWatch Supabase Database Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users Table
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  age integer,
  gender text,
  language text default 'en',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Medicines Table
create table if not exists public.medicines (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  cause text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Time Slots Table
create table if not exists public.time_slots (
  id uuid primary key default uuid_generate_v4(),
  medicine_id uuid references public.medicines(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  time_string text not null, -- Format 'HH:MM'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Medicine History Table
create table if not exists public.medicine_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  medicine_id uuid references public.medicines(id) on delete cascade not null,
  time_slot_id uuid references public.time_slots(id) on delete cascade not null,
  status text check (status in ('taken', 'missed', 'snoozed', 'pending')) not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  date text not null -- Format 'YYYY-MM-DD' for easy querying
);

-- Diet Recommendations Table
create table if not exists public.diet_recommendations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  eat text,
  avoid text,
  hydration text,
  side_effects text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security (RLS) Policies
-- (For this simple implementation, we'll allow all operations, but in a real app, 
-- we would tie this to Supabase Auth's auth.uid())

alter table public.users enable row level security;
alter table public.medicines enable row level security;
alter table public.time_slots enable row level security;
alter table public.medicine_history enable row level security;
alter table public.diet_recommendations enable row level security;

-- Allow anonymous access for the scope of this project
create policy "Allow all operations for users" on public.users for all using (true) with check (true);
create policy "Allow all operations for medicines" on public.medicines for all using (true) with check (true);
create policy "Allow all operations for time_slots" on public.time_slots for all using (true) with check (true);
create policy "Allow all operations for history" on public.medicine_history for all using (true) with check (true);
create policy "Allow all operations for diet" on public.diet_recommendations for all using (true) with check (true);
