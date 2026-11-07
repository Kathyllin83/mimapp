import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/AppShell";
import { EmptyState } from "@/components/app/Editorial";

export const Route = createFileRoute("/dupes")({
  head: () => ({
    meta: [
      { title: "Caçadora de Dupes — Mimá" },
      {
        name: "description",
        content: "Compare produtos semelhantes quando houver dados disponíveis.",
      },
      { property: "og:title", content: "Caçadora de Dupes — Mimá" },
      {
        property: "og:description",
        content: "Informações sobre comparação de produtos semelhantes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dupes,
});

function Dupes() {
  return (
    <div>
      <PageHeader
        title="Caçadora de Dupes"
        subtitle="Alternativas semelhantes, com informações verificadas."
      />
      <EmptyState
        title="Nenhuma comparação disponível"
        description="As alternativas serão exibidas quando houver produtos analisados."
      />
    </div>
  );
}
