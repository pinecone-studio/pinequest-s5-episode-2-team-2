import { useEffect, useState } from "react";
import { File, Paths } from "expo-file-system";
import { loadTensorflowModel } from "react-native-fast-tflite";
import type { TfliteModel } from "react-native-fast-tflite";

/**
 * A bare file name means a model copied into the app's Documents folder. iOS can move that
 * folder when the app is reinstalled, so a full `file://` path copied earlier goes stale.
 */
export function resolveModelUri(source: string | undefined): string | undefined {
  if (!source || source.startsWith("file://")) return source;
  if (/^[\w.-]+\.tflite$/.test(source)) return new File(Paths.document, source).uri;
  return source;
}

export function useEyeModel(source: string | undefined) {
  const [model, setModel] = useState<TfliteModel>();
  const [error, setError] = useState(false);
  const uri = resolveModelUri(source);
  useEffect(() => {
    let live = true;
    setModel(undefined);
    setError(false);
    if (!uri) return;
    if (!uri.startsWith("file://")) {
      setError(true);
      return;
    }
    loadTensorflowModel({ url: uri }, [])
      .then((loaded) => {
        if (!live) {
          loaded.dispose();
          return;
        }
        const input = loaded.inputs[0],
          output = loaded.outputs[0];
        if (
          loaded.inputs.length !== 1 ||
          loaded.outputs.length !== 1 ||
          input?.dataType !== "float32" ||
          output?.dataType !== "float32" ||
          input.shape.join(",") !== "1,128,128,3" ||
          output.shape.join(",") !== "1,6"
        ) {
          loaded.dispose();
          setError(true);
          return;
        }
        setModel(loaded);
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, [uri]);
  return { model, error };
}
