import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// SWC is needed because esbuild does not emit decorator metadata, which Nest's DI relies on.
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" }, jsc: { parser: { syntax: "typescript", decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true } } })],
  test: { include: ["test/**/*.test.ts"], environment: "node", testTimeout: 20000 },
});
