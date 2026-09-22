import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Compile the actual TS/TSX source in memory; stub only external boundaries.
export function loadSource(relativePath, stubs = {}) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const nativeRequire = createRequire(filename);
    const require = (specifier) => {
      if (Object.hasOwn(stubs, specifier)) return stubs[specifier];
      if (specifier.startsWith('.')) {
        const base = path.resolve(path.dirname(filename), specifier);
        const resolved = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
        if (resolved) return load(resolved);
      }
      return nativeRequire(specifier);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    });
    new Function('require', 'module', 'exports', outputText)(require, module, module.exports);
    return module.exports;
  }
  return load(path.resolve(root, relativePath));
}
