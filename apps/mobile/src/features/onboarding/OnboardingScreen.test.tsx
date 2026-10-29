import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import OnboardingScreen from "./OnboardingScreen";
import { onboardingCopy as copy, onboardingPages as pages } from "./copy";

const mockReplace = jest.fn();
const mockSave = jest.fn();
jest.mock("../../components/Mascot", () => ({ Mascot: "Mascot" }));
jest.mock("expo-router", () => ({ router: { replace: (to: string) => mockReplace(to) } }));
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => ({}) }));
jest.mock("./consent", () => ({ saveConsent: () => mockSave() }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("../../components/ui", () => ({ Button: "Button", Text: "Text" }));
jest.mock("react-native", () => ({
  View: "View",
  ScrollView: "ScrollView",
  Pressable: "Pressable",
  useWindowDimensions: () => ({ width: 375, height: 667 }),
  StyleSheet: { create: (styles: unknown) => styles },
}));

let renderer: ReactTestRenderer;
const button = (label: string) => renderer.root.findByProps({ label });
const press = (label: string) =>
  act(() => {
    void button(label).props.onPress();
  });
function lastPage() {
  for (let index = 1; index < pages.length; index++) press(copy.next);
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockReplace.mockReset();
  mockSave.mockReset();
  act(() => {
    renderer = create(<OnboardingScreen />);
  });
});
afterEach(() => act(() => renderer.unmount()));

test("keeps every page's text and lets parents go back with matching progress", () => {
  for (let index = 0; index < pages.length; index++) {
    expect(JSON.stringify(renderer.toJSON())).toContain(pages[index]!.body);
    expect(
      renderer.root.findByProps({ accessibilityRole: "progressbar" }).props.accessibilityValue.now,
    ).toBe(index + 1);
    if (index < pages.length - 1) press(copy.next);
  }
  press(copy.back);
  expect(JSON.stringify(renderer.toJSON())).toContain(pages[2]!.body);
  expect(mockSave).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

test("requires the checkbox and waits for consent persistence before opening Home", async () => {
  let finish!: () => void;
  mockSave.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  lastPage();
  expect(button(copy.accept).props.disabled).toBe(true);
  act(() => renderer.root.findByProps({ accessibilityRole: "checkbox" }).props.onPress());
  expect(button(copy.accept).props.disabled).toBe(false);
  press(copy.accept);
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(button(copy.accept).props.disabled).toBe(true);
  expect(button(copy.back).props.disabled).toBe(true);
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => {
    finish();
  });
  expect(mockReplace).toHaveBeenCalledWith("/");
});

test("stays on consent after a save failure and allows retry", async () => {
  mockSave.mockRejectedValueOnce(new Error("storage unavailable")).mockResolvedValueOnce(undefined);
  lastPage();
  act(() => renderer.root.findByProps({ accessibilityRole: "checkbox" }).props.onPress());
  await act(async () => {
    await button(copy.accept).props.onPress();
  });
  expect(renderer.root.findByProps({ accessibilityRole: "alert" }).props.children).toBe(
    copy.saveError,
  );
  expect(mockReplace).not.toHaveBeenCalled();
  expect(button(copy.accept).props.disabled).toBe(false);
  await act(async () => {
    await button(copy.accept).props.onPress();
  });
  expect(mockReplace).toHaveBeenCalledWith("/");
});
