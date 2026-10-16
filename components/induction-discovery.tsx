'use client';

/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The inline SVG chart needs image semantics while retaining addressable paths. An img element cannot render this chart. */

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Compass,
  Eye,
  Hand,
  Layers2,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Snowflake,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  InductionBench,
  BENCH_ANCHORS,
  bindBench,
} from '@/components/induction-bench';
import {
  completedDiscovery,
  inductionAt,
  needleTrace,
  observationFor,
  PEAK_TIME,
  restingFrame,
  TRANSIENT_SECONDS,
  type BatteryPolarity,
  type DiscoveryRecord,
  type InductionFrame,
  type RingAction,
} from '@/lib/induction-model';

type Phase =
  | 'ready'
  | 'closing'
  | 'steady'
  | 'opening'
  | 'compare'
  | 'flip'
  | 'reverse-ready'
  | 'reverse-closing'
  | 'reverse-steady'
  | 'reverse-opening'
  | 'explain';
type Node = 'switch' | 'battery' | 'ring';
const SWITCH_SECONDS = 0.28;
const OPEN_FINISH = TRANSIENT_SECONDS;
const CLOSE_FINISH = SWITCH_SECONDS + TRANSIENT_SECONDS;
const REPLAY_HOLD = 1.8;
const REPLAY_OPEN = CLOSE_FINISH + REPLAY_HOLD;
const REPLAY_END = REPLAY_OPEN + OPEN_FINISH;
const DROP_RECORD = 'faraday-disconnect-observation';
const actionNames = {
  connect: '接通瞬间',
  hold: '保持接通',
  disconnect: '断开瞬间',
};
const phaseCopy: Record<
  Phase,
  { chapter: number; title: string; text: string; next: string }
> = {
  ready: {
    chapter: 0,
    title: '合上开关，盯住右边的指针',
    text: '两组线圈绕在同一个铁环上，导线彼此绝缘。先只动左侧开关。',
    next: '点击或拖动发光的开关',
  },
  closing: {
    chapter: 0,
    title: '看见那一下了吗？再等一会儿',
    text: '先保持开关接通，让仪器完整记下指针的运动。',
    next: '正在观察 · 稍等指针回零',
  },
  steady: {
    chapter: 0,
    title: '电池还连着，指针却回到了零',
    text: '“没有持续偏转”也是一条证据。现在抬起同一个开关。',
    next: '点击或向上拖动开关，断开回路',
  },
  opening: {
    chapter: 0,
    title: '断开时，指针换了一个方向',
    text: '保持电池、接线和线圈不变。仪器正在保存这一次观察。',
    next: '正在记录 · 等指针归零',
  },
  compare: {
    chapter: 1,
    title: '把两次“动了一下”叠起来看看',
    text: '将“断开瞬间”的记录拖到“接通瞬间”上。也可以依次点这两张记录。',
    next: '先选断开记录，再放到接通记录上',
  },
  flip: {
    chapter: 1,
    title: '接下来，只反转电池的方向',
    text: '开关已经断开。线圈、导线和动作都保持原样，只翻转电池。',
    next: '点击或左右拖动电池',
  },
  'reverse-ready': {
    chapter: 1,
    title: '还是同一个接通动作，再试一次',
    text: '这次只改了电池方向。请看右侧指针，和第一次比较。',
    next: '合上同一个开关',
  },
  'reverse-closing': {
    chapter: 1,
    title: '只反转电池，偏转也反向了',
    text: '两次都是接通，装置没有换。继续保持，看看零结果是否也能重复。',
    next: '正在观察 · 保持接通',
  },
  'reverse-steady': {
    chapter: 1,
    title: '保持接通，指针又一次归零',
    text: '现在断开最后一次，把这一组单变量对照收完整。',
    next: '抬起开关，完成对照',
  },
  'reverse-opening': {
    chapter: 1,
    title: '相同条件，规律再次出现',
    text: '接通与断开仍然产生相反的短暂偏转。正在收好你的证据。',
    next: '正在保存这组对照',
  },
  explain: {
    chapter: 2,
    title: '你已收齐证据，看看铁环里发生了什么',
    text: '点击铁环，开启现代磁场示意。刚才的三个时刻会慢慢重现。',
    next: '点击铁环，透视这次发现',
  },
};

