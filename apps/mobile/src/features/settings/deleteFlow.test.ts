import { confirmWithAlert, runDeleteFlow, type AlertFn } from "./deleteFlow";

const copy = { title: "t", message: "m", cancel: "c", confirm: "d" };

function steps(confirmed: boolean, deleteData = jest.fn(async () => {})) {
  return { confirm: jest.fn(async () => confirmed), deleteData, onDeleted: jest.fn() };
}

test("cancelling deletes nothing and stays on the screen", async () => {
  const s = steps(false);
  await expect(runDeleteFlow(s)).resolves.toBe("cancelled");
  expect(s.deleteData).not.toHaveBeenCalled();
  expect(s.onDeleted).not.toHaveBeenCalled();
});

test("confirming deletes the data, then restarts", async () => {
  const s = steps(true);
  await expect(runDeleteFlow(s)).resolves.toBe("deleted");
  expect(s.deleteData).toHaveBeenCalledTimes(1);
  expect(s.onDeleted).toHaveBeenCalledTimes(1);
});

test("a failed delete reports failure and does not restart", async () => {
  const s = steps(
    true,
    jest.fn(async () => {
      throw new Error("disk");
    }),
  );
  await expect(runDeleteFlow(s)).resolves.toBe("failed");
  expect(s.onDeleted).not.toHaveBeenCalled();
});

test("the dialog resolves true only for the destructive button", async () => {
  const press =
    (index: number): AlertFn =>
    (_t, _m, buttons) =>
      buttons[index]?.onPress?.();
  await expect(confirmWithAlert(press(0), copy)).resolves.toBe(false);
  await expect(confirmWithAlert(press(1), copy)).resolves.toBe(true);

  let shown: Parameters<AlertFn> | undefined;
  const capture: AlertFn = (...args) => {
    shown = args;
  };
  const pending = confirmWithAlert(capture, copy);
  expect(shown?.[2].map((b) => b.style)).toEqual(["cancel", "destructive"]);
  shown?.[3].onDismiss();
  await expect(pending).resolves.toBe(false);
});
