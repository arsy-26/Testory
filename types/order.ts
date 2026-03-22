import { OrderItem } from "./order-item";

enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
}

export interface Order {
  id: string;
  orderNumber: string;

  customerName: string;
  customerPhone: string;
  notes?: string;

  totalAmount: number;

  status: OrderStatus;
  expiresAt: Date;
  confirmedAt?: Date;
  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;

  items?: OrderItem[];
}