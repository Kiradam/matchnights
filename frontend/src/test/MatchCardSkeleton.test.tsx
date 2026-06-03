import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatchCardSkeleton } from "../components/MatchCardSkeleton";

describe("MatchCardSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<MatchCardSkeleton />);
    expect(container.firstChild).not.toBeNull();
  });

  it("applies skeleton-pulse animation via inline style", () => {
    const { container } = render(<MatchCardSkeleton />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.animation).toContain("skeleton-pulse");
  });
});
