import Image from "next/image";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChangeLogMarkdownProps = {
  content: string;
};

function trustedImageSource(source: string | undefined): string | null {
  if (!source) return null;

  try {
    const url = new URL(source);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) return null;

    const isGitHubAttachment =
      url.hostname === "github.com" &&
      /^\/user-attachments\/assets\/[a-f\d-]+$/i.test(url.pathname);
    const isLegacyGitHubImage =
      url.hostname === "user-images.githubusercontent.com" &&
      /^\/[\d]+\/[\w./-]+$/.test(url.pathname);

    return isGitHubAttachment || isLegacyGitHubImage ? url.href : null;
  } catch {
    return null;
  }
}

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
          img: ({ src, alt }) => {
            const trustedSource = trustedImageSource(typeof src === "string" ? src : undefined);
            return trustedSource ? (
              <span className="change-log-image">
                <Image
                  src={trustedSource}
                  alt={alt ?? "Pull request image"}
                  fill
                  sizes="(max-width: 768px) 100vw, 780px"
                  style={{ objectFit: "contain" }}
                />
              </span>
            ) : (
              <span className="change-log-image-omitted">
                Image omitted for privacy{alt ? `: ${alt}` : "."}
              </span>
            );
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
