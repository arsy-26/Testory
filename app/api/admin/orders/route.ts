import { NextRequest } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";

const VALID_STATUSES = [
    "PENDING",
    "CONFIRMED",
    "EXPIRED",
    "CANCELLED",
    "COMPLETED",
] as const;

type OrderStatus = typeof VALID_STATUSES[number];

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const STATUS_ORDER: Record<OrderStatus, number> = {
    PENDING: 0,
    CONFIRMED: 1,
    COMPLETED: 2,
    CANCELLED: 3,
    EXPIRED: 4,
};

export async function GET(req: NextRequest) {
    try {
        const admin = await getCurrentAdmin();
        if (!admin) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = req.nextUrl;

        const rawStatus = searchParams.get("status")?.toUpperCase() as OrderStatus | null;
        if (rawStatus && !VALID_STATUSES.includes(rawStatus)) {
            return Response.json(
                {
                    error: "Invalid status",
                    validValues: VALID_STATUSES,
                },
                { status: 400 }
            );
        }

        const rawPage = parseInt(searchParams.get("page") || String(DEFAULT_PAGE));
        const rawLimit = parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT));

        const page = isNaN(rawPage) || rawPage < 1 ? DEFAULT_PAGE : rawPage;
        const limit = isNaN(rawLimit) || rawLimit < 1
            ? DEFAULT_LIMIT
            : Math.min(rawLimit, MAX_LIMIT);

        const skip = (page - 1) * limit;

        const search = searchParams.get("search")?.trim() || null;

        const where: Parameters<typeof prisma.order.findMany>[0]["where"] = {};

        if (rawStatus) where.status = rawStatus;

        if (search) {
            where.OR = [
                { orderNumber: { contains: search, mode: "insensitive" } },
                { customerName: { contains: search, mode: "insensitive" } },
                { customerPhone: { contains: search } },
            ];
        }

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take: limit,
                orderBy: [
                    { createdAt: "desc" },
                ],
                select: {
                    id: true,
                    orderNumber: true,
                    customerName: true,
                    customerPhone: true,
                    notes: true,
                    totalAmount: true,
                    status: true,
                    expiresAt: true,
                    confirmedAt: true,
                    completedAt: true,
                    createdAt: true,
                    updatedAt: true,
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
                                },
                            },
                        },
                    },
                },
            }),
            prisma.order.count({ where }),
        ]);

        const now = new Date();

        const ordersWithExtras = orders
            .map((order) => {
                const timeLeftMs = order.expiresAt.getTime() - now.getTime();

                return {
                    ...order,
                    timeLeftMinutes:
                        order.status === "PENDING"
                            ? Math.max(0, Math.floor(timeLeftMs / 60000))
                            : null,
                    isUrgent:
                        order.status === "PENDING" && timeLeftMs > 0 && timeLeftMs < 10 * 60 * 1000,
                    totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
                };
            })
            .sort((a, b) => {
                const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
                if (statusDiff !== 0) return statusDiff;
                if (a.status === "PENDING") {
                    return a.expiresAt.getTime() - b.expiresAt.getTime();
                }
                return 0;
            });

        return Response.json({
            orders: ordersWithExtras,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1,
            },
        });
    } catch (error) {
        console.error("Error fetching orders:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}