"use server";

import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type ActionResult =
    | { success: true; order: Record<string, unknown> }
    | { success: false; error: string; reason?: string; currentStatus?: string };

export async function cancelOrder(orderId: string): Promise<ActionResult> {
    try {
        const admin = await getCurrentAdmin();
        if (!admin) return { success: false, error: "Unauthorized" };

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                status: true,
                items: {
                    select: { productId: true, quantity: true },
                },
            },
        });

        if (!order) return { success: false, error: "Order not found" };

        if (order.status !== "PENDING") {
            return {
                success: false,
                error: "Hanya order PENDING yang bisa dibatalkan",
            };
        }

        const cancelled = await prisma.$transaction(async (tx) => {
            const updated = await tx.order.update({
                where: { id: orderId },
                data: { status: "CANCELLED" },
            });

            await Promise.all(
                order.items.map((item) =>
                    tx.product.update({
                        where: { id: item.productId },
                        data: { reserved: { decrement: item.quantity } },
                    })
                )
            );

            return updated;
        });

        revalidatePath("/admin/orders");
        revalidatePath(`/admin/orders/${orderId}`);

        return { success: true, order: cancelled };
    } catch (error) {
        console.error("Error cancelling order:", error);
        return { success: false, error: "Internal server error" };
    }
}

export async function confirmOrder(orderId: string): Promise<ActionResult> {
    try {
        const admin = await getCurrentAdmin();
        if (!admin) return { success: false, error: "Unauthorized" };

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                status: true,
                expiresAt: true,
                items: {
                    select: { productId: true, quantity: true },
                },
            },
        });

        if (!order) return { success: false, error: "Order not found" };

        if (order.status !== "PENDING") {
            return {
                success: false,
                error: "Order tidak dapat dikonfirmasi",
                reason:
                    order.status === "EXPIRED"
                        ? "Order sudah expired"
                        : "Order sudah diproses",
                currentStatus: order.status,
            };
        }

        const confirmed = await prisma.$transaction(async (tx) => {
            const fresh = await tx.order.findUnique({
                where: { id: orderId },
                select: { expiresAt: true, status: true },
            });

            if (!fresh || fresh.status !== "PENDING") {
                throw new Error("ORDER_STATUS_CHANGED");
            }

            if (fresh.expiresAt < new Date()) {
                await tx.order.update({
                    where: { id: orderId },
                    data: { status: "EXPIRED" },
                });
                throw new Error("ORDER_EXPIRED");
            }

            const updated = await tx.order.update({
                where: { id: orderId },
                data: {
                    status: "CONFIRMED",
                    confirmedAt: new Date(),
                },
            });

            await Promise.all(
                order.items.map((item) =>
                    tx.product.update({
                        where: { id: item.productId },
                        data: {
                            stock: { decrement: item.quantity },
                            reserved: { decrement: item.quantity },
                        },
                    })
                )
            );

            return updated;
        });

        revalidatePath("/admin/orders");
        revalidatePath(`/admin/orders/${orderId}`);

        return { success: true, order: confirmed };
    } catch (error: any) {
        if (error.message === "ORDER_EXPIRED") {
            return { success: false, error: "Order sudah kedaluwarsa" };
        }
        if (error.message === "ORDER_STATUS_CHANGED") {
            return { success: false, error: "Status order berubah, silakan refresh" };
        }
        console.error("Error confirming order:", error);
        return { success: false, error: "Internal server error" };
    }
}

export async function completeOrder(orderId: string): Promise<ActionResult> {
    try {
        const admin = await getCurrentAdmin();
        if (!admin) return { success: false, error: "Unauthorized" };

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, status: true },
        });

        if (!order) return { success: false, error: "Order not found" };

        if (order.status !== "CONFIRMED") {
            return {
                success: false,
                error: "Hanya order CONFIRMED yang bisa diselesaikan",
            };
        }

        const completed = await prisma.order.update({
            where: { id: orderId },
            data: {
                status: "COMPLETED",
                completedAt: new Date(),
            },
        });

        revalidatePath("/admin/orders");
        revalidatePath(`/admin/orders/${orderId}`);

        return { success: true, order: completed };
    } catch (error) {
        console.error("Error completing order:", error);
        return { success: false, error: "Internal server error" };
    }
}