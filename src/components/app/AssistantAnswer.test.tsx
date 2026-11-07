import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssistantAnswer } from "./AssistantAnswer";

describe("AssistantAnswer", () => {
  it("renders comparison tables, headings and lists from the assistant response", () => {
    render(
      <AssistantAnswer
        text={[
          "| Perfume | Observações |",
          "| --- | --- |",
          "| **Exemplo** | Confira as notas oficiais. |",
          "",
          "### Como escolher",
          "1. Teste uma amostra.",
        ].join("\n")}
      />,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Perfume" })).toBeInTheDocument();
    expect(screen.getByText("Exemplo").tagName).toBe("STRONG");
    expect(screen.getByRole("heading", { name: "Como escolher" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("Teste uma amostra.");
  });

  it("does not render model-provided HTML, remote images or executable links", () => {
    const { container } = render(
      <AssistantAnswer
        text={
          "<script>alert(1)</script>\n\n[Link](javascript:alert%281%29)\n\n![Imagem](https://example.com/tracker.png)"
        }
      />,
    );
    expect(container.querySelector("script, img")).toBeNull();
    expect(screen.getByText("Link")).not.toHaveAttribute(
      "href",
      expect.stringContaining("javascript:"),
    );
  });
});
