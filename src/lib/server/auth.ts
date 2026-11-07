import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { dbQuery } from "./db";

const scrypt = promisify(scryptCallback);
const cookieName = () => process.env["SESSION_COOKIE"] || "mima_session";

export type AuthUser = { id: string; email: string; name: string; role: "user" | "admin" };

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function parseCookie(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function getUser(request: Request): Promise<AuthUser | null> {
  const sessionId = parseCookie(request, cookieName());
  if (!sessionId) return null;
  const { rows } = await dbQuery<AuthUser>(
    `SELECT u.id, u.email, u.name, u.role
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > now()`,
    [sessionId],
  );
  return rows[0] ?? null;
}

export async function createSession(userId: string) {
  const sessionId = randomBytes(32).toString("base64url");
  await dbQuery(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')",
    [sessionId, userId],
  );
  return sessionId;
}

export async function deleteSession(request: Request) {
  const sessionId = parseCookie(request, cookieName());
  if (sessionId) await dbQuery("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

export function sessionCookie(sessionId: string, maxAge = 60 * 60 * 24 * 30) {
  const secure = process.env["NODE_ENV"] === "production" ? "; Secure" : "";
  return `${cookieName()}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie() {
  return `${cookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}
