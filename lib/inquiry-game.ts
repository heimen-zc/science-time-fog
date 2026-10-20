import { inductionAt, TRANSIENT_SECONDS } from './induction-model.ts';
import {
  captureMagnet,
  initialMagnet,
  magnetFlux,
  sampleMagnet,
  validMagnetCycle,
  type MagnetCapture,
} from './magnet-model.ts';

export type EvidenceRecord = {
  id: number;
  mode: 'ring' | 'magnet';
  action: 'connect' | 'hold' | 'disconnect' | 'insert' | 'withdraw';
  core: 'iron' | 'copper' | 'air';
  polarity: 'normal' | 'reversed';
  turns: number;
  batteryPairs: number;
  motionSpeed: number;
  direction: 'left' | 'right' | 'none';
  strength: number;
  observation: string;
  signature: string;
  magnetCapture?: MagnetCapture;
  magnetSession?: string;
};
export const CASES = [
  {
    id: 'jolt',
    number: '01',
    title: '是谁碰动了指针？',
    suspect: '桌面震动说',
    claim: '“也许只是合上开关时，桌子震了一下。”',
    goal: '给两台回放机装入只改变电池方向的记录。',
    method: '控制变量',
    discovery:
      '相同的通电动作，只反转电池，指针便反向。单靠桌面震动，解释不了这个有规律的反转。',
    limit: '它排除了“纯粹震动”的解释，还没有排除所有其他解释。',
  },
  {
    id: 'leak',
    number: '02',
    title: '没有电池，谁在供电？',
    suspect: '铁环漏电说',
    claim: '“一定是电池的电流，偷偷漏进了另一个线圈。”',
    goal: '先移开解释中的电池，再装入一份不需要电池的运动记录。',
    method: '排除替代解释',
    discovery:
      '磁铁与线圈这组装置没有电池，也没有连接两组绕线的铁环；磁铁运动时仍有响应。铁环漏电不是这类现象的必要条件。',
    limit: '这不是说所有装置绝不漏电，而是这份无电池的证据不能用铁环漏电解释。',
  },
  {
    id: 'static',
    number: '03',
    title: '消失的电流',
    suspect: '有磁性就一直有电流说',
    claim: '“只要磁铁在附近，电流就应该一直存在。”',
    goal: '把靠近、停住、远离接成一段影片，找出最容易被忽略的一刻。',
    method: '保存零结果',
    discovery:
      '磁铁仍在线圈附近，停住后指针归零；移动时才有响应。在这组条件下，关键不是“有磁铁”，而是穿过线圈的磁通量在变化。',
    limit:
      '这是对这组实验的判断，不等于已经测出了适用于所有几何形状的定量定律。',
  },
] as const;
export type CaseId = (typeof CASES)[number]['id'];
export type GameProof = {
  caseId: CaseId;
  evidenceIds: number[];
  checkpoint: number;
  cut: boolean;
};
export const bounded = (n: number) =>
  Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;

