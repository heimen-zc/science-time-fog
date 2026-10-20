'use client';

/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The SVG has live path refs; the 2D projected drag control needs slider keyboard semantics. */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Hand,
  Lightbulb,
  Magnet,
  MoveHorizontal,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MagnetBench,
  MAGNET_ANCHORS,
  bindMagnetBench,
} from '@/components/magnet-bench';
import {
  captureMagnet,
  compareMagnetSpeeds,
  confirmedMagnetPair,
  followMagnet,
  initialMagnet,
  magnetPosition,
  magnetTrace,
  validMagnetCycle,
  type MagnetCapture,
  type MagnetSample,
} from '@/lib/magnet-model';
import './magnet-discovery.css';

type Phase =
  | 'approach'
  | 'hold'
  | 'away'
  | 'evidence'
  | 'rate'
  | 'retry'
  | 'complete';
const names = { insert: '靠近线圈', hold: '停住观察', withdraw: '远离线圈' };
const guidance: Record<Phase, { title: string; text: string; next: string }> = {
  approach: {
    title: '没有电池了，磁铁能让指针动吗？',
    text: '握住发光的磁铁，沿导轨拖向线圈。只移动磁铁，线圈与接线保持不变。',
    next: '把磁铁从远处拖到靠近位',
  },
  hold: {
    title: '现在停住，先别急着把磁铁拉走',
    text: '把磁铁留在靠近位，松开手。看看磁铁还在时，指针会不会一直偏转。',
    next: '停在靠近位，等观察圈走完',
  },
  away: {
    title: '磁铁还在，指针却归零了。现在拉远',
    text: '还是同一根磁铁、同一个磁极。沿原路把磁铁拖回远处，盯住指针方向。',
    next: '沿原路拖回远处',
  },
  evidence: {
    title: '不用电池，也留下了三种不同的观察',
    text: '你记录了靠近、停住、远离。先比较有无响应与方向，下一步再单独比较快慢。',
    next: '证据已保存 · 可以查看现代解释',
  },
  rate: {
    title: '同一段路，再换一种快慢',
    text: '磁极、线圈、接线和起终点不变。这次只改变移动的快慢，再拖向靠近位。',
    next: '同一路程，再靠近一次',
  },
  retry: {
    title: '这组结果还不能清楚比较快慢，没关系',
    text: '先把磁铁拖回远处，再按提示尝试一次。旧观察会保留，不必重做前面的实验。',
    next: '先拖回远处，为下一次比较做准备',
  },
  complete: {
    title: '把“有没有磁铁”与“磁通量有没有变化”分开了',
    text: '三时刻观察和同一路径快慢对照都已保存。带着实际操作留下的曲线，继续检验解释。',
    next: '本次实验完成 · 证据可以带入密室',
  },
};

function CaptureTrace({ record }: { record: MagnetCapture }) {
  return (
    <svg
      viewBox="0 0 240 70"
      role="img"
      aria-label={`${names[record.action]}的实际感应响应曲线`}
    >
      <path className="discovery-trace__zero" d="M0 35H240" />
      <path className="discovery-trace__signal" d={magnetTrace(record)} />
    </svg>
  );
}

