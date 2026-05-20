import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "community_admin_session";

function getSecret() {
  return process.env.ADMIN_PASSWORD || "";
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

export async function isAdminSessionValid() {
  const secret = getSecret();
  if (!secret) return false;

  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return false;

  const [sessionValue, signature] = value.split(".");
  if (!sessionValue || !signature) return false;

  const expected = sign(sessionValue);
  const actualBuffer = hexToBytes(signature);
  const expectedBuffer = hexToBytes(expected);
  if (!actualBuffer || !expectedBuffer) return false;

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function setAdminSession() {
  const sessionValue = `admin-${Date.now()}`;
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, `${sessionValue}.${sign(sessionValue)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