export function recordTitle(r: EvidenceRecord) {
  if (r.mode === 'ring')
    return `${r.polarity === 'normal' ? '正接' : '反接'}电池 · ${{ connect: '合上开关', hold: '保持通电', disconnect: '断开开关', insert: '', withdraw: '' }[r.action]}`;
  return `磁铁 · ${{ insert: '靠近线圈', hold: '近处停住', withdraw: '远离线圈', connect: '', disconnect: '' }[r.action]}`;
}
function fairPair(a: EvidenceRecord, b: EvidenceRecord) {
  return (
    a.mode === 'ring' &&
    b.mode === 'ring' &&
    a.action !== 'hold' &&
    a.action === b.action &&
    a.core === b.core &&
    a.turns === b.turns &&
    a.batteryPairs === b.batteryPairs &&
    a.motionSpeed === b.motionSpeed &&
    a.polarity !== b.polarity &&
    a.direction !== 'none' &&
    b.direction !== 'none' &&
    a.direction !== b.direction
  );
}
export function caseCandidates(
  id: CaseId,
  records: EvidenceRecord[],
): EvidenceRecord[] {
  if (id === 'jolt') {
    const a = records.find((r) => records.some((b) => fairPair(r, b)));
    const b = a && records.find((r) => fairPair(a, r));
    const distractors = records.filter(
      (r) => r.mode === 'ring' && r.id !== a?.id && r.id !== b?.id,
    );
    return [
      a,
      distractors.find((r) => r.action === 'hold'),
      b,
      distractors.find((r) => r.action !== 'hold'),
    ]
      .filter((r): r is EvidenceRecord => Boolean(r))
      .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i)
      .slice(0, 4);
  }
  const cycle = records.filter((r) => r.mode === 'magnet' && r.magnetCapture);
  const session = cycle.find((r) =>
    validMagnetCycle(
      cycle
        .filter((b) => b.magnetSession === r.magnetSession)
        .flatMap((b) => (b.magnetCapture ? [b.magnetCapture] : [])),
    ),
  )?.magnetSession;
  const group = session
    ? cycle.filter((r) => r.magnetSession === session)
    : records.filter((r) => r.mode === 'magnet');
  const ordered = ['withdraw', 'insert', 'hold']
    .map((action) => group.find((r) => r.action === action))
    .filter((r): r is EvidenceRecord => Boolean(r));
  if (id === 'leak')
    return [
      ...ordered,
      ...records
        .filter((r) => r.mode === 'ring' && r.action === 'connect')
        .slice(0, 1),
    ].slice(0, 4);
  return ordered;
}
export function validateSelection(
  id: CaseId,
  ids: number[],
  records: EvidenceRecord[],
) {
  const expected = id === 'jolt' ? 2 : id === 'leak' ? 1 : 3;
  if (ids.length !== expected || new Set(ids).size !== expected)
    return {
      ok: false,
      message: '每个插槽需要一份不同的记录。先从下方拿起胶片，再放入空位。',
    };
  const selected = ids.map((n) => records.find((r) => r.id === n));
  if (selected.some((r) => !r))
    return { ok: false, message: '这份记录已不在实验本中，请重新装入。' };
  const [a, b, c] = selected as EvidenceRecord[];
  if (id === 'jolt') {
    if (fairPair(a, b))
      return {
        ok: true,
        message: '条件吻合。转动时间旋钮，让两台检流计说话。',
      };
    const changes = [
      a.mode !== b.mode && '装置',
      a.action !== b.action && '操作动作',
      a.core !== b.core && '铁芯',
      a.turns !== b.turns && '线圈匝数',
      a.batteryPairs !== b.batteryPairs && '电池数量',
      a.motionSpeed !== b.motionSpeed && '操作速率',
    ].filter(Boolean);
    return {
      ok: false,
      message: changes.length
        ? `还同时改变了${changes.join('、')}。请保留相同的动作，只反转电池方向。`
        : '需要同一种通断动作、相反的电池方向；保持通电的零读数不能代替方向对照。',
    };
  }
  if (id === 'leak')
    return a.mode === 'magnet' &&
      a.action !== 'hold' &&
      a.strength > 0 &&
      Boolean(a.magnetCapture?.samples.some((s) => Math.abs(s.needle) > 0.0001))
      ? {
          ok: true,
          message: '这份记录来自无电池装置。转动旋钮，寻找运动中的响应。',
        }
      : {
          ok: false,
          message:
            a.mode === 'ring'
              ? '这份记录仍用了电池，不能排除电池漏电。换成磁铁与线圈的运动胶片。'
              : '停住时没有电流响应。要检验漏电说，需要无电池、但确实出现响应的记录。',
        };
  const order =
    a.action === 'insert' && b.action === 'hold' && c.action === 'withdraw';
  const sameSession =
    a.magnetSession &&
    a.magnetSession === b.magnetSession &&
    b.magnetSession === c.magnetSession;
  const captures = [a, b, c].flatMap((r) =>
    r.magnetCapture ? [r.magnetCapture] : [],
  );
  return order &&
    sameSession &&
    captures.length === 3 &&
    validMagnetCycle(captures)
    ? {
        ok: true,
        message: '胶片接通了。拖动放映光标，找到“磁铁还在，指针却不动”的一刻。',
      }
    : {
        ok: false,
        message: order
          ? '需要同一次亲手操作中完整的靠近、近处停住、远离记录。请回实验台补齐。'
          : '故事接反了：先从远处靠近，再停在近处，最后远离。点击插槽可取出胶片。',
      };
}
export function frameFor(r: EvidenceRecord, progress: number) {
  const t = bounded(progress);
  if (r.mode === 'ring') {
    const action =
      r.action === 'connect' || r.action === 'disconnect' ? r.action : 'hold';
    const frame = inductionAt(action, r.polarity, t * TRANSIENT_SECONDS, false);
    return {
      needle: frame.needle,
      position: 0,
      flux: frame.flux,
      signal: frame.secondary,
      ring: frame,
    };
  }
  const cap = r.magnetCapture;
  if (!cap?.samples.length)
    return {
      needle: 0,
      position: 0,
      flux: magnetFlux(0),
      signal: 0,
      ring: null,
    };
  const seconds = t * cap.duration;
  let i = cap.samples.findIndex((s) => s.time >= seconds);
  if (i < 0) i = cap.samples.length - 1;
  const b = cap.samples[i];
  const a = cap.samples[Math.max(0, i - 1)];
  const f =
    b.time > a.time ? bounded((seconds - a.time) / (b.time - a.time)) : 0;
  const position = a.position + (b.position - a.position) * f;
  return {
    needle: a.needle + (b.needle - a.needle) * f,
    position,
    flux: magnetFlux(position),
    signal: a.signal + (b.signal - a.signal) * f,
    ring: null,
  };
}
export function inspectProof(
  id: CaseId,
  ids: number[],
  progress: number,
  cut: boolean,
  records: EvidenceRecord[],
) {
  const selection = validateSelection(id, ids, records);
  if (!selection.ok) return selection;
  const selected = ids.map((n) => records.find((r) => r.id === n)!);
  if (id === 'jolt') {
    const frames = selected.map((r) => frameFor(r, progress));
    const ok = frames[0].needle * frames[1].needle < -0.008;
    return {
      ok,
      message: ok
        ? '捕捉到了：相同动作，两支指针朝相反方向偏转。'
        : '现在还看不清方向差异。把光标移到通断开始后的偏转高点。',
    };
  }
  if (id === 'leak') {
    const f = frameFor(selected[0], progress);
    const peak = Math.max(
      ...selected[0].magnetCapture!.samples.map((s) => Math.abs(s.needle)),
    );
    const ok = cut && Math.abs(f.needle) > Math.max(0.0001, peak * 0.3);
    return {
      ok,
      message: !cut
        ? '先把解释中的电池移走，检验它是否真是不可缺少的。'
        : ok
          ? '没有电池，运动中的磁铁仍让指针偏转。'
          : '无电池装置里，寻找磁铁运动、指针明显响应的一帧。',
    };
  }
  const segment = Math.min(2, Math.floor(bounded(progress) * 3));
  const f = frameFor(selected[segment], bounded(progress) * 3 - segment);
  const ok =
    segment === 1 &&
    f.position > 0.975 &&
    Math.abs(f.needle) < 0.02 &&
    f.flux > 0.9;
  return {
    ok,
    message: ok
      ? '关键零结果：磁铁仍在近处，磁通量并不为零，但指针已经归零。'
      : '不是远处的零！把放映光标移到中间“近处停住”的片段，检查磁铁和指针。',
  };
}
export function proofValid(proof: GameProof, records: EvidenceRecord[]) {
  return (
    CASES.some((c) => c.id === proof.caseId) &&
    Number.isFinite(proof.checkpoint) &&
    proof.checkpoint >= 0 &&
    proof.checkpoint <= 1 &&
    inspectProof(
      proof.caseId,
      proof.evidenceIds,
      proof.checkpoint,
      proof.cut,
      records,
    ).ok
  );
}
export const verifiedProofs = (
  proofs: GameProof[],
  records: EvidenceRecord[],
) =>
  CASES.flatMap((c) => {
    const p = proofs.find((p) => p.caseId === c.id && proofValid(p, records));
    return p ? [p] : [];
  });

