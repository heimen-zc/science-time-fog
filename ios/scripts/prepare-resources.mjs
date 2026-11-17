import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=path.dirname(root);
const sharp=createRequire(import.meta.url)('sharp');
const design=process.env.TIMEFOG_DESIGN_ASSETS ?? path.join(root,'DesignAssets');
const destination=path.join(root,'TimeFog/Content');await fs.mkdir(destination,{recursive:true});
for(const [source,name,box] of [
 ['雾灯助手','BrandLamp',[100,50,180,180]],['回放对照镜','Comparator',[80,100,230,230]],
 ['控制变量印章','SealControl',[110,70,160,160]],['排除替代印章','SealAlternative',[110,70,160,160]],['零结果印章','SealZero',[110,70,160,160]],
 ['灯塔未修复','LighthouseDark',[24,150,342,240]],['灯塔已修复','LighthouseLit',[24,150,342,240]]
]){
 const [left,top,width,height]=box;
 const svg=(await fs.readFile(path.join(design,source+'.svg'),'utf8')).replace(/<rect x="0" y="0" width="390" height="844" rx="0" fill="#F8F5ED" stroke="none"\/>/,'');
 await sharp(Buffer.from(svg)).extract({left,top,width,height}).resize(width*3,height*3).png().toFile(path.join(destination,name+'.png'));
}
for(const type of ['induction','magnet']){
 const raw=JSON.parse(await fs.readFile(path.join(repo,`scripts/${type}-art/generated/geometry.json`),'utf8'));
 const css=await fs.readFile(path.join(repo,`scripts/${type}-art/${type==='induction'?'bench':'magnet'}.css`),'utf8');
 const defaults={face:'#303D45',top:'#54646B',edge:'#8C9A9D','shade-0':'#24343C','shade-1':'#354751','shade-2':'#42565F','shade-3':'#526A71'};
 const colors={};
 for(const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
  const props=Object.fromEntries([...m[2].matchAll(/--bench-([\w-]+)\s*:\s*([^;]+);/g)].map(v=>[v[1],v[2].trim()]));
  for(const sel of m[1].split(',')){const k=sel.match(/bench-material-([\w-]+)/);if(k)colors[k[1]]={...colors[k[1]],...props}}
 }
 const asset={items:raw.items.map((i,index)=>{
  const c={...defaults,...colors[i.material]};
  const fills={fill:c.face,top:c.top,'shade-0':c['shade-0'],'shade-1':c['shade-1'],'shade-2':c['shade-2'],'shade-3':c['shade-3'],'tube-body':c.face,'tube-shine':c.top,'tube-shade':c['shade-0'],'moving-top':c.top,'moving-side':c['shade-1'],'moving-end':c['shade-2']};
  return {name:i.name,key:i.key??index,lift:i.lift??0,moving:!!i.moving,paths:i.paths.map(p=>({d:p.d,stroke:!fills[p.kind],color:fills[p.kind]??(p.kind==='bevel'?c.top:['tick','scale'].includes(p.kind)?'#77816C':p.kind==='zero'?'#235F5D':c.edge),width:p.kind==='zero'?1.4:.6,opacity:p.opacity??(p.kind==='groove'?.35:1)}))}
 }),travel:raw.travel??[0,0],gauge:raw.gauge.matrix.match(/-?\d+(?:\.\d+)?/g).map(Number),lever:raw.lever??null};
 await fs.writeFile(path.join(destination,`${type}-geometry.json`),JSON.stringify(asset));
}
for(const name of ['close-switch','open-switch','flip-battery','close-reversed','open-reversed','overlay-traces','magnet-approach','magnet-hold','magnet-away']){
 await fs.copyFile(path.join(repo,'public/action-films',name+'.gif'),path.join(destination,name+'.gif'));
 await sharp(path.join(repo,'public/action-films',name+'.webp')).png().toFile(path.join(destination,name+'-poster.png'));
}
const catalog=path.join(root,'TimeFog/Assets.xcassets');await fs.mkdir(path.join(catalog,'AppIcon.appiconset'),{recursive:true});
await fs.writeFile(path.join(catalog,'Contents.json'),JSON.stringify({info:{author:'xcode',version:1}}));
const icon=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512"><rect width="512" height="512" fill="#102C38"/><path d="M250 162 16 43v239zM281 162l218-98v220z" fill="#E5B65F" opacity=".23"/><circle cx="85" cy="108" r="4" fill="#F6D99B"/><circle cx="413" cy="317" r="3" fill="#F6D99B"/><path d="m222 214-26 212h124l-24-212z" fill="#E9DFC7"/><path d="m275 214 21 212h24l-24-212" fill="#A6B6A7"/><path d="m211 298 97 4 6 43-109-7" fill="#A36E51"/><path d="M219 139h82v70h-82z" fill="#F1CD80" stroke="#A9864E" stroke-width="8"/><path d="m204 132 56-47 56 47z" fill="#B58652"/><path d="M260 144v60m-34-30h69" stroke="#8E7E4F" stroke-width="5"/><path d="M0 446q120-65 251-8t261-1v75H0z" fill="#28626A"/><path d="M0 482q155-51 282-7t230-9v46H0z" fill="#367E7D"/><path d="M394 90l7 17 18 7-18 7-7 18-7-18-18-7 18-7z" fill="#E5B65F"/></svg>`;
await sharp(Buffer.from(icon)).png().toFile(path.join(catalog,'AppIcon.appiconset/Icon.png'));
await fs.writeFile(path.join(catalog,'AppIcon.appiconset/Contents.json'),JSON.stringify({images:[{filename:'Icon.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'xcode',version:1}}));
console.log('Prepared native geometry, seven illustrations, nine films, and app icon.');
