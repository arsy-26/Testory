import { isValidPhone } from '@/lib/utils';
import { z } from 'zod';

export const createOrderSchema = z.object({
    customerName: z.string().min(2, "Nama minimal 2 karakter"),
    customerPhone: z.string().refine(isValidPhone, "Format nomor HP tidak valid"),
    notes: z.string().optional(),
    items: z
        .array(
            z.object({
                productId: z.string(),
                quantity: z.number().int().min(1),
            })
        )
        .min(1, "Minimal pesan 1 produk")
        .max(1, "Hanya bisa memesan 1 produk per transaksi"),
});
