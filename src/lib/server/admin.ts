import { getUser, json } from "./auth";

/** Devolve uma Response de erro (401/403) se quem chama não for administrador; senão null. */
export async function requireAdmin(request: Request): Promise<Response | null> {
  const user = await getUser(request);
  if (!user) return json({ error: "Não autenticado" }, { status: 401 });
  if (user.role !== "admin") return json({ error: "Acesso restrito" }, { status: 403 });
  return null;
}
