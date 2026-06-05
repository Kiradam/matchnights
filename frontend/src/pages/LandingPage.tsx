import { Link } from "react-router-dom";

const moments = [
  {
    label: "Choose fixtures",
    text: "Mark the matches that matter before kick-off.",
  },
  {
    label: "Find the crew",
    text: "See which group is ready to watch together.",
  },
  {
    label: "Make it a night",
    text: "Turn the biggest games into shared plans.",
  },
];

export function LandingPage() {
  return (
    <main
      className="min-h-screen overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(circle at 50% 30%, rgba(37, 125, 255, 0.2), rgba(37, 125, 255, 0) 36%), linear-gradient(180deg, #020917 0%, #020713 58%, #01040c 100%)",
      }}
    >
      <section className="relative mx-auto flex min-h-[78vh] w-full max-w-7xl flex-col px-5 pb-8 pt-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <span className="font-display text-lg font-black tracking-normal text-white sm:text-xl">
            Match
            <span className="bg-gradient-to-r from-[#247dff] to-[#67c8ff] bg-clip-text text-transparent">
              Nights
            </span>
          </span>
          <Link
            to="/login"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#2d8cff]/45 bg-[#0a1b3d]/70 px-4 text-sm font-bold text-white shadow-[0_0_28px_rgba(36,125,255,0.22)] transition hover:border-[#69c9ff] hover:bg-[#10295b] focus:outline-none focus:ring-2 focus:ring-[#4aa3ff]"
          >
            Sign in
          </Link>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <img
            src="/matchnights-logo-concept.png"
            alt="MatchNights"
            className="h-auto w-full max-w-[780px] object-contain drop-shadow-[0_24px_80px_rgba(31,118,255,0.26)]"
          />

          <div className="mt-6 max-w-2xl">
            <h1 className="font-display text-4xl font-black uppercase leading-none tracking-normal text-white sm:text-6xl lg:text-7xl">
              Match
              <span className="bg-gradient-to-r from-[#247dff] via-[#318cff] to-[#6dcbff] bg-clip-text text-transparent">
                Nights
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base font-medium leading-7 text-slate-300 sm:text-lg">
              Plan every kick-off, see who is watching, and turn the best
              fixtures into nights together.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-gradient-to-r from-[#126cff] to-[#5fc7ff] px-6 text-sm font-black uppercase tracking-normal text-white shadow-[0_18px_48px_rgba(18,108,255,0.32)] transition hover:from-[#247dff] hover:to-[#7bd4ff] focus:outline-none focus:ring-2 focus:ring-[#84d7ff]"
              >
                Enter MatchNights
              </Link>
              <span className="text-sm font-semibold text-[#8ba6cf]">
                Invite-only group planning
              </span>
            </div>
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
