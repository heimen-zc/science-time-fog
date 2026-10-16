# Faraday induction bench — Figure

One low-voltage source and one knife switch energise an insulated winding on a
continuous iron annulus. A second winding on that same annulus closes through a
centre-zero galvanometer. The knife blade and galvanometer needle follow the
parent's experiment frame; the art never operates the experiment on its own.

## Parts before geometry

- Bench: four rubber feet, walnut bed, inset top panel, four brass corner screws.
- Battery: wooden plinth, wooden cell case, dark lid, two brass terminal seats,
  two terminal posts, two thumb nuts, two lid screws, polarity marker.
- Switch: porcelain plinth, hinge seat, receiving jaw, two jaw leaves, hinge pin,
  brass knife blade, insulated handle, two plinth screws, rigid supply strap.
- Ring: two cradle feet, two insulating risers, one continuous iron annulus,
  primary enamelled copper winding, secondary enamelled copper winding,
  four terminal seats, four binding posts.
- Galvanometer: plinth, pedestal, round case, brass bezel, ivory dial face,
  centre-zero scale, needle, hub, two insulated terminals, two terminal caps,
  two mount screws.
- Wiring: four separately routed insulated leads, each with a real port at both
  ends. The short battery-to-switch connection is a rigid brass bus strap.

The finished instrument has 72 physical parts: 64 solids (including the live
needle and hub), a continuous iron core, two 7.5-turn windings, the rigid supply
strap, and four insulated leads. Each winding terminal has an insulating seat
and a real supporting post.

The geometry build records the actual solid/tube shapes, all routes, their
ports, and the grounded support chain. It runs `settle` before serialisation and
`auditOrExit` with `--audit`. No explode pose exists. Winding pieces are sorted
individually so their far halves go behind the common core and their near halves
go in front. Runtime output contains no kit and uses only escaped React paths.

The parent supplies the card, all HTML controls, help, labels and experiment
physics. There is no idle experiment tour. Dashed cyan field paths lie along
the annulus and receive opacity from flux, independently of needle deflection.

## Rebuild and inspect

Run from the checkout root:

```sh
node scripts/induction-art/build.mjs --audit
node scripts/induction-art/preview.mjs
BENCH_AUDIT_CLOSED=1 BENCH_AUDIT_NEEDLE=1 node scripts/induction-art/build.mjs --audit --no-emit
BENCH_AUDIT_CLOSED=.5 BENCH_AUDIT_NEEDLE=-1 node scripts/induction-art/build.mjs --audit --no-emit
```

`--no-emit` checks another physical switch/needle pose without replacing the
production rest geometry. A failing audit does not publish geometry. Emission
uses atomic rename, so the development server never reads a partial JSON file.

Only `generated/geometry.json` is a production asset. Preview HTML, transpiled
preview modules, detailed geometry records and screenshots are local proofs.
The portable MIT kit is used only at build time; no kit code enters the client.

The React component provides the requested three exports. The binder accepts
`Pick<ParentNode, "querySelector" | "querySelectorAll">` to avoid conflicting DOM
and Cloudflare worker `Element.append` declarations. It does all queries once,
then updates only cached SVG nodes and scoped CSS variables. Its `closed` input
is the parent's eased fraction. Signed current sets a persistent primary or
transient secondary highlight and a stationary directional arrow. No clocks,
requestAnimationFrame calls, controls, physics or idle experiments live here.
