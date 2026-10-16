// Build-only Anatomy kit reuse: MIT, copyright (c) 2026 Ryan; see ../induction-art/kit/LICENSE.
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../induction-art/kit/iso-kit.mjs";
import * as G from "../induction-art/kit/lathe.mjs";
import * as A from "../induction-art/kit/audit.mjs";
import { tubePieces, tubeSvg } from "../induction-art/kit/tube.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "generated");
mkdirSync(OUT, { recursive: true });
const atomicWrite = (name, contents) => {
  const target = resolve(OUT, name), temporary = target + "." + process.pid + ".tmp";
  writeFileSync(temporary, contents);
  renameSync(temporary, target);
};
const WIDTH = 960, HEIGHT = 540, TRAVEL = [146, 0, 0];
const BASE = { x: -270, y: -110, w: 550, d: 220, r: 14 };
const P = k.fitProjection([
  ...k.boxCorners(BASE, -22, 0),
  ...k.boxCorners({x:-224,y:-32,w:90,d:24,r:0},60,86),
  ...k.boxCorners({x:10,y:-64,w:92,d:88,r:0},29,116),
  ...k.boxCorners({x:155,y:10,w:98,d:25,r:0},34,130),
], WIDTH, HEIGHT, { pad: 32, azimuth: 125, elevation: 38 });
const R = A.recorder(P);
const at = (p) => k.iso(p, P);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const parts = new Set(), ports = {};
function put(name, part, material, paths, shapes, point, extra = {}) {
  parts.add(name);
  // Audit the same paths and shapes that will be emitted as escaped JSX.
  const svg = `<g>${paths.map(({ d, kind }) => `<path class="${kind === "line" ? "iso-line" : "art-" + kind}" d="${d}"/>`).join("")}</g>`;
  return R.put({ name, at: point, piece: part, svg, shapes, paths, material, move: part === "slide" ? TRAVEL : [0, 0, 0], ...extra });
}
function solidPaths(paths, inner = []) {
  return [
    { d: paths.fill, kind: "fill" },
    ...paths.shades.map((d, i) => ({ d, kind: `shade-${i}` })),
    { d: paths.top, kind: "top" },
    { d: paths.crease, kind: "crease" },
    { d: paths.bevel, kind: "bevel" },
    ...inner,
    { d: paths.outline, kind: "outline" },
  ].filter((p) => p.d);
}
const line = (d, kind = "line") => ({ d, kind });
function slab(name, part, material, plan, z, h, inner = []) {
  return put(name, part, material, solidPaths(k.slabOf(plan, z, h, P, 8, .7), inner),
    [R.solid(A.slab(plan, z, h, { name, owner: name }))], centreOf(plan, z + h / 2));
}
function disc(name, part, material, point, axis, r, h, inner = []) {
  const F = G.frameAlong(point, axis);
  return put(name, part, material, solidPaths(G.disc(0, h, r, F, P, { bevel: .4 }), inner),
    [R.solid(A.disc(F, 0, h, r, { name, owner: name }))], G.pointOf(F, h / 2, 0, 0));
}
function sphere(name, part, material, point, radius) {
  return put(name, part, material, solidPaths(G.sphereOf(point, radius, P)),
    [R.solid(A.ball(point, radius, { name, owner: name }))], point);
}
function screw(name, part, point, r = 1.8) {
  const [x, y, z] = point;
  disc(name, part, "brass", point, [0, 0, 1], r, 1,
    [line(k.lineOnTop([x - r * .65, y], [x + r * .65, y], z + 1, P), "slot")]);
}
function port(name, part, point, supportZ, material = "brass") {
  const radius = 3.6;
  disc(`${name}.seat`, part, "ebonite", [point[0], point[1], supportZ], [0, 0, 1], 5, 2.5);
  const post = disc(`${name}.post`, part, material, [point[0], point[1], supportZ + 2.5], [0, 0, 1], 2.8,
    point[2] - radius - supportZ - 2.5);
  // This post and its round binding terminal are one real connector assembly.
  // The contact graph can then recognise a lead ending on that connector.
  post.shapes.forEach((shape) => { shape.owner = name; });
  sphere(name, part, material, point, radius);
  ports[name] = { point, radius };
  return name;
}
function portPoint(name, direction, radius) {
  const port = ports[name];
  return G.add3(port.point, G.mul3(G.unit3(direction), Math.sqrt(port.radius ** 2 - radius ** 2)));
}
function route(name, part, material, points, radius, options = {}) {
  const { closed = false, touch = [], limp = true, ends = [true, true], maxLength = 10 } = options;
  R.route(name, points, radius, { piece: part, closed, touch, limp, ends });
  const pieces = tubePieces(points, radius, P, { closed, maxLength, spacing: .65, caps: true, stripes: true });
  pieces.forEach((p, i) => {
    const paths = [
      { d: p.body, kind: "tube-body" }, { d: p.shine, kind: "tube-shine" },
      { d: p.shade, kind: "tube-shade" }, { d: p.edges, kind: "tube-edge" },
    ].filter((p) => p.d);
    const item = put(`${name}:${i}`, part, material, paths,
      [A.tube(p.points, p.radii, { name: `${name}:${i}`, owner: name })], p.mid,
      { route: name, chunk: i });
    // Tube markup gives coverage/line auditing exactly the kit's own geometry.
    item.svg = tubeSvg(p);
  });
  parts.add(name);
  return points;
}
function lead(name, material, from, to, via, directionA, directionB) {
  const radius = 1.65;
  const start = portPoint(from, directionA, radius), end = portPoint(to, directionB, radius);
  const points = G.fillet([start, ...via, end], 11, 14, { P, tube: radius });
  route(name, "lead", material, points, radius);
  return { name, from, to, points, radius };
}

