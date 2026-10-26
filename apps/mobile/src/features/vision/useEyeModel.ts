import { useEffect, useState } from "react";
import { loadTensorflowModel } from "react-native-fast-tflite";
import type { TfliteModel } from "react-native-fast-tflite";

export function useEyeModel(uri: string | undefined) {
  const [model, setModel] = useState<TfliteModel>();
  const [error, setError] = useState(false);
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