function transientFrame(
  action: RingAction,
  polarity: BatteryPolarity,
  age: number,
  field: boolean,
): InductionFrame {
  if (action !== 'connect') {
    const frame = inductionAt(action, polarity, age, field);
    return {
      ...frame,
      closed:
        action === 'disconnect' ? Math.max(0, 1 - age / SWITCH_SECONDS) : 1,
    };
  }
  if (age < SWITCH_SECONDS)
    return { ...restingFrame(polarity), closed: age / SWITCH_SECONDS, field };
  return inductionAt(action, polarity, age - SWITCH_SECONDS, field);
}

function Trace({
  record,
  overlay,
}: {
  record: DiscoveryRecord;
  overlay?: DiscoveryRecord;
}) {
  return (
    <svg
      viewBox="0 0 140 56"
      role="img"
      aria-label={`${actionNames[record.action]}：${record.direction === 'none' ? '回到零' : record.direction === 'right' ? '向右偏转' : '向左偏转'}`}
    >
      <path className="discovery-trace__zero" d="M5 28H135" />
      <path
        className="discovery-trace__signal"
        d={needleTrace(record.action, record.polarity, 130, 50)}
        transform="translate(5 3)"
      />
      {overlay ? (
        <path
          className="discovery-trace__overlay"
          d={needleTrace(overlay.action, overlay.polarity, 130, 50)}
          transform="translate(5 3)"
        />
      ) : null}
    </svg>
  );
}

