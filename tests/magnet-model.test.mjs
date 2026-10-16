import assert from 'node:assert/strict';
import test from 'node:test';
import {
  initialMagnet,
  magnetFlux,
  sampleMagnet,
  followMagnet,
  captureMagnet,
  validMagnetCycle,
  compareMagnetSpeeds,
  confirmedMagnetPair,
} from '../lib/magnet-model.ts';

function sweep(action, seconds) {
  let state = initialMagnet(action === 'withdraw' ? 1 : 0);
  const samples = [{ time: 0, position: state.position, signal: 0, needle: 0 }];
  for (let i = 1; i <= 240; i++) {
    const x = action === 'withdraw' ? 1 - i / 240 : i / 240;
    state = sampleMagnet(state, x, seconds / 240);
    samples.push({
      time: (i * seconds) / 240,
      position: x,
      signal: state.signal,
      needle: state.needle,
    });
  }
  return captureMagnet(action, samples);
}

test('stopping near the coil retains flux but makes induced response zero', () => {
  const near = sampleMagnet(initialMagnet(1), 1, 0.5);
  assert.ok(near.flux > 0.99);
  assert.equal(near.signal, 0);
  assert.equal(near.emf, 0);
  assert.ok(magnetFlux(0) < magnetFlux(0.5) && magnetFlux(0.5) < magnetFlux(1));
});
test('real displacement reverses the signal, and a faster identical path strengthens it', () => {
  const forward = sampleMagnet(initialMagnet(0.7), 0.71, 0.02);
  const backward = sampleMagnet(initialMagnet(0.71), 0.7, 0.02);
  const fast = sampleMagnet(initialMagnet(0.7), 0.71, 0.01);
  assert.equal(forward.emf, -backward.emf);
  assert.equal(forward.signal, -backward.signal);
  assert.equal(fast.signal, 2 * forward.signal);
  assert.ok(
    Math.abs(forward.emf + (forward.flux - magnetFlux(0.7)) / 0.02) < 1e-10,
  );
});
test('pointer following is bounded and settles without an idle experiment', () => {
  let state = initialMagnet();
  for (let i = 0; i < 300; i++) state = followMagnet(state, 1, 1 / 60);
  assert.equal(state.position, 1);
  assert.equal(state.needle, 0);
  assert.equal(state.signal, 0);
  assert.equal(sampleMagnet(state, NaN, 0.02).position, 0);
  assert.equal(sampleMagnet(state, 1, 0), state);
});
test('only a completed near / stationary-near / away cycle is evidence', () => {
  const insert = sweep('insert', 2);
  const away = sweep('withdraw', 2);
  const hold = captureMagnet('hold', [
    { time: 0, position: 1, signal: 0, needle: 0 },
    { time: 1.5, position: 1, signal: 0, needle: 0 },
  ]);
  assert.equal(validMagnetCycle([insert, hold, away]), true);
  assert.equal(validMagnetCycle([insert, away]), false);
  assert.equal(
    validMagnetCycle([insert, { ...hold, start: 0, end: 0 }, away]),
    false,
  );
  assert.equal(validMagnetCycle([insert, { ...hold, peak: 0.1 }, away]), false);
});
test('speed evidence requires the same full path and does not award indistinguishable results', () => {
  const slow = sweep('insert', 3),
    fast = sweep('insert', 1);
  assert.equal(compareMagnetSpeeds(slow, fast), 'confirmed');
  assert.equal(compareMagnetSpeeds(slow, sweep('insert', 2.9)), 'similar');
  assert.equal(
    compareMagnetSpeeds(slow, { ...fast, end: 0.6 }),
    'inconclusive',
  );
  assert.equal(
    compareMagnetSpeeds(slow, { ...fast, travel: 1.4 }),
    'inconclusive',
  );
  assert.deepEqual(confirmedMagnetPair([slow, { ...fast, travel: 1.4 }]), []);
  assert.equal(
    confirmedMagnetPair([slow, { ...fast, travel: 1.4 }, fast]).length,
    2,
  );
});
