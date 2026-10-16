// Geometry only: the vendored Anatomy kit is MIT, copyright (c) 2026 Ryan.
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import * as A from "./kit/audit.mjs";
import { tubePieces, tubeSvg } from "./kit/tube.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "generated");
mkdirSync(OUT, { recursive: true });
const atomicWrite = (filename, contents) => {
  const target = resolve(OUT, filename), temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, contents);
  renameSync(temporary, target);
};
const WIDTH = 960, HEIGHT = 540;
const BASE = { x: -260, y: -115, w: 520, d: 230, r: 14 };
const P = k.fitProjection([
  ...k.boxCorners(BASE, -22, 0),
  ...k.boxCorners({ x: -238, y: -80, w: 94, d: 75, r: 0 }, 0, 70),
  ...k.boxCorners({ x: 141, y: -43, w: 98, d: 25, r: 0 }, 34, 130),
  [-185, 60, 72],
], WIDTH, HEIGHT, { pad: 34, azimuth: 62, elevation: 38 });
const R = A.recorder(P);
const at = (p) => k.iso(p, P);
const centreOf = (plan, z) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z];
const parts = new Set();
const ports = {};

function put(name, part, material, paths, shapes, point, extra = {}) {
  parts.add(name);
  // Audit the same paths and shapes that will be emitted as escaped JSX.
  const svg = `<g>${paths.map(({ d, kind }) => `<path class="${kind === "line" ? "iso-line" : "art-" + kind}" d="${d}"/>`).join("")}</g>`;
  return R.put({ name, at: point, piece: part, svg, shapes, paths, material, ...extra });
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
  route(name, name.startsWith("primary") ? "primary-lead" : "secondary-lead", material, points, radius);
  return { name, from, to, points, radius };
}

// Ground chain: feet -> walnut bed -> inset deck -> every component plinth.
for (const [i, [x, y]] of k.corners(BASE, 27).entries()) {
  disc(`stand.foot${i}`, "bench", "rubber", [x, y, -22], [0, 0, 1], 10, 7);
}
slab("stand.bed", "bench", "walnut", BASE, -15, 12);
const DECK = k.insetPlan(BASE, 5);
slab("stand.deck", "bench", "deck", DECK, -3, 3,
  [line(k.planOutline(k.insetPlan(DECK, 5), 0, P), "groove")]);
k.corners(DECK, 11).forEach(([x, y], i) => screw(`stand.screw${i}`, "bench", [x, y, 0], 2.1));

const BAT = { x: -233, y: -75, w: 84, d: 65, r: 5 };
slab("battery.plinth", "battery", "walnut", { ...BAT, x: BAT.x - 5, y: BAT.y - 5, w: BAT.w + 10, d: BAT.d + 10 }, 0, 5);
slab("battery.case", "battery", "wood", BAT, 5, 42,
  [line(k.sideSeam(BAT, 13, P, 8), "groove")]);
slab("battery.lid", "battery", "ebonite", { ...BAT, x: BAT.x - 1, y: BAT.y - 1, w: BAT.w + 2, d: BAT.d + 2 }, 47, 5);
[-223, -159].forEach((x, i) => screw(`battery.lidscrew${i}`, "battery", [x, -65, 52]));
port("battery.positive", "battery", [-211, -42, 65], 52);
port("battery.negative", "battery", [-172, -42, 65], 52);

const SW = { x: -200, y: 40, w: 85, d: 40, r: 6 };
slab("switch.plinth", "switch", "porcelain", SW, 0, 6);
for (const [i, x] of [-193, -122].entries()) screw(`switch.screw${i}`, "switch", [x, 73, 6]);
slab("switch.hingeSeat", "switch", "brass", { x: -191, y: 53, w: 12, d: 14, r: 1.5 }, 6, 6);
slab("switch.jawSeat", "switch", "brass", { x: -147, y: 53, w: 12, d: 14, r: 1.5 }, 6, 6);
sphere("switch.hinge", "switch", "brass", [-185, 60, 16], 4);
sphere("switch.contact", "switch", "brass", [-141, 60, 16], 4);
ports["switch.hinge"] = { point: [-185, 60, 16], radius: 4 };
ports["switch.contact"] = { point: [-141, 60, 16], radius: 4 };
for (const [i, y] of [54.4, 64].entries()) slab(`switch.jaw${i}`, "switch", "brass", { x: -145, y, w: 8, d: 1.6, r: .4 }, 12, 11);

// A rigid supply strap makes the battery/switch one assembly; there are four
// flexible external leads, not an accidental fifth primary/secondary bridge.
const strapRadius = 1.5;
const strap = G.fillet([
  portPoint("battery.positive", [0, 1, 0], strapRadius),
  [-211, -8, 65], [-211, 21, 40], [-205, 38, 16],
  [-198, 60, 16], portPoint("switch.hinge", [-1, 0, 0], strapRadius),
], 11, 12, { P, tube: strapRadius });
route("battery.supplyStrap", "battery", "brass", strap, strapRadius, { limp: false });

