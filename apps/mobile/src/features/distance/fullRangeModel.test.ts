export {};
const mockLoad = jest.fn(),
  mockCreate = jest.fn(),
  mockLoaderDispose = jest.fn(),
  mockModuleDispose = jest.fn();
jest.mock("react-native", () => ({
  Image: { resolveAssetSource: () => ({ uri: "local-model" }) },
}));
jest.mock("react-native-nitro-modules", () => ({
  NitroModules: {
    createHybridObject: (name: string) =>
      name === "AssetLoader"
        ? { loadAsset: mockLoad, dispose: mockLoaderDispose }
        : { createModel: mockCreate, dispose: mockModuleDispose },
  },
}));
jest.mock("../../../assets/models/face_detection_full_range_sparse.tflite", () => 1, {
  virtual: true,
});
const model = (size = 192) => ({
  inputs: [{ dataType: "float32", shape: [1, size, size, 3] }],
  outputs: [
    { dataType: "float32", shape: [1, 2304, 16] },
    { dataType: "float32", shape: [1, 2304, 1] },
  ],
  dispose: jest.fn(),
});
beforeEach(() => {
  jest.resetModules();
  jest.resetAllMocks();
  mockLoad.mockResolvedValue(new ArrayBuffer(8));
});
test("private asset load validates the full-range contract and shares one completed model", async () => {
  const good = model();
  mockCreate.mockReturnValue(good);
  const { loadFullRangeFace } = await import("./fullRangeModel");
  const loading = loadFullRangeFace();
  expect(loadFullRangeFace()).toBe(loading);
  expect(await loading).toBe(good);
  expect(mockLoad).toHaveBeenCalledTimes(1);
  expect(mockLoaderDispose).toHaveBeenCalledTimes(1);
  expect(mockModuleDispose).toHaveBeenCalledTimes(1);
  expect(good.dispose).not.toHaveBeenCalled();
});
test("wrong input or output contracts are disposed and a failed cache can retry", async () => {
  const bad = model(128);
  mockCreate.mockReturnValueOnce(bad);
  const wrongOutput = model();
  wrongOutput.outputs[0]!.shape = [1, 896, 16];
  mockCreate.mockReturnValueOnce(wrongOutput);
  const { loadFullRangeFace } = await import("./fullRangeModel");
  await expect(loadFullRangeFace()).rejects.toThrow("contract");
  await expect(loadFullRangeFace()).rejects.toThrow("contract");
  expect(bad.dispose).toHaveBeenCalledTimes(1);
  expect(wrongOutput.dispose).toHaveBeenCalledTimes(1);
  expect(mockLoad).toHaveBeenCalledTimes(2);
});
