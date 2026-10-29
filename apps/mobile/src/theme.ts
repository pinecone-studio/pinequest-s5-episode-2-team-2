import type { Outcome } from "@app/core";

// Design follows the web demo (#152): Nunito, a bright blue palette, pill buttons, soft cards.
// The font files and their licence (SIL OFL 1.1) are in assets/fonts.
export const fonts = {
  medium: "Nunito-Medium",
  bold: "Nunito-Bold",
  extraBold: "Nunito-ExtraBold",
  black: "Nunito-Black",
} as const;

export const theme = {
  colors: {
    background: "#F6F3FF",
    surface: "#FFFFFF",
    text: "#2A1F4F",
    muted: "#655D88",
    primary: "#6C4FD1",
    primaryPressed: "#5A3FBD",
    primarySoft: "#EFEAFF",
    onPrimary: "#FFFFFF",
    border: "#E2D9FF",
    notice: "#FFF6E0",
    onNotice: "#5C3D00",
    danger: "#B91C1C",
    /** Start-screen gradient below `primary`: lavender, fading to the page colour. */
    heroMid: "#8F72E0",
    heroEnd: "#FFF6EA",
    /** Pastel accents from the mascot design: mint and cream discs and tiles. */
    mint: "#DDF6EC",
    cream: "#FFF6E6",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 20, xl: 32 },
  radius: { sm: 16, md: 28, pill: 999 },
  typography: {
    title: { fontFamily: fonts.black, fontSize: 26, lineHeight: 32, fontWeight: "900" },
    body: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 24, fontWeight: "500" },
    caption: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  },
  /** Soft blue drop shadow used by cards and buttons. */
  shadow: {
    shadowColor: "#6C4FD1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 2,
  },
} as const;

// Keep outcome tokens aligned with the shared contract; labels must accompany colours.
// Hues from the web demo's verdicts, darkened where needed for text contrast.
export const outcomeColors = {
  REFER: { foreground: "#B23A35", background: "#FFF7F6" },
  RETAKE: { foreground: "#8A5A00", background: "#FFF8E8" },
  NOT_ASSESSED: { foreground: "#5B6B8C", background: "#EEF2F8" },
  NO_VISIBLE_SIGN: { foreground: "#17734B", background: "#EEFAF4" },
} satisfies Record<Outcome, { foreground: string; background: string }>;
