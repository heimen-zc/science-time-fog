// Local proof only; no preview module, HTML or screenshots enter the app.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const HERE=dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(readFileSync(resolve(HERE,'generated/geometry.json'),'utf8'));
const original=readFileSync(resolve(HERE,'../../components/magnet-bench.tsx'),'utf8');
const source=original.replace(/^import[^;]+;\s*/gm,'');
const js=ts.transpileModule(`const MAGNET_GEOMETRY=${JSON.stringify(data)};\n${source}`,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext},
}).outputText;
const modulePath=resolve(HERE,'generated/preview-component.mjs');
writeFileSync(modulePath,js);
const {MagnetBench}=await import(pathToFileURL(modulePath).href+`?v=${Date.now()}`);
const markup=renderToStaticMarkup(React.createElement(MagnetBench));
const css=readFileSync(resolve(HERE,'magnet.css'),'utf8');
const binder=js.slice(js.indexOf('const clamp'));
const script=`const MAGNET_GEOMETRY=${JSON.stringify(data)};\n${binder}\n
const update=bindMagnetBench(document);
window.magnetProof={travel:MAGNET_GEOMETRY.travel,anchors:MAGNET_GEOMETRY.anchors,items:MAGNET_GEOMETRY.items.map(({name,key,lift,moving})=>({name,key,lift,moving}))};
window.magnetFrame={position:0,needle:0,signal:0,flux:0,field:false};
window.setMagnetFrame=(patch)=>{Object.assign(window.magnetFrame,patch);update(window.magnetFrame);};
setMagnetFrame({});`;
for(const theme of ['dark','light']) {
  const page=`<!doctype html><html lang="zh-CN" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Magnet and coil — art proof</title><style>
html{background:#0d1625;color:#a5b5c6;font:12px system-ui;}body{margin:0;min-height:100vh;display:grid;place-items:center;}main{width:min(1100px,100%);} .iso-plate{background:#121d2d;border:1px solid #334153;border-radius:18px;overflow:hidden;} .preview-caption{padding:12px 20px;display:flex;justify-content:space-between;gap:12px;letter-spacing:.06em;font-size:10px;} [data-theme=light]{background:#eff1ed;color:#495b62;}[data-theme=light] .iso-plate{background:#e6eae5;border-color:#bfc7c1;}
${css}</style><main><div class="iso-plate"><div class="preview-caption"><span>FIG. 02 · MAGNET / HOLLOW COIL</span><span>GEOMETRY PROOF</span></div>${markup}<div class="preview-caption"><span>ONE AXIAL STROKE</span><span data-readout>63 physical parts · 2 insulated leads</span></div></div></main><script type="module">${script.replaceAll('</script','<\\/script')}</script></html>`;
  writeFileSync(resolve(HERE,`generated/preview${theme==='light'?'-light':''}.html`),page);
}
console.log('Wrote scripts/magnet-art/generated/preview.html and preview-light.html. window.setMagnetFrame drives the real binder.');
