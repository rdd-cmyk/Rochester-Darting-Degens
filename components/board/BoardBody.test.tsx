import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BoardBody } from "./BoardBody";
it("opens exact rivalry deep links through the authenticated page", () => {
  const id = "bc000000-0000-4000-8000-000000000001";
  render(<BoardBody body={`Showdown\n/rivalries/challenges/${id}`} />);
  expect(screen.getByRole("link")).toHaveAttribute(
    "href",
    `/rivalries/challenges/${id}`,
  );
});
it("does not turn arbitrary routes, markup or malformed UUID suffixes into links", () => {
  render(
    <BoardBody
      body={
        "<script>alert(1)</script> /admin /rivalries/challenges/bc000000-0000-4000-8000-000000000001-evil"
      }
    />,
  );
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getByText(/<script>/)).toBeInTheDocument();
});
