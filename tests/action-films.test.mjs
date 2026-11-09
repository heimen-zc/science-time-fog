import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  actionFilms,
  magnetActionFilms,
  ringActionFilms,
} from '../lib/action-films.ts';
import {
  PEAK_TIME,
  SWITCH_SECONDS,
  TRANSIENT_SECONDS,
  transientFrame,
} from '../lib/induction-model.ts';

function readFilm(buffer) {
  let i = 13 + (buffer[10] & 128 ? 3 * 2 ** ((buffer[10] & 7) + 1) : 0);
  let frames = 0,
    ticks = 0,
    loops = 1;
  const skipBlocks = () => {
    while (i < buffer.length && buffer[i]) i += buffer[i] + 1;
    i++;
  };
  while (i < buffer.length) {
    const marker = buffer[i++];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      const type = buffer[i++];
      if (type === 0xf9) ticks += buffer.readUInt16LE(i + 2);
      if (
        type === 0xff &&
        buffer.toString('ascii', i + 1, i + 12) === 'NETSCAPE2.0'
      )
        loops = buffer.readUInt16LE(i + 14);
      skipBlocks();
    } else if (marker === 0x2c) {
      const packed = buffer[i + 8];
      i += 9 + (packed & 128 ? 3 * 2 ** ((packed & 7) + 1) : 0) + 1;
      skipBlocks();
      frames++;
    } else assert.fail(`Unexpected GIF marker ${marker}`);
  }
  return { frames, ticks, loops };
}

test('every guided step has a small, finite animation and a still alternative', async () => {
  const ids = [
    ...Object.values(ringActionFilms),
    ...Object.values(magnetActionFilms),
  ];
  assert.deepEqual([...new Set(ids)].sort(), Object.keys(actionFilms).sort());
  for (const id of ids) {
    const files = ['gif', 'webp'].map(
      (ext) => new URL(`../public/action-films/${id}.${ext}`, import.meta.url),
    );
    const [gif, poster] = await Promise.all(
      files.map((file) => readFile(file)),
    );
    assert.equal(gif.toString('ascii', 0, 6), 'GIF89a', id);
    assert.equal(gif.readUInt16LE(6), 640, id);
    assert.equal(gif.readUInt16LE(8), 360, id);
    assert.ok(
      gif.length <= 340 * 1024,
      `${id} exceeds the per-clip size budget`,
    );
    const { frames, ticks, loops } = readFilm(gif);
    assert.ok(
      frames >= 15 && ticks >= 250 && ticks < 500,
      `${id} is a brief multi-frame film`,
    );
    assert.equal(loops, 1, `${id} must not loop indefinitely`);
    assert.equal(poster.toString('ascii', 8, 12), 'WEBP', id);
    assert.ok(poster.length <= 32 * 1024, id);
    assert.ok(
      actionFilms[id].action && actionFilms[id].watch && actionFilms[id].next,
    );
  }
});

test('film and live switch share contact delay, return to zero and polarity reversal', () => {
  const beforeContact = transientFrame('connect', 'normal', SWITCH_SECONDS / 2);
  assert.equal(beforeContact.primary, 0);
  assert.equal(Math.abs(beforeContact.needle), 0);
  assert.equal(beforeContact.closed, 0.5);
  assert.ok(
    transientFrame('connect', 'normal', SWITCH_SECONDS + PEAK_TIME).needle >
      0.9,
  );
  assert.ok(
    transientFrame('connect', 'reversed', SWITCH_SECONDS + PEAK_TIME).needle <
      -0.9,
  );
  assert.ok(transientFrame('disconnect', 'normal', PEAK_TIME).needle < -0.9);
  assert.ok(transientFrame('disconnect', 'reversed', PEAK_TIME).needle > 0.9);
  assert.equal(
    transientFrame(
      'connect',
      'normal',
      SWITCH_SECONDS + TRANSIENT_SECONDS + 0.01,
    ).needle,
    0,
  );
  assert.equal(
    transientFrame(
      'connect',
      'normal',
      SWITCH_SECONDS + TRANSIENT_SECONDS + 0.01,
    ).primary,
    1,
  );
});
