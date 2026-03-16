"use server";

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/auth";
import { loginSchema } from "@/validations/auth/login.schema";

export async function adminLoginAction(
    prevState: any,
    formData: FormData
) {
    try {
        const data = {
            email: formData.get("email"),
            password: formData.get("password"),
        };

        const validation = loginSchema.safeParse(data);

        if (!validation.success) {
            return {
                success: false,
                message: "Validation failed",
                errors: validation.error.flatten().fieldErrors,
            };
        }

        const { email, password } = validation.data;

        const admin = await prisma.admin.findUnique({
            where: { email },
        });

        if (!admin) {
            return {
                success: false,
                message: "Email atau password salah",
            };
        }

        const isValid = await bcrypt.compare(password, admin.password);

        if (!isValid) {
            return {
                success: false,
                message: "Email atau password salah",
            };
        }

        const token = generateToken({
            adminId: admin.id,
            email: admin.email,
        });

        const cookieStore = await cookies();

        cookieStore.set("admin_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7,
        });

        return {
            success: true,
            message: "Login berhasil",
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
            },
        };
    } catch (error) {
        console.error("Login error:", error);

        return {
            success: false,
            message: "Internal server error",
        };
    }
}