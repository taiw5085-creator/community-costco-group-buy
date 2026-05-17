create extension if not exists "pgcrypto";

alter table public.products add column if not exists spec text;
alter table public.members add column if not exists address_note text;

create table if not exists public.wallet_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  order_id uuid references public.orders(id),
  topup_id uuid,
  type text not null check (type in ('topup', 'purchase', 'refund', 'adjustment')),
  amount numeric not null,
  balance_after numeric not null,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.topups (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  phone text not null,
  line_name text,
  amount numeric not null check (amount > 0),
  bank_last5 text,
  proof_image_url text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text,
  created_at timestamptz default now(),
  approved_at timestamptz
);

alter table public.wallet_logs
  drop constraint if exists wallet_logs_topup_id_fkey;

alter table public.wallet_logs
  add constraint wallet_logs_topup_id_fkey
  foreign key (topup_id) references public.topups(id);

create index if not exists wallet_logs_member_idx on public.wallet_logs(member_id);
create index if not exists wallet_logs_topup_idx on public.wallet_logs(topup_id);
create index if not exists topups_member_idx on public.topups(member_id);
create index if not exists topups_status_idx on public.topups(status);
create index if not exists topups_phone_idx on public.topups(phone);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'topup-proofs',
  'topup-proofs',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.wallet_logs enable row level security;
alter table public.topups enable row level security;

drop policy if exists "Admin full access wallet logs" on public.wallet_logs;
create policy "Admin full access wallet logs"
on public.wallet_logs for all
to authenticated
using ((auth.jwt() ->> 'role') = 'admin')
with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists "Admin full access topups" on public.topups;
create policy "Admin full access topups"
on public.topups for all
to authenticated
using ((auth.jwt() ->> 'role') = 'admin')
with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists "Public can read topup proofs" on storage.objects;
create policy "Public can read topup proofs"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'topup-proofs');

drop policy if exists "Admin can manage topup proofs" on storage.objects;
create policy "Admin can manage topup proofs"
on storage.objects for all
to authenticated
using (bucket_id = 'topup-proofs' and (auth.jwt() ->> 'role') = 'admin')
with check (bucket_id = 'topup-proofs' and (auth.jwt() ->> 'role') = 'admin');
