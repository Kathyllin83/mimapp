import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OffersSection } from "@/components/app/OffersSection";

export const Route = createFileRoute("/ofertas")({
  head: () => ({
    meta: [
      { title: "Ofertas — Mimá" },
      {
        name: "description",
        content: "Encontre ofertas de beleza e perfumaria acompanhadas pela Mimá.",
      },
      { property: "og:title", content: "Ofertas — Mimá" },
      {
        property: "og:description",
        content: "Encontre ofertas de beleza e perfumaria acompanhadas pela Mimá.",
      },
    ],
  }),
  component: OffersPage,
});

function OffersPage() {
  const [store, setStore] = useState("all");

  return (
    <div className="offers-page">
      <OffersSection q="" store={store} onStoreChange={setStore} />
    </div>
  );
}
