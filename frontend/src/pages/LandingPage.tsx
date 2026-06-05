import { Link } from "react-router-dom";

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
  return (
    <main
      className="min-h-screen overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(circle at 50% 30%, rgba(37, 125, 255, 0.2), rgba(37, 125, 255, 0) 36%), linear-gradient(180deg, #020917 0%, #020713 58%, #01040c 100%)",
      }}
    >
      <section className="relative mx-auto flex min-h-[76vh] w-full max-w-7xl flex-col items-center justify-center px-5 pb-8 pt-10 text-center sm:px-8 lg:px-10">
        <div
          className="w-full max-w-[780px] overflow-hidden shadow-[0_24px_80px_rgba(31,118,255,0.26)]"
          style={{ aspectRatio: "2.2 / 1" }}
        >
          <img
            src="/matchnights-logo-concept.png"
            alt="MatchNights"
            className="h-auto w-full object-contain"
          />
        </div>

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
