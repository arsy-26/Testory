import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import crypto from "crypto";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const orderRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "15 m"),
  analytics: true,
  prefix: "rl:order",
});

export async function checkOrderRateLimit(phone: string) {
  const crypto = require("crypto");
  const phoneHash = crypto
    .createHash("sha256")
    .update(phone)
    .digest("hex")
    .slice(0, 16);
  const { success, reset } = await orderRateLimit.limit(phoneHash);

  return { allowed: success, resetAt: reset ? reset * 1000 : undefined };
}

const trackRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  analytics: true,
  prefix: "rl:track",
});

export async function checkTrackRateLimit(
  trackingToken: string
): Promise<{ allowed: boolean; resetAt?: number }> {
  // Hash token sebelum dijadikan key Redis
  // supaya token asli tidak pernah tersimpan di Redis
  const tokenHash = crypto
    .createHash("sha256")
    .update(trackingToken)
    .digest("hex")
    .slice(0, 24);

  const { success, reset } = await trackRateLimit.limit(tokenHash);
  return {
    allowed: success,
    resetAt: reset ? reset * 1000 : undefined,
  };
}

export function generateOrderNumber(): string {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase(); // 5 random chars
  return `ORD-${datePart}-${randomPart}`;
}

export function generateTrackingToken(): string {
  const random = crypto.randomBytes(8).toString("hex");
  return `tk_${random}`;
}

export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[\s-]/g, "");

  if (normalized.startsWith("0")) {
    normalized = "+62" + normalized.slice(1);
  } else if (normalized.startsWith("62")) {
    normalized = "+" + normalized;
  } else if (!normalized.startsWith("+")) {
    normalized = "+62" + normalized;
  }

  return normalized;
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{7,10}$/;
  return phoneRegex.test(phone);
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}
