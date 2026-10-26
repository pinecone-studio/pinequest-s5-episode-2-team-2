export type DeleteOutcome = "cancelled" | "deleted" | "failed";

export type DeleteFlowSteps = {
  /** Asks the parent to confirm; resolves true only on an explicit "delete". */
  confirm: () => Promise<boolean>;
  deleteData: () => Promise<unknown>;
  /** Called only after the data is gone, e.g. to restart at onboarding. */
  onDeleted: () => void;
};

/** Settings "delete all data" (#33): nothing is deleted without confirmation. */
export async function runDeleteFlow(steps: DeleteFlowSteps): Promise<DeleteOutcome> {
  if (!(await steps.confirm())) return "cancelled";
  try {
    await steps.deleteData();
  } catch {
    return "failed";
  }
  steps.onDeleted();
  return "deleted";
}

type AlertButton = { text: string; style?: "cancel" | "destructive"; onPress?: () => void };
export type AlertFn = (
  title: string,
  message: string,
  buttons: AlertButton[],
  options: { cancelable: boolean; onDismiss: () => void },
) => void;

/**
 * Wraps React Native's `Alert.alert` (passed in, so this file stays testable without the
 * native module). Dismissing the dialog counts as cancel.
 */
export function confirmWithAlert(
  alert: AlertFn,
  copy: { title: string; message: string; cancel: string; confirm: string },
): Promise<boolean> {
  return new Promise((resolve) => {
    alert(
      copy.title,
      copy.message,
      [
        { text: copy.cancel, style: "cancel", onPress: () => resolve(false) },
        { text: copy.confirm, style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
