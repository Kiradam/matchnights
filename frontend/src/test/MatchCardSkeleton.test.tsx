import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatchCardSkeleton } from "../components/MatchCardSkeleton";

describe("MatchCardSkeleton", () => {
  it("renders three placeholder bars", () => {
    const { container } = render(<MatchCardSkeleton />);
    const bars = container.querySelectorAll(".flex-1.h-7");
    expect(bars).toHaveLength(3);
  });

  it("applies animate-pulse class", () => {
    const { container } = render(<MatchCardSkeleton />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });
});
