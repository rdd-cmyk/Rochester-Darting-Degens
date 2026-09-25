import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChangeLogMarkdownProps = {
  content: string;
};

export function ChangeLogMarkdown({ content }: ChangeLogMarkdownProps) {
  return (
    <div className="change-log-markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: ({ children }) => <h3>{children}</h3>,
          h2: ({ children }) => <h3>{children}</h3>,
          h3: ({ children }) => <h3>{children}</h3>,
          a: ({ href, title, children }) =>
            href ? (
              <a href={href} title={title} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          table: ({ children }) => (
            <div className="change-log-table-scroll">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