export function InductionDiscovery({
  onComplete,
  onBack,
  onExplore,
}: {
  onComplete: (records: DiscoveryRecord[]) => void;
  onBack: () => void;
  onExplore: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('ready');
  const phaseRef = useRef<Phase>('ready');
  const [records, setRecords] = useState<DiscoveryRecord[]>([]);
  const recordsRef = useRef<DiscoveryRecord[]>([]);
  const [combined, setCombined] = useState(false);
  const [armedRecord, setArmedRecord] = useState(false);
  const [hint, setHint] = useState(0);
  const [slow, setSlow] = useState(false);
  const [paused, setPaused] = useState(false);
  const [preview, setPreview] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [explanationSeen, setExplanationSeen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [magnified, setMagnified] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const gaugeNeedle = useRef<SVGPathElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const supply = useRef<HTMLSpanElement>(null);
  const fieldStatus = useRef<HTMLSpanElement>(null);
  const kick = useRef<() => void>(() => {});
  const paint = useRef<(frame: InductionFrame) => void>(() => {});
  const callbacks = useRef({
    onEnd: (_: RingAction, __: boolean) => {},
    onTrace: (_: RingAction, __: BatteryPolarity) => {},
  });
  const runtime = useRef({
    action: null as RingAction | null,
    polarity: 'normal' as BatteryPolarity,
    age: 0,
    active: false,
    recorded: false,
    replay: false,
    preview: false,
    field: false,
    slow: false,
    paused: false,
    restore: restingFrame(),
  });
  const gesture = useRef<{
    x: number;
    y: number;
    moved: boolean;
    node: Node;
  } | null>(null);
  const consumedClick = useRef(false);
  const copy = phaseCopy[phase];
  const busy =
    ['closing', 'opening', 'reverse-closing', 'reverse-opening'].includes(
      phase,
    ) ||
    preview ||
    replaying;
  const allowedNode: Node | null =
    preview || replaying
      ? null
      : ['ready', 'steady', 'reverse-ready', 'reverse-steady'].includes(phase)
        ? 'switch'
        : phase === 'flip'
          ? 'battery'
          : phase === 'explain'
            ? 'ring'
            : null;
  const baseline = records.filter((record) => record.polarity === 'normal');

  const changePhase = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
    setHint(0);
  };
  const append = (action: RingAction, polarity: BatteryPolarity) => {
    if (
      recordsRef.current.some(
        (record) => record.action === action && record.polarity === polarity,
      )
    )
      return;
    const next = [
      ...recordsRef.current,
      observationFor(action, polarity, recordsRef.current.length + 1),
    ];
    recordsRef.current = next;
    setRecords(next);
  };
  useEffect(() => {
    callbacks.current = {
      onTrace: append,
      onEnd(action, reversed) {
        if (action === 'connect') {
          append('hold', reversed ? 'reversed' : 'normal');
          changePhase(reversed ? 'reverse-steady' : 'steady');
        } else changePhase(reversed ? 'explain' : 'compare');
      },
    };
  });

  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    const bind = bindBench(root);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    let animation = 0;
    let last = 0;
    const render = (frame: InductionFrame) => {
      bind(frame);
      gaugeNeedle.current?.setAttribute(
        'transform',
        `rotate(${frame.needle * 47} 80 80)`,
      );
      const text =
        Math.abs(frame.needle) < 0.025
          ? '指针在零位'
          : frame.needle > 0
            ? '指针向右偏转'
            : '指针向左偏转';
      if (readout.current && readout.current.textContent !== text)
        readout.current.textContent = text;
      if (supply.current)
        supply.current.textContent =
          Math.abs(frame.primary) > 0.01
            ? '电池回路：保持供电'
            : '电池回路：断开';
      if (fieldStatus.current)
        fieldStatus.current.textContent =
          Math.abs(frame.flux) < 0.01
            ? '磁场：已经减弱至零'
            : Math.abs(frame.secondary) < 0.01
              ? '磁场：存在，但已稳定'
              : frame.closed > 0.8
                ? '磁场：正在建立'
                : '磁场：正在减弱';
    };
    paint.current = render;
    const run = () => {
      if (
        !animation &&
        visible &&
        !document.hidden &&
        runtime.current.active &&
        !runtime.current.paused
      ) {
        last = 0;
        animation = window.requestAnimationFrame(tick);
      }
    };
    const tick = (now: number) => {
      animation = 0;
      const r = runtime.current;
      if (!visible || document.hidden || r.paused || !r.active) {
        last = 0;
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      r.age += dt * (r.slow ? 0.38 : 1);
      if (r.replay) {
        const action =
          r.age < CLOSE_FINISH
            ? 'connect'
            : r.age < REPLAY_OPEN
              ? 'hold'
              : 'disconnect';
        const age = action === 'disconnect' ? r.age - REPLAY_OPEN : r.age;
        render(
          still.matches && action !== 'hold'
            ? {
                ...inductionAt(
                  action,
                  r.polarity,
                  r.age >= REPLAY_END ? TRANSIENT_SECONDS : PEAK_TIME,
                  true,
                ),
              }
            : transientFrame(action, r.polarity, age, true),
        );
        if (r.age >= REPLAY_END) {
          r.active = false;
          r.replay = false;
          r.action = null;
          setReplaying(false);
          setExplanationSeen(true);
          render({ ...restingFrame(r.polarity), field: true });
        }
      } else if (r.action) {
        const action = r.action;
        const offset = action === 'connect' ? SWITCH_SECONDS : 0;
        const duration = action === 'connect' ? CLOSE_FINISH : OPEN_FINISH;
        const frame =
          still.matches && r.age > offset && r.age < duration
            ? inductionAt(action, r.polarity, PEAK_TIME, r.field)
            : transientFrame(action, r.polarity, r.age, r.field);
        render(frame);
        if (r.age >= duration) {
          r.active = false;
          if (r.preview) {
            r.preview = false;
            r.action = null;
            setPreview(false);
            render(r.restore);
          } else {
            // Store a complete observed trace only after the observation window ends.
            callbacks.current.onTrace(action, r.polarity);
            callbacks.current.onEnd(action, r.polarity === 'reversed');
          }
        }
      }
      run();
    };
    kick.current = run;
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.at(-1)?.isIntersecting ?? false;
        if (!visible && animation) {
          window.cancelAnimationFrame(animation);
          animation = 0;
        }
        run();
      },
      { rootMargin: '80px' },
    );
    observer.observe(root);
    const visibility = () => {
      last = 0;
      run();
    };
    document.addEventListener('visibilitychange', visibility);
    render(restingFrame());
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      window.cancelAnimationFrame(animation);
      kick.current = () => {};
      paint.current = () => {};
    };
  }, []);

  useEffect(() => {
    if (!allowedNode || phase === 'explain') return;
    const first = window.setTimeout(
      () => setHint((value) => Math.max(value, 1)),
      15_000,
    );
    const second = window.setTimeout(
      () => setHint((value) => Math.max(value, 2)),
      30_000,
    );
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [allowedNode, phase]);

  useEffect(() => {
    if (phase === 'ready') return;
    const selector =
      explanationSeen && phase === 'explain'
        ? '.discovery-explanation'
        : phase === 'compare'
          ? '.discovery-evidence'
          : phase === 'flip'
            ? '.discovery-hotspot--battery'
            : phase === 'explain'
              ? '.discovery-hotspot--ring'
              : ['steady', 'reverse-ready', 'reverse-steady'].includes(phase)
                ? '.discovery-hotspot--switch'
                : null;
    if (!selector) return;
    const root = stage.current?.closest('.induction-discovery');
    const target = root?.querySelector<HTMLElement>(selector);
    if (!target) return;
    const box = target.getBoundingClientRect();
    const guideHeight =
      root?.querySelector('.discovery-director')?.getBoundingClientRect()
        .height ?? 120;
    if (box.top < guideHeight + 20 || box.bottom > window.innerHeight - 30) {
      target.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      });
    }
  }, [phase, explanationSeen]);

  const showInstrument = () => {
    stage.current?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  };
  const animate = (action: RingAction, demonstration = false) => {
    const r = runtime.current;
    r.restore = ['steady', 'reverse-steady'].includes(phaseRef.current)
      ? inductionAt('hold', r.polarity, TRANSIENT_SECONDS)
      : restingFrame(r.polarity);
    Object.assign(r, {
      action,
      age: 0,
      active: true,
      recorded: false,
      preview: demonstration,
      replay: false,
      field: false,
    });
    if (demonstration) {
      setPreview(true);
      showInstrument();
    } else
      changePhase(
        r.polarity === 'reversed'
          ? action === 'connect'
            ? 'reverse-closing'
            : 'reverse-opening'
          : action === 'connect'
            ? 'closing'
            : 'opening',
      );
    kick.current();
  };
  const act = (node: Node) => {
    if (node !== allowedNode || runtime.current.active) return;
    if (node === 'switch')
      animate(
        ['ready', 'reverse-ready'].includes(phaseRef.current)
          ? 'connect'
          : 'disconnect',
      );
    else if (node === 'battery') {
      runtime.current.polarity = 'reversed';
      paint.current(restingFrame('reversed'));
      changePhase('reverse-ready');
    } else {
      Object.assign(runtime.current, {
        action: null,
        replay: true,
        age: 0,
        active: true,
        field: true,
      });
      setReplaying(true);
      showInstrument();
      kick.current();
    }
  };

  const pointerDown = (event: PointerEvent<HTMLButtonElement>, node: Node) => {
    if (node !== allowedNode) return;
    consumedClick.current = false;
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      moved: false,
      node,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = gesture.current;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag?.moved) {
      consumedClick.current = true;
      act(drag.node);
      window.setTimeout(() => {
        consumedClick.current = false;
      }, 0);
    }
  };
  const combine = () => {
    if (phaseRef.current !== 'compare' || baseline.length !== 3) return;
    setCombined(true);
    setArmedRecord(false);
    changePhase('flip');
  };
  const dropped = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    // COSEC: 只接受本实验固定的记录标识，拖拽文本不作为 HTML 或动态路径使用。
    if (event.dataTransfer.getData('text/plain') === DROP_RECORD) combine();
  };
  const askHint = () => {
    const level = Math.min(3, hint + 1);
    setHint(level);
    if (level === 3 && allowedNode === 'switch' && !runtime.current.active)
      animate(
        ['ready', 'reverse-ready'].includes(phaseRef.current)
          ? 'connect'
          : 'disconnect',
        true,
      );
  };
  const reset = () => {
    Object.assign(runtime.current, {
      action: null,
      polarity: 'normal',
      age: 0,
      active: false,
      recorded: false,
      replay: false,
      preview: false,
      field: false,
      paused: false,
    });
    recordsRef.current = [];
    setRecords([]);
    setCombined(false);
    setArmedRecord(false);
    setPreview(false);
    setReplaying(false);
    setExplanationSeen(false);
    setPaused(false);
    setSubmitted(false);
    paint.current(restingFrame());
    changePhase('ready');
  };
  const stopOrContinue = () => {
    const value = !runtime.current.paused;
    runtime.current.paused = value;
    setPaused(value);
    if (!value) kick.current();
  };
  const polarityPair = records.filter((record) => record.action === 'connect');

  return (
    <section
      className="induction-discovery"
      aria-labelledby="discovery-title"
      data-phase={phase}
    >
      <nav className="discovery-topbar" aria-label="实验导航">
        <button type="button" onClick={onBack}>
          <ArrowLeft /> 时间地图
        </button>
        <span>1831 · 伦敦皇家研究院</span>
        <span className="discovery-coordinate">
          <Compass /> 第一次发现
        </span>
      </nav>
      <header className="discovery-heading">
        <div>
          <p className="eyebrow">亲手找回一条科学线索</p>
          <h1 id="discovery-title">
            只动一下的指针<span>从你的手中，开始一次发现。</span>
          </h1>
        </div>
        <ol className="discovery-chapters" aria-label="发现进度">
          {['观察异常', '只改一个条件', '揭开原理'].map((label, index) => (
            <li
              key={label}
              className={
                index < copy.chapter || (index === 2 && explanationSeen)
                  ? 'is-done'
                  : index === copy.chapter
                    ? 'is-current'
                    : ''
              }
              aria-current={index === copy.chapter ? 'step' : undefined}
            >
              <span>
                {index < copy.chapter || (index === 2 && explanationSeen) ? (
                  <Check />
                ) : (
                  index + 1
                )}
              </span>
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
              ? '雾灯示范 · 不计入你的实验记录'
              : replaying
                ? '现代解释 · 正在重现刚才的过程'
                : '雾灯助手 · 每次只做一件事'}
          </small>
          <h2>
            {preview
              ? '看开关怎么动，然后由你来做'
              : replaying
                ? '跟着磁场变化，重看三个时刻'
                : explanationSeen && phase === 'explain'
                  ? '你已经用自己的证据，完成了一次发现'
                  : copy.title}
          </h2>
          <p>
            {explanationSeen && phase === 'explain'
              ? '接通、保持、断开，再只反转电池。现在带着这六条观察，继续追问磁铁与线圈。'
              : copy.text}
          </p>
        </div>
        <span className="discovery-director__step">
          {records.length}
          <small>/6 条观察</small>
        </span>
      </div>

      <div
        className={`discovery-instrument iso-plate ${magnified ? 'is-magnified' : ''}`}
        ref={stage}
        data-hint={hint}
        data-active-node={allowedNode ?? 'observing'}
      >
        <div className="discovery-instrument__corners">
          <span>感应环 · 交互教学装置</span>
          <span ref={supply}>电池回路：断开</span>
        </div>
        <div className="discovery-canvas">
          <div className="discovery-artboard">
            <InductionBench />
            {(['switch', 'battery', 'ring'] as const).map((node) => {
              const point = BENCH_ANCHORS[node];
              const enabled = allowedNode === node;
              const label =
                node === 'switch'
                  ? ['ready', 'reverse-ready'].includes(phase)
                    ? '合上开关'
                    : '抬起开关'
                  : node === 'battery'
                    ? '只反转电池'
                    : '透视铁环';
              return (
                <button
                  key={node}
                  type="button"
                  className={`discovery-hotspot discovery-hotspot--${node} ${enabled ? 'is-active' : ''}`}
                  disabled={!enabled}
                  aria-label={label}
                  style={{
                    left: `${point[0] * 100}%`,
                    top: `${point[1] * 100}%`,
                  }}
                  onPointerDown={(event) => pointerDown(event, node)}
                  onPointerMove={(event) => {
                    const drag = gesture.current;
                    if (
                      drag &&
                      Math.hypot(
                        event.clientX - drag.x,
                        event.clientY - drag.y,
                      ) > 12
                    )
                      drag.moved = true;
                  }}
                  onPointerUp={pointerUp}
                  onPointerCancel={(event) => {
                    gesture.current = null;
                    consumedClick.current = true;
                    window.setTimeout(() => {
                      consumedClick.current = false;
                    }, 0);
                    if (event.currentTarget.hasPointerCapture(event.pointerId))
                      event.currentTarget.releasePointerCapture(
                        event.pointerId,
                      );
                  }}
                  onClick={() => {
                    if (consumedClick.current) {
                      consumedClick.current = false;
                      return;
                    }
                    act(node);
                  }}
                >
                  <span className="discovery-hotspot__ring" />
                  {enabled ? (
                    <>
                      <Hand />
                      <span className="discovery-hotspot__label">{label}</span>
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="discovery-meter"
            onClick={() => setMagnified((value) => !value)}
            aria-label={magnified ? '缩小检流计观察窗' : '放大检流计观察窗'}
            aria-pressed={magnified}
          >
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
                ref={gaugeNeedle}
                className="discovery-meter__needle"
                d="M80 85L80 43"
              />
              <circle cx="80" cy="80" r="4" />
            </svg>
            <strong ref={readout}>指针在零位</strong>
            <small>点一下放大</small>
          </button>
          {preview ? (
            <div className="discovery-preview-badge">
              <Eye /> 演示观察 · 结束后请亲手操作
            </div>
          ) : null}
          {replaying || explanationSeen ? (
            <div className="discovery-field-status">
              <Eye />
              <span ref={fieldStatus}>现代磁场示意</span>
            </div>
          ) : null}
        </div>
        <div className="discovery-instrument__foot">
          <p>
            <span className={busy ? 'is-observing' : ''} />
            {paused
              ? '观察已暂停，点击“继续观察”恢复'
              : preview
                ? '先看示范，记录会保持不变'
                : replaying
                  ? '正在重看三个时刻 · 不增加实验记录'
                  : explanationSeen && phase === 'explain'
                    ? '透视过程已完成，向下查看解释并继续历险'
                    : copy.next}
          </p>
          <span>两组回路彼此绝缘</span>
        </div>
      </div>

      <div className="discovery-tools">
        <button
          type="button"
          className="discovery-help"
          onClick={askHint}
          disabled={busy}
        >
          <Lightbulb />
          {hint >= 2 ? '示范一下操作' : hint ? '再提示一点' : '需要一点帮助'}
        </button>
        <details>
          <summary>
            观察工具 <ChevronDown />
          </summary>
          <div>
            <button
              type="button"
              onClick={() => {
                const next = !runtime.current.slow;
                runtime.current.slow = next;
                setSlow(next);
              }}
              aria-pressed={slow}
            >
              <Snowflake />
              {slow ? '已开启慢动作' : '慢一点看'}
            </button>
            <button type="button" onClick={stopOrContinue} disabled={!busy}>
              {paused ? <Play /> : <Pause />}
              {paused ? '继续观察' : '暂停观察'}
            </button>
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
          {phase === 'compare'
            ? '先点“断开瞬间”的曲线，再点“接通瞬间”。曲线会叠在一起。'
            : allowedNode === 'battery'
              ? '开关已经断开。只点击电池，线圈和导线都不用调整。'
              : allowedNode === 'ring'
                ? '点击铁环上的眼睛提示，可以看到现代磁场示意。'
                : hint === 1
                  ? '找到桌面左前方发光的开关。可以直接点击，或拖动它的手柄。'
                  : hint === 2
                    ? '只动这一个开关。合上后先等指针回零，再把开关抬起。'
                    : '示范不会替你填写证据。现在可以亲手试一遍。'}
        </p>
      ) : null}

      <section
        className={`discovery-evidence ${phase === 'compare' ? 'is-comparing' : ''}`}
        aria-labelledby="discovery-evidence-title"
      >
        <div className="discovery-evidence__head">
          <div>
            <Layers2 />
            <h2 id="discovery-evidence-title">仪器替你留痕，你来寻找关系</h2>
          </div>
          <span>{combined ? '两条瞬态曲线已叠合' : '观察后自动出现'}</span>
        </div>
        <div className="discovery-records">
          {(['connect', 'hold', 'disconnect'] as const).map((action) => {
            const record = baseline.find((item) => item.action === action);
            const interactive = phase === 'compare' && action !== 'hold';
            return (
              <button
                type="button"
                key={action}
                className={`discovery-record ${record ? 'has-record' : ''} ${action === 'disconnect' && armedRecord ? 'is-picked' : ''} ${action === 'connect' && armedRecord ? 'is-drop-target' : ''}`}
                disabled={!interactive}
                draggable={interactive && action === 'disconnect'}
                onDragStart={(event) => {
                  if (action !== 'disconnect') return;
                  event.dataTransfer.setData('text/plain', DROP_RECORD);
                  event.dataTransfer.effectAllowed = 'move';
                  setArmedRecord(true);
                }}
                onDragOver={(event) => {
                  if (interactive && action === 'connect') {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={dropped}
                onClick={() => {
                  if (!interactive) return;
                  if (action === 'disconnect') setArmedRecord(true);
                  else if (armedRecord) combine();
                }}
                aria-label={`${actionNames[action]}${record ? '，已有观察记录' : '，等待观察'}${interactive ? (action === 'disconnect' ? '，点击选中或拖到接通记录上' : '，放入选中的断开记录') : ''}`}
              >
                <div>
                  <span>
                    {action === 'hold' ? <Eye /> : <Zap />}
                    {actionNames[action]}
                  </span>
                  {record ? (
                    <Check />
                  ) : (
                    <span className="discovery-record__waiting">待观察</span>
                  )}
                </div>
                {record ? (
                  <>
                    <Trace
                      record={record}
                      overlay={
                        combined && action === 'connect'
                          ? baseline.find(
                              (item) => item.action === 'disconnect',
                            )
                          : undefined
                      }
                    />
                    <p>
                      {action === 'hold'
                        ? '电池连着 · 指针归零'
                        : combined && action === 'connect'
                          ? '两次偏转，方向相反'
                          : record.direction === 'right'
                            ? '短暂向右偏转，再归零'
                            : '短暂向左偏转，再归零'}
                    </p>
                  </>
                ) : (
                  <div className="discovery-record__empty">
                    <span />
                    亲眼观察后，这里会留下曲线
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {phase === 'compare' ? (
          <p className="discovery-compare-prompt">
            <Hand />
            {armedRecord
              ? '已拿起断开记录，再点一下接通记录'
              : '拖动断开记录到接通记录，或依次点击这两张记录'}
          </p>
        ) : null}
        {polarityPair.length === 2 ? (
          <div className="discovery-controlled-pair">
            <Check />
            <div>
              <strong>只改电池方向，同一个接通动作的偏转反向了</strong>
              <p>
                开关动作、铁环、线圈和接线均保持不变。这是一组可以检查的单变量对照。
              </p>
            </div>
            <span>
              <Trace record={polarityPair[0]} overlay={polarityPair[1]} />
            </span>
          </div>
        ) : null}
      </section>

      {phase === 'explain' ? (
        <section
          className="discovery-explanation"
          aria-labelledby="discovery-explanation-title"
        >
          <p className="eyebrow">
            <Sparkles /> 现代解释 · 在证据之后出现
          </p>
          <h2 id="discovery-explanation-title">让另一侧响应的，是磁场的变化</h2>
          <p>
            左回路电流变化，让穿过右线圈的磁通量变化，产生感应电动势。右回路闭合，因此有短暂的感应电流。
          </p>
          <p>
            保持接通时，铁环里的磁场仍然存在，但已稳定，右侧指针回零。断开时磁场减弱，变化方向相反。
          </p>
          <div className="discovery-achievements">
            <span>
              <Check /> 保存零结果
            </span>
            <span>
              <Check /> 只改一个变量
            </span>
            <span>
              <Check /> 重复检验
            </span>
          </div>
          <div className="discovery-finish-actions">
            {!explanationSeen ? (
              <Button
                size="lg"
                className="primary-cta"
                onClick={() => act('ring')}
                disabled={replaying}
              >
                {replaying ? <Eye /> : <Play />}
                {replaying ? '透视回放中…' : '透视铁环，重看三个时刻'}
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  className="primary-cta"
                  disabled={submitted}
                  onClick={() => {
                    if (submitted || !completedDiscovery(recordsRef.current))
                      return;
                    setSubmitted(true);
                    onComplete(recordsRef.current);
                  }}
                >
                  带着证据继续历险 <ArrowRight />
                </Button>
                <button
                  type="button"
                  onClick={() => act('ring')}
                  disabled={replaying}
                >
                  <RotateCcw />
                  再看一遍透视过程
                </button>
              </>
            )}
          </div>
          <small>
            场线是现代可视化示意，并非历史现场能看见的东西。装置按 1831
            年感应环原理简化；相对刻度与瞬态已做教学处理，省略随机误差。偏转左右取决于接线，重点是相对方向。
          </small>
        </section>
      ) : null}
      <footer className="discovery-footer">
        <a
          href="https://www.rigb.org/explore-science/explore/collection/michael-faradays-ring-coil-apparatus"
          target="_blank"
          rel="noopener noreferrer"
        >
          看看法拉第留下的真实装置 <ArrowRight />
        </a>
        <button type="button" onClick={onExplore}>
          熟悉装置？打开完整实验室 <ArrowRight />
        </button>
      </footer>
    </section>
  );
}
