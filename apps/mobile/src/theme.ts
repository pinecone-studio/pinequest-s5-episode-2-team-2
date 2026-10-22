import type { Outcome } from "@app/core";

export const theme = {
  colors: {
    background: "#F5F9FF",
    surface: "#FFFFFF",
    text: "#123575",
    muted: "#526C96",
    primary: "#096BE7",
    primaryPressed: "#0756BA",
    onPrimary: "#FFFFFF",
    border: "#E4EDFA",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 20, xl: 32 },
  radius: { sm: 16, md: 20, pill: 999 },
  typography: {
    title: { fontSize: 24, lineHeight: 32, fontWeight: "700" },
    body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
    caption: { fontSize: 12, lineHeight: 18, fontWeight: "400" },
  },
} as const;

// Keep outcome tokens aligned with the shared contract; labels must accompany colours.
export const outcomeColors = {
  REFER: { foreground: "#8A4B00", background: "#FFF4E3" },
  RETAKE: { foreground: "#6D28A8", background: "#F3EBFF" },
  NOT_ASSESSED: { foreground: "#455A7A", background: "#EBF0F8" },
  NO_VISIBLE_SIGN: { foreground: "#126B57", background: "#E6F8F1" },
} satisfies Record<Outcome, { foreground: string; background: string }>;
