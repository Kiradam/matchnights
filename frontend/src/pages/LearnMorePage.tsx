import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

  const steps = [
    {
      title: t("learnMore.step1Title"),
      text: t("learnMore.step1Desc"),
    },
    {
      title: t("learnMore.step2Title"),
      text: t("learnMore.step2Desc"),
    },
    {
      title: t("learnMore.step3Title"),
      text: t("learnMore.step3Desc"),
    },
  ];

  const features = [
    {
      title: t("learnMore.supportInvite"),
      text: t("learnMore.supportInviteDesc"),
    },
    {
      title: t("learnMore.supportGroup"),
      text: t("learnMore.supportGroupDesc"),
    },
    {
      title: t("learnMore.supportPlanning"),
      text: t("learnMore.supportPlanningDesc"),
    },
    {
      title: t("learnMore.supportCalendar"),
      text: t("learnMore.supportCalendarDesc"),
    },
    {
      title: t("learnMore.supportAdmin"),
      text: t("learnMore.supportAdminDesc"),
    },
    {
      title: t("learnMore.supportWC"),
      text: t("learnMore.supportWCDesc"),
    },
  ];

  const noBettingFeatures = [
    {
      title: t("learnMore.noPrizes"),
      text: t("learnMore.noPrizesDesc"),
    },
    {
      title: t("learnMore.friendlyComp"),
      text: t("learnMore.friendlyCompDesc"),
    },
    {
      title: t("learnMore.yourRules"),
      text: t("learnMore.yourRulesDesc"),
    },
  ];

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
            {t("learnMore.home")}
          </Link>
          <Link
            className="rounded-lg border border-[#2d8cff]/45 bg-[#0a1b3d]/70 px-4 py-2 text-white transition hover:border-[#69c9ff] hover:bg-[#10295b]"
            to="/login"
          >
            {t("learnMore.enter")}
          </Link>
        </nav>
      </header>

      <section className="mx-auto w-full max-w-5xl px-5 py-16 text-center sm:px-8 lg:px-10">
        <h1 className="font-display text-4xl font-black uppercase leading-none tracking-normal text-white sm:text-5xl lg:text-6xl">
          {t("learnMore.title")}
          <span className="block bg-gradient-to-r from-[#247dff] via-[#318cff] to-[#6dcbff] bg-clip-text text-transparent">
            works
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-7 text-slate-300 sm:text-lg">
          {t("learnMore.builtForFriendsDesc")}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <PrimaryLink to="/login">{t("learnMore.enter")}</PrimaryLink>
          <SecondaryLink to="/">{t("learnMore.back")}</SecondaryLink>
        </div>
      </section>

      <Section title={t("learnMore.builtForFriends")}>
        <p className="max-w-3xl text-base font-medium leading-7 text-[#9bb1d1] sm:text-lg">
          {t("learnMore.builtForFriendsDesc")}
        </p>
      </Section>

      <Section title={t("learnMore.howItWorks")}>
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

      <Section title={t("learnMore.whyNotChat")}>
        <p className="max-w-3xl text-base font-medium leading-7 text-[#9bb1d1] sm:text-lg">
          {t("learnMore.whyNotChatDesc")}
        </p>
      </Section>

      <Section title={t("learnMore.insightsTitle")}>
        <p className="max-w-3xl text-base font-medium leading-7 text-[#9bb1d1] sm:text-lg">
          {t("learnMore.insightsDesc")}
        </p>
      </Section>

      <Section title={t("learnMore.supports")}>
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

      <Section title={t("learnMore.noBetting")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {noBettingFeatures.map((feature) => (
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

      <section className="mx-auto w-full max-w-5xl px-5 py-14 text-center sm:px-8 lg:px-10">
        <div className="rounded-lg border border-[#2d8cff]/30 bg-[#071a3a]/70 px-5 py-10 shadow-[0_22px_70px_rgba(18,108,255,0.18)]">
          <h2 className="font-display text-3xl font-black uppercase leading-none tracking-normal text-white sm:text-4xl">
            {t("learnMore.readyCta")}
            <span className="block bg-gradient-to-r from-[#247dff] via-[#318cff] to-[#6dcbff] bg-clip-text text-transparent">
              match night?
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base font-medium leading-7 text-slate-300">
            {t("learnMore.readyDesc")}
          </p>
          <div className="mt-7">
            <PrimaryLink to="/login">{t("learnMore.enter")}</PrimaryLink>
          </div>
        </div>
      </section>
    </main>
  );
}
