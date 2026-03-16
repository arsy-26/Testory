import { Product } from "@/types/product";
import { Order } from "@/types/order";

export interface OrderItem {
  id: string;

  orderId: string;
  order?: Order;

  productId: string;
  product?: Product;

  productName: string;
  productPrice: number;
  quantity: number;
  subtotal: number;

  createdAt: Date;
}