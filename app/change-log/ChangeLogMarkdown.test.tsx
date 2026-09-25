import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ChangeLogMarkdown } from "./ChangeLogMarkdown";

describe("ChangeLogMarkdown", () => {
  test("renders pull-request Markdown with GitHub-flavored formatting", () => {
    render(
      <ChangeLogMarkdown
        content={`## Summary
- **Improved** the \`/stats\` page.
- [x] Checked the layout

| Area | Result |
| --- | --- |
| Chart | Better |

[View details](https://github.com/rdd-cmyk/Rochester-Darting-Degens)`}
      />
    );

    expect(screen.getByRole("heading", { name: "Summary", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("Improved").tagName).toBe("STRONG");
    expect(screen.getByText("/stats").tagName).toBe("CODE");
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(within(screen.getByRole("table")).getByText("Better")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View details" })).toHaveAttribute(
      "href",
      "https://github.com/rdd-cmyk/Rochester-Darting-Degens"
    );
  });

  test("does not render raw HTML or unsafe links from a pull-request body", () => {
    const { container } = render(
      <ChangeLogMarkdown content={'<img src=x onerror=alert(1)>\n\n[Unsafe](javascript:alert(1))'} />
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("link", { name: "Unsafe" })).not.toBeInTheDocument();
    expect(screen.getByText("Unsafe")).toBeInTheDocument();
  });

  test("loads GitHub attachment images through the local image optimizer", () => {
    render(
      <ChangeLogMarkdown content="![League chart](https://github.com/user-attachments/assets/12345678-1234-1234-1234-123456789abc)" />
    );

    const image = screen.getByRole("img", { name: "League chart" });
    expect(image.getAttribute("src")).toMatch(/^\/_next\/image\?/);
    expect(image.getAttribute("src")).toContain("github.com%2Fuser-attachments%2Fassets");
  });

  test("omits untrusted, deceptive, and relative Markdown image URLs", () => {
    const { container } = render(
      <ChangeLogMarkdown
        content={`![Tracker](https://tracker.example/pixel.png)

![Deceptive](https://github.com.evil.example/user-attachments/assets/1234)

![Relative](/api/change-log)

![Query](https://github.com/user-attachments/assets/12345678-1234-1234-1234-123456789abc?redirect=1)`}
      />
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Image omitted for privacy: Tracker")).toBeInTheDocument();
    expect(screen.getByText("Image omitted for privacy: Deceptive")).toBeInTheDocument();
    expect(screen.getByText("Image omitted for privacy: Relative")).toBeInTheDocument();
    expect(screen.getByText("Image omitted for privacy: Query")).toBeInTheDocument();
  });
});
