import { z } from "zod";
import {
  orderStatuses,
  paymentStatuses,
  productCategories,
  shippingSizes,
  topupStatuses,
  walletTransactionTypes
} from "@/lib/types";

export const checkoutSchema = z.object({
  name: z.string().trim().min(2, "請輸入姓名"),
  building: z.string().trim().min(1, "請輸入棟別 / 戶號"),
  phone: z.string().trim().min(8, "請輸入可聯絡電話"),
  lineName: z.string().trim().min(1, "請輸入 LINE 名稱"),
  note: z.string().trim().max(100, "備註最多 100 字")
});

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99)
});

export const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "請輸入商品名稱"),
  spec: z.string().trim().max(80, "規格最多 80 字"),
  imageUrl: z.string().trim().url("請重新上傳圖片").or(z.literal("")),
  category: z.enum(productCategories),
  cost: z.number().min(0, "成本不可小於 0"),
  price: z.number().min(1, "售價需大於 0"),
  shippingType: z.enum(shippingSizes),
  deadline: z.string().min(1, "請設定結單時間"),
  targetProfitRate: z.number().min(0).max(80),
  isActive: z.boolean(),
  isHot: z.boolean()
});

export const adminLoginSchema = z.object({
  password: z.string().min(1, "請輸入管理員密碼")
});

export const accountLookupSchema = z.object({
  phone: z.string().trim().min(8, "請輸入手機號碼")
});

export const joinMemberSchema = z.object({
  name: z.string().trim().min(2, "請輸入姓名"),
  phone: z.string().trim().min(8, "請輸入手機號碼"),
  lineName: z.string().trim().min(1, "請輸入 LINE 名稱"),
  addressNote: z.string().trim().min(1, "請輸入社區 / 棟別 / 樓層"),
  note: z.string().trim().max(120, "備註最多 120 字")
});

export const topupSchema = z.object({
  phone: z.string().trim().min(8, "請輸入手機號碼"),
  lineName: z.string().trim().min(1, "請輸入 LINE 名稱"),
  amount: z.number().positive("儲值金額需大於 0"),
  bankLast5: z.string().trim().regex(/^\d{5}$/, "請輸入轉帳帳號後五碼"),
  proofImageUrl: z.string().trim().url("請先上傳轉帳截圖"),
  note: z.string().trim().max(120, "備註最多 120 字")
});

export const orderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(orderStatuses)
});

export const paymentStatusSchema = z.object({
  paymentStatus: z.enum(paymentStatuses)
});

export const walletAdjustmentSchema = z.object({
  memberId: z.string().uuid(),
  type: z.enum(walletTransactionTypes),
  amount: z.number().refine((value) => value !== 0, "金額不可為 0"),
  note: z.string().trim().max(100).optional().default("")
});

export const topupRequestSchema = z.object({
  memberId: z.string().uuid(),
  amount: z.number().positive("儲值金額需大於 0"),
  paymentMethod: z.string().trim().min(1, "請選擇付款方式"),
  note: z.string().trim().max(120, "備註最多 120 字").optional().default("")
});

export const topupRequestStatusSchema = z.object({
  requestId: z.string().uuid()
});

export const topupReviewSchema = z.object({
  topupId: z.string().uuid(),
  status: z.enum(topupStatuses)
});

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;
export type ProductFormValues = z.infer<typeof productSchema>;
export type AdminLoginValues = z.infer<typeof adminLoginSchema>;
export type AccountLookupValues = z.infer<typeof accountLookupSchema>;
export type JoinMemberValues = z.infer<typeof joinMemberSchema>;
export type WalletAdjustmentValues = z.infer<typeof walletAdjustmentSchema>;
export type TopupRequestValues = z.infer<typeof topupRequestSchema>;
export type TopupValues = z.infer<typeof topupSchema>;