// Ground: feet -> deck -> guide/coil/meter -> all mounted parts.
for (const [i, [x, y]] of k.corners(BASE, 26).entries()) disc(`stand.foot${i}`, "bench", "rubber", [x, y, -22], [0,0,1], 10, 7);
slab("stand.bed", "bench", "walnut", BASE, -15, 12);
const DECK = k.insetPlan(BASE, 5);
slab("stand.deck", "bench", "deck", DECK, -3, 3, [line(k.planOutline(k.insetPlan(DECK, 5), 0, P), "groove")]);
k.corners(DECK, 11).forEach(([x,y], i) => screw(`stand.screw${i}`, "bench", [x,y,0], 2.1));

// The two rails give the same visible projected axis as the magnet and coil.
for (const [i,y] of [-47, 1].entries()) slab(`guide.rail${i}`, "guide", "brass", {x:-206,y,w:200,d:6,r:0}, 0, 8);
for (const [i,x] of [-216,-6].entries()) {
  slab(`guide.stop${i}`, "guide", "ebonite", {x,y:-54,w:10,d:68,r:2}, 0, 20);
  screw(`guide.stopScrew${i}`, "guide", [x+5,-45,20], 2.1);
}
const SCALE = {x:-203,y:20,w:196,d:7,r:1};
const scaleTicks = k.topTicks(-198,-12,6,5,SCALE.y,.6,[2.1,3.4],P);
slab("guide.scale", "guide", "brass", SCALE, 0, .6,
  [line(scaleTicks.minor,"tick"),line(scaleTicks.major,"tick")]);

// A single moving assembly. Every part receives exactly TRAVEL * position.
for (const [i,x] of [-203,-167].entries()) for (const [j,y] of [-48.5,-.5].entries()) {
  slab(`slide.bearing${i}${j}`, "slide", "ebonite", {x,y,w:12,d:9,r:2}, 8, 6);
}
const CARRIAGE = {x:-206,y:-53,w:54,d:66,r:3};
slab("slide.carriage", "slide", "iron", CARRIAGE, 14, 6,
  [line(k.planOutline(k.insetPlan(CARRIAGE,3),20,P),"groove")]);
