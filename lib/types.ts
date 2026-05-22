export const productCategories = ["飲料", "民生用品", "零食", "本週限定", "熱門優惠"] as const;
export type ProductCategory = (typeof productCategories)[number];

export const shippingSizes = ["小件", "中件", "大件"] as const;
export type ShippingSize = (typeof shippingSizes)[number];

export const orderStatuses = [
  "placed",
  "purchasing",
  "arrived",
  "picked_up",
  "cancelled",
  "待付款",
  "已付款",
  "採購中",
  "已到貨",
  "已領貨",
  "已取消",
  "退款完成"
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const paymentStatuses = ["待付款", "已扣款", "已退款"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const walletTransactionTypes = ["deposit", "purchase", "refund", "adjustment"] as const;
export type WalletTransactionType = (typeof walletTransactionTypes)[number];

export const walletLogTypes = ["topup", "purchase", "refund", "adjustment"] as const;
export type WalletLogType = (typeof walletLogTypes)[number];

export const topupRequestStatuses = ["pending", "confirmed", "cancelled", "待確認", "已入帳", "已取消"] as const;
export type TopupRequestStatus = (typeof topupRequestStatuses)[number];

export const topupStatuses = ["pending", "approved", "rejected"] as const;
export type TopupStatus = (typeof topupStatuses)[number];

export type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  category: string | null;
  spec: string | null;
  price: number;
  deadline: string | null;
  isHot: boolean;
  orderCount: number;
};

export type AdminProduct = PublicProduct & {
  cost: number;
  shippingFee: number;
  shippingType: ShippingSize;
  profit: number;
  profitRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CartItem = {
  productId: string;
  quantity: number;
};

export type CartLine = {
  product: PublicProduct;
  quantity: number;
};

export type Member = {
  id: string;
  name: string;
  building: string | null;
  addressNote?: string | null;
  phone: string;
  lineName: string | null;
  lineUserId?: string | null;
  lineBoundAt?: string | null;
  lineBindStatus?: string | null;
  lookupCode?: string;
  balance: number;
  totalDeposit: number;
  totalSpent: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string | null;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  shippingFee?: number;
  profit?: number;
  subtotal: number;
  createdAt: string;
};

export type AdminOrder = {
  id: string;
  orderNo: string;
  memberId: string | null;
  member: Member | null;
  totalAmount: number;
  totalProfit: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  pickupCode: string | null;
  estimatedArrivalDate: string | null;
  lineNotified: boolean;
  notifiedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export type PublicOrder = {
  id: string;
  orderNo: string;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  pickupCode: string | null;
  estimatedArrivalDate: string | null;
  note: string | null;
  createdAt: string;
  items: Array<Pick<OrderItem, "productName" | "quantity" | "unitPrice" | "subtotal">>;
};

export type WalletTransaction = {
  id: string;
  memberId: string;
  orderId: string | null;
  type: WalletTransactionType;
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type WalletLog = {
  id: string;
  memberId: string;
  orderId: string | null;
  topupId: string | null;
  type: WalletLogType;
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
};

export type TopupRequest = {
  id: string;
  memberId: string;
  member?: Member | null;
  amount: number;
  paymentMethod: string | null;
  note: string | null;
  status: TopupRequestStatus;
  createdAt: string;
  confirmedAt: string | null;
};

export type Topup = {
  id: string;
  memberId: string | null;
  member?: Member | null;
  phone: string;
  lineName: string | null;
  amount: number;
  bankLast5: string | null;
  proofImageUrl: string | null;
  status: TopupStatus;
  note: string | null;
  createdAt: string;
  approvedAt: string | null;
};

export type AccountLookupResult = {
  member: Omit<Member, "lookupCode" | "isActive" | "updatedAt">;
  orders: PublicOrder[];
  transactions: WalletLog[];
  topupRequests: TopupRequest[];
  topups: Topup[];
};

export type DashboardData = {
  products: AdminProduct[];
  orders: AdminOrder[];
  members: Member[];
  transactions: WalletTransaction[];
  topupRequests: TopupRequest[];
  topups?: Topup[];
};
