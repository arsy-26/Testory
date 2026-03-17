import { NextRequest } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { getCurrentAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "products";

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      process.env.CLOUDINARY_API_SECRET!
    );

    return Response.json({
      timestamp,
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      folder,
      maxFileSize: 2 * 1024 * 1024,
      allowedFormats: ["jpg", "jpeg", "png", "webp"],
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}