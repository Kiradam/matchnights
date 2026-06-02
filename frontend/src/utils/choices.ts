import type { PreferenceChoice } from "../types";

export const CHOICE_LABELS: Record<PreferenceChoice, string> = {
  watch_together: "Together",
  watch: "Watch",
  skip: "Skip",
};

export const CHOICE_DOT: Record<PreferenceChoice, string> = {
  watch_together: "bg-green-400",
  watch: "bg-blue-400",
  skip: "bg-gray-300 dark:bg-gray-600",
};