/** Explicit preview fixtures only. Never merged into a visitor's experiment notebook. */
export function makePreviewEvidence(): EvidenceRecord[] {
  const records: EvidenceRecord[] = [];
  for (const polarity of ['normal', 'reversed'] as const)
    for (const action of ['connect', 'hold', 'disconnect'] as const) {
      const f = inductionAt(action, polarity, 0.24);
      records.push({
        id: records.length + 1,
        mode: 'ring',
        action,
        core: 'iron',
        polarity,
        turns: 120,
        batteryPairs: 1,
        motionSpeed: 1,
        direction: action === 'hold' ? 'none' : f.needle > 0 ? 'right' : 'left',
        strength: Math.abs(f.needle) * 100,
        observation: '教学样例：由共用模型生成，非你的实验记录。',
        signature: `preview:${polarity}:${action}`,
      });
    }
  for (const action of ['insert', 'hold', 'withdraw'] as const) {
    let state = initialMagnet(action === 'insert' ? 0 : 1);
    const duration = action === 'hold' ? 1.6 : 2;
    const samples = [
      { time: 0, position: state.position, signal: 0, needle: 0 },
    ];
    for (let i = 1; i <= 120; i++) {
      const position =
        action === 'hold' ? 1 : action === 'insert' ? i / 120 : 1 - i / 120;
      state = sampleMagnet(state, position, duration / 120);
      samples.push({
        time: (i * duration) / 120,
        position,
        signal: state.signal,
        needle: state.needle,
      });
    }
    const cap = captureMagnet(action, samples);
    records.push({
      id: records.length + 1,
      mode: 'magnet',
      action,
      core: 'air',
      polarity: 'normal',
      turns: 120,
      batteryPairs: 0,
      motionSpeed: action === 'hold' ? 0 : 1 / duration,
      direction:
        action === 'hold' ? 'none' : cap.signedPeak > 0 ? 'right' : 'left',
      strength: cap.peak * 100,
      observation: '教学样例：非你的实验记录。',
      signature: `preview:${action}`,
      magnetCapture: cap,
      magnetSession: 'preview-only',
    });
  }
  return records;
}

