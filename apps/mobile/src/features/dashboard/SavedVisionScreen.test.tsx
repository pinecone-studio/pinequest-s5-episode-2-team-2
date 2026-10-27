import { act } from "react";
import type * as React from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import SavedVisionScreen from "./SavedVisionScreen";
import { VisionSummary } from "./VisionSummary";
import { listAcuityResults, type AcuityResult } from "../../storage/acuity";
import { dashboardCopy as copy } from "./copy";
const mockParams: { id?: string; childId?: string } = {};
jest.mock("../../storage/acuity", () => ({ listAcuityResults: jest.fn() }));
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => "db" }));
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof React>("react");
  return {
    router: { back: jest.fn() },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});
jest.mock("../../components/ui", () => ({
  Text: "Text",
  Card: "Card",
  Screen: "Screen",
  Button: "Button",
}));
let renderer: ReactTestRenderer;
const result = (childId: string): AcuityResult => ({
  id: "v",
  childId,
  createdAt: "2026-10-27T00:00:00Z",
  group: "child5",
  right: 0,
  left: 0,
  refer: false,
});
async function render() {
  await act(async () => {
    renderer = create(<SavedVisionScreen />);
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.resetAllMocks();
  Object.assign(mockParams, { id: "v", childId: "b" });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});
test("the saved ID must also belong to the requested child", async () => {
  jest.mocked(listAcuityResults).mockResolvedValue([result("other")]);
  await render();
  expect(listAcuityResults).toHaveBeenCalledWith("db", "b");
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.missingVision);
});
test("a missing child never loads unassigned vision checks", async () => {
  delete mockParams.childId;
  await render();
  expect(listAcuityResults).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.missingVision);
});
test("read errors expose retry and the saved check can then be viewed", async () => {
  jest.mocked(listAcuityResults).mockRejectedValueOnce(new Error("read"));
  await render();
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.failed);
  jest.mocked(listAcuityResults).mockResolvedValueOnce([result("b")]);
  await act(async () => renderer.root.findByProps({ label: copy.retry }).props.onPress());
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.eyes.right);
  expect(JSON.stringify(renderer.toJSON())).not.toContain(copy.failed);
});

test("an old child response cannot overwrite a new route's saved result", async () => {
  let old!: (rows: AcuityResult[]) => void;
  let latest!: (rows: AcuityResult[]) => void;
  jest
    .mocked(listAcuityResults)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          old = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          latest = resolve;
        }),
    );
  await render();
  mockParams.childId = "new-child";
  await act(async () => renderer.update(<SavedVisionScreen />));
  await act(async () => latest([result("new-child")]));
  await act(async () => old([result("b")]));
  expect(renderer.root.findByType(VisionSummary).props.result.childId).toBe("new-child");
});
