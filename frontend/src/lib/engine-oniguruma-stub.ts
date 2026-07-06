// Stub for @shikijs/engine-oniguruma.
// @streamdown/code already uses createJavaScriptRegexEngine — WASM is never called at runtime.
// This stub prevents the 608 kB onig.wasm from being bundled.
export function createOnigurumaEngine(): never {
  throw new Error('oniguruma engine not available; JS engine is used instead');
}
export function loadWasm(): Promise<void> {
  return Promise.resolve();
}
export function getDefaultWasmLoader(): null {
  return null;
}
export function setDefaultWasmLoader(): void {}
