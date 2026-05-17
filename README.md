# 社區好市多代購系統 V1.2

Next.js App Router + TypeScript + Tailwind CSS + Supabase + React Hook Form + Zod + Server Actions。

## 主要功能

- 正式 Supabase 資料表：商品、會員、訂單、訂單明細、儲值交易
- RLS 已啟用，前台不暴露成本、毛利、毛利率
- 後台使用 `ADMIN_PASSWORD` + httpOnly cookie 保護
- 商品 CRUD，自動計算毛利、毛利率、建議售價
- 商品照片使用 Supabase Storage 直接上傳，前台以 4:3 商品卡預覽
- 商品專屬頁 `/product/[slug]`
- 商品卡可複製 LINE 貼文
- 下單自動建立會員、檢查餘額、足額扣款、不足額保留待付款
- 新會員加入頁 `/join`：建立會員資料，後續下單與查詢以手機號碼識別
- 儲值申請頁 `/topup`：銀行轉帳後送出申請與截圖，管理員審核才入帳
- 會員查詢頁 `/account`：用手機號碼看餘額、訂單、儲值紀錄、消費紀錄、退款紀錄
- 後台會員 / 儲值管理 `/admin/members`
- 後台儲值審核 `/admin/topups`
- 後台採購模式 `/admin/purchase-list`
- LINE Bot webhook 預留 `/api/line/webhook`

## 環境變數

建立 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
NEXT_PUBLIC_SITE_URL=
```

說明：

- `NEXT_PUBLIC_SUPABASE_URL`：Supabase 專案 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：前台公開 anon key
- `SUPABASE_SERVICE_ROLE_KEY`：Server Actions / 後台管理使用，不可放到 client
 - `ADMIN_PASSWORD`：後台簡易管理員密碼
 - `NEXT_PUBLIC_SITE_URL`：公開網址，用於未來 LINE 分享與通知

> 注意：`SUPABASE_SERVICE_ROLE_KEY` 必須使用 Supabase 後台 Project Settings 內的 service_role key。不要把 service role key 放進任何 Client Component。
> 如果後台新增商品或圖片上傳出現 `row-level security policy`，代表目前填入的 key 不是 service_role，RLS 正常阻擋了寫入。

## Supabase

到 Supabase SQL Editor 執行：

```bash
supabase/schema.sql
```

若你的資料庫已經建立過舊版資料表，這次升級可先執行：

```bash
supabase/migration_v1_3.sql
supabase/migration_v1_4.sql
```

資料表：

- `products`
- `members`
- `orders`
- `order_items`
- `wallet_transactions`
- `topup_requests`
- `wallet_logs`
- `topups`

Storage：

- `product-images`：商品圖片 bucket，公開讀取，上傳限制 5MB，支援 jpg / png / webp
- `topup-proofs`：轉帳截圖 bucket，公開讀取，上傳限制 5MB，支援 jpg / png / webp

RLS：

- `products`：前台可讀取 `is_active = true`
- `members / orders / order_items / wallet_transactions / wallet_logs / topups`：不直接開放 anon 讀取
- 會員查詢使用 Server Action 以手機號碼回傳自己的資料
- 後台使用 server-side service role 管理資料

## 啟動

```bash
npm install
npm run dev
```

網址：

- 前台：http://localhost:3000
- 加入會員：http://localhost:3000/join
- 會員儲值：http://localhost:3000/topup
- 會員查詢：http://localhost:3000/account
- 後台：http://localhost:3000/admin
- 會員 / 儲值管理：http://localhost:3000/admin/members
- 儲值審核：http://localhost:3000/admin/topups
- 採購清單：http://localhost:3000/admin/purchase-list

## 測試流程

1. 到 `/join` 建立會員資料。
2. 到 `/topup` 用同一支手機送出儲值申請與截圖。
3. 到 `/admin` 用 `ADMIN_PASSWORD` 登入。
4. 到 `/admin/topups` 將儲值申請按「通過」，確認會員餘額增加並寫入 `wallet_logs`。
5. 在 `/admin` 新增商品，直接上傳商品圖片，填商品名稱、分類、成本、售價、運費分類、結單時間。
6. 回前台，商品卡點「複製 LINE 貼文」。
7. 前台加入購物車並下單，填姓名、棟別、電話、LINE 名稱。
8. 到 `/account` 用手機號碼查會員餘額、訂單、儲值紀錄、消費紀錄與退款紀錄。
9. 到 `/admin` 查看訂單、毛利、付款狀態，或取消訂單退款。
10. 到 `/admin/purchase-list` 查看採購清單並打勾。

## 未來保留

- LINE Messaging API 到貨通知
- LINE Login
- AI 客服
- 推播通知
- 預儲值線上金流
