// Placeholders until the team writes the final Mongolian copy (CONTRIBUTING.md "App copy").
export const historyCopy = {
  title: "TODO(copy): History",
  noChild: "TODO(copy): Add a child profile to keep a history",
  empty: "TODO(copy): No saved scans yet",
  scans: (n: number) => `${n} TODO(copy): scans`,
  failed: "TODO(copy): Could not load the history. Try again.",
  retry: "TODO(copy): Retry",
  open: "TODO(copy): Open scan details",
  detail: {
    title: "TODO(copy): Scan details",
    missing: "TODO(copy): This scan no longer exists",
    frames: (used: number, total: number) => `TODO(copy): Frames used: ${used} / ${total}`,
    score: "TODO(copy): Asymmetry score (a measurement, not a diagnosis)",
    back: "TODO(copy): Back",
    delete: "TODO(copy): Delete scan",
    confirmTitle: "TODO(copy): Delete this scan?",
    confirmBody: "TODO(copy): It cannot be restored.",
    cancel: "TODO(copy): Cancel",
    deleteFailed: "TODO(copy): Could not delete. Try again.",
  },
} as const;
