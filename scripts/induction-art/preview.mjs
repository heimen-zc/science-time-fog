// Local, dependency-free art review. The output is not imported by the site.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const HERE = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(resolve(HERE, "generated/geometry.json"), "utf8"));
const original = readFileSync(resolve(HERE, "../../components/induction-bench.tsx"), "utf8");
// Transpile the real component, substituting its static local JSON import.
const source = original.replace(/^import[\s\S]*?from ['"]\.\.\/lib\/induction-bench-geometry['"];\s*/gm, "")
  .replace(/^import ['"][^'"]+\.css['"];\s*/gm, "");
const js = ts.transpileModule(`const BENCH_GEOMETRY = ${JSON.stringify(data)};\n${source}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
}).outputText;
const modulePath = resolve(HERE, "generated/preview-component.mjs");
writeFileSync(modulePath, js);
const { InductionBench } = await import(pathToFileURL(modulePath).href + `?v=${Date.now()}`);
const markup = renderToStaticMarkup(React.createElement(InductionBench));
const css = readFileSync(resolve(HERE, "bench.css"), "utf8");
const binder = js.slice(js.indexOf("const bounded"));
const state = { closed: 0, polarity: 1, needle: 0, flux: 0, field: false, primary: 0, secondary: 0 };
const script = `const BENCH_GEOMETRY = ${JSON.stringify(data)};\n${binder}\n
const drawBench = bindBench(document);
window.benchFrame = ${JSON.stringify(state)};
window.setBenchFrame = (next) => { Object.assign(window.benchFrame, next); drawBench(window.benchFrame); };
setBenchFrame({});
const scale = document.querySelector('[data-scale]');
window.setBenchTheme = (theme) => { document.documentElement.dataset.theme = theme; };
document.addEventListener('keydown', (event) => {
 if (event.key === '1') setBenchFrame({closed:0,needle:0,flux:0,field:false,primary:0,secondary:0});
 if (event.key === '2') setBenchFrame({closed:1,needle:0,flux:1,field:true,primary:1,secondary:0});
 if (event.key === '3') setBenchFrame({closed:.5,needle:-.8,flux:-.55,field:true,polarity:-1});
});`;
for (const theme of ["dark", "light"]) {
  const page = `<!doctype html><html lang="zh-CN" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Induction bench — art proof</title><style>
html{background:#0d1625;color:#a5b5c6;font:12px system-ui;}body{margin:0;min-height:100vh;display:grid;place-items:center;}main{width:min(1100px,100%);} .iso-plate{background:#121d2d;border:1px solid #334153;border-radius:18px;overflow:hidden;} .preview-caption{padding:12px 20px;display:flex;justify-content:space-between;letter-spacing:.08em;font-size:10px;} [data-theme=light]{background:#eff1ed;color:#495b62;}[data-theme=light] .iso-plate{background:#e6eae5;border-color:#bfc7c1;}
${css}</style><main><div class="iso-plate"><div class="preview-caption"><span>FIG. 01 · FARADAY INDUCTION RING</span><span>ART / GEOMETRY PROOF</span></div>${markup}<div class="preview-caption"><span>1 REST · 2 STEADY FIELD · 3 REVERSE / HALF SWITCH</span><span data-readout>1 shared annulus · 2 isolated circuits</span></div></div></main><script type="module">${script.replaceAll("</script", "<\\/script")}</script></html>`;
  writeFileSync(resolve(HERE, `generated/preview${theme === "light" ? "-light" : ""}.html`), page);
}
console.log("Preview written: scripts/induction-art/generated/preview.html (keys 1, 2, 3). No runtime media or network.");
