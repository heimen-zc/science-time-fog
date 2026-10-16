import assert from 'node:assert/strict';
import test from 'node:test';
import {
  completedDiscovery,
  inductionAt,
  observationFor,
  PEAK_TIME,
  TRANSIENT_SECONDS,
} from '../lib/induction-model.ts';

test('steady primary current leaves a magnetic field but no secondary signal', () => {
  const held = inductionAt('hold', 'normal', 20);
  assert.equal(held.primary, 1);
  assert.equal(held.flux, 1);
  assert.equal(held.emf, 0);
  assert.equal(held.secondary, 0);
  assert.equal(held.needle, 0);
});

test('making/breaking and reversing the battery reverse the pulse', () => {
  const making = inductionAt('connect', 'normal', PEAK_TIME);
  const breaking = inductionAt('disconnect', 'normal', PEAK_TIME);
  const reversed = inductionAt('connect', 'reversed', PEAK_TIME);
  assert.ok(making.needle > 0.99);
  assert.equal(breaking.needle, -making.needle);
  assert.equal(reversed.needle, -making.needle);
  assert.equal(inductionAt('disconnect', 'normal', TRANSIENT_SECONDS).flux, 0);
});

test('EMF is the negative derivative of the same flux shown in the animation', () => {
  for (const action of ['connect', 'disconnect']) {
    for (const polarity of ['normal', 'reversed']) {
      for (const age of [0.1, 0.4, 0.9, 1.8]) {
        const dt = 1e-5;
        const derivative =
          (inductionAt(action, polarity, age + dt).flux -
            inductionAt(action, polarity, age - dt).flux) /
          (2 * dt);
        assert.ok(
          Math.abs(inductionAt(action, polarity, age).emf + derivative) < 1e-7,
        );
      }
    }
  }
});

test('a discovery requires actual complete controlled sequences in both polarities', () => {
  const normal = ['connect', 'hold', 'disconnect'].map((action, index) =>
    observationFor(action, 'normal', index + 1),
  );
  assert.equal(completedDiscovery(normal), false);
  const reversed = ['connect', 'hold', 'disconnect'].map((action, index) =>
    observationFor(action, 'reversed', index + 4),
  );
  assert.equal(completedDiscovery([...normal, ...reversed]), true);
  assert.equal(
    completedDiscovery([
      ...normal,
      ...reversed.map((record) => ({ ...record, direction: 'none' })),
    ]),
    false,
  );
});
