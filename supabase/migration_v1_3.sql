alter table public.products add column if not exists spec text;

alter table public.orders add column if not exists pickup_code text;
alter table public.orders add column if not exists estimated_arrival_date date;
alter table public.orders add column if not exists line_notified boolean default false;
alter table public.orders add column if not exists notified_at timestamptz;

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

create index if not exists members_phone_building_idx on public.members(phone, building);
create index if not exists orders_pickup_code_idx on public.orders(pickup_code);
create index if not exists topup_requests_member_idx on public.topup_requests(member_id);
create index if not exists topup_requests_status_idx on public.topup_requests(status);

alter table public.topup_requests enable row level security;

drop policy if exists "Admin full access topup requests" on public.topup_requests;
create policy "Admin full access topup requests"
on public.topup_requests for all
to authenticated
using ((auth.jwt() ->> 'role') = 'admin')
with check ((auth.jwt() ->> 'role') = 'admin');
