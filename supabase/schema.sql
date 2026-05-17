create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  image_url text,
  category text,
  spec text,
  cost numeric default 0,
  price numeric default 0,
  shipping_fee numeric default 0,
  shipping_type text,
  profit numeric default 0,
  profit_rate numeric default 0,
  deadline timestamptz,
  is_active boolean default true,
  is_hot boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  building text,
  address_note text,
  phone text not null,
  line_name text,
  lookup_code text not null,
  balance numeric default 0,
  total_deposit numeric default 0,
  total_spent numeric default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (phone)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,
  member_id uuid references public.members(id),
  total_amount numeric default 0,
  total_profit numeric default 0,
  status text default '待付款' check (status in ('待付款', '已付款', '採購中', '已到貨', '已領貨', '已取消', '退款完成')),
  payment_status text default '待付款' check (payment_status in ('待付款', '已扣款', '已退款')),
  pickup_code text,
  estimated_arrival_date date,
  line_notified boolean default false,
  notified_at timestamptz,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text,
  quantity integer default 1,
  unit_price numeric default 0,
  unit_cost numeric default 0,
  shipping_fee numeric default 0,
  profit numeric default 0,
  subtotal numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  order_id uuid references public.orders(id),
  type text not null check (type in ('deposit', 'purchase', 'refund', 'adjustment')),
  amount numeric not null,
  balance_after numeric not null,
  note text,
  created_by text,
  created_at timestamptz default now()
);

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

create table if not exists public.topup_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  amount numeric not null check (amount > 0),
  payment_method text,
  note text,
  status text default '待確認' check (status in ('待確認', '已入帳', '已取消')),
  created_at timestamptz default now(),
  confirmed_at timestamptz
);

alter table public.products add column if not exists spec text;
alter table public.members add column if not exists address_note text;
alter table public.orders add column if not exists pickup_code text;
alter table public.orders add column if not exists estimated_arrival_date date;
alter table public.orders add column if not exists line_notified boolean default false;
alter table public.orders add column if not exists notified_at timestamptz;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders drop constraint if exists orders_payment_status_check;

update public.orders
set status = case
  when status = '已下單' and payment_status = '已扣款' then '已付款'
  when status = '已下單' then '待付款'
  when status = '已領取' then '已領貨'
  else status
end
where status in ('已下單', '已領取');

update public.orders
set pickup_code = chr(65 + floor(random() * 26)::int) || lpad(floor(random() * 1000)::int::text, 3, '0')
where pickup_code is null;

alter table public.orders
add constraint orders_status_check
check (status in ('待付款', '已付款', '採購中', '已到貨', '已領貨', '已取消', '退款完成'));

alter table public.orders
add constraint orders_payment_status_check
check (payment_status in ('待付款', '已扣款', '已退款'));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create index if not exists products_slug_idx on public.products(slug);
create index if not exists products_active_deadline_idx on public.products(is_active, deadline);
create index if not exists members_phone_lookup_idx on public.members(phone, lookup_code);
create index if not exists members_phone_building_idx on public.members(phone, building);
create index if not exists orders_member_idx on public.orders(member_id);
create index if not exists orders_pickup_code_idx on public.orders(pickup_code);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists wallet_transactions_member_idx on public.wallet_transactions(member_id);
create index if not exists wallet_logs_member_idx on public.wallet_logs(member_id);
create index if not exists wallet_logs_topup_idx on public.wallet_logs(topup_id);
create index if not exists topups_member_idx on public.topups(member_id);
create index if not exists topups_status_idx on public.topups(status);
create index if not exists topups_phone_idx on public.topups(phone);
create index if not exists topup_requests_member_idx on public.topup_requests(member_id);
create index if not exists topup_requests_status_idx on public.topup_requests(status);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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

alter table public.products enable row level security;
alter table public.members enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallet_logs enable row level security;
alter table public.topups enable row level security;
alter table public.topup_requests enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Admin full access products" on public.products;
create policy "Admin full access products"
on public.products for all
to authenticated
using ((auth.jwt() ->> 'role') = 'admin')
with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists "Admin full access members" on public.members;
create policy "Admin full access members"
on public.members for all
to authenticated
using ((auth.jwt() ->> 'role') = 'admin')
with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists "Admin full access orders" on public.orders;
create policy "Admin full access orders"
on public.orders for all
to authenticated
using ((auth.jwt() ->> 'role') = 'admin')
with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists "Admin full access order items" on public.order_items;
create policy "Admin full access order items"
on public.order_items for all
to authenticated
using ((auth.jwt() ->> 'role') = 'admin')
with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists "Admin full access wallet transactions" on public.wallet_transactions;
create policy "Admin full access wallet transactions"
on public.wallet_transactions for all
to authenticated
using ((auth.jwt() ->> 'role') = 'admin')
with check ((auth.jwt() ->> 'role') = 'admin');

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

drop policy if exists "Admin full access topup requests" on public.topup_requests;
create policy "Admin full access topup requests"
on public.topup_requests for all
to authenticated
using ((auth.jwt() ->> 'role') = 'admin')
with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "Admin can manage product images" on storage.objects;
create policy "Admin can manage product images"
on storage.objects for all
to authenticated
using (bucket_id = 'product-images' and (auth.jwt() ->> 'role') = 'admin')
with check (bucket_id = 'product-images' and (auth.jwt() ->> 'role') = 'admin');

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

-- V1.2 note:
-- Customer account lookup is intentionally handled through Next.js Server Actions
-- using phone. This avoids exposing member/order/wallet rows directly
-- to anon clients while keeping RLS enabled for future Supabase Auth or LINE Login.
