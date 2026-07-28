import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const cookieName = "sokcho-planner-session";

function password() {
  const value = process.env.PLANNER_PASSWORD;
  if (!value) throw new Error("PLANNER_PASSWORD is not configured");
  return value;
}
function token() { return createHmac("sha256", password()).update("sokcho-planner/v1").digest("hex"); }

export async function isAuthenticated() {
  const current = (await cookies()).get(cookieName)?.value;
  if (!current) return false;
  const expected = token();
  return current.length === expected.length && timingSafeEqual(Buffer.from(current), Buffer.from(expected));
}
export function validPassword(candidate: string) {
  const expected = password();
  return candidate.length === expected.length && timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
}
export const sessionCookie = { name: cookieName, value: () => token(), options: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: 60 * 60 * 24 * 14 } };
