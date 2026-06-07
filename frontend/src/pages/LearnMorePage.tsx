import type { ReactNode } from "react";
import { Link } from "react-router-dom";

const steps = [
  {
    title: "1. Pick the matches",
    text: "Choose the fixtures you care about before kick-off.",
  },
  {
    title: "2. See who’s in",
    text: "Check which friends want to watch the same match.",
  },
  {
    title: "3. Make it a night",
    text: "Turn match preferences into shared plans.",
  },
];

const features = [
  {
    title: "Invite-only access",
    text: "No public sign-ups. Groups are managed through invitations.",
  },
  {
    title: "Group preferences",
    text: "See what your friends want to watch in each group.",
  },
  {
    title: "Match planning",
    text: "Keep football nights organized around real fixtures.",
  },
  {
    title: "Calendar-friendly",
    text: "Designed to make upcoming matches easier to follow.",
  },
  {
    title: "Admin-managed groups",
    text: "Group access and invitations stay controlled.",
  },
  {
    title: "World Cup ready",
    text: "Built with football tournaments and shared viewing in mind.",
  },
];

function PrimaryLink({ children, to }: { children: string; to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-12 items-center justify-center rounded-lg bg-gradient-to-r from-[#126cff] to-[#5fc7ff] px-6 text-sm font-black uppercase tracking-normal text-white shadow-[0_18px_48px_rgba(18,108,255,0.32)] transition hover:from-[#247dff] hover:to-[#7bd4ff] focus:outline-none focus:ring-2 focus:ring-[#84d7ff]"
    >
      {children}
    </Link>
  );
}

function SecondaryLink({ children, to }: { children: string; to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#2d8cff]/45 bg-[#0a1b3d]/70 px-6 text-sm font-black uppercase tracking-normal text-white transition hover:border-[#69c9ff] hover:bg-[#10295b] focus:outline-none focus:ring-2 focus:ring-[#4aa3ff]"
    >
      {children}
    </Link>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
      <h2 className="font-display text-2xl font-black uppercase tracking-normal text-white sm:text-3xl">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function LearnMorePage() {
  return (
    <main
      className="min-h-screen overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(circle at 50% 18%, rgba(37, 125, 255, 0.22), rgba(37, 125, 255, 0) 34%), linear-gradient(180deg, #020917 0%, #020713 58%, #01040c 100%)",
      }}
    >
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
        <Link to="/" className="font-display text-lg font-black tracking-normal text-white sm:text-xl">
          Match
          <span className="bg-gradient-to-r from-[#247dff] to-[#67c8ff] bg-clip-text text-transparent">
            Nights
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm font-bold">
          <Link className="text-[#9bb1d1] transition hover:text-white" to="/">
            Home
          </Link>
          <Link
            className="rounded-lg border border-[#2d8cff]/45 bg-[#0a1b3d]/70 px-4 py-2 text-white transition hover:border-[#69c9ff] hover:bg-[#10295b]"
            to="/login"
          >
            Enter MatchNights
          </Link>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-5xl px-5 py-16 text-center sm:px-8 lg:px-10">
        <h1 className="font-display text-4xl font-black uppercase leading-none tracking-normal text-white sm:text-5xl lg:text-6xl">
          How MatchNights
          <span className="block bg-gradient-to-r from-[#247dff] via-[#318cff] to-[#6dcbff] bg-clip-text text-transparent">
            works
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-7 text-slate-300 sm:text-lg">
          MatchNights helps private groups of friends coordinate which football
          matches they want to watch together — without endless group chat
          confusion.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <PrimaryLink to="/login">Enter MatchNights</PrimaryLink>
          <SecondaryLink to="/">Back to home</SecondaryLink>
        </div>
      </section>

      <Section title="Built for friend groups">
        <p className="max-w-3xl text-base font-medium leading-7 text-[#9bb1d1] sm:text-lg">
          MatchNights is invite-only by design. Each group has its own shared
          space to pick matches, compare preferences, and plan football nights
          together.
        </p>
      </Section>

      <Section title="How it works">
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <article
              key={step.title}
              className="rounded-lg border border-white/10 bg-white/[0.06] p-5"
            >
              <h3 className="font-display text-lg font-black uppercase tracking-normal text-white">
                {step.title}
              </h3>
              <p className="mt-2 text-sm font-medium leading-6 text-[#9bb1d1]">
                {step.text}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Why not just use a group chat?">
        <p className="max-w-3xl text-base font-medium leading-7 text-[#9bb1d1] sm:text-lg">
          Group chats are great for conversation. They are not great for
          coordination. MatchNights gives every group a clear place to see match
          preferences without scrolling through old messages.
        </p>
      </Section>

      <Section title="What MatchNights supports">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-lg border border-white/10 bg-white/[0.05] p-5"
            >
              <h3 className="font-display text-base font-black uppercase tracking-normal text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm font-medium leading-6 text-[#9bb1d1]">
                {feature.text}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="No betting. Just friendly competition.">
        <div className="max-w-3xl space-y-4 text-base font-medium leading-7 text-[#9bb1d1] sm:text-lg">
          <p>
            MatchNights is not a betting platform and there are no prizes,
            payouts, or gambling features.
          </p>
          <p>
            The goal is simple: make predictions, compare opinions, and enjoy
            match nights with your friends.
          </p>
          <p>
            If your group wants to celebrate the best predictor with a high
            five, a coffee, or bragging rights, that's entirely up to you —
            MatchNights is only here to make the experience more fun and
            organized.
          </p>
        </div>
      </Section>

      <Section title="How match prediction insights work">
        <div className="max-w-3xl space-y-4 text-base font-medium leading-7 text-[#9bb1d1] sm:text-lg">
          <p>
            The prediction insights shown in MatchNights are based on publicly
            available market data and probability calculations.
          </p>
          <p>
            Instead of displaying complex numbers, we convert those estimates
            into simple win, draw, and away-win probabilities that are easier to
            understand and discuss with friends.
          </p>
          <p>
            They're not guarantees and they're not betting advice — they're
            simply a helpful way to spark conversation and compare opinions
            before kickoff.
          </p>
        </div>
      </Section>

      <section className="mx-auto w-full max-w-5xl px-5 py-14 text-center sm:px-8 lg:px-10">
        <div className="rounded-lg border border-[#2d8cff]/30 bg-[#071a3a]/70 px-5 py-10 shadow-[0_22px_70px_rgba(18,108,255,0.18)]">
          <h2 className="font-display text-3xl font-black uppercase leading-none tracking-normal text-white sm:text-4xl">
            Ready for the next
            <span className="block bg-gradient-to-r from-[#247dff] via-[#318cff] to-[#6dcbff] bg-clip-text text-transparent">
              match night?
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base font-medium leading-7 text-slate-300">
            Start with your group, pick the matches, and make every night count.
          </p>
          <div className="mt-7">
            <PrimaryLink to="/login">Enter MatchNights</PrimaryLink>
          </div>
        </div>
      </section>
    </main>
  );
}
