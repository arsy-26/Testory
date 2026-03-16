import { NextRequest } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import prisma from '@/lib/prisma';

const adminProductSelect = {
    id: true,
    name: true,
    brand: true,
    status: true,
    price: true,
    stock: true,
    reserved: true,
    isActive: true,
    createdAt: true,
};

export async function GET(req: NextRequest) {
    try {
        // Auth check dengan handling error
        let admin = await getCurrentAdmin();
        if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = req.nextUrl;
        let status = searchParams.get('status');
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
        const skip = (page - 1) * limit;

        const search = searchParams.get('search');
        const brand = searchParams.get('brand');
        const includeInactive = searchParams.get('includeInactive') === 'true';

        status = status ? status.toUpperCase() : null;

        if (status && !["READY", "INCOMING", "PO"].includes(status)) {
            return Response.json({ error: "Invalid status" }, { status: 400 });
        }

        // Build where clause
        const where: any = {};
        
        if (!includeInactive) where.isActive = true;
        if (status) where.status = status;
        if (brand) where.brand = brand;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { brand: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Fetch products + total count paralel
        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take: limit,
                orderBy: [
                    { isActive: 'desc' },
                    { createdAt: 'desc' },
                ],
                select: adminProductSelect,
            }),
            prisma.product.count({ where }),
        ]);

        // Hitung available stock, pastikan tidak negatif
        const productsWithAvailable = products.map(p => ({
            ...p,
            availableStock: Math.max(0, p.stock - p.reserved),
        }));

        return Response.json({
            products: productsWithAvailable,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching admin products:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}