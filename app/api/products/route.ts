import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const VALID_STATUSES = ["READY", "INCOMING", "PO"] as const;
type ProductStatus = (typeof VALID_STATUSES)[number];

export const productPublicSelect = {
    id: true,
    name: true,
    brand: true,
    processor: true,
    ram: true,
    storage: true,
    gpu: true,
    display: true,
    originalPrice: true,
    price: true,
    status: true,
    stock: true,
    reserved: true,
    images: true,
    description: true,
    createdAt: true,
};

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;

        const rawStatus = searchParams.get("status")?.toUpperCase() as ProductStatus | null;
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

        const brand = searchParams.get("brand")?.trim() || null;

        const rawMinPrice = parseInt(searchParams.get("minPrice") || "");
        const rawMaxPrice = parseInt(searchParams.get("maxPrice") || "");
        const minPrice = isNaN(rawMinPrice) ? null : rawMinPrice;
        const maxPrice = isNaN(rawMaxPrice) ? null : rawMaxPrice;

        if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
            return Response.json(
                { error: "minPrice tidak boleh lebih besar dari maxPrice" },
                { status: 400 }
            );
        }

        const where: Parameters<typeof prisma.product.findMany>[0]["where"] = {
            isActive: true,
        };

        if (rawStatus) where.status = rawStatus;

        if (brand) {
            where.brand = { equals: brand, mode: "insensitive" };
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { brand: { contains: search, mode: "insensitive" } },
                { processor: { contains: search, mode: "insensitive" } },
            ];
        }

        if (minPrice !== null || maxPrice !== null) {
            where.price = {
                ...(minPrice !== null && { gte: minPrice }),
                ...(maxPrice !== null && { lte: maxPrice }),
            };
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: productPublicSelect,
            }),
            prisma.product.count({ where }),
        ]);

        const productsWithAvailable = products.map(({ stock, reserved, ...p }) => ({
            ...p,
            availableStock: stock - reserved,
        }));

        return Response.json({
            products: productsWithAvailable,
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
        console.error("Error fetching products:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}