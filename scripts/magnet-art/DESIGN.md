# Magnet and hollow coil bench — Figure

A bar magnet rides on two insulating saddles on a guided carriage. Moving the
carriage along the coil axis approaches a single hollow, upright cylindrical
winding. Two insulated leads close that winding through a centre-zero meter.
There is no electrical source, switch, independent clock or idle experiment.

## Parts before geometry

- Base: four rubber feet, walnut bed, inset deck, four corner screws.
- Guide: two brass rails, two end stops, two stop screws, scale strip.
- Slider: four bearing pads, carriage plate, two insulating saddles, two fixing
  screws, drag-knob stem, drag knob, S half and N half of one bar magnet.
- Coil: walnut plinth, two insulating supports, two open end flanges, hollow
  bobbin sleeve, two plinth screws, two insulating terminal seats, two posts,
  two binding terminals, one continuous copper winding.
- Meter: walnut plinth, pedestal, stem, round case, annular brass bezel, ivory
  scale, moving needle, hub, two mount screws, two insulated terminal seats,
  two posts, two binding terminals.
- Circuit: two insulated external leads, each mounted to a real terminal at
  each end. The coil itself and the meter complete one closed circuit.

All slide parts share exactly one translation. The N end stops at x=10; the
left mouth begins at x=12 and the coil centre is x=56. Magnet half-section
fits inside the bore, but the displayed stroke never takes it through the
middle. The carriage remains supported on the rails in every position.

Every drawn solid/tube is recorded with its true shape. Build-time settling
measures order at 0, .5, 1 and intermediate stroke samples. Runtime order uses
those settled keys and the same true depth offset. Geometry is emitted by
atomic rename. Only generated/geometry.json is a production output; preview
HTML/modules, records, reports and screenshots are local proofs.

The MIT Anatomy kit is reused read-only from ../induction-art/kit. Materials
and the meter follow that bench. The parent owns physics, controls, HTML text,
keyboard/pointer handling and the frame clock. Dashed magnetic lines are a
separate explanatory overlay, hidden unless field is explicitly true.

## Rebuild and review

```sh
node scripts/magnet-art/build.mjs --audit
node scripts/magnet-art/preview.mjs
```

There are 63 actual physical parts (60 solids and three continuous routes:
the winding plus two leads). Copper is subdivided into depth-sortable pieces,
not counted as hundreds of independent parts. The hollow bobbin and flanges
use explicitly closed meridians including the inner walls, rendered as visible
annular facets; no convex backing fill caps the opening.

The build checks 33 stroke positions, strict painter order in every one, and
the support graph at 0, .5 and 1. It emits nothing when an audit fails.
`--no-emit` audits without replacing production geometry, and
`MAGNET_AUDIT_NEEDLE=-1` or `1` selects a needle extremum for inspection.

The standalone preview exposes `window.setMagnetFrame` only in that local
proof. `review-actions.json` verifies 514 forward/reverse updates against the
settled key order and viewBox bounds. Both review action files run line checks
at far, mid-stroke, near and field-overlay states and capture 4× junctions.
Use them with the installed Anatomy `scripts/drive.mjs`; `scripts/capture.mjs`
can also capture the preview at width 390 and with `--reduced`.

Runtime caches selectors once. All 13 moving nodes share one translation;
fixed geometry keeps its order, and only the moving nodes are reinserted when
their settled depth slots change. There are no timers or event handlers in the
asset. `MAGNET_ANCHORS` is normalised to the exact 960×540 SVG viewBox.
