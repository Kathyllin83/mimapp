import { hashPassword } from "../src/lib/server/auth";
import { dbQuery } from "../src/lib/server/db";

const DEFAULT_PASSWORD = "Mima123!";
const production = process.env.NODE_ENV === "production";
const password = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;

// A senha padrão está no README público: nunca usar em produção.
if (production && (password === DEFAULT_PASSWORD || password.length < 12)) {
  console.error(
    "Em produção, defina ADMIN_PASSWORD com pelo menos 12 caracteres (não use a senha padrão).",
  );
  process.exit(1);
}

const email = process.env.ADMIN_EMAIL || "root@mima.local";
const result = await dbQuery<{ id: string; email: string; name: string; role: "admin" }>(
  `INSERT INTO users (email, password_hash, name, role)
   VALUES ($1, $2, 'Kathyllin', 'admin')
   ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = 'admin', password_hash = EXCLUDED.password_hash
   RETURNING id, email, name, role`,
  [email, await hashPassword(password)],
);
console.log(result.rows[0]);
process.exit(0);
