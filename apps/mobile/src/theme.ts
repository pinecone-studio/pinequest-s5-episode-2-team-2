import type { Outcome } from "@app/core";

export const theme = {
  colors: {
    background: "#F5F7FA",
    surface: "#FFFFFF",
    text: "#172B3A",
    muted: "#526574",
    primary: "#155E75",
    onPrimary: "#FFFFFF",
    border: "#D6DFE6",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 8, md: 16 },
  typography: {
    title: { fontSize: 28, lineHeight: 36, fontWeight: "700" },
    body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
    caption: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  },
} as const;

// Keep outcome tokens aligned with the shared contract; labels must accompany colours.
export const outcomeColors = {
  REFER: { foreground: "#991B1B", background: "#FEE2E2" },
  RETAKE: { foreground: "#854D0E", background: "#FEF9C3" },
  NOT_ASSESSED: { foreground: "#334155", background: "#E2E8F0" },
  NO_VISIBLE_SIGN: { foreground: "#166534", background: "#DCFCE7" },
} satisfies Record<Outcome, { foreground: string; background: string }>;