for (const [i,x] of [-194,-172].entries()) slab(`slide.saddle${i}`, "slide", "ebonite", {x,y:-33,w:8,d:26,r:1.8}, 20, 40);
for (const [i,x] of [-197,-161].entries()) screw(`slide.screw${i}`, "slide", [x,7,20],1.8);
slab("slide.south", "slide", "south", {x:-222,y:-31,w:43,d:22,r:1.5}, 60, 24);
const north = slab("slide.north", "slide", "north", {x:-179,y:-31,w:43,d:22,r:1.5}, 60, 24);
north.text = {value:"N",matrix:k.topMatrix([-157.5,-20],84,P),size:8};
disc("slide.handleStem", "slide", "brass", [-179,5,20], [0,0,1], 3.5, 9);
disc("slide.handle", "slide", "ebonite", [-179,5,29], [0,0,1], 7, 9,
  [line(k.knurl(-179,5,7,29,38,28,P),"line")]);

// Open bobbin, not a toroidal core. Both end mouths remain genuinely hollow.
const COIL_Y=-20, COIL_Z=72, BORE=30, SHELL=33, WIND_R=34.3;
const CF=G.frameOf([0,COIL_Y,COIL_Z],[1,0,0],[0,1,0],[0,0,1]);
slab("coil.plinth", "coil", "walnut", {x:5,y:-75,w:102,d:111,r:5}, 0, 6);
for (const [i,x] of [12,90].entries()) slab(`coil.support${i}`, "coil", "ebonite", {x,y:-28,w:10,d:16,r:1}, 6, 23);
function ringPart(name,s0,s1,inside,outside,material) {
  const shape=R.solid(A.ring(CF,s0,s1,inside,outside,{name,owner:name}));
  // Close the meridian explicitly: the fourth surface is the inner bore wall.
  // Visible facets preserve this hollow volume instead of convexly capping it.
  const meridian=[[s0,inside],[s0,outside],[s1,outside],[s1,inside],[s0,inside]];
  const paths=G.lathe(meridian,CF,P,{fill:"facets"});
  paths.outline=G.outlineOf(meridian,CF,P,{fill:"hull"}).outline+G.circleOf(CF,s0,inside,P);
  return put(name,"coil",material,solidPaths(paths),[shape],G.pointOf(CF,(s0+s1)/2,0,0));
}
ringPart("coil.leftFlange",12,22,BORE,43,"ebonite");
ringPart("coil.sleeve",22,90,BORE,SHELL,"porcelain");
ringPart("coil.rightFlange",90,100,BORE,43,"ebonite");
for (const [i,x] of [14,98].entries()) screw(`coil.screw${i}`,"coil",[x,-66,6],2);
port("coil.terminal0","coil",[26,COIL_Y+WIND_R,26],6);
port("coil.terminal1","coil",[86,COIL_Y-WIND_R,26],6);
const turns=11.5, wireRadius=1.3;
const winding=Array.from({length:turns*112+1},(_,i)=>{
  const t=i/(turns*112), angle=t*turns*Math.PI*2;
  return [26+60*t,COIL_Y+WIND_R*Math.cos(angle),COIL_Z+WIND_R*Math.sin(angle)];
});
route("coil.winding","winding","copper",[
  portPoint("coil.terminal0",[0,0,1],wireRadius),...winding,portPoint("coil.terminal1",[0,0,1],wireRadius),
],wireRadius,{touch:["coil.sleeve"],limp:false,maxLength:3.5});

// Same centre-zero mechanism and material vocabulary as the induction ring.
const GAUGE=[204,26,82], GAUGE_R=48;
slab("gauge.plinth","gauge","walnut",{x:159,y:-5,w:92,d:70,r:5},0,6);
slab("gauge.pedestal","gauge","ebonite",{x:193,y:10,w:22,d:25,r:3},6,12);
disc("gauge.stem","gauge","brass",[204,19,18],[0,0,1],6,16);
const GF=G.frameOf(GAUGE,[0,1,0],[1,0,0],[0,0,1]);
put("gauge.case","gauge","ebonite",solidPaths(G.disc(-14,0,GAUGE_R,GF,P)),
  [R.solid(A.disc(GF,-14,0,GAUGE_R,{name:"gauge.case"}))],G.pointOf(GF,-7,0,0));
