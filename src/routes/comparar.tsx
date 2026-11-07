import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/app/Editorial";

export const Route = createFileRoute("/comparar")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s["id"] === "string" ? (s["id"] as string) : "",
  }),
  head: () => ({ meta: [{ title: "Comparar preços — Mimá" }] }),
  component: Compare,
});

function Compare() {
  return (
    <div className="compare-empty px-5 pt-5 md:px-6">
      <Link
        to="/explorar"
        className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft size={16} /> Voltar
      </Link>
      <EmptyState
        title="Ainda não há produtos para comparar"
        description="As comparações aparecerão aqui quando houver produtos e preços disponíveis."
      />
      <div className="text-center">
        <Link to="/explorar" className="text-link">
          Voltar para Explorar <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
