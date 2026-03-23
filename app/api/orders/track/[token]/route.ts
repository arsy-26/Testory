// app/api/orders/track/route.ts
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { checkTrackRateLimit } from "@/lib/utils";
import { Prisma } from "@/app/generated/prisma";
import { z } from "zod";

const trackOrderSchema = z
    .string()
    .regex(/^tk_[a-f0-9]{16}$/, "Format tracking token tidak valid")

const orderTrackSelect = {
    id: true,
    orderNumber: true,
    customerName: true,
    totalAmount: true,
    status: true,
    notes: true,
    createdAt: true,
    expiresAt: true,
    confirmedAt: true,
    completedAt: true,
    items: {
        select: {
            id: true,
            productId: true,
            productName: true,
            productPrice: true,
            quantity: true,
            subtotal: true,
            product: {
                select: {
                    id: true,
                    name: true,
                    images: true,
                    brand: true,
                },
            },
        },
    },
} satisfies Prisma.OrderSelect;

type TrackedOrder = Prisma.OrderGetPayload<{ select: typeof orderTrackSelect }>;

type OrderWithComputed = TrackedOrder & {
    timeLeftMinutes: number | null;
    isUrgent: boolean;
};

type TrackOrderResponse = {
    order: OrderWithComputed;
};

export async function GET(req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const validation = trackOrderSchema.safeParse(token);

        if (!validation.success) {
            return Response.json(
                {
                    error: "Validation failed",
                    details: validation.error.issues,
                },
                { status: 400 }
            );
        }

        const rateLimit = await checkTrackRateLimit(token);

        if (!rateLimit.allowed) {
            const resetDate = new Date(rateLimit.resetAt!);
            return Response.json(
                {
                    error: "Terlalu banyak percobaan",
                    message: `Silakan coba lagi setelah ${resetDate.toLocaleTimeString("id-ID")}`,
                    resetAt: resetDate.toISOString(),
                },
                { status: 429 }
            );
        }

        const order = await prisma.order.findUnique({
            where: { trackingToken: token },
            select: orderTrackSelect,
        });

        if (!order) {
            return Response.json(
                { error: "Pesanan tidak ditemukan" },
                { status: 404 }
            );
        }

        const now = new Date();
        const timeLeftMs = order.expiresAt.getTime() - now.getTime();

        const timeLeftMinutes: number | null =
            order.status === "PENDING"
                ? Math.max(0, Math.floor(timeLeftMs / 60000))
                : null;

        const isUrgent: boolean =
            order.status === "PENDING" &&
            timeLeftMs > 0 &&
            timeLeftMs < 10 * 60 * 1000;

        const orderWithComputed: OrderWithComputed = {
            ...order,
            timeLeftMinutes,
            isUrgent,
        };

        return Response.json(
            { order: orderWithComputed } satisfies TrackOrderResponse
        );
    } catch (error: unknown) {
        console.error("Error tracking order:", error);
        return Response.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}