// All onboarding text is a placeholder until the team writes the final Mongolian copy (#30).
// Copy rules: CONTRIBUTING.md "App copy" (no diagnosis, no "healthy/normal" wording).
export const onboardingPages = [
  { key: "purpose", title: "TODO(copy): Purpose title", body: "TODO(copy): What the app does" },
  {
    key: "limits",
    title: "TODO(copy): Limits title",
    body: "TODO(copy): Not a diagnosis; does not replace an eye exam",
  },
  {
    key: "privacy",
    title: "TODO(copy): Privacy title",
    body: "TODO(copy): Images never leave the phone and are not stored",
  },
  { key: "how", title: "TODO(copy): How to scan title", body: "TODO(copy): How to scan" },
] as const;

export const onboardingCopy = {
  step: (current: number, total: number) => `${current} / ${total}`,
  consent: "TODO(copy): I have read this and understand the app does not diagnose",
  next: "TODO(copy): Next",
  back: "TODO(copy): Back",
  accept: "TODO(copy): Agree and continue",
  saveError: "TODO(copy): Could not save, try again",
} as const;
