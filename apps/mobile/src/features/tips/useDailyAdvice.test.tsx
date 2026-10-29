import { act, useEffect } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { getDailyAdvice } from "./dailyAdvice";
import { useDailyAdvice } from "./useDailyAdvice";

let mockStateChange: (state: string) => void;
const mockRemove = jest.fn();
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
}));
jest.mock("react-native", () => ({
  AppState: {
    addEventListener: (_: string, handler: typeof mockStateChange) => {
      mockStateChange = handler;
      return { remove: mockRemove };
    },
  },
}));

let shown: ReturnType<typeof getDailyAdvice>;
let renderer: ReactTestRenderer;
function Probe() {
  shown = useDailyAdvice();
  return null;
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 29, 23, 59, 30));
  mockRemove.mockClear();
  act(() => {
    renderer = create(<Probe />);
  });
});
afterEach(() => {
  act(() => renderer.unmount());
  jest.useRealTimers();
});

test("an open Home changes at midnight and removes timer/listener on unmount", () => {
  const previous = shown;
  act(() => jest.advanceTimersByTime(30_000));
  expect(shown).toBe(getDailyAdvice(new Date()));
  expect(shown).not.toBe(previous);
  act(() => renderer.unmount());
  expect(jest.getTimerCount()).toBe(0);
  expect(mockRemove).toHaveBeenCalledTimes(1);
});

test("foregrounding after missed days refreshes without accumulating timers", () => {
  jest.setSystemTime(new Date(2026, 9, 31, 12));
  act(() => mockStateChange("active"));
  expect(shown).toBe(getDailyAdvice(new Date()));
  act(() => mockStateChange("active"));
  expect(jest.getTimerCount()).toBe(1);
});