export function MagnetDiscovery({
  onComplete,
  onBack,
  onExplore,
  initialCaptures = [],
}: {
  onComplete: (captures: MagnetCapture[]) => void;
  onBack: () => void;
  onExplore: () => void;
  initialCaptures?: MagnetCapture[];
}) {
  const initialRecords = validMagnetCycle(initialCaptures)
    ? initialCaptures
    : [];
  const initialPhase: Phase = confirmedMagnetPair(initialRecords).length
    ? 'complete'
    : initialRecords.length >= 3
      ? 'rate'
      : 'approach';
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [records, setRecords] = useState<MagnetCapture[]>(initialRecords);
  const [reference, setReference] = useState<MagnetCapture | null>(
    initialRecords.filter((record) => record.action === 'insert').at(-1) ??
      null,
  );
  const [hint, setHint] = useState(0);
  const [preview, setPreview] = useState(false);
  const [assisting, setAssisting] = useState(false);
  const [field, setField] = useState(false);
  const [trialMessage, setTrialMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const root = useRef<HTMLElement>(null);
  const instrument = useRef<HTMLDivElement>(null);
  const artboard = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const needle = useRef<SVGPathElement>(null);
  const readout = useRef<HTMLElement>(null);
  const movement = useRef<HTMLSpanElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const liveTrace = useRef<SVGPathElement>(null);
  const positionInput = useRef<HTMLInputElement>(null);
  const clockReadout = useRef<HTMLSpanElement>(null);
  const kick = useRef<() => void>(() => {});
  const paint = useRef<() => void>(() => {});
  const callbacks = useRef({
    phase: (_: Phase) => {},
    records: (_: MagnetCapture[]) => {},
    preview: (_: boolean) => {},
    assist: (_: boolean) => {},
    message: (_: string) => {},
    reference: (_: MagnetCapture | null) => {},
  });
  const runtime = useRef({
    state: initialMagnet(initialPhase === 'complete' ? 1 : 0),
    target: initialPhase === 'complete' ? 1 : 0,
    clock: 0,
    phase: initialPhase as Phase,
    trace: [] as MagnetSample[],
    records: initialRecords,
    reference:
      initialRecords.filter((record) => record.action === 'insert').at(-1) ??
      null,
    still: 0,
    field: false,
    preview: false,
    restore: 0,
    assist: null as null | {
      from: number;
      to: number;
      age: number;
      duration: number;
    },
    drag: null as null | {
      x: number;
      y: number;
      position: number;
      pointer: number;
    },
    rateFeedback: '',
  });
  const copy = guidance[phase];
  const canMove =
    !preview && ['approach', 'hold', 'away', 'rate', 'retry'].includes(phase);
  const wantsSlow = (reference?.duration ?? records[0]?.duration ?? 2) < 1.7;
  const ready = validMagnetCycle(records);
  const baseline =
    reference ?? records.find((record) => record.action === 'insert');
  const provenPair = confirmedMagnetPair(records);
  const comparison = provenPair[1];
  const showInstrument = () =>
    instrument.current?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  const changePhase = useCallback((next: Phase) => {
    runtime.current.phase = next;
    setPhase(next);
    setHint(0);
  }, []);
  useEffect(() => {
    callbacks.current = {
      phase: changePhase,
      records: setRecords,
      preview: setPreview,
      assist: setAssisting,
      message: setTrialMessage,
      reference: setReference,
    };
  }, [changePhase]);

  useEffect(() => {
    const stage = instrument.current;
    if (!stage) return;
    const bind = bindMagnetBench(stage);
    let animation = 0,
      last = 0,
      visible = true;
    const draw = () => {
      const r = runtime.current,
        s = r.state;
      bind({
        position: s.position,
        needle: s.needle,
        signal: s.signal,
        flux: s.flux,
        field: r.field,
      });
      const far = MAGNET_ANCHORS.far,
        near = MAGNET_ANCHORS.near;
      handle.current?.style.setProperty(
        'left',
        `${(far[0] + (near[0] - far[0]) * s.position) * 100}%`,
      );
      handle.current?.style.setProperty(
        'top',
        `${(far[1] + (near[1] - far[1]) * s.position) * 100}%`,
      );
      needle.current?.setAttribute(
        'transform',
        `rotate(${s.needle * 55} 80 80)`,
      );
      const moving = Math.abs(s.velocity) > 0.006;
      if (!moving) {
        handle.current?.setAttribute(
          'aria-valuenow',
          String(Math.round(s.position * 100)),
        );
        handle.current?.setAttribute(
          'aria-valuetext',
          `磁铁位置 ${Math.round(s.position * 100)}%，${s.position > 0.975 ? '靠近线圈' : s.position < 0.025 ? '在远处' : '位于导轨中段'}`,
        );
      }
      if (movement.current)
        movement.current.textContent = moving
          ? s.velocity > 0
            ? '磁铁正在靠近'
            : '磁铁正在远离'
          : '磁铁停住了';
      if (readout.current)
        readout.current.textContent =
          Math.abs(s.needle) < 0.015
            ? '指针在零位'
            : !moving
              ? '指针正在归零'
              : s.needle > 0
                ? '指针向右偏转'
                : '指针向左偏转';
      if (positionInput.current)
        positionInput.current.value = String(Math.round(s.position * 1000));
      progress.current?.style.setProperty(
        'width',
        `${Math.min(1, r.still / 1.5) * 100}%`,
      );
      if (clockReadout.current)
        clockReadout.current.textContent = r.trace.length
          ? `${(r.clock - r.trace[0].time).toFixed(1)} 秒`
          : '等待移动';
      if (liveTrace.current)
        liveTrace.current.setAttribute(
          'd',
          r.trace.length > 1
            ? magnetTrace(captureMagnet('insert', r.trace))
            : 'M0 35H240',
        );
    };
    paint.current = draw;
    const save = (action: 'insert' | 'hold' | 'withdraw') => {
      const record = captureMagnet(action, runtime.current.trace);
      runtime.current.records = [...runtime.current.records, record];
      callbacks.current.records(runtime.current.records);
      runtime.current.trace = [];
      return record;
    };
    const stopAssist = () => {
      runtime.current.assist = null;
      callbacks.current.assist(false);
    };
    const next = (phase: Phase) => {
      stopAssist();
      runtime.current.still = 0;
      callbacks.current.phase(phase);
      // A new observation starts from where the magnet actually is.
      runtime.current.trace = [];
    };
    const run = () => {
      if (!animation && visible && !document.hidden) {
        last = 0;
        animation = window.requestAnimationFrame(tick);
      }
    };
    const tick = (now: number) => {
      animation = 0;
      if (!visible || document.hidden) {
        last = 0;
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      const r = runtime.current;
      const previous = r.state;
      r.clock += dt;
      if (r.assist) {
        r.assist.age += dt;
        const a = r.assist;
        const t = Math.min(1, a.age / a.duration);
        const eased = t * t * (3 - 2 * t);
        r.target = a.from + (a.to - a.from) * eased;
        if (t === 1) {
          if (r.preview && a.to !== r.restore)
            r.assist = { from: a.to, to: r.restore, age: 0, duration: 1.2 };
          else stopAssist();
        }
      }
      r.state = followMagnet(previous, r.target, dt);
      const s = r.state;
      if (r.preview) {
        if (
          !r.assist &&
          Math.abs(s.position - r.restore) < 0.0002 &&
          Math.abs(s.needle) < 0.001
        ) {
          r.preview = false;
          callbacks.current.preview(false);
        }
      } else {
        const moving = Math.abs(s.velocity) > 0.001;
        const observing = ['approach', 'away', 'rate'].includes(r.phase);
        if (observing && (moving || r.trace.length)) {
          if (!r.trace.length)
            r.trace.push({
              time: r.clock - dt,
              position: previous.position,
              signal: 0,
              needle: previous.needle,
            });
          r.trace.push({
            time: r.clock,
            position: s.position,
            signal: s.signal,
            needle: s.needle,
          });
          if (r.trace.length > 1200) {
            const peak = r.trace.reduce((a, b) =>
              Math.abs(a.signal) > Math.abs(b.signal) ? a : b,
            );
            r.trace = r.trace.filter(
              (sample, index) =>
                index % 2 === 0 ||
                sample === peak ||
                index === r.trace.length - 1,
            );
          }
        }
        if (
          r.phase === 'approach' &&
          s.position > 0.999 &&
          Math.abs(s.velocity) < 0.015
        ) {
          save('insert');
          next('hold');
        } else if (r.phase === 'hold') {
          if (
            s.position > 0.999 &&
            Math.abs(s.velocity) < 0.001 &&
            Math.abs(s.needle) < 0.01 &&
            Math.abs(s.signal) < 0.003
          ) {
            r.still += dt;
            r.trace.push({
              time: r.clock,
              position: s.position,
              signal: s.signal,
              needle: s.needle,
            });
            if (r.still >= 1.55) {
              save('hold');
              next('away');
            }
          } else {
            r.still = 0;
            r.trace = [];
          }
        } else if (
          r.phase === 'away' &&
          s.position < 0.001 &&
          Math.abs(s.velocity) < 0.015
        ) {
          save('withdraw');
          next('evidence');
        } else if (
          r.phase === 'rate' &&
          s.position > 0.999 &&
          Math.abs(s.velocity) < 0.015
        ) {
          const trial = captureMagnet('insert', r.trace);
          const first =
            r.reference ??
            r.records.find((record) => record.action === 'insert');
          const result = first
            ? compareMagnetSpeeds(first, trial)
            : 'inconclusive';
          if (result === 'confirmed') {
            save('insert');
            next('complete');
            callbacks.current.message(
              '同一段路，运动快慢和感应响应都出现了可比较的差别。',
            );
          } else {
            if (
              trial.travel < 1.12 &&
              trial.start < 0.025 &&
              trial.end > 0.975
            ) {
              const replacement = save('insert');
              r.reference = replacement;
              callbacks.current.reference(replacement);
            }
            next('retry');
            callbacks.current.message(
              result === 'similar'
                ? '两次快慢太接近，暂时不能据此比较。这条轨迹会保留并成为新的基准，下次把节奏差别拉开一点。'
                : '局部加速可能让总用时与峰值不能直接比较。保留这个不确定结果，以刚完成的轨迹作为新基准，再换一种节奏；点按辅助会按固定节奏移动。',
            );
          }
        } else if (
          r.phase === 'retry' &&
          s.position < 0.001 &&
          Math.abs(s.velocity) < 0.015
        ) {
          next('rate');
        }
      }
      draw();
      const busy = Boolean(
        r.assist ||
        r.preview ||
        r.drag ||
        r.trace.length ||
        r.phase === 'hold' ||
        Math.abs(r.target - s.position) > 0.0001 ||
        Math.abs(s.needle) > 0.0001,
      );
      if (busy) animation = window.requestAnimationFrame(tick);
    };
    kick.current = run;
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.at(-1)?.isIntersecting ?? false;
        if (!visible && animation) {
          window.cancelAnimationFrame(animation);
          animation = 0;
          last = 0;
        }
        if (visible) run();
      },
      { rootMargin: '80px' },
    );
    observer.observe(stage);
    const visibility = () => {
      if (document.hidden) {
        runtime.current.drag = null;
        if (animation) window.cancelAnimationFrame(animation);
        animation = 0;
        last = 0;
      } else run();
    };
    document.addEventListener('visibilitychange', visibility);
    draw();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      window.cancelAnimationFrame(animation);
      kick.current = () => {};
      paint.current = () => {};
    };
  }, []);

  useEffect(() => {
    if (!canMove || phase === 'hold') return;
    const first = window.setTimeout(
      () => setHint((value) => Math.max(value, 1)),
      15000,
    );
    const second = window.setTimeout(
      () => setHint((value) => Math.max(value, 2)),
      30000,
    );
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [canMove, phase]);
  useEffect(() => {
    const selector =
      phase === 'evidence' || phase === 'complete'
        ? '.magnet-evidence'
        : '.magnet-instrument';
    if (phase === 'approach' || phase === 'hold' || phase === 'away') return;
    const target = root.current?.querySelector(selector);
    target?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }, [phase]);

  const steer = (target: number) => {
    if (!canMove) return;
    const r = runtime.current;
    const bounded = magnetPosition(target);
    // Guided strokes are one-way; stopping is always possible. The opposite
    // stroke unlocks after the stationary observation, not as a hidden option.
    r.target =
      phase === 'approach' || phase === 'rate'
        ? Math.max(r.state.position, bounded)
        : phase === 'away' || phase === 'retry'
          ? Math.min(r.state.position, bounded)
          : bounded;
    runtime.current.assist = null;
    setAssisting(false);
    kick.current();
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (!canMove || (event.pointerType === 'mouse' && event.button !== 0))
      return;
    const r = runtime.current;
    r.assist = null;
    setAssisting(false);
    r.drag = {
      x: event.clientX,
      y: event.clientY,
      position: r.state.position,
      pointer: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    kick.current();
  };
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const start = runtime.current.drag,
      box = artboard.current?.getBoundingClientRect();
    if (!start || !box || start.pointer !== event.pointerId || !canMove) return;
    const dx = (MAGNET_ANCHORS.near[0] - MAGNET_ANCHORS.far[0]) * box.width;
    const dy = (MAGNET_ANCHORS.near[1] - MAGNET_ANCHORS.far[1]) * box.height;
    const length = dx * dx + dy * dy;
    if (length < 1) return;
    steer(
      start.position +
        ((event.clientX - start.x) * dx + (event.clientY - start.y) * dy) /
          length,
    );
  };
  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (runtime.current.drag?.pointer !== event.pointerId) return;
    runtime.current.drag = null;
    if (event.type === 'pointercancel')
      runtime.current.target = runtime.current.state.position;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    kick.current();
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canMove) return;
    const current = runtime.current.state.position;
    const step = event.shiftKey ? 0.2 : 0.06;
    const target =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? 1
          : ['ArrowRight', 'ArrowUp'].includes(event.key)
            ? current + step
            : ['ArrowLeft', 'ArrowDown'].includes(event.key)
              ? current - step
              : null;
    if (target !== null) {
      event.preventDefault();
      steer(target);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      steer(current);
    }
  };
  const assist = () => {
    const r = runtime.current;
    if (!canMove || phase === 'hold') return;
    if (r.assist) {
      r.assist = null;
      r.target = r.state.position;
      setAssisting(false);
      return;
    }
    const to = phase === 'away' || phase === 'retry' ? 0 : 1;
    const baselineDuration = baseline?.duration ?? 2;
    const duration =
      phase === 'rate'
        ? Math.max(
            0.45,
            Math.min(
              8,
              wantsSlow ? baselineDuration * 2.8 : baselineDuration / 2.8,
            ),
          )
        : 1.4;
    r.assist = { from: r.state.position, to, age: 0, duration };
    setAssisting(true);
    showInstrument();
    kick.current();
  };
  const help = () => {
    const next = Math.min(3, hint + 1);
    setHint(next);
    const r = runtime.current;
    if (
      next === 3 &&
      canMove &&
      phase !== 'hold' &&
      !r.drag &&
      !r.trace.length
    ) {
      r.restore = r.state.position;
      r.preview = true;
      r.assist = {
        from: r.restore,
        to: phase === 'away' || phase === 'retry' ? 0 : 1,
        age: 0,
        duration: 1.2,
      };
      setPreview(true);
      showInstrument();
      kick.current();
    }
  };
  const reset = () => {
    Object.assign(runtime.current, {
      state: initialMagnet(),
      target: 0,
      clock: 0,
      phase: 'approach',
      trace: [],
      records: [],
      reference: null,
      still: 0,
      field: false,
      preview: false,
      assist: null,
      drag: null,
    });
    setRecords([]);
    setReference(null);
    setPreview(false);
    setAssisting(false);
    setField(false);
    setTrialMessage('');
    setSubmitted(false);
    changePhase('approach');
    paint.current();
    showInstrument();
  };
  const finish = () => {
    if (submitted || !validMagnetCycle(runtime.current.records)) return;
    setSubmitted(true);
    onComplete(runtime.current.records);
  };

  return (
    <section
      ref={root}
      className="induction-discovery magnet-discovery"
      data-phase={phase}
      aria-labelledby="magnet-title"
    >
      <nav className="discovery-topbar" aria-label="实验导航">
        <button type="button" onClick={onBack}>
          <ArrowLeft />
          时间地图
        </button>
        <span>1831 · 沿着法拉第的追问继续</span>
        <span className="discovery-coordinate">
          <Magnet />
          第二次发现
        </span>
      </nav>
      <header className="discovery-heading">
        <div>
          <p className="eyebrow">把电池拿走，解释还能站住吗？</p>
          <h1 id="magnet-title">
            磁铁不碰线圈<span>这次，让你的手控制变化。</span>
          </h1>
        </div>
        <ol className="discovery-chapters" aria-label="发现进度">
          {['靠近', '停住', '远离'].map((label, index) => (
            <li
              key={label}
              className={
                records.length > index
                  ? 'is-done'
                  : phase === ['approach', 'hold', 'away'][index]
                    ? 'is-current'
                    : ''
              }
            >
              <span>{records.length > index ? <Check /> : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      </header>
      <div className="discovery-director" aria-live="polite">
        <span className="discovery-director__avatar" aria-hidden="true">
          <Lightbulb />
        </span>
        <div>
          <small>
            {preview
              ? '雾灯示范 · 不会增加实验记录'
              : '雾灯助手 · 每次只做一件事'}
          </small>
          <h2>{preview ? '先看一遍，再由你亲手移动' : copy.title}</h2>
          <p>{copy.text}</p>
          {phase === 'rate' ? (
            <p className="magnet-rate-hint">
              当前基准的运动用时约 {baseline?.duration.toFixed(1)} 秒。这次试着
              {wantsSlow ? '慢一些' : '快一些'}
              ；不方便拖动，也可以用“点按辅助”。
            </p>
          ) : null}
        </div>
        <span className="discovery-director__step">
          {Math.min(3, records.length)}
          <small>/3 条观察</small>
        </span>
      </div>
      <div
        ref={instrument}
        className="discovery-instrument magnet-instrument iso-plate"
        data-preview={preview}
      >
        <div className="discovery-instrument__corners">
          <span>棒磁铁 × 空心线圈 · 没有电池</span>
          <span ref={movement}>磁铁停住了</span>
        </div>
        <div className="discovery-canvas">
          <div
            ref={artboard}
            className="discovery-artboard"
            onPointerDown={(event) => {
              if ((event.target as Element).closest('[data-magnet-slide]'))
                down(event);
            }}
            onPointerMove={drag}
            onPointerUp={release}
            onPointerCancel={release}
          >
            <MagnetBench />
            <div
              ref={handle}
              className={`magnet-drag-handle ${canMove ? 'is-active' : ''}`}
              role="slider"
              tabIndex={canMove ? 0 : -1}
              aria-label="移动磁铁：向右或向上靠近，向左或向下远离；Home 到远处，End 到近处"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={
                phase === 'hold' ||
                phase === 'away' ||
                phase === 'evidence' ||
                phase === 'complete'
                  ? 100
                  : 0
              }
              aria-valuetext={
                phase === 'hold' ? '磁铁靠近线圈，请停住观察' : copy.next
              }
              aria-disabled={!canMove}
              onPointerDown={down}
              onPointerMove={drag}
              onPointerUp={release}
              onPointerCancel={release}
              onKeyDown={key}
              style={{
                left: `${MAGNET_ANCHORS.far[0] * 100}%`,
                top: `${MAGNET_ANCHORS.far[1] * 100}%`,
              }}
            >
              <Hand />
              <span>
                {phase === 'hold'
                  ? '停住观察'
                  : phase === 'away' || phase === 'retry'
                    ? '沿原路拉远'
                    : '握住磁铁拖动'}
              </span>
            </div>
          </div>
          <div className="discovery-meter magnet-meter">
            <span>观察窗 · 检流计</span>
            <svg viewBox="0 0 160 118" aria-hidden="true">
              <path
                className="discovery-meter__face"
                d="M14 91A66 66 0 0 1 146 91Z"
              />
              {Array.from({ length: 13 }, (_, index) => {
                const angle = ((-150 + index * 10) * Math.PI) / 180;
                return (
                  <line
                    key={index}
                    x1={80 + Math.cos(angle) * 57}
                    y1={80 + Math.sin(angle) * 57}
                    x2={80 + Math.cos(angle) * (index % 3 === 0 ? 47 : 52)}
                    y2={80 + Math.sin(angle) * (index % 3 === 0 ? 47 : 52)}
                  />
                );
              })}
              <text x="80" y="39" textAnchor="middle">
                0
              </text>
              <path
                ref={needle}
                className="discovery-meter__needle"
                d="M80 85L80 43"
              />
              <circle cx="80" cy="80" r="4" />
            </svg>
            <strong ref={readout}>指针在零位</strong>
            <small>随磁铁的实际运动响应</small>
          </div>
          {preview ? (
            <div className="discovery-preview-badge">
              <Eye />
              只看示范 · 不计入证据
            </div>
          ) : null}
        </div>
        <div className="discovery-instrument__foot">
          <p>
            <span />
            {preview ? '示范结束后，磁铁会回到原处' : copy.next}
          </p>
          <span>磁铁与线圈没有导线连接</span>
        </div>
      </div>
      {phase === 'hold' ? (
        <div className="magnet-hold">
          <span>保持靠近且静止，等指针回零</span>
          <div>
            <span ref={progress} />
          </div>
          <small>离开靠近位或重新移动，观察计时会重新开始</small>
        </div>
      ) : (
        <span className="sr-only" ref={progress} />
      )}
      <div className="discovery-tools magnet-tools">
        <button
          type="button"
          className="discovery-help"
          onClick={help}
          disabled={preview}
        >
          <Lightbulb />
          {hint >= 2 ? '示范一下' : hint ? '再提示一点' : '需要一点帮助'}
        </button>
        {canMove && phase !== 'hold' ? (
          <button type="button" className="magnet-assist" onClick={assist}>
            <MoveHorizontal />
            {assisting
              ? '停在这里'
              : '点按辅助：' +
                (phase === 'away' || phase === 'retry'
                  ? '移回远处'
                  : '向线圈靠近')}
          </button>
        ) : null}
        <details>
          <summary>精细操作与重做</summary>
          <div className="magnet-precision">
            <label>
              磁铁位置
              <input
                ref={positionInput}
                type="range"
                min="0"
                max="1000"
                step="1"
                defaultValue="0"
                disabled={!canMove}
                aria-label="精细调整磁铁位置，零为远处，一千为靠近位"
                onChange={(event) => steer(Number(event.target.value))}
              />
              <span>远处 ← → 靠近位</span>
            </label>
            <button type="button" onClick={reset}>
              <RotateCcw />
              重新做这次实验
            </button>
          </div>
        </details>
      </div>
      {hint > 0 ? (
        <p className="discovery-hint" aria-live="polite">
          <Lightbulb />
          {phase === 'hold'
            ? '把磁铁留在线圈旁，松开鼠标或手指，观察圈会自动走完。'
            : hint >= 2
              ? '沿导轨拖动磁铁；也可点“点按辅助”移动，再点一次就停住。示范本身不会填写证据。'
              : phase === 'away' || phase === 'retry'
                ? '握住磁铁，沿原来的导轨拖回远处。'
                : '握住磁铁上的发光手形，向线圈拖动。指针会跟着实际运动改变。'}
        </p>
      ) : null}
      <div className="magnet-live">
        <div>
          <span>本次手动轨迹</span>
          <span ref={clockReadout}>等待移动</span>
        </div>
        <svg
          viewBox="0 0 240 70"
          aria-label="当前操作的实际感应响应"
          role="img"
        >
          <path className="discovery-trace__zero" d="M0 35H240" />
          <path
            ref={liveTrace}
            className="discovery-trace__signal"
            d="M0 35H240"
          />
        </svg>
        <small>停住时归零，方向取决于接线；曲线与指针均由实际位移驱动。</small>
      </div>
      {(phase === 'rate' || phase === 'retry') && baseline ? (
        <div className="magnet-rate-reference">
          <div>
            <strong>当前比较基准 · 靠近线圈</strong>
            <small>
              运动用时约 {baseline.duration.toFixed(1)}{' '}
              秒。保留原有记录，用这一条完整轨迹与下一次比较。
            </small>
          </div>
          <CaptureTrace record={baseline} />
        </div>
      ) : null}
      <section
        className="discovery-evidence magnet-evidence"
        aria-labelledby="magnet-evidence-title"
      >
        <div className="discovery-evidence__head">
          <div>
            <Sparkles />
            <h2 id="magnet-evidence-title">不是选答案，是留下亲手做出的证据</h2>
          </div>
          <span>
            {records.length >= 3 ? '三种观察已保存' : '完成对应动作后出现'}
          </span>
        </div>
        <div className="discovery-records">
          {(['insert', 'hold', 'withdraw'] as const).map((action) => {
            const record = records.find((item) => item.action === action);
            return (
              <article
                key={action}
                className={`discovery-record ${record ? 'has-record' : ''}`}
              >
                <div>
                  <span>{names[action]}</span>
                  {record ? (
                    <Check />
                  ) : (
                    <span className="magnet-waiting" aria-label="等待观察" />
                  )}
                </div>
                {record ? (
                  <>
                    <CaptureTrace record={record} />
                    <p>
                      {action === 'hold'
                        ? '磁铁仍靠近 · 指针归零'
                        : action === 'insert'
                          ? '靠近时出现响应'
                          : '远离时出现相反响应'}
                    </p>
                  </>
                ) : (
                  <div className="discovery-record__empty">
                    亲手操作后，这里会留下曲线
                  </div>
                )}
              </article>
            );
          })}
        </div>
        {ready ? (
          <div className="discovery-explanation magnet-explanation">
            <p className="eyebrow">
              <Sparkles />
              现代解释 · 在观察之后出现
            </p>
            <h2>关键不是“有磁铁”，而是磁通量正在变化</h2>
            <p>
              靠近和远离，使穿过闭合线圈的磁通量发生相反方向的变化，产生感应电动势和电流。磁铁停住时，磁通量仍存在，却不再变化，所以指针回零。
            </p>
            <p>
              前三种动作先比较有无响应与方向；手动移动的快慢可能不同，不能把它们的峰值直接当作严格的定量对照。
            </p>
            <button
              type="button"
              className="magnet-field-toggle"
              aria-pressed={field}
              onClick={() => {
                const next = !runtime.current.field;
                runtime.current.field = next;
                setField(next);
                paint.current();
                showInstrument();
              }}
            >
              <Eye />
              {field ? '隐藏现代磁通示意' : '看看现代磁通示意'}
            </button>
            {field ? (
              <small>
                场线为现代可视化，不是历史现场肉眼可见的现象；显示它不会增加证据。
              </small>
            ) : null}
          </div>
        ) : null}
        {trialMessage ? (
          <p className="magnet-trial-message" aria-live="polite">
            {trialMessage}
          </p>
        ) : null}
        {comparison && baseline ? (
          <div className="magnet-speed-pair">
            <h3>
              <Check />
              同一磁极、线圈、接线和起终点，只改变移动快慢
            </h3>
            <div>
              {provenPair.map((record, index) => (
                <article key={index}>
                  <strong>
                    {index ? '第二次' : '第一次'}靠近 ·{' '}
                    {record.duration.toFixed(1)} 秒
                  </strong>
                  <CaptureTrace record={record} />
                </article>
              ))}
            </div>
            <p>
              两条曲线使用相同响应刻度，横轴分别归一到各自运动全程；不是同一秒数的叠图。局部加速也会影响瞬时峰值，这不是定量测量仪器。
            </p>
          </div>
        ) : null}
        <div className="discovery-finish-actions magnet-finish">
          {phase === 'evidence' ? (
            <Button
              size="lg"
              className="primary-cta"
              onClick={() => {
                runtime.current.trace = [];
                changePhase('rate');
              }}
            >
              再试一次：只改变移动快慢
              <ArrowRight />
            </Button>
          ) : phase === 'complete' ? (
            <Button
              size="lg"
              className="primary-cta"
              onClick={finish}
              disabled={submitted}
            >
              带着证据继续历险
              <ArrowRight />
            </Button>
          ) : null}
          {ready && phase !== 'complete' ? (
            <button type="button" onClick={finish} disabled={submitted}>
              带这三条观察，进入证据密室
              <ArrowRight />
            </button>
          ) : null}
        </div>
        <p className="magnet-model-note">
          装置是沿线圈轴线运动的教学简化，不是历史装置的精确复刻；采用无量纲相对响应与阻尼指针，省略随机误差。磁铁只靠近线圈一侧，不穿过中心。
        </p>
      </section>
      <footer className="discovery-footer">
        <button type="button" onClick={onExplore}>
          打开完整自由实验室
          <ArrowRight />
        </button>
      </footer>
    </section>
  );
}