export const INQUIRY_STORAGE = 'science-time-fog:evidence-room:v1';
/** Keep proof-bearing observations and a complete cycle even after many optional retries. */
export function notebookSnapshot(
  records: EvidenceRecord[],
  proofs: GameProof[],
) {
  const keep = new Set(
    verifiedProofs(proofs, records).flatMap((p) => p.evidenceIds),
  );
  for (const c of CASES)
    for (const r of caseCandidates(c.id, records)) keep.add(r.id);
  for (const r of [...records].reverse()) {
    if (keep.size >= 24) break;
    keep.add(r.id);
  }
  const saved = records.filter((r) => keep.has(r.id)).slice(0, 24);
  return { records: saved, proofs: verifiedProofs(proofs, saved) };
}
/** COSEC: Browser storage is untrusted. Bound size, numbers, enums and sample arrays before use. */
export function decodeNotebook(
  raw: string | null,
): { records: EvidenceRecord[]; proofs: GameProof[] } | null {
  if (!raw || raw.length > 4_000_000) return null;
  try {
    const data = JSON.parse(raw);
    if (
      !data ||
      !Array.isArray(data.records) ||
      data.records.length > 24 ||
      !Array.isArray(data.proofs) ||
      data.proofs.length > 3
    )
      return null;
    const finite = (v: unknown, lo: number, hi: number) =>
      typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
    const records: EvidenceRecord[] = [];
    for (const r of data.records) {
      if (
        !r ||
        !Number.isSafeInteger(r.id) ||
        r.id < 1 ||
        records.some((x) => x.id === r.id) ||
        !['ring', 'magnet'].includes(r.mode) ||
        !['connect', 'hold', 'disconnect', 'insert', 'withdraw'].includes(
          r.action,
        ) ||
        (r.mode === 'ring' &&
          !['connect', 'hold', 'disconnect'].includes(r.action)) ||
        (r.mode === 'magnet' &&
          !['insert', 'hold', 'withdraw'].includes(r.action)) ||
        !['iron', 'copper', 'air'].includes(r.core) ||
        !['normal', 'reversed'].includes(r.polarity) ||
        !['left', 'right', 'none'].includes(r.direction) ||
        !finite(r.turns, 1, 10000) ||
        !finite(r.batteryPairs, 0, 100) ||
        !finite(r.motionSpeed, 0, 1000) ||
        !finite(r.strength, 0, 1e8) ||
        typeof r.observation !== 'string' ||
        r.observation.length > 2000 ||
        typeof r.signature !== 'string' ||
        r.signature.length > 1000
      )
        return null;
      let cap: MagnetCapture | undefined;
      if (r.magnetCapture) {
        const c = r.magnetCapture;
        if (
          r.mode !== 'magnet' ||
          c.action !== r.action ||
          typeof r.magnetSession !== 'string' ||
          r.magnetSession.length > 100 ||
          !Array.isArray(c.samples) ||
          c.samples.length < 2 ||
          c.samples.length > 1200 ||
          !finite(c.duration, 0.001, 3600)
        )
          return null;
        let last = -1;
        for (const s of c.samples) {
          if (
            !s ||
            !finite(s.time, 0, 3600) ||
            s.time < last ||
            !finite(s.position, 0, 1) ||
            !finite(s.signal, -1e6, 1e6) ||
            !finite(s.needle, -1, 1)
          )
            return null;
          last = s.time;
        }
        cap = captureMagnet(c.action, c.samples);
      }
      records.push({
        id: r.id,
        mode: r.mode,
        action: r.action,
        core: r.core,
        polarity: r.polarity,
        turns: r.turns,
        batteryPairs: r.batteryPairs,
        motionSpeed: r.motionSpeed,
        direction: r.direction,
        strength: r.strength,
        observation: r.observation,
        signature: r.signature,
        ...(cap ? { magnetCapture: cap, magnetSession: r.magnetSession } : {}),
      });
    }
    const proofs = data.proofs.filter(
      (p: GameProof) =>
        p &&
        Array.isArray(p.evidenceIds) &&
        typeof p.cut === 'boolean' &&
        proofValid(p, records),
    );
    return { records, proofs: verifiedProofs(proofs, records) };
  } catch {
    return null;
  }
}
