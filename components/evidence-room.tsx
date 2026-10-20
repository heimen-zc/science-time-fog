'use client';

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Fingerprint,
  Film,
  KeyRound,
  LockKeyhole,
  ScanLine,
  Scissors,
  Sparkles,
  X,
} from 'lucide-react';
import { InductionBench, bindBench } from './induction-bench';
import { MagnetBench, bindMagnetBench } from './magnet-bench';
import {
  CASES,
  bounded,
  caseCandidates,
  frameFor,
  inspectProof,
  recordTitle,
  validateSelection,
  verifiedProofs,
  type CaseId,
  type EvidenceRecord,
  type GameProof,
} from '../lib/inquiry-game';
import './evidence-room.css';

const RingArt = memo(InductionBench);
const MagnetArt = memo(MagnetBench);
const asset = (path: string) =>
  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`;

/** Existing audited solid figures; cached path bindings avoid rebuilding geometry while scrubbing. */
function Projector({
  record,
  progress,
  label,
  modern = false,
}: {
  record: EvidenceRecord;
  progress: number;
  label: string;
  modern?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const ringUpdate = useRef<ReturnType<typeof bindBench> | null>(null);
  const magnetUpdate = useRef<ReturnType<typeof bindMagnetBench> | null>(null);
  useEffect(() => {
    if (!root.current) return;
    if (record.mode === 'ring') ringUpdate.current = bindBench(root.current);
    else magnetUpdate.current = bindMagnetBench(root.current);
    return () => {
      ringUpdate.current = null;
      magnetUpdate.current = null;
    };
  }, [record.mode]);
  const frame = useMemo(() => frameFor(record, progress), [record, progress]);
  useEffect(() => {
    if (frame.ring) ringUpdate.current?.({ ...frame.ring, field: modern });
    else magnetUpdate.current?.({ ...frame, field: modern });
  }, [frame, modern]);
  const direction =
    Math.abs(frame.needle) < 0.0001
      ? '归零'
      : `${Math.abs(frame.needle) < 0.02 ? '微弱' : ''}${frame.needle > 0 ? '向右偏转' : '向左偏转'}`;
  return (
    <figure className="er-projector">
      <figcaption>
        <span>{label}</span>
        <b>{recordTitle(record)}</b>
        <small>记录 #{record.id.toString().padStart(2, '0')}</small>
      </figcaption>
      <div className="er-projection" ref={root}>
        {record.mode === 'ring' ? <RingArt /> : <MagnetArt />}
      </div>
      <div className="er-meter">
        <span className={Math.abs(frame.needle) >= 0.0001 ? 'is-current' : ''}>
          <i />
          {direction}
        </span>
        {record.mode === 'magnet' && (
          <span>
            磁铁
            {frame.position > 0.975
              ? '仍在近处'
              : frame.position < 0.025
                ? '在远处'
                : '位于轨道中'}
          </span>
        )}
      </div>
      <small className="er-model-note">
        {record.mode === 'magnet'
          ? '按你保存的位置与指针数据回放'
          : '按记录条件重建的慢放教学模型'}{' '}
        · 非实物录像{modern ? ' · 现代磁通量示意' : ''}
      </small>
    </figure>
  );
}

function Trace({ record }: { record: EvidenceRecord }) {
  const path = useMemo(
    () =>
      Array.from(
        { length: 61 },
        (_, i) =>
          `${i ? 'L' : 'M'}${i * 2},${24 - frameFor(record, i / 60).needle * 18}`,
      ).join(' '),
    [record],
  );
  return (
    <svg viewBox="0 0 120 48" aria-hidden="true">
      <path d="M0 24H120" className="er-trace-zero" />
      <path d={path} />
    </svg>
  );
}

export function EvidenceRoom({
  records,
  proofs,
  preview = false,
  onProof,
  onArchive,
  onCollect,
  onBack,
  onStart,
}: {
  records: EvidenceRecord[];
  proofs: GameProof[];
  preview?: boolean;
  onProof: (proof: GameProof) => void;
  onArchive: () => void;
  onCollect: (mode: 'ring' | 'magnet') => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const verified = verifiedProofs(proofs, records);
  const [caseId, setCaseId] = useState<CaseId>(
    () =>
      CASES.find((c) => !verified.some((p) => p.caseId === c.id))?.id ??
      'static',
  );
  const [slots, setSlots] = useState<(number | null)[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [cut, setCut] = useState(false);
  const [notice, setNotice] = useState('');
  const [hintLevel, setHintLevel] = useState(0);
  const [reward, setReward] = useState(false);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const rewardDialog = useRef<HTMLDialogElement>(null);
  const director = useRef<HTMLOutputElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const dragged = useRef<{
    id: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const ignoreClick = useRef(false);
  useEffect(() => {
    const dialog = rewardDialog.current;
    if (reward && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [reward]);
  const current = CASES.find((c) => c.id === caseId)!;
  const candidates = useMemo(
    () => caseCandidates(caseId, records),
    [caseId, records],
  );
  const slotCount = caseId === 'jolt' ? 2 : caseId === 'leak' ? 1 : 3;
  const ids = Array.from({ length: slotCount }, (_, i) => slots[i] ?? -1);
  const selected = ids.map((id) => records.find((r) => r.id === id));
  const filled = selected.every(Boolean);
  const selection = validateSelection(caseId, ids, records);
  const inspected = inspectProof(caseId, ids, progress, cut, records);
  const solved = verified.some((p) => p.caseId === caseId);
  const allSolved = verified.length === 3;
  const missing =
    caseId === 'jolt'
      ? candidates.length < 2 ||
        !candidates.some((a) =>
          candidates.some(
            (b) => validateSelection('jolt', [a.id, b.id], records).ok,
          ),
        )
      : caseId === 'leak'
        ? !candidates.some((r) => validateSelection('leak', [r.id], records).ok)
        : !candidates.some((a) =>
            candidates.some((b) =>
              candidates.some(
                (c) =>
                  validateSelection('static', [a.id, b.id, c.id], records).ok,
              ),
            ),
          );
  const segment = Math.min(2, Math.floor(progress * 3));
  const reelRecord = caseId === 'static' ? selected[segment] : selected[0];
  const hints =
    caseId === 'jolt'
      ? [
          '把实验动作固定下来，例如两次都合上开关。只改变电池的正反方向。',
          '找“正接电池 · 合上开关”和“反接电池 · 合上开关”。放好后，把光标向开头挪一点，比较两个指针。',
          '金色胶片是可用的一组对照。分别放进 A、B 槽；光标约在开头的 10% 时，试着定格。',
        ]
      : caseId === 'leak'
        ? [
            '如果电池漏电是必要原因，没有电池时还会不会出现响应？',
            '先点“移开电池”，再装入“磁铁 · 靠近线圈”或“远离线圈”。旋钮不要停在刚开始。',
            '装入金色运动胶片，把光标拖到靠后的位置；只有指针真的响应时，才能保存证据。',
          ]
        : [
            '像剪一段小电影：靠近 → 在近处停住 → 远离。',
            '停住并不等于磁铁消失。去影片中间，看看磁铁的位置和指针是否矛盾。',
            '把三张胶片按标注放好，再把光标拖到 50%。定格的是“近处停住”的零结果，而不是远处的零。',
          ];

  const switchCase = (id: CaseId) => {
    setCaseId(id);
    setSlots([]);
    setPicked(null);
    setProgress(0);
    setCut(false);
    setNotice('');
    setHintLevel(0);
    setReward(false);
    requestAnimationFrame(() => director.current?.focus());
  };
  const place = (id: number, index: number) => {
    // COSEC: Accept only a real notebook record and a bounded, existing socket index.
    if (
      !candidates.some((r) => r.id === id) ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= slotCount
    )
      return;
    setSlots((old) =>
      Array.from({ length: slotCount }, (_, i) =>
        i === index ? id : old[i] === id ? null : (old[i] ?? null),
      ),
    );
    setPicked(null);
    setProgress(0);
    setNotice('');
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const d = dragged.current;
    if (!d) return;
    if (Math.hypot(event.clientX - d.x, event.clientY - d.y) > 8)
      d.moved = true;
    if (!d.moved) return;
    if (ghost.current) {
      ghost.current.style.opacity = '1';
      ghost.current.style.transform = `translate(${event.clientX + 12}px,${event.clientY - 42}px) rotate(-6deg)`;
    }
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-evidence-slot]');
    setHoverSlot(target ? Number(target.dataset.evidenceSlot) : null);
  };
  const release = (
    event: PointerEvent<HTMLButtonElement>,
    cancelled = false,
  ) => {
    const d = dragged.current;
    if (d?.moved) {
      ignoreClick.current = true;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-evidence-slot]');
      if (!cancelled && target)
        place(d.id, Number(target.dataset.evidenceSlot));
      else setPicked(d.id);
      window.setTimeout(() => {
        ignoreClick.current = false;
      }, 0);
    }
    dragged.current = null;
    setHoverSlot(null);
    if (ghost.current) ghost.current.style.opacity = '0';
  };
  const capture = () => {
    if (!inspected.ok) {
      setNotice(inspected.message);
      return;
    }
    onProof({ caseId, evidenceIds: ids, checkpoint: progress, cut });
    setReward(true);
    setNotice('');
  };
  const highlighted = (r: EvidenceRecord) =>
    hintLevel >= 3 &&
    (caseId === 'jolt'
      ? r.action === 'connect'
      : caseId === 'leak'
        ? r.mode === 'magnet' && r.action !== 'hold'
        : true);
  let instruction = current.goal as string;
  if (caseId === 'jolt' && !filled)
    instruction = !selected[0]
      ? '先拿起一卷“合上开关”的胶片，放入 A 号回放机。'
      : 'A 机准备好了。给 B 机装入相同动作、只反转电池的胶片。';
  if (caseId === 'static' && !filled)
    instruction = `下一步：拿起“${['靠近线圈', '近处停住', '远离线圈'][selected.findIndex((r) => !r)]}”胶片，放入对应的空插槽。`;
  if (caseId === 'leak' && !cut)
    instruction = '先点桌上的电池，把这条解释依赖的供电路径移走。';
  else if (caseId === 'leak' && !filled)
    instruction = '没有电池了。拿起一卷磁铁运动胶片，放进回放机。';
  if (picked !== null)
    instruction = `已拿起“${recordTitle(records.find((r) => r.id === picked)!)}”，点亮的插槽可以放入。`;
  else if (filled && !selection.ok) instruction = selection.message;
  else if (selection.ok && (caseId !== 'leak' || cut))
    instruction =
      caseId === 'static'
        ? '拖动放映光标，找出“磁铁还在，指针归零”的一刻。'
        : '拖动时间光标观察指针，找到关键瞬间后按“定格取证”。';

  return (
    <section
      className="evidence-room"
      style={
        {
          '--room-image': `url("${asset('/evidence-room.webp')}")`,
        } as CSSProperties
      }
      aria-label="法拉第证据密室"
    >
      <div className="er-atmosphere" aria-hidden="true" />
      <div className="er-shell">
        <nav className="er-nav" aria-label="实验历险导航">
          <button onClick={onBack}>
            <ArrowLeft size={16} />
            时空地图
          </button>
          <span>1831 · 伦敦 / 皇家研究所</span>
          <span className="er-chapter">第二幕 · 证据密室</span>
        </nav>
        {preview && (
          <div className="er-preview">
            <Film size={16} />
            <span>
              密室预演 · 使用明确标记的教学样例，不计入你的真实实验和经验值。
            </span>
            <button onClick={onStart}>
              亲手做实验 <ArrowRight size={15} />
            </button>
          </div>
        )}
        <header className="er-heading">
          <div>
            <p className="er-eyebrow">THE EVIDENCE ROOM</p>
            <h1>让证据，击穿迷雾。</h1>
            <p>不是猜中答案。是让一个解释，经得住检验。</p>
          </div>
          <div
            className="er-seals"
            aria-label={`已获得 ${verified.length} 枚科学方法印章`}
          >
            {CASES.map((c) => (
              <button
                key={c.id}
                onClick={() => switchCase(c.id)}
                className={`${caseId === c.id ? 'is-active' : ''} ${verified.some((p) => p.caseId === c.id) ? 'is-earned' : ''}`}
                aria-label={`${c.title}：${verified.some((p) => p.caseId === c.id) ? '已完成' : '待检验'}`}
                aria-current={caseId === c.id ? 'step' : undefined}
              >
                <span>
                  {verified.some((p) => p.caseId === c.id) ? (
                    <Check size={20} />
                  ) : (
                    c.number
                  )}
                </span>
                <small>{c.method}</small>
              </button>
            ))}
          </div>
        </header>

        <div className={`er-case ${solved ? 'is-solved' : ''}`} key={caseId}>
          <div className="er-suspect">
            <div className="er-fingerprint">
              <Fingerprint size={44} strokeWidth={1} />
            </div>
            <div>
              <span>待检验的解释 / {current.number}</span>
              <h2>{current.title}</h2>
              <p>{current.claim}</p>
            </div>
            <div className="er-charge">
              {solved ? '证据已归档' : current.suspect}
            </div>
          </div>
          <output className="er-director" ref={director} tabIndex={-1}>
            <span className="er-director-icon">
              <ScanLine size={20} />
            </span>
            <span className="er-director-text">{notice || instruction}</span>
            <button
              onClick={() => setHintLevel((n) => Math.min(3, n + 1))}
              aria-label="获得一步提示"
            >
              <CircleHelp size={18} />
              {hintLevel ? '再提示一点' : '给我一点提示'}
            </button>
          </output>
          {hintLevel > 0 && (
            <div className="er-hint">
              <Sparkles size={16} />
              <span>{hints[hintLevel - 1]}</span>
              <button aria-label="收起提示" onClick={() => setHintLevel(0)}>
                <X size={16} />
              </button>
            </div>
          )}

          {missing ? (
            <div className="er-missing">
              <div className="er-empty-reels">
                <Film size={60} strokeWidth={1} />
                <LockKeyhole size={26} />
              </div>
              <h3>回放机在等你的证据</h3>
              <p>
                这里不会替你编造记录。先亲手完成
                {caseId === 'jolt'
                  ? '感应环的电池正反对照'
                  : '磁铁靠近、近处停住、远离'}
                ，胶片就会自动送进来。
              </p>
              <button
                className="er-primary"
                onClick={() => onCollect(caseId === 'jolt' ? 'ring' : 'magnet')}
              >
                返回实验台，收集这份证据 <ArrowRight size={17} />
              </button>
              <small>已有记录和印章会保留，不用从头开始。</small>
            </div>
          ) : (
            <>
              {caseId === 'leak' && (
                <div className={`er-battery-test ${cut ? 'is-cut' : ''}`}>
                  <div className="er-explanation-path">
                    <span>假说中的供电路径</span>
                    <span className="er-wire" />
                    <button
                      onClick={() => {
                        setCut((v) => !v);
                        setNotice('');
                      }}
                      aria-pressed={cut}
                      className="er-battery"
                    >
                      <span className="er-battery-poles">+ −</span>
                      <b>{cut ? '电池已移开' : '移开这块电池'}</b>
                      <Scissors size={20} />
                    </button>
                    <span className="er-wire" />
                    <span>铁环 → 另一个线圈？</span>
                  </div>
                  <small>
                    {cut
                      ? '现在只检查你保存的无电池实验，回放不生成新记录。'
                      : '这是对解释的拆解，不是改写当年的实验操作。'}
                  </small>
                </div>
              )}
              <div
                className={`er-viewing ${caseId === 'jolt' ? 'er-dual' : 'er-single'}`}
              >
                {caseId === 'jolt' ? (
                  [0, 1].map((i) => (
                    <div key={i} className="er-projector-well">
                      {selected[i] ? (
                        <Projector
                          record={selected[i]!}
                          progress={progress}
                          label={`同步回放 ${i ? 'B' : 'A'}`}
                        />
                      ) : (
                        <div className="er-screen-empty">
                          <Film size={50} strokeWidth={0.8} />
                          <span>{i ? 'B' : 'A'} 号回放机</span>
                          <small>装入胶片，实验才会亮起</small>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="er-projector-well">
                    {reelRecord ? (
                      <Projector
                        key={reelRecord.mode}
                        record={reelRecord}
                        progress={
                          caseId === 'static'
                            ? progress * 3 - segment
                            : progress
                        }
                        label={
                          caseId === 'static'
                            ? [
                                '第一段 · 靠近',
                                '第二段 · 近处停住',
                                '第三段 · 远离',
                              ][segment]
                            : '无电池装置'
                        }
                        modern={caseId === 'static' && selection.ok}
                      />
                    ) : (
                      <div className="er-screen-empty">
                        <Film size={56} strokeWidth={0.8} />
                        <span>
                          {caseId === 'static'
                            ? '把三段实验，接成一个故事'
                            : '放入一份无电池的运动证据'}
                        </span>
                        <small>你保存的操作，将在这里重新上演</small>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div
                className={`er-sockets ${caseId === 'static' ? 'er-filmstrip' : ''}`}
                aria-label="证据插槽"
              >
                {Array.from({ length: slotCount }, (_, i) => (
                  <button
                    key={i}
                    data-evidence-slot={i}
                    className={`${picked !== null || hoverSlot === i ? 'is-ready' : ''} ${selected[i] ? 'is-loaded' : ''}`}
                    onClick={() => {
                      if (picked !== null) place(picked, i);
                      else if (selected[i]) {
                        setPicked(selected[i]!.id);
                        setSlots((old) =>
                          old.map((id, index) => (index === i ? null : id)),
                        );
                        setProgress(0);
                      }
                    }}
                    aria-label={`${caseId === 'static' ? ['靠近', '停住', '远离'][i] : String.fromCharCode(65 + i)} 插槽：${selected[i] ? recordTitle(selected[i]!) + '，点击取出或替换' : '点击放入已拿起的胶片'}`}
                  >
                    <span className="er-socket-index">
                      {caseId === 'static'
                        ? ['Ⅰ', 'Ⅱ', 'Ⅲ'][i]
                        : String.fromCharCode(65 + i)}
                    </span>
                    <span>
                      {selected[i]
                        ? recordTitle(selected[i]!)
                        : caseId === 'static'
                          ? ['放入靠近', '放入近处停住', '放入远离'][i]
                          : '点这里放入胶片'}
                    </span>
                    {selected[i] ? <X size={15} /> : <Film size={17} />}
                  </button>
                ))}
              </div>
              <div className={`er-transport ${selection.ok ? 'is-live' : ''}`}>
                <div className="er-time-label">
                  <Film size={16} />
                  <label htmlFor="evidence-playhead">
                    {caseId === 'jolt' ? '同步时间旋钮' : '放映光标'}
                  </label>
                  <output>{Math.round(progress * 100)}%</output>
                </div>
                <input
                  id="evidence-playhead"
                  type="range"
                  min="0"
                  max="1000"
                  step="1"
                  value={Math.round(progress * 1000)}
                  disabled={!selection.ok || (caseId === 'leak' && !cut)}
                  onChange={(e) => {
                    setProgress(bounded(Number(e.target.value) / 1000));
                    setNotice('');
                  }}
                  aria-valuetext={`${Math.round(progress * 100)}%，${caseId === 'static' ? ['靠近', '近处停住', '远离'][segment] : '同步慢放'}`}
                />
                <div className="er-time-ticks">
                  <span>开始</span>
                  <span>
                    {caseId === 'static'
                      ? '近处停住'
                      : '拖动光标，检查真实响应'}
                  </span>
                  <span>结束</span>
                </div>
                <button
                  className={`er-capture ${inspected.ok ? 'can-capture' : ''}`}
                  onClick={capture}
                  disabled={!selection.ok || (caseId === 'leak' && !cut)}
                >
                  <ScanLine size={18} />
                  定格取证{inspected.ok && <span>关键帧</span>}
                </button>
              </div>

              <div className="er-inventory">
                <div className="er-inventory-heading">
                  <span>
                    <Film size={17} />
                    {preview ? '教学样例胶片' : '你的证据胶片'}
                  </span>
                  <small>拖进插槽 · 或点胶片，再点插槽</small>
                  <span>{candidates.length} 卷</span>
                </div>
                <div className="er-reel-belt">
                  {candidates.map((r) => (
                    <button
                      key={r.id}
                      className={`er-reel ${picked === r.id ? 'is-picked' : ''} ${ids.includes(r.id) ? 'is-used' : ''} ${highlighted(r) ? 'is-hinted' : ''}`}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        dragged.current = {
                          id: r.id,
                          x: e.clientX,
                          y: e.clientY,
                          moved: false,
                        };
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={move}
                      onPointerUp={(e) => release(e)}
                      onPointerCancel={(e) => release(e, true)}
                      onClick={() => {
                        if (!ignoreClick.current)
                          setPicked((v) => (v === r.id ? null : r.id));
                      }}
                      aria-pressed={picked === r.id}
                      aria-label={`拿起 ${recordTitle(r)}，记录 ${r.id}`}
                    >
                      <span className="er-reel-top">
                        <Film size={14} />
                        <span>
                          {preview ? '教学样例' : '亲手记录'} #
                          {r.id.toString().padStart(2, '0')}
                        </span>
                        {ids.includes(r.id) && <Check size={15} />}
                      </span>
                      <Trace record={r} />
                      <strong>{recordTitle(r)}</strong>
                      <small>
                        {r.mode === 'ring'
                          ? `${r.turns} 匝 · ${r.batteryPairs} 组电池 · ${r.core === 'iron' ? '铁芯' : '无铁芯'}`
                          : `无电池 · ${r.magnetCapture?.duration.toFixed(1) ?? '?'} 秒 · ${r.action === 'hold' ? '磁铁留在近处' : '保存的实际轨迹'}`}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {solved && !reward && (
            <div className="er-solved-bar">
              <Check size={18} />
              <span>
                已获得「{current.method}」印章。你可以重新摆弄证据，或继续前进。
              </span>
              <button
                onClick={() =>
                  allSolved
                    ? onArchive()
                    : switchCase(
                        CASES.find(
                          (c) => !verified.some((p) => p.caseId === c.id),
                        )!.id,
                      )
                }
              >
                {allSolved ? '打开历史档案箱' : '调查下一个解释'}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
        {allSolved && !reward && (
          <button className="er-vault-button" onClick={onArchive}>
            <KeyRound size={24} />
            <span>
              <small>三枚科学方法印章，已集齐</small>
              <b>打开法拉第的历史档案箱</b>
            </span>
            <ArrowRight size={22} />
          </button>
        )}
        <footer className="er-footer">
          <span>场景为 AI 创作的历史氛围插画，非档案照片</span>
          <span>用证据推进剧情 · 误判不扣分 · 可以随时重做</span>
        </footer>
      </div>
      <div ref={ghost} className="er-drag-ghost" aria-hidden="true">
        <Film size={22} />
        证据胶片
      </div>
      {reward && (
        <div className="er-reward-shade">
          <dialog
            ref={rewardDialog}
            className="er-reward"
            aria-labelledby="er-reward-title"
            onCancel={(e) => {
              e.preventDefault();
              setReward(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setReward(false);
              }
            }}
          >
            <div className="er-earned-seal">
              <Check size={42} strokeWidth={1.5} />
              <span>VERIFIED</span>
            </div>
            <p className="er-eyebrow">不是答对，是证明</p>
            <h2 id="er-reward-title">获得「{current.method}」印章</h2>
            <p>{current.discovery}</p>
            <div className="er-boundary">
              <b>证据也有边界</b>
              <p>{current.limit}</p>
            </div>
            <button
              autoFocus
              className="er-primary"
              onClick={() =>
                allSolved
                  ? onArchive()
                  : switchCase(
                      CASES.find(
                        (c) => !verified.some((p) => p.caseId === c.id),
                      )!.id,
                    )
              }
            >
              {allSolved
                ? '三枚印章集齐 · 打开历史档案箱'
                : '带着这份证据，继续调查'}
              <ArrowRight size={17} />
            </button>
            <small>回放只用于检查既有记录，不会替你生成新实验。</small>
          </dialog>
        </div>
      )}
    </section>
  );
}
