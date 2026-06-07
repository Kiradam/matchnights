import { Link, Navigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";

const moments = [
  {
    label: "Pick the matches",
    text: "Choose the fixtures your group actually wants to watch.",
  },
  {
    label: "See who’s in",
    text: "Know which friends are joining before kick-off.",
  },
  {
    label: "Make it a night",
    text: "Turn match decisions into shared plans.",
  },
];

export function LandingPage() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/matches" replace />;
  }

  return (
    <main
      className="min-h-screen overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(circle at 50% 30%, rgba(37, 125, 255, 0.2), rgba(37, 125, 255, 0) 36%), linear-gradient(180deg, #020917 0%, #020713 58%, #01040c 100%)",
      }}
    >
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
        <Link
          to="/"
          className="font-display text-lg font-black tracking-normal text-white sm:text-xl"
        >
          Match
          <span className="bg-gradient-to-r from-[#247dff] to-[#67c8ff] bg-clip-text text-transparent">
            Nights
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm font-bold">
          <Link
            className="text-[#9bb1d1] transition hover:text-white"
            to="/learn-more"
          >
            Learn More
          </Link>
          <Link
            className="rounded-lg border border-[#2d8cff]/45 bg-[#0a1b3d]/70 px-4 py-2 text-white transition hover:border-[#69c9ff] hover:bg-[#10295b]"
            to="/login"
          >
            Enter MatchNights
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto flex min-h-[76vh] w-full max-w-7xl flex-col items-center justify-center px-5 pb-8 pt-10 text-center sm:px-8 lg:px-10">
        <img
          src="/matchnights-logo-concept.png"
          alt="MatchNights"
          className="h-auto max-h-[46vh] w-full max-w-[780px] object-contain"
        />

        <div className="mt-6 w-full max-w-5xl text-center">
          <h1 className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center font-display text-4xl font-black uppercase leading-none tracking-normal text-white sm:text-5xl lg:text-6xl xl:text-7xl">
            <span>Every Match.</span>
            <span className="bg-gradient-to-r from-[#247dff] via-[#318cff] to-[#6dcbff] bg-clip-text text-transparent">
              Every Night.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base font-medium leading-7 text-slate-300 sm:text-lg">
            Plan football nights with your friends — without endless group chats.
          </p>
          <div className="mt-7 flex flex-col items-center gap-3">
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-gradient-to-r from-[#126cff] to-[#5fc7ff] px-6 text-sm font-black uppercase tracking-normal text-white shadow-[0_18px_48px_rgba(18,108,255,0.32)] transition hover:from-[#247dff] hover:to-[#7bd4ff] focus:outline-none focus:ring-2 focus:ring-[#84d7ff]"
              >
                Enter MatchNights
              </Link>
              <Link
                to="/learn-more"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#2d8cff]/45 bg-[#0a1b3d]/70 px-6 text-sm font-black uppercase tracking-normal text-white transition hover:border-[#69c9ff] hover:bg-[#10295b] focus:outline-none focus:ring-2 focus:ring-[#4aa3ff]"
              >
                Learn More
              </Link>
            </div>
            <p className="text-sm font-semibold text-[#8ba6cf]">
              Coordinate matches, groups, and watch parties.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-14 sm:px-8 lg:px-10">
        <div className="grid overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] sm:grid-cols-3">
          {moments.map((moment) => (
            <div
              key={moment.label}
              className="border-b border-white/10 p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
            >
              <h2 className="font-display text-lg font-black uppercase tracking-normal text-white">
                {moment.label}
              </h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[#9bb1d1]">
                {moment.text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
