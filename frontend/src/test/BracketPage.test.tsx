import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { BracketPage, orderChildRound } from "../pages/BracketPage";
import type { BracketMatch } from "../types";
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

const predictions = [
  { id: 99, user_id: 1, match_id: 1, home_goals: 2, away_goals: 1, predicted_outcome: "home_win",
    predicted_qualifier: null, boosted: false, submitted_at: "2026-06-27T00:00:00Z", locked_at: null,
    points_awarded: null, base_points: null, evaluated_at: null, points_reason: null, state: "tip_locked" },
];

function mockApi(bracket = mockData) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === "/predictions") return Promise.resolve({ data: predictions } as never);
    return Promise.resolve({ data: bracket } as never);
  });
}

describe("BracketPage", () => {
  beforeEach(() => {
    mockApi();
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

  it("clicking a team opens a bubble with kickoff/result and tip status", async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText("BRA").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("BRA")[0]);
    await waitFor(() => {
      // Match 1 (Brazil 2–0 Japan) is finished and the user tipped 2–1
      expect(screen.getByText(/Full time/)).toBeInTheDocument();
      expect(screen.getByText(/Your tip/)).toBeInTheDocument();
    });
  });

  it("orders children so positional pairing matches real feeders", () => {
    // Children listed by external_id (ids 1..6), NOT bracket order. Parents pull
    // their true feeders (5,6 then 1,2) to the front so pairing 2i/2i+1 is correct.
    const children = [1, 2, 3, 4, 5, 6].map((id) => ({ id })) as never as BracketMatch[];
    const parents = [
      { home_source_match_id: 5, away_source_match_id: 6 },
      { home_source_match_id: 1, away_source_match_id: 2 },
    ] as BracketMatch[];
    expect(orderChildRound(parents, children).map((c) => c.id)).toEqual([5, 6, 1, 2, 3, 4]);
  });

  it("keeps children in original order under still-TBD parents", () => {
    const children = [10, 11].map((id) => ({ id })) as never as BracketMatch[];
    const parents = [{ home_source_match_id: null, away_source_match_id: null }] as BracketMatch[];
    expect(orderChildRound(parents, children).map((c) => c.id)).toEqual([10, 11]);
  });

  it("shows error state when the request fails", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => expect(screen.getByText("Failed to load bracket.")).toBeInTheDocument());
  });
});
