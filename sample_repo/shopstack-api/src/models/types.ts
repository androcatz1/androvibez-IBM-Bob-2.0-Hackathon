// ─── User ────────────────────────────────────────────────────────────────────

export type UserRole = 'customer' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
}

// ─── Product ─────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  reserved_quantity: number;
  sku: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  sku: string;
}

// ─── Order ───────────────────────────────────────────────────────────────────

// Note: additional statuses exist in the implementation beyond what's in the README
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'paid'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'payment_failed'
  | 'refunded';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface CreateOrderInput {
  user_id: string;
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'card' | 'bank_transfer' | 'wallet';

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessPaymentInput {
  order_id: string;
  method: PaymentMethod;
  // In a real system this would include card details, tokens, etc.
}

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'order_confirmed'
  | 'order_shipped'
  | 'payment_failed'
  | 'order_cancelled'
  | 'refund_issued';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  message: string;
  sent_at: string;
}

// ─── API Response Helpers ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
