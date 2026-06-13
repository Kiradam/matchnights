import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { StandingsPage } from "../pages/StandingsPage";
import api from "../api/axios";

vi.mock("../api/axios");

const mockData = {
  groups: [
    {
      name: "Group A",
      table: [
        { position: 1, team: "Mexico", tla: "MEX", crest: null, played: 1, won: 1, drawn: 0, lost: 0, gf: 2, ga: 0, gd: 2, points: 3, status: "in_play" },
        { position: 2, team: "South Korea", tla: "KOR", crest: null, played: 1, won: 1, drawn: 0, lost: 0, gf: 2, ga: 1, gd: 1, points: 3, status: "in_play" },
        { position: 3, team: "Czechia", tla: "CZE", crest: null, played: 1, won: 0, drawn: 0, lost: 1, gf: 1, ga: 2, gd: -1, points: 0, status: "in_play" },
        { position: 4, team: "South Africa", tla: "RSA", crest: null, played: 1, won: 0, drawn: 0, lost: 1, gf: 0, ga: 2, gd: -2, points: 0, status: "in_play" },
      ],
      matches: [
        { id: 1, home_team: "Mexico", home_team_tla: "MEX", home_team_crest: null, away_team: "South Africa", away_team_tla: "RSA", away_team_crest: null, home_score: 2, away_score: 0, match_datetime: "2026-06-11T19:00:00Z", status: "finished" },
        { id: 2, home_team: "South Korea", home_team_tla: "KOR", home_team_crest: null, away_team: "Czechia", away_team_tla: "CZE", away_team_crest: null, home_score: 2, away_score: 1, match_datetime: "2026-06-12T02:00:00Z", status: "finished" },
      ],
    },
    {
      name: "Group B",
      table: [
        { position: 1, team: "Canada", tla: "CAN", crest: null, played: 1, won: 0, drawn: 1, lost: 0, gf: 1, ga: 1, gd: 0, points: 1, status: "in_play" },
        { position: 2, team: "Bosnia", tla: "BIH", crest: null, played: 1, won: 0, drawn: 1, lost: 0, gf: 1, ga: 1, gd: 0, points: 1, status: "in_play" },
        { position: 3, team: "Qatar", tla: "QAT", crest: null, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, status: "in_play" },
        { position: 4, team: "Switzerland", tla: "SUI", crest: null, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, status: "in_play" },
      ],
      matches: [],
    },
  ],
  best_third: [
    { group: "Group A", team: "Czechia", tla: "CZE", crest: null, played: 1, gd: -1, gf: 1, points: 0, advances: true },
    { group: "Group B", team: "Qatar", tla: "QAT", crest: null, played: 0, gd: 0, gf: 0, points: 0, advances: false },
  ],
};

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <StandingsPage />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe("StandingsPage", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ data: mockData });
  });

  it("renders the page title", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Standings")).toBeInTheDocument());
  });

  it("renders all group cards", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Group A/)).toBeInTheDocument();
      expect(screen.getByText(/Group B/)).toBeInTheDocument();
    });
  });

  it("renders team TLAs in the table", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("MEX").length).toBeGreaterThan(0);
      expect(screen.getAllByText("KOR").length).toBeGreaterThan(0);
    });
  });

  it("renders correct points", async () => {
    renderPage();
    await waitFor(() => {
      const pointCells = screen.getAllByText("3");
      expect(pointCells.length).toBeGreaterThan(0);
    });
  });

  it("expands fixtures when button is clicked", async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Fixtures").length).toBeGreaterThan(0));
    const buttons = screen.getAllByText("Fixtures");
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(screen.getByText("Hide")).toBeInTheDocument());
    // fixture scores should now be visible
    expect(screen.getByText("2–0")).toBeInTheDocument();
  });

  it("collapses fixtures when clicked again", async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Fixtures").length).toBeGreaterThan(0));
    const btn = screen.getAllByText("Fixtures")[0];
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByText("Hide")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Hide"));
    await waitFor(() => expect(screen.getAllByText("Fixtures").length).toBeGreaterThan(0));
    expect(screen.queryByText("2–0")).not.toBeInTheDocument();
  });

  it("renders Best Third Place section", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Best Third Place")).toBeInTheDocument());
  });

  it("renders the legend", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Qualified / clinched")).toBeInTheDocument();
      expect(screen.getByText("In contention")).toBeInTheDocument();
      expect(screen.getByText("Eliminated")).toBeInTheDocument();
    });
  });

  it("shows error message when API fails", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network error"));
    renderPage();
    await waitFor(() => expect(screen.getByText("Failed to load standings.")).toBeInTheDocument());
  });

  it("shows loading state initially", () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
