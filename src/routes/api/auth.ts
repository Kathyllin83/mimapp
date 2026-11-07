import { createFileRoute } from "@tanstack/react-router";
import {
  createSession,
  deleteSession,
  getUser,
  hashPassword,
  json,
  sessionCookie,
  clearSessionCookie,
  verifyPassword,
} from "@/lib/server/auth";
import { dbQuery } from "@/lib/server/db";

export const Route = createFileRoute("/api/auth")({
  server: {
    handlers: {
      GET: async ({ request }) => json({ user: await getUser(request) }),
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          action?: "login" | "register";
          name?: string;
          email?: string;
          password?: string;
        };
        const email = body.email?.trim().toLowerCase();
        const password = body.password ?? "";
        if (!email || !/^\S+@\S+\.\S+$/.test(email) || password.length < 6)
          return json({ error: "E-mail ou senha inválidos" }, { status: 400 });

        if (body.action === "register") {
          if (!body.name?.trim()) return json({ error: "Nome é obrigatório" }, { status: 400 });
          const result = await dbQuery<{
            id: string;
            email: string;
            name: string;
            role: "user" | "admin";
          }>(
            `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)
             RETURNING id, email, name, role`,
            [email, await hashPassword(password), body.name.trim()],
          ).catch((error: { code?: string }) => {
            if (error.code === "23505") return null;
            throw error;
          });
          if (!result) return json({ error: "E-mail já cadastrado" }, { status: 409 });
          const user = result.rows[0]!;
          return json(
            { user },
            { headers: { "set-cookie": sessionCookie(await createSession(user.id)) } },
          );
        }

        const result = await dbQuery<{
          id: string;
          email: string;
          name: string;
          role: "user" | "admin";
          password_hash: string;
        }>("SELECT id, email, name, role, password_hash FROM users WHERE email = $1", [email]);
        const user = result.rows[0];
        if (!user || !(await verifyPassword(password, user.password_hash)))
          return json({ error: "E-mail ou senha inválidos" }, { status: 401 });
        return json(
          { user: { id: user.id, email: user.email, name: user.name, role: user.role } },
          { headers: { "set-cookie": sessionCookie(await createSession(user.id)) } },
        );
      },
      DELETE: async ({ request }) => {
        await deleteSession(request);
        return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
      },
    },
  },
});