put("gauge.bezel","gauge","brass",solidPaths(G.ringBand(0,3.5,44,48,GF,P)),
  [R.solid(A.ring(GF,0,3.5,44,48,{name:"gauge.bezel"}))],G.pointOf(GF,1.75,0,0));
const FD=G.frameOf(G.pointOf(GF,3.1,0,0),GF.a,GF.u,GF.v);
const dialPaths=solidPaths(G.disc(0,.4,43.9,FD,P));
const faceAt=(x,y)=>at(G.add3(G.pointOf(GF,3.5,0,0),G.add3(G.mul3(GF.u,x),G.mul3(GF.v,-y))));
const arc=Array.from({length:81},(_,i)=>{
  const a=(-65+i/80*130)*Math.PI/180;
  return faceAt(Math.sin(a)*39,-Math.cos(a)*39);
});
dialPaths.push(line(k.pathOf(arc),"scale"));
for(let i=0;i<=26;i++) {
  const a=(-65+i*5)*Math.PI/180,r=i===13?34.5:i%5===3?35:36;
  dialPaths.push(line(k.pathOf([faceAt(Math.sin(a)*39,-Math.cos(a)*39),faceAt(Math.sin(a)*r,-Math.cos(a)*r)]),i===13?"zero":"tick"));
}
put("gauge.face","gauge","ivory",dialPaths,[R.solid(A.disc(FD,0,.4,43.9,{name:"gauge.face"}))],G.pointOf(FD,.2,0,0));
for(const [i,x] of [174,234].entries()) screw(`gauge.screw${i}`,"gauge",[x,1,6],1.8);
port("gauge.terminal0","gauge",[179,54,20],6);
port("gauge.terminal1","gauge",[233,54,20],6);

const leads=[
  lead("circuit.out","secondary-wire","coil.terminal0","gauge.terminal0",
    [[26,47,26],[122,62,22],[157,54,20]],[0,1,0],[-1,0,0]),
  lead("circuit.return","secondary-return","coil.terminal1","gauge.terminal1",
    [[117,-54.3,26],[135,-66,22],[255,-66,22],[262,34,20],[253,54,20]],[1,0,0],[1,0,0]),
];

// The live face decorations are recorded with the same thin physical geometry.
const needleValue=Number(process.env.MAGNET_AUDIT_NEEDLE??0);
const needleAngle=needleValue*62*Math.PI/180;
const needlePolygon=[[-1.7,8],[-.9,-32],[0,-37],[.9,-32],[1.7,8]].map(([x,y])=>[
  x*Math.cos(needleAngle)-y*Math.sin(needleAngle),x*Math.sin(needleAngle)+y*Math.cos(needleAngle),
]);
const faceOrigin=at(G.pointOf(GF,3.7,0,0));
const faceX=G.sub3(faceAt(1,0),faceAt(0,0)),faceY=G.sub3(faceAt(0,1),faceAt(0,0));
const needleMatrix=`matrix(${[faceX[0],faceX[1],faceY[0],faceY[1],...faceOrigin].map(n=>n.toFixed(6)).join(" ")})`;
const NF=G.frameOf(G.pointOf(GF,3.5,0,0),GF.a,GF.u,G.mul3(GF.v,-1));
const needleItem=put("gauge.needle","gauge","brass",[],[R.solid(A.prism(NF,needlePolygon,0,.2,{name:"gauge.needle"}))],G.pointOf(GF,3.6,0,0),{external:true});
needleItem.svg=`<g transform="${needleMatrix}"><path d="${k.pathOf(needlePolygon,true)}"/></g>`;
const hubItem=put("gauge.hub","gauge","brass",[],[R.solid(A.disc(GF,3.5,3.7,3.4,{name:"gauge.hub"}))],G.pointOf(GF,3.6,0,0),{external:true});
hubItem.svg=`<g transform="${needleMatrix}"><circle r="3.4"/></g>`;

