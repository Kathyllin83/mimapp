import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/Editorial";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos — Mimá" },
      { name: "description", content: "Informações sobre os planos Mimá." },
      { property: "og:title", content: "Planos — Mimá" },
      {
        property: "og:description",
        content: "Informações sobre os planos Mimá.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Plans,
});

function Plans() {
  return (
    <div>
      <PageHeader title="Planos" subtitle="Informações sobre planos estarão disponíveis aqui." />
      <EmptyState
        title="Nenhum plano disponível"
        description="Os planos serão exibidos quando suas condições estiverem configuradas."
      />
    </div>
  );
}
