import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import {
    generateOrderNumber,
    normalizePhone,
    checkOrderRateLimit,
    generateTrackingToken,
    formatRupiah,
} from "@/lib/utils";
import { createOrderSchema } from "@/validations/orders/order.schema";

const CRITICAL_STOCK_THRESHOLD = 5;
const ORDER_EXPIRES_IN_MS = 30 * 60 * 1000;

type RawProduct = {
    id: string;
    name: string;
    price: number;
    stock: number;
    reserved: number;
    isActive: boolean;
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const validation = createOrderSchema.safeParse(body);

        if (!validation.success) {
            return Response.json(
                { error: "Validation failed", details: validation.error.issues },
                { status: 400 }
            );
        }

        const { customerName, customerPhone, notes, items } = validation.data;
        const normalizedPhone = normalizePhone(customerPhone);

        const rateLimit = await checkOrderRateLimit(normalizedPhone);

        if (!rateLimit.allowed) {
            const resetDate = new Date(rateLimit.resetAt!);
            return Response.json(
                {
                    error: "Terlalu banyak pesanan",
                    message: `Anda sudah membuat 3 pesanan dalam 15 menit terakhir. Silakan coba lagi setelah ${resetDate.toLocaleTimeString("id-ID")}`,
                    resetAt: resetDate.toISOString(),
                },
                { status: 429 }
            );
        }

        const productId = items[0].productId;
        const requestedQty = items[0].quantity;

        const product = await prisma.product.findUnique({
            where: {
                id: productId,
                isActive: true,
            },
        });

        if (!product) {
            return Response.json(
                { error: "Produk tidak ditemukan atau tidak tersedia" },
                { status: 404 }
            );
        }

        const availableStock = product.stock - product.reserved;
        if (availableStock < requestedQty) {
            return Response.json(
                {
                    error: "Stok tidak mencukupi",
                    product: {
                        id: product.id,
                        name: product.name,
                        available: availableStock,
                        requested: requestedQty,
                    },
                },
                { status: 400 }
            );
        }

        const isCriticalStock = availableStock <= CRITICAL_STOCK_THRESHOLD;
        const trackingToken = generateTrackingToken()

        const order = await prisma.$transaction(
            async (tx) => {
                if (isCriticalStock) {
                    const rows = await tx.$queryRaw<RawProduct[]>`
            SELECT id, name, price, stock, reserved, "isActive"
            FROM "Product"
            WHERE id = ${product.id}
              AND "isActive" = true
            FOR UPDATE
          `;

                    const freshProduct = rows[0];

                    if (!freshProduct) {
                        throw new Error("PRODUCT_NOT_FOUND");
                    }

                    const freshAvailable = freshProduct.stock - freshProduct.reserved;
                    if (freshAvailable < requestedQty) {
                        throw new Error("INSUFFICIENT_STOCK");
                    }

                    await tx.product.update({
                        where: { id: product.id },
                        data: { reserved: { increment: requestedQty } },
                    });
                } else {
                    const result = await tx.$executeRaw`
            UPDATE "Product"
            SET reserved = reserved + ${requestedQty}
            WHERE id = ${product.id}
              AND "isActive" = true
              AND (stock - reserved) >= ${requestedQty}
          `;

                    if (result === 0) {
                        const check = await tx.product.findUnique({
                            where: { id: product.id },
                            select: { isActive: true, stock: true, reserved: true },
                        });

                        if (!check || !check.isActive) {
                            throw new Error("PRODUCT_NOT_FOUND");
                        }

                        throw new Error("INSUFFICIENT_STOCK");
                    }
                }

                const newOrder = await tx.order.create({
                    data: {
                        orderNumber: generateOrderNumber(),
                        trackingToken,
                        customerName,
                        customerPhone: normalizedPhone,
                        notes: notes || null,
                        totalAmount: product.price * requestedQty,
                        status: "PENDING",
                        expiresAt: new Date(Date.now() + ORDER_EXPIRES_IN_MS),
                        items: {
                            create: [{
                                productId: product.id,
                                productName: product.name,
                                productPrice: product.price,
                                quantity: requestedQty,
                                subtotal: product.price * requestedQty,
                            }],
                        },
                    },
                    select: {
                        id: true,
                        orderNumber: true,
                        totalAmount: true,
                        expiresAt: true,
                        items: { select: { id: true, productName: true, quantity: true, subtotal: true } }
                    },
                });

                return newOrder;
            },
            {
                isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
                timeout: 10000,
                maxWait: 3000,
            }
        );

        const productName = order.items[0].productName;
        const productQuantity = order.items[0].quantity;
        const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER || "6281314998265";
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const trackingUrl = `${appUrl}/orders/track?token=${trackingToken}`;

        const waMessage =
            `Halo Admin! Saya mau order:\n\n` +
            `*${productName} (${productQuantity} unit)*\n` +
            `Total: *${formatRupiah(order.totalAmount)}*\n` +
            `Order ID: *${order.orderNumber}*\n` +
            `Nama: ${customerName}\n` +
            `HP: ${normalizedPhone}\n\n` +
            `Link tracking pesanan saya:\n` +
            `${trackingUrl}\n\n` +
            `Mohon info rekening untuk transfer. Terima kasih!`;

        const whatsappLink = `https://wa.me/${adminPhone}?text=${encodeURIComponent(waMessage)}`;

        return Response.json(
            {
                success: true,
                order: {
                    id: order.id,
                    orderNumber: order.orderNumber,
                    totalAmount: order.totalAmount,
                    expiresAt: order.expiresAt,
                    items: order.items,
                    whatsappLink,
                    trackingUrl,
                },
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("Error creating order:", error);

        if (error.message === "PRODUCT_NOT_FOUND") {
            return Response.json(
                { error: "Produk tidak ditemukan atau tidak tersedia" },
                { status: 404 }
            );
        }

        if (error.message === "INSUFFICIENT_STOCK") {
            return Response.json(
                { error: "Stok tidak mencukupi, silakan coba lagi" },
                { status: 400 }
            );
        }

        if (error.code === "P2028") {
            return Response.json(
                { error: "Transaksi timeout, silakan coba lagi" },
                { status: 503 }
            );
        }

        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}