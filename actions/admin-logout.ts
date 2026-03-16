"use server";

import { cookies } from "next/headers";

type LogoutState = {
    success: boolean;
    message: string;
};

export async function adminLogoutAction(): Promise<LogoutState> {
    try {
        const cookieStore = await cookies();
        cookieStore.delete("admin_token");

        return {
            success: true,
            message: "Logout berhasil",
        };
    } catch (error) {
        console.error("Logout error:", error);

        return {
            success: false,
            message: "Internal server error",
        };
    }
}