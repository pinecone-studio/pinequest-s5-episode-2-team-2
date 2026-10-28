import { Image } from "react-native";
import { NitroModules, type HybridObject } from "react-native-nitro-modules";
import type { TfliteModel } from "react-native-fast-tflite";
import poseDetector from "../../../assets/models/pose_detector.tflite";
import pose from "../../../assets/models/pose_landmarks_detector.tflite";
import palm from "../../../assets/models/hand_detector.tflite";
import hand from "../../../assets/models/hand_landmarks_detector.tflite";
import type { GestureModels } from "./gestureFrame";

interface Loader extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  loadAsset(uri: string): Promise<ArrayBuffer>;
}
interface Module extends HybridObject<{ ios: "c++"; android: "c++" }> {
  createModel(bytes: ArrayBuffer, delegates: []): TfliteModel;
}
let loading: Promise<GestureModels> | undefined;

/** One bounded model cache; no camera data. A private AssetLoader avoids the shared-load race. */
export function loadGestureModels(): Promise<GestureModels> {
  if (loading) return loading;
  loading = (async () => {
    const loader = NitroModules.createHybridObject<Loader>("AssetLoader");
    const module = NitroModules.createHybridObject<Module>("TfliteModule");
    const loaded: TfliteModel[] = [];
    const specs = [
      [poseDetector, 224, ["1,2254,12", "1,2254,1"]],
      [pose, 256, ["1,195", "1,1", "1,256,256,1", "1,64,64,39", "1,117"]],
      [palm, 192, ["1,2016,18", "1,2016,1"]],
      [hand, 224, ["1,63", "1,1", "1,1", "1,63"]],
    ] as const;
    try {
      for (const [asset, size, shapes] of specs) {
        const uri = Image.resolveAssetSource(asset)?.uri;
        if (!uri) throw new Error("Missing gesture model asset");
        const model = module.createModel(await loader.loadAsset(uri), []);
        loaded.push(model);
        if (
          model.inputs.length !== 1 ||
          model.inputs[0]?.dataType !== "float32" ||
          model.inputs[0].shape.join(",") !== `1,${size},${size},3` ||
          model.outputs.length !== shapes.length ||
          model.outputs.some(
            (tensor, i) => tensor.dataType !== "float32" || tensor.shape.join(",") !== shapes[i],
          )
        )
          throw new Error("Unexpected gesture model contract");
      }
      return { poseDetector: loaded[0]!, pose: loaded[1]!, palm: loaded[2]!, hand: loaded[3]! };
    } catch (error) {
      loaded.forEach((model) => model.dispose());
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
