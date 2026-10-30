import { transformFileSync } from "@babel/core";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";

// ts-jest leaves worklets as normal functions, hiding helpers captured before initialization.
// Compile with the app's production Babel config and inspect the values sent to the worker.
function loadCompiled(filename: string): Record<string, unknown> {
  const nativeRequire = createRequire(filename);
  const output: Record<string, unknown> = {};
  const code = transformFileSync(filename, {
    configFile: resolve(__dirname, "../../../babel.config.js"),
    envName: "production",
  })!.code!;
  runInNewContext(code, {
    exports: output,
    require: (id: string) =>
      id.startsWith(".") ? loadCompiled(resolve(dirname(filename), `${id}.ts`)) : nativeRequire(id),
  });
  return output;
}

function checkClosure(value: unknown, path: string, seen = new Set<unknown>()) {
  if (typeof value !== "function" || seen.has(value)) return;
  seen.add(value);
  const closure = (value as { __closure?: unknown[] }).__closure ?? [];
  closure.forEach((captured, index) => {
    if (captured === undefined) throw new Error(`${path} captured undefined helper ${index}`);
    checkClosure(captured, `${path} -> ${index}`, seen);
  });
}

test.each(["gestureFrame", "gesturePipeline"])(
  "%s sends initialized helpers to the camera worker in production",
  (name) => {
    const compiled = loadCompiled(resolve(__dirname, `${name}.ts`));
    for (const [key, value] of Object.entries(compiled)) checkClosure(value, key);
  },
);
