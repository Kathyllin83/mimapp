import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function AssistantAnswer({ text }: { text: string }) {
  return (
    <div className="assistant-answer">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          table: ({ children }) => (
            <div
              className="assistant-table-scroll"
              role="region"
              aria-label="Tabela de comparação"
              tabIndex={0}
            >
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: () => null,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
