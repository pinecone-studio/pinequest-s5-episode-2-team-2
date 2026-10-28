const mockLoad = jest.fn(),
  mockCreate = jest.fn(),
  mockLoaderDispose = jest.fn(),
  mockModuleDispose = jest.fn();
jest.mock("react-native", () => ({
  Image: { resolveAssetSource: (n: number) => ({ uri: `asset-${n}` }) },
}));
jest.mock("react-native-nitro-modules", () => ({
  NitroModules: {
    createHybridObject: (name: string) =>
      name === "AssetLoader"
        ? { loadAsset: mockLoad, dispose: mockLoaderDispose }
        : { createModel: mockCreate, dispose: mockModuleDispose },
  },
}));
jest.mock("../../../assets/models/pose_detector.tflite", () => 1, { virtual: true });
jest.mock("../../../assets/models/pose_landmarks_detector.tflite", () => 2, { virtual: true });
jest.mock("../../../assets/models/hand_detector.tflite", () => 3, { virtual: true });
jest.mock("../../../assets/models/hand_landmarks_detector.tflite", () => 4, { virtual: true });
const model = (size: number, outputs: number[][]) => ({
  inputs: [{ dataType: "float32", shape: [1, size, size, 3] }],
  outputs: outputs.map((shape) => ({ dataType: "float32", shape })),
  dispose: jest.fn(),
  runSync: jest.fn(),
});
beforeEach(() => {
  jest.resetModules();
  jest.resetAllMocks();
  mockLoad.mockResolvedValue(new ArrayBuffer(8));
});
test("private loader fetches models sequentially and shares only the completed model cache", async () => {
  let finish!: (value: ArrayBuffer) => void;
  mockLoad.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const loaded = [
    model(224, [
      [1, 2254, 12],
      [1, 2254, 1],
    ]),
    model(256, [
      [1, 195],
      [1, 1],
      [1, 256, 256, 1],
      [1, 64, 64, 39],
      [1, 117],
    ]),
    model(192, [
      [1, 2016, 18],
      [1, 2016, 1],
    ]),
    model(224, [
      [1, 63],
      [1, 1],
      [1, 1],
      [1, 63],
    ]),
  ];
  loaded.forEach((m) => mockCreate.mockReturnValueOnce(m));
  const { loadGestureModels } = await import("./gestureModels");
  const promise = loadGestureModels();
  expect(loadGestureModels()).toBe(promise);
  expect(mockLoad).toHaveBeenCalledTimes(1);
  expect(mockCreate).not.toHaveBeenCalled();
  finish(new ArrayBuffer(8));
  expect(await promise).toEqual({
    poseDetector: loaded[0],
    pose: loaded[1],
    palm: loaded[2],
    hand: loaded[3],
  });
  expect(mockLoad.mock.calls.map((call) => call[0])).toEqual([
    "asset-1",
    "asset-2",
    "asset-3",
    "asset-4",
  ]);
  expect(mockLoaderDispose).toHaveBeenCalledTimes(1);
  expect(mockModuleDispose).toHaveBeenCalledTimes(1);
  expect(loaded[0]!.dispose).not.toHaveBeenCalled();
});
test("a mismatched model is disposed and a failed cache permits a new attempt", async () => {
  const bad = model(128, [[1, 6]]);
  mockCreate.mockReturnValue(bad);
  const { loadGestureModels } = await import("./gestureModels");
  await expect(loadGestureModels()).rejects.toThrow("contract");
  expect(bad.dispose).toHaveBeenCalledTimes(1);
  await expect(loadGestureModels()).rejects.toThrow("contract");
  expect(mockLoad).toHaveBeenCalledTimes(2);
});