const RING_R = 66, CORE_R = 11, RING_Z = 42;
for (const [i, y] of [-66, 66].entries()) {
  slab(`ring.cradle${i}`, "ring", "walnut", { x: -15, y: y - 11, w: 30, d: 22, r: 3 }, 0, 6);
  disc(`ring.insulator${i}`, "ring", "ebonite", [0, y, 6], [0, 0, 1], 7, 25);
}
const circle = Array.from({ length: 289 }, (_, i) => {
  const theta = Math.PI / 2 + i / 288 * Math.PI * 2;
  return [RING_R * Math.cos(theta), RING_R * Math.sin(theta), RING_Z];
});
route("ring.core", "ring", "iron", circle, CORE_R, { closed: true, limp: false, maxLength: 7, touch: ["ring.insulator0", "ring.insulator1"] });

const windingEnds = {};
function winding(name, startAngle, span) {
  const turns = 7.5, radius = 1.2, minor = CORE_R + radius;
  const points = Array.from({ length: turns * 112 + 1 }, (_, i) => {
    const t = i / (turns * 112), a = startAngle + t * span, b = Math.PI / 2 + t * turns * Math.PI * 2;
    const r = RING_R + minor * Math.cos(b);
    return [r * Math.cos(a), r * Math.sin(a), RING_Z + minor * Math.sin(b)];
  });
  const out = (p) => G.mul3(G.unit3([p[0], p[1], 0]), 30);
  const terminals = [
    G.add3(points[0], out(points[0])),
    G.add3(points.at(-1), out(points.at(-1))),
  ];
  for (const [i, p] of terminals.entries()) {
    const terminal = `${name}.terminal${i}`;
    port(terminal, name, p, 0);
  }
  const from = portPoint(`${name}.terminal0`, G.sub3(points[0], terminals[0]), radius);
  const to = portPoint(`${name}.terminal1`, G.sub3(points.at(-1), terminals[1]), radius);
  route(name, name, "copper", [from, ...points, to], radius,
    { touch: ["ring.core"], limp: false, maxLength: 4.5 });
  windingEnds[name] = terminals;
}
winding("primary", 2.57, 1.04);
winding("secondary", -.55, 1.04);

const GAUGE = [190, -27, 82], GAUGE_R = 48;
slab("gauge.plinth", "gauge", "walnut", { x: 145, y: -55, w: 90, d: 61, r: 6 }, 0, 6);
slab("gauge.pedestal", "gauge", "ebonite", { x: 179, y: -42, w: 22, d: 25, r: 3 }, 6, 12);
disc("gauge.stem", "gauge", "brass", [190, -34, 18], [0, 0, 1], 6, 16);
const GF = G.frameOf(GAUGE, [0, 1, 0], [1, 0, 0], [0, 0, 1]);
put("gauge.case", "gauge", "ebonite", solidPaths(G.disc(-14, 0, GAUGE_R, GF, P)),
  [R.solid(A.disc(GF, -14, 0, GAUGE_R, { name: "gauge.case" }))], G.pointOf(GF, -7, 0, 0));
const bezelMeridian = [[0, 44], [0, 48], [3.5, 48], [3.5, 44]];
put("gauge.bezel", "gauge", "brass", solidPaths(G.ringBand(0, 3.5, 44, 48, GF, P)),
  [R.solid(A.lathe(GF, bezelMeridian, { name: "gauge.bezel" }))], G.pointOf(GF, 1.75, 0, 0));
const facePoint = G.pointOf(GF, 3.1, 0, 0);
const FD = G.frameOf(facePoint, GF.a, GF.u, GF.v);
const dialPaths = solidPaths(G.disc(0, .4, 43.9, FD, P));
const faceAt = (x, y) => at(G.add3(G.pointOf(FD, .4, 0, 0), G.add3(G.mul3(GF.u, x), G.mul3(GF.v, -y))));
// Ticks start on the printed scale arc; the scale belongs to the face.
const arc = Array.from({ length: 81 }, (_, i) => {
  const a = (-65 + i / 80 * 130) * Math.PI / 180;
  return faceAt(Math.sin(a) * 39, -Math.cos(a) * 39);
});
dialPaths.push(line(k.pathOf(arc), "scale"));
for (let i = 0; i <= 26; i++) {
  const a = (-65 + i * 5) * Math.PI / 180;
  const r = i === 13 ? 34.5 : i % 5 === 3 ? 35 : 36;
  dialPaths.push(line(k.pathOf([faceAt(Math.sin(a) * 39, -Math.cos(a) * 39), faceAt(Math.sin(a) * r, -Math.cos(a) * r)]), i === 13 ? "zero" : "tick"));
}
put("gauge.face", "gauge", "ivory", dialPaths,
  [R.solid(A.disc(FD, 0, .4, 43.9, { name: "gauge.face" }))], G.pointOf(FD, .2, 0, 0));
