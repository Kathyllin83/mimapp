import { hashPassword } from "../src/lib/server/auth";
import { dbQuery } from "../src/lib/server/db";

const password = process.env.ADMIN_PASSWORD || "Mima123!";
const result = await dbQuery<{ id: string; email: string; name: string; role: "admin" }>(
  `INSERT INTO users (email, password_hash, name, role)
   VALUES ('root@mima.local', $1, 'Kathyllin', 'admin')
   ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = 'admin'
   RETURNING id, email, name, role`,
  [await hashPassword(password)],
);
console.log(result.rows[0]);
