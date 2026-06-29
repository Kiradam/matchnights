import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { BracketPage } from "../pages/BracketPage";
import api from "../api/axios";

vi.mock("../api/axios");

function team(name: string, tla: string, score: number | null = null, tbd = false) {
  return { name, tla, crest: null, score, is_tbd: tbd };
}

const mockData = {
  rounds: [
    {
      key: "r32", name: "Round of 32", matches: [
        { id: 1, stage: "Round of 32", match_datetime: "2026-06-28T19:00:00Z", status: "finished",
          home: team("Brazil", "BRA", 2), away: team("Japan", "JPN", 0),
          home_source_match_id: null, away_source_match_id: null },
        { id: 2, stage: "Round of 32", match_datetime: "2026-06-29T19:00:00Z", status: "finished",
          home: team("France", "FRA", 1), away: team("Sweden", "SWE", 0),
          home_source_match_id: null, away_source_match_id: null },
      ],
    },
    {
      key: "r16", name: "Round of 16", matches: [
        { id: 3, stage: "Round of 16", match_datetime: "2026-07-04T19:00:00Z", status: "scheduled",
          home: team("Brazil", "BRA"), away: team("France", "FRA"),
          home_source_match_id: 1, away_source_match_id: 2 },
      ],
    },
    { key: "qf", name: "Quarter-finals", matches: [] },
    { key: "sf", name: "Semi-finals", matches: [] },
    { key: "final", name: "Final", matches: [] },
    { key: "third", name: "Third place", matches: [] },
  ],
};

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <BracketPage />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe("BracketPage", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ data: mockData });
  });

  it("renders the title", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Knockout Bracket")).toBeInTheDocument());
  });

  it("renders team nodes with TLAs", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("BRA").length).toBeGreaterThan(0);
      expect(screen.getAllByText("JPN").length).toBeGreaterThan(0);
    });
  });

  it("populates the team picker with non-TBD R32 teams", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Brazil")).toBeInTheDocument());
    // Brazil, France, Japan, Sweden as <option>s
    expect(screen.getByRole("option", { name: "Brazil" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sweden" })).toBeInTheDocument();
  });

  it("selecting a team via the picker shows the Clear button", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Knockout Bracket")).toBeInTheDocument());
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "Brazil" } });
    await waitFor(() => expect(screen.getByText("Clear")).toBeInTheDocument());
  });

  it("shows error state when the request fails", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => expect(screen.getByText("Failed to load bracket.")).toBeInTheDocument());
  });
});