for (const [i, x] of [160, 220].entries()) screw(`gauge.screw${i}`, "gauge", [x, -47, 6]);
port("gauge.terminal0", "gauge", [165, -8, 18], 6);
port("gauge.terminal1", "gauge", [215, -8, 18], 6);

const p0 = ports["primary.terminal0"].point;
const p1 = ports["primary.terminal1"].point;
const s0 = ports["secondary.terminal0"].point;
const s1 = ports["secondary.terminal1"].point;
const radial = (p) => G.unit3([p[0], p[1], 0]);
const leads = [
  lead("primary.feed", "primary-wire", "switch.contact", "primary.terminal0",
    [[-105, 60, 16], G.add3(p0, G.mul3(radial(p0), 32))], [1, 0, 0], radial(p0)),
  lead("primary.return", "return-wire", "battery.negative", "primary.terminal1",
    [[-152, -42, 65], [-125, -48, 60], [-101, -44, p1[2]], G.add3(p1, G.mul3(radial(p1), 16))], [1, 0, 0], radial(p1)),
  lead("secondary.out", "secondary-wire", "secondary.terminal0", "gauge.terminal0",
    [G.add3(s0, G.mul3(radial(s0), 17)), [117, -69, 24], [142, -32, 18], [145, -8, 18]], radial(s0), [-1, 0, 0]),
  lead("secondary.return", "secondary-return", "secondary.terminal1", "gauge.terminal1",
    [G.add3(s1, G.mul3(radial(s1), 18)), [117, 62, 24], [203, 54, 18], [235, 17, 18], [235, -8, 18]], radial(s1), [1, 0, 0]),
];

// The blade and insulated grip are solid prisms in each sampled physical pose.
const pivot = [-185, 60, 20];
const basis = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((v) => G.sub3(at(G.add3(pivot, v)), at(pivot)).slice(0, 2));
function movingBox(name, material, from, to, halfWidth, bottom, top, closed) {
  const theta = (1 - closed) * Math.PI * .29;
  const X = [Math.cos(theta), 0, Math.sin(theta)], Y = [0, 1, 0], Z = [-Math.sin(theta), 0, Math.cos(theta)];
  const origin = G.add3(pivot, G.add3(G.mul3(X, (from + to) / 2), G.mul3(Z, (bottom + top) / 2)));
  const shape = A.orientedBox(origin, [X, Y, Z], [(to - from) / 2, halfWidth, (top - bottom) / 2],
    { name, owner: name === "switch.blade" ? "switch.hinge" : name });
  const corner = (x, y, z) => at(G.add3(pivot, G.add3(G.mul3(X, x), G.add3(G.mul3(Y, y), G.mul3(Z, z)))));
  const paths = [
    line(k.pathOf([corner(from, -halfWidth, top), corner(to, -halfWidth, top), corner(to, halfWidth, top), corner(from, halfWidth, top)], true), "moving-top"),
    line(k.pathOf([corner(from, halfWidth, bottom), corner(to, halfWidth, bottom), corner(to, halfWidth, top), corner(from, halfWidth, top)], true), "moving-side"),
    line(k.pathOf([corner(to, -halfWidth, bottom), corner(to, halfWidth, bottom), corner(to, halfWidth, top), corner(to, -halfWidth, top)], true), "moving-end"),
  ];
  return put(name, "switch", material, paths, [R.solid(shape)], origin);
}
const switchClosed = Number(process.env.BENCH_AUDIT_CLOSED ?? 0);
movingBox("switch.blade", "brass", 0, 54, 3, 0, 1.6, switchClosed);
movingBox("switch.grip", "ebonite", 50, 69, 5.5, 1.6, 6.6, switchClosed);