// Magnetic loops live in the axial vertical plane. They translate with the
// magnet, never travel as electricity, and remain hidden during observation.
const field=[];
for(const side of [-1,1]) {
  const N=-136,S=-222,z=COIL_Z;
  const p=(x,h)=>at([x,COIL_Y,z+h]);
  const M=p(N,0),C1=p(N+118,side*8),C2=p(N+95,side*63),T=p(S-16,side*39),C3=p(S-50,side*18),E=p(S,0);
  field.push(`M${M.join(" ")}C${C1.join(" ")} ${C2.join(" ")} ${T.join(" ")}Q${C3.join(" ")} ${E.join(" ")}L${M.join(" ")}Z`);
}
const arrows=[-1,1].map(side=>k.pathOf([at([-108,COIL_Y,COIL_Z+side*7]),at([-114,COIL_Y,COIL_Z+side*4]),at([-114,COIL_Y,COIL_Z+side*10])],true));

const STATES=Array.from({length:33},(_,i)=>i/32);
console.log(`Settling ${R.items.length} items over ${STATES.length} stroke positions…`);
A.settle(R,P,{states:STATES});
R.items.sort((a,b)=>a.key-b.key);
const audit=A.auditOrExit(R,P,{frames:STATES,apart:true});
if(audit) {
  const strict=A.depthOrder(R.settled.items,P,{overlaps:R.settled.overlaps,solved:R.settled.solved,rest:STATES});
  const strictCount=strict.problems.length+strict.missing.length;
  const supportAt=[];
  for(const state of [0,.5,1]) {
    const support=A.supports(R.solids.map(s=>A.moved(s,A.offsetOf(s,state))),R.tubes.map(s=>A.moved(s,A.offsetOf(s,state))));
    supportAt.push({position:state,...support});
  }
  const supportCount=supportAt.reduce((n,s)=>n+s.loose.length+s.hanging.length+s.sunk.length,0);
  console.log(`stroke supports: ${supportCount} problems · strict depth: ${strictCount} problems`);
  if(strictCount||supportCount) { console.log(JSON.stringify({depth:strict.problems.slice(0,8),supportAt}));process.exitCode=1; }
}
if(process.exitCode||process.argv.includes("--no-emit")) process.exit(process.exitCode??0);
const physicalParts=R.solids.length+R.tubes.length;
if(physicalParts<40||physicalParts>80) throw Error(`Figure part count out of bounds: ${physicalParts}`);
const screenTravel=G.sub3(at(TRAVEL),at([0,0,0])).slice(0,2);
const data={
  items:R.items.filter(i=>!i.external).map(({name,piece,material,paths,key,move,text})=>({
    name,part:piece,material,paths,key,lift:G.dot3(move,G.viewOf(P)),moving:piece==="slide",...(text?{text}:{}),
  })),
  anchors:Object.fromEntries(Object.entries({far:[-179,5,34],near:[-33,5,34],gauge:GAUGE}).map(([name,p])=>[name,at(p).map((n,i)=>n/(i?HEIGHT:WIDTH))])),
  travel:screenTravel,gauge:{matrix:needleMatrix},field,arrows,
};
atomicWrite("geometry.json",JSON.stringify(data));
atomicWrite("record.json",JSON.stringify({projection:P,ports,leads,routes:R.routes,solids:R.solids,states:STATES,
  stroke:TRAVEL,physicalParts,bounds:{farN:-136,nearN:10,mouth:12,centre:56},supportGround:R.solids.filter(A.grounded).map(s=>s.name)},(key,value)=>key.startsWith("_")?undefined:value,2));
console.log(`Wrote ${physicalParts} physical parts, ${data.items.length} pieces and two closed-circuit leads.`);
