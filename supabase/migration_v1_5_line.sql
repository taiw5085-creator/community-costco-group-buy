alter table public.members add column if not exists line_user_id text;
alter table public.members add column if not exists line_bound_at timestamptz;
alter table public.members add column if not exists line_bind_status text default '未綁定';

alter table public.orders add column if not exists line_notified boolean default false;
alter table public.orders add column if not exists notified_at timestamptz;

create index if not exists members_line_user_id_idx on public.members(line_user_id);
create index if not exists orders_line_notified_idx on public.orders(line_notified);
