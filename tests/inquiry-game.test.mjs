import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CASES,
  caseCandidates,
  decodeNotebook,
  frameFor,
  inspectProof,
  makePreviewEvidence,
  notebookSnapshot,
  proofValid,
  validateSelection,
  verifiedProofs,
} from '../lib/inquiry-game.ts';
const records = makePreviewEvidence();
const proof = (caseId, evidenceIds, checkpoint, cut = false) => ({
  caseId,
  evidenceIds,
  checkpoint,
  cut,
});
test('many optional retries never evict the original controlled pair, cycle or verified proofs', () => {
  const many = [
    ...records,
    ...Array.from({ length: 70 }, (_, i) => ({
      ...records[6],
      id: 100 + i,
      signature: `extra-${i}`,
    })),
  ];
  const proofs = [
    proof('jolt', [1, 4], 0.1),
    proof('leak', [7], 0.9, true),
    proof('static', [7, 8, 9], 0.5),
  ];
  const saved = notebookSnapshot(many, proofs);
  assert.equal(saved.records.length, 24);
  assert.equal(saved.proofs.length, 3);
  assert.equal(decodeNotebook(JSON.stringify(saved)).proofs.length, 3);
});
test('explicit preview offers three solvable, distinct investigations', () => {
  assert.equal(records.length, 9);
  assert.ok(records.every((r) => r.observation.includes('教学样例')));
  assert.ok(CASES.every((c) => caseCandidates(c.id, records).length <= 4));
  assert.equal(validateSelection('jolt', [1, 4], records).ok, true);
  assert.equal(validateSelection('leak', [7], records).ok, true);
  assert.equal(validateSelection('static', [7, 8, 9], records).ok, true);
});
test('polarity comparison rejects confounds, duplicates and unknown IDs', () => {
  assert.equal(validateSelection('jolt', [1, 6], records).ok, false);
  assert.match(validateSelection('jolt', [1, 6], records).message, /操作动作/);
  assert.equal(validateSelection('jolt', [1, 1], records).ok, false);
  assert.equal(validateSelection('jolt', [1, 999], records).ok, false);
  assert.equal(
    validateSelection(
      'jolt',
      [1, 4],
      records.map((r) => (r.id === 4 ? { ...r, turns: 200 } : r)),
    ).ok,
    false,
  );
});
test('pinning a conclusion requires a visible opposing response, not merely picking records', () => {
  assert.equal(inspectProof('jolt', [1, 4], 0, false, records).ok, false);
  assert.equal(inspectProof('jolt', [1, 4], 0.1, false, records).ok, true);
  assert.equal(inspectProof('jolt', [1, 4], 1, false, records).ok, false);
});
test('no-battery evidence requires movement and an actually responding saved frame', () => {
  assert.equal(validateSelection('leak', [1], records).ok, false);
  assert.equal(validateSelection('leak', [8], records).ok, false);
  assert.equal(inspectProof('leak', [7], 0.9, false, records).ok, false);
  assert.equal(inspectProof('leak', [7], 0, true, records).ok, false);
  assert.equal(inspectProof('leak', [7], 0.9, true, records).ok, true);
});
test('editing requires chronological records from the same actual cycle', () => {
  assert.equal(validateSelection('static', [9, 8, 7], records).ok, false);
  assert.equal(
    validateSelection(
      'static',
      [7, 8, 9],
      records.map((r) =>
        r.id === 8 ? { ...r, magnetSession: 'different' } : r,
      ),
    ).ok,
    false,
  );
});
test('the critical zero must be stationary NEAR the coil, not a far-away zero', () => {
  assert.equal(inspectProof('static', [7, 8, 9], 0, true, records).ok, false);
  assert.equal(inspectProof('static', [7, 8, 9], 0.5, true, records).ok, true);
  assert.equal(
    inspectProof(
      'static',
      [7, 8, 9],
      0.5,
      true,
      records.map((r) =>
        r.id === 8
          ? {
              ...r,
              magnetCapture: {
                ...r.magnetCapture,
                start: 0,
                end: 0,
                samples: r.magnetCapture.samples.map((s) => ({
                  ...s,
                  position: 0,
                })),
              },
            }
          : r,
      ),
    ).ok,
    false,
  );
});
test('archive gate recomputes all proofs; corrupt or duplicate conclusions cannot unlock it', () => {
  const proofs = [
    proof('jolt', [1, 4], 0.1),
    proof('leak', [7], 0.9, true),
    proof('static', [7, 8, 9], 0.5),
  ];
  assert.equal(verifiedProofs(proofs, records).length, 3);
  assert.equal(verifiedProofs([...proofs, proofs[0]], records).length, 3);
  assert.equal(proofValid({ ...proofs[0], checkpoint: NaN }, records), false);
  assert.equal(
    verifiedProofs(
      proofs,
      records.filter((r) => r.id !== 4),
    ).length,
    2,
  );
});
test('replay and proof checking never mutate or fabricate notebook observations', () => {
  const before = JSON.stringify(records);
  for (const c of CASES) {
    caseCandidates(c.id, records);
    validateSelection(c.id, [], records);
  }
  for (let t = 0; t <= 1; t += 0.01) records.forEach((r) => frameFor(r, t));
  assert.equal(JSON.stringify(records), before);
});
test('restore bounds untrusted data and verifies badges before restoring', () => {
  const restored = decodeNotebook(
    JSON.stringify({
      records,
      proofs: [proof('jolt', [1, 4], 0.1), proof('static', [7, 8, 9], 0)],
    }),
  );
  assert.equal(restored.records.length, 9);
  assert.equal(restored.proofs.length, 1);
  assert.equal(decodeNotebook('{'), null);
  assert.equal(
    decodeNotebook(
      JSON.stringify({ records: [...records, records[0]], proofs: [] }),
    ),
    null,
  );
  assert.equal(
    decodeNotebook(
      JSON.stringify({
        records: records.map((r) =>
          r.id === 7
            ? {
                ...r,
                magnetCapture: {
                  ...r.magnetCapture,
                  samples: [{ time: 0, position: 99 }],
                },
              }
            : r,
        ),
        proofs: [],
      }),
    ),
    null,
  );
  assert.equal(
    decodeNotebook(
      JSON.stringify({
        records: records.map((r) =>
          r.id === 1 ? { ...r, mode: 'arbitrary-css' } : r,
        ),
        proofs: [],
      }),
    ),
    null,
  );
});
