import { OrderItem } from "@/types/order-item";

enum ProductStatus {
  READY = "READY",
  INCOMING = "INCOMING",
  PO = "PO",
}

export interface Product {
  id: string;
  name: string;
  brand: string;

  processor: string;
  ram: string;
  storage: string;
  gpu?: string;
  display?: string;

  originalPrice?: number;
  price: number;

  status: ProductStatus;

  stock: number;
  reserved: number;

  images: string[];
  description?: string;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  orderItems?: OrderItem[];
}