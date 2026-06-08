import type { PreferenceChoice } from "../types";

export const CHOICE_I18N_KEYS: Record<PreferenceChoice, string> = {
  watch_together: "watchMode.together",
  watch: "watchMode.atHome",
  skip: "watchMode.skip",
};

export const CHOICE_DOT: Record<PreferenceChoice, string> = {
  watch_together: "bg-green-400",
  watch: "bg-blue-400",
  skip: "bg-orange-400",
};
