import fs from 'node:fs';
import path from 'node:path';

const wasmPath = path.resolve(process.cwd(), 'src/wasm-pkg/time_engine_wasm_bg.wasm');
if (fs.existsSync(wasmPath)) {
  (globalThis as any).__WASM_BYTES__ = fs.readFileSync(wasmPath);
}
