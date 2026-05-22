create extension if not exists "pgcrypto";

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  phone text not null default '',
  building text,
  line_name text,
  created_at timestamptz default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  slug text unique default gen_random_uuid()::text,
  category text,
  created_at timestamptz default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique default ('O' || replace(gen_random_uuid()::text, '-', '')),
  member_id uuid references public.members(id),
  created_at timestamptz default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
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

alter table public.members add column if not exists note text;
alter table public.members add column if not exists address_note text;
alter table public.members add column if not exists line_user_id text;
alter table public.members add column if not exists line_bind_status text default 'pending';
alter table public.members add column if not exists line_bound_at timestamptz;
alter table public.members add column if not exists balance numeric default 0;
alter table public.members add column if not exists total_deposit numeric default 0;
alter table public.members add column if not exists total_spent numeric default 0;
alter table public.members add column if not exists is_active boolean default true;
alter table public.members add column if not exists created_at timestamptz default now();
alter table public.members add column if not exists updated_at timestamptz default now();

update public.members
set line_bind_status = 'pending'
where line_bind_status is null or line_bind_status in ('未綁定', '');

update public.members
set line_bind_status = 'bound'
where line_user_id is not null and line_bind_status in ('pending', '未綁定');

alter table public.products add column if not exists cost_price numeric default 0;
alter table public.products add column if not exists sell_price numeric default 0;
alter table public.products add column if not exists cost numeric default 0;
alter table public.products add column if not exists price numeric default 0;
alter table public.products add column if not exists profit numeric default 0;
alter table public.products add column if not exists spec text;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists is_active boolean default true;
alter table public.products add column if not exists created_at timestamptz default now();

update public.products
set
  cost_price = coalesce(nullif(cost_price, 0), cost, 0),
  sell_price = coalesce(nullif(sell_price, 0), price, 0),
  cost = coalesce(nullif(cost, 0), cost_price, 0),
  price = coalesce(nullif(price, 0), sell_price, 0),
  profit = coalesce(nullif(profit, 0), coalesce(nullif(sell_price, 0), price, 0) - coalesce(nullif(cost_price, 0), cost, 0), 0);

alter table public.orders add column if not exists status text default 'placed';
alter table public.orders add column if not exists total_amount numeric default 0;
alter table public.orders add column if not exists line_notified boolean default false;
alter table public.orders add column if not exists notified_at timestamptz;
alter table public.orders add column if not exists picked_up_at timestamptz;
alter table public.orders add column if not exists created_at timestamptz default now();

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
check (status in ('placed', 'purchasing', 'arrived', 'picked_up', 'cancelled', '待付款', '已付款', '採購中', '已到貨', '已領貨', '已取消', '退款完成'));

alter table public.order_items add column if not exists qty integer default 1;
alter table public.order_items add column if not exists price numeric default 0;
alter table public.order_items add column if not exists subtotal numeric default 0;
alter table public.order_items add column if not exists created_at timestamptz default now();

update public.order_items
set
  qty = coalesce(nullif(qty, 1), quantity, 1),
  price = coalesce(nullif(price, 0), unit_price, 0),
  subtotal = coalesce(nullif(subtotal, 0), coalesce(nullif(price, 0), unit_price, 0) * coalesce(nullif(qty, 1), quantity, 1), 0);

create table if not exists public.topup_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  amount numeric not null check (amount > 0),
  last5 text,
  payment_method text,
  note text,
  status text default 'pending',
  created_at timestamptz default now(),
  confirmed_at timestamptz
);

alter table public.topup_requests add column if not exists last5 text;
alter table public.topup_requests add column if not exists payment_method text;
alter table public.topup_requests add column if not exists note text;
alter table public.topup_requests add column if not exists confirmed_at timestamptz;

alter table public.topup_requests drop constraint if exists topup_requests_status_check;
alter table public.topup_requests add constraint topup_requests_status_check
check (status in ('pending', 'confirmed', 'cancelled', '待確認', '已入帳', '已取消'));

create table if not exists public.wallet_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  type text not null check (type in ('topup', 'purchase', 'refund', 'adjustment')),
  amount numeric not null,
  description text,
  note text,
  order_id uuid references public.orders(id),
  topup_request_id uuid references public.topup_requests(id),
  topup_id uuid,
  balance_after numeric default 0,
  created_at timestamptz default now()
);

alter table public.wallet_logs add column if not exists description text;
alter table public.wallet_logs add column if not exists topup_request_id uuid references public.topup_requests(id);
alter table public.wallet_logs add column if not exists topup_id uuid;
alter table public.wallet_logs add column if not exists order_id uuid references public.orders(id);
alter table public.wallet_logs add column if not exists balance_after numeric default 0;
update public.wallet_logs set description = note where description is null and note is not null;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  type text,
  message text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists members_line_user_id_idx on public.members(line_user_id);
create index if not exists members_phone_building_idx on public.members(phone, building);
create index if not exists orders_member_status_idx on public.orders(member_id, status);
create index if not exists topup_requests_member_status_idx on public.topup_requests(member_id, status);
create index if not exists wallet_logs_member_idx on public.wallet_logs(member_id);
create index if not exists notifications_member_idx on public.notifications(member_id);