const polar = [at([-211, -42, 70]), at([-172, -42, 70])];
const faceOrigin = faceAt(0, 0), faceX = G.sub3(faceAt(1, 0), faceOrigin), faceY = G.sub3(faceAt(0, 1), faceOrigin);
// The live needle and hub are rendered in face coordinates by React. Record
// their actual thin shapes too, including a selectable needle audit pose.
const needleAngle = Number(process.env.BENCH_AUDIT_NEEDLE ?? 0) * 62 * Math.PI / 180;
const needlePolygon = [[-1.7, 8], [-.9, -32], [0, -37], [.9, -32], [1.7, 8]].map(([x, y]) => [
  x * Math.cos(needleAngle) - y * Math.sin(needleAngle), x * Math.sin(needleAngle) + y * Math.cos(needleAngle),
]);
const NF = G.frameOf(G.pointOf(GF, 3.5, 0, 0), GF.a, GF.u, G.mul3(GF.v, -1));
const needleMatrix = `matrix(${[faceX[0], faceX[1], faceY[0], faceY[1], ...at(G.pointOf(GF, 3.7, 0, 0))].map((n) => n.toFixed(6)).join(" ")})`;
const needleItem = put("gauge.needle", "gauge", "brass", [], [R.solid(A.prism(NF, needlePolygon, 0, .2, { name: "gauge.needle" }))], G.pointOf(GF, 3.6, 0, 0), { external: true });
needleItem.svg = `<g transform="${needleMatrix}"><path d="${k.pathOf(needlePolygon, true)}"/></g>`;
const hubItem = put("gauge.hub", "gauge", "brass", [], [R.solid(A.disc(GF, 3.5, 3.7, 3.4, { name: "gauge.hub" }))], G.pointOf(GF, 3.6, 0, 0), { external: true });
hubItem.svg = `<g transform="${needleMatrix}"><circle r="3.4"/></g>`;
const field = [-3.2, 3.2].map((offset) => k.pathOf(Array.from({ length: 145 }, (_, i) => {
  const a = i / 144 * Math.PI * 2;
  return at([(RING_R + offset) * Math.cos(a), (RING_R + offset) * Math.sin(a), RING_Z + CORE_R + 1]);
}), true));
const fieldArrows = [1.48, 4.62].map((a) => {
  const p = [(RING_R) * Math.cos(a), RING_R * Math.sin(a), RING_Z + CORE_R + 1.4];
  const tangent = [-Math.sin(a), Math.cos(a), 0], radial = [Math.cos(a), Math.sin(a), 0];
  const arrow = (sign) => k.pathOf([
    at(G.add3(p, G.add3(G.mul3(tangent, sign * -3), G.mul3(radial, -3)))),
    at(G.add3(p, G.mul3(tangent, sign * 4))),
    at(G.add3(p, G.add3(G.mul3(tangent, sign * -3), G.mul3(radial, 3)))),
  ]);
  return { positive: arrow(1), negative: arrow(-1) };
});
const currentArrows = [leads[0], leads[2]].map((lead) => {
  const distance = G.pathLength(lead.points) * .42;
  const point = G.pointAlong(lead.points, distance);
  const tangent = G.tangentAlong(lead.points, distance);
  const cross = G.unit3(G.cross3(tangent, G.viewOf(P)));
  const arrow = (sign) => k.pathOf([
    at(G.add3(point, G.mul3(tangent, sign * 4))),
    at(G.add3(point, G.add3(G.mul3(tangent, sign * -3), G.mul3(cross, 2.1)))),
    at(G.add3(point, G.add3(G.mul3(tangent, sign * -3), G.mul3(cross, -2.1)))),
  ], true);
  return { circuit: lead.name.startsWith("primary") ? "primary" : "secondary", positive: arrow(1), negative: arrow(-1) };
});

console.log(`Settling ${R.items.length} geometry items…`);
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
A.auditOrExit(R, P);
if (process.exitCode || process.argv.includes("--no-emit")) process.exit(process.exitCode ?? 0);

// No unrecorded or stand-in shapes: serialise from the same settled recorder.
const data = {
  items: R.items.filter((item) => !item.external).map(({ name, piece, material, paths }) => ({ name, part: piece, material, paths })),
  anchors: Object.fromEntries(Object.entries({ switch: [-155, 60, 34], battery: [-193, -42, 65], gauge: GAUGE, ring: [0, 0, 52] }).map(([name, p]) => [name, at(p).map((n, i) => n / (i ? HEIGHT : WIDTH))])),
  gauge: { matrix: needleMatrix },
  lever: { pivot: at(pivot), basis },
  polarity: polar,
  field, fieldArrows, currentArrows,
};
atomicWrite("geometry.json", JSON.stringify(data));
atomicWrite("record.json", JSON.stringify({ projection: P, ports, leads, routes: R.routes,
  parts: [...parts].filter((name) => !/:\d+$/.test(name)),
  solids: R.solids.map((s) => ({ name: s.name, kind: s.kind, F: s.F, o: s.o, axes: s.axes, half: s.half, poly: s.poly, r: s.r, s0: s.s0, s1: s.s1 })),
  supportGround: R.solids.filter(A.grounded).map((s) => s.name),
  explode: false,
}, null, 2));
console.log(`Wrote geometry: ${data.items.length} pieces; four isolated leads; 7.5 turns per winding.`);
