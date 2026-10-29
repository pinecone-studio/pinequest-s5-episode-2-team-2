import { Image } from "react-native";
import { NitroModules, type HybridObject } from "react-native-nitro-modules";
import type { TfliteModel } from "react-native-fast-tflite";
import asset from "../../../assets/models/face_detection_full_range_sparse.tflite";
interface Loader extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  loadAsset(uri: string): Promise<ArrayBuffer>;
}
interface Module extends HybridObject<{ ios: "c++"; android: "c++" }> {
  createModel(bytes: ArrayBuffer, delegates: []): TfliteModel;
}

let loading: Promise<TfliteModel> | undefined;
export function loadFullRangeFace(): Promise<TfliteModel> {
  if (loading) return loading;
  loading = (async () => {
    const loader = NitroModules.createHybridObject<Loader>("AssetLoader");
    const module = NitroModules.createHybridObject<Module>("TfliteModule");
    let model: TfliteModel | undefined;
    try {
      const uri = Image.resolveAssetSource(asset)?.uri;
      if (!uri) throw new Error("Missing full-range face model");
      model = module.createModel(await loader.loadAsset(uri), []);
      if (
        model.inputs.length !== 1 ||
        model.inputs[0]?.dataType !== "float32" ||
        model.inputs[0].shape.join(",") !== "1,192,192,3" ||
        model.outputs.length !== 2 ||
        model.outputs.some(
          (t, i) => t.dataType !== "float32" || t.shape.join(",") !== ["1,2304,16", "1,2304,1"][i],
        )
      )
        throw new Error("Unexpected full-range face model contract");
      return model;
    } catch (error) {
      model?.dispose();
      throw error;
    } finally {
      loader.dispose();
      module.dispose();
    }
  })().catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
