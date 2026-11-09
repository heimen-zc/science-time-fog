import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import {
  InductionBench,
  BENCH_ANCHORS,
  bindBench,
} from '../../components/induction-bench';
import {
  MagnetBench,
  MAGNET_ANCHORS,
  bindMagnetBench,
} from '../../components/magnet-bench';
import { actionFilms, type ActionFilmId } from '../../lib/action-films';
import {
  inductionAt,
  needleTrace,
  restingFrame,
  transientFrame,
} from '../../lib/induction-model';
import { initialMagnet, sampleMagnet } from '../../lib/magnet-model';
import './frame.css';

const target = document.querySelector<HTMLElement>('#film')!;
const root = createRoot(target);
const clip = (value: number) => Math.min(1, Math.max(0, value));
const ease = (value: number) => {
  const x = clip(value);
  return x * x * (3 - 2 * x);
};
const dt = 1 / 120;

function motion(position: number, direction: 1 | -1, seconds: number) {
  let state = initialMagnet(position);
  for (let i = 1; i <= Math.round(seconds / dt); i++)
    state = sampleMagnet(
      state,
      position + direction * ease((i * dt) / 1.1),
      dt,
    );
  return state;
}

function magnetFrame(id: ActionFilmId, time: number) {
  if (id === 'magnet-approach') return motion(0, 1, Math.max(0, time - 0.55));
  if (id === 'magnet-away') return motion(1, -1, Math.max(0, time - 0.55));
  // Begin the hold with the actual final moving sample from the approach.
  let state = motion(0, 1, 1.1);
  for (let i = 0; i < Math.round(time / dt); i++)
    state = sampleMagnet(state, 1, dt);
  return state;
}

function Marker() {
  return (
    <span className="tap" aria-hidden="true">
      <svg viewBox="0 0 24 25">
        <path d="M7 15V6a2 2 0 1 1 4 0v5l1-1a2 2 0 0 1 3 1l1-.5a2 2 0 0 1 3 2l1 .5v4c0 4-2 6-6 6h-2l-4-2-5-6a2 2 0 0 1 3-2z" />
      </svg>
    </span>
  );
}

function Dial() {
  return (
    <aside className="meter">
      <span>检流计 · 放大</span>
      <svg viewBox="0 0 140 112" aria-hidden="true">
        <circle
          cx="70"
          cy="57"
          r="49"
          fill="#141d21"
          stroke="#9a7b4d"
          strokeWidth="3"
        />
        <circle
          cx="70"
          cy="57"
          r="44"
          fill="#efe3c5"
          stroke="#c3a877"
          strokeWidth="1.5"
        />
        {Array.from({ length: 13 }, (_, i) => (
          <path
            key={i}
            d="M70 17v6"
            transform={`rotate(${(i - 6) * 8} 70 64)`}
            stroke={i === 6 ? '#253838' : '#656e5e'}
            strokeWidth={i === 6 ? 2 : 1}
          />
        ))}
        <text x="70" y="35" textAnchor="middle">
          0
        </text>
        <text x="40" y="49" textAnchor="middle">
          −
        </text>
        <text x="100" y="49" textAnchor="middle">
          +
        </text>
        <path className="needle" d="M68 72l1-37 1-6 1 6 1 37z" fill="#184a54" />
        <circle cx="70" cy="64" r="4" fill="#af8250" stroke="#5d5038" />
      </svg>
      <strong data-reading="" />
    </aside>
  );
}

function Polarity() {
  return (
    <aside className="meter meter--poles">
      <span>电池端子 · 放大</span>
      <div>
        <b data-pole="left">＋</b>
        <b data-pole="right">−</b>
      </div>
      <strong data-reading="" />
    </aside>
  );
}

function TraceCards() {
  return (
    <div className="trace-desk">
      <div className="trace-card">
        <span data-trace-label="">接通瞬间</span>
        <svg viewBox="0 0 170 62">
          <path d="M0 31H170" className="zero" />
          <path
            d={needleTrace('connect', 'normal', 170, 62)}
            className="connect"
          />
          <path
            d={needleTrace('disconnect', 'normal', 170, 62)}
            className="disconnect"
            data-overlay=""
            opacity="0"
          />
        </svg>
      </div>
      <div className="trace-card trace-card--loose">
        <span>断开瞬间</span>
        <svg viewBox="0 0 170 62">
          <path d="M0 31H170" className="zero" />
          <path
            d={needleTrace('disconnect', 'normal', 170, 62)}
            className="disconnect"
          />
        </svg>
        <Marker />
      </div>
    </div>
  );
}

function mount(id: ActionFilmId) {
  const magnet = id.startsWith('magnet-');
  const comparing = id === 'overlay-traces';
  const flip = id === 'flip-battery';
  const opening = id.startsWith('open-');
  const polarity = id.endsWith('-reversed') ? 'reversed' : 'normal';
  flushSync(() =>
    root.render(
      <article className="frame" key={id}>
        <header>
          <span>雾灯动作片 / {actionFilms[id].label}</span>
          <small>教学示范 · 不记证据</small>
        </header>
        {comparing ? (
          <TraceCards />
        ) : (
          <>
            <div className="bench-shot">
              {magnet ? <MagnetBench /> : <InductionBench />}
              <Marker />
            </div>
            {flip ? <Polarity /> : <Dial />}
          </>
        )}
        <footer>
          <span data-beat="" />
          <strong data-caption="" />
        </footer>
        <div className="film-progress" aria-hidden="true">
          <i />
        </div>
      </article>,
    ),
  );

  const paintBench = !magnet && !comparing ? bindBench(target) : null;
  const paintMagnet = magnet ? bindMagnetBench(target) : null;
  const marker = target.querySelector<HTMLElement>('.tap')!;
  const stage = target.querySelector<HTMLElement>('[data-beat]')!;
  const caption = target.querySelector<HTMLElement>('[data-caption]')!;
  const reading = target.querySelector<HTMLElement>('[data-reading]');
  const needle = target.querySelector<SVGPathElement>('.needle');
  const bar = target.querySelector<HTMLElement>('.film-progress i')!;
  const card = target.querySelector<HTMLElement>('.trace-card--loose');
  const overlay = target.querySelector<SVGPathElement>('[data-overlay]');
  const traceLabel = target.querySelector<HTMLElement>('[data-trace-label]');
  const leftPole = target.querySelector<HTMLElement>('[data-pole="left"]');
  const rightPole = target.querySelector<HTMLElement>('[data-pole="right"]');

  return (time: number, duration: number) => {
    bar.style.transform = `scaleX(${clip(time / duration)})`;
    if (comparing && card && overlay) {
      const travel = ease((time - 0.6) / 1.15);
      card.style.transform = `translateX(${-308 * travel}px)`;
      card.style.opacity = String(1 - ease((time - 1.67) / 0.25));
      overlay.setAttribute('opacity', String(ease((time - 1.67) / 0.25)));
      if (traceLabel)
        traceLabel.textContent = time < 1.86 ? '接通瞬间' : '接通与断开';
      stage.textContent = time < 1.86 ? '拖放' : '对照';
      caption.textContent =
        time < 1.86
          ? '把「断开瞬间」放到「接通瞬间」上'
          : '同一零线，一上一下：偏转方向相反';
      return;
    }

    const age = time - 0.7;
    let value = 0;
    let point: readonly number[] = flip
      ? BENCH_ANCHORS.battery
      : BENCH_ANCHORS.switch;
    let pressed = age >= 0 && age < 0.25;
    let state = '';
    let text = '';
    if (magnet) {
      const frame = magnetFrame(id, time);
      paintMagnet?.({ ...frame, field: false });
      const [x, y] = MAGNET_ANCHORS.far;
      const [a, b] = MAGNET_ANCHORS.near;
      point = [x + (a - x) * frame.position, y + (b - y) * frame.position];
      const hold = id === 'magnet-hold';
      pressed = !hold && time >= 0.45 && time <= 1.65;
      value = frame.needle;
      state = hold ? '松手' : time < 1.65 ? '拖动' : '观察';
      text = hold
        ? time < 0.75
          ? '原地松手，磁铁不要再动'
          : '磁铁还在近处，指针回到零位'
        : time < 0.55
          ? id === 'magnet-away'
            ? '握住磁铁，沿原路拖回远端'
            : '握住磁铁，沿轨道拖向线圈'
          : time < 1.65
            ? id === 'magnet-away'
              ? '远离时，指针往另一侧摆'
              : '靠近时，注意检流计偏转'
            : id === 'magnet-away'
              ? '到远端停住，等记录出现'
              : '到靠近位后松手，原地等待';
    } else {
      const frame = flip
        ? restingFrame(age >= 0.15 ? 'reversed' : 'normal')
        : age < 0
          ? opening
            ? inductionAt('hold', polarity, 0)
            : restingFrame(polarity)
          : transientFrame(opening ? 'disconnect' : 'connect', polarity, age);
      paintBench?.(frame);
      value = frame.needle;
      state = flip ? '换极性' : age < 0.28 ? '点按' : '观察';
      text = flip
        ? age < 0.15
          ? '只点电池，开关保持断开'
          : '正负交换，铁环和开关都不动'
        : age < 0.28
          ? opening
            ? '点同一个开关，把刀闸抬起'
            : '点左前方的手柄，合上刀闸'
          : Math.abs(value) > 0.08
            ? '看右侧：指针短暂偏转'
            : opening
              ? '开关已断开，指针归零'
              : '开关仍接通，指针却归零';
    }
    marker.style.left = `${point[0] * 100}%`;
    marker.style.top = `${point[1] * 100}%`;
    marker.classList.toggle('is-pressed', pressed);
    marker.classList.toggle(
      'is-released',
      id === 'magnet-hold' || (magnet ? time > 1.65 : age > 0.45),
    );
    needle?.setAttribute('transform', `rotate(${value * 47} 70 64)`);
    if (leftPole && rightPole) {
      leftPole.textContent = age >= 0.15 ? '−' : '＋';
      rightPole.textContent = age >= 0.15 ? '＋' : '−';
      leftPole.classList.toggle('positive', age < 0.15);
      rightPole.classList.toggle('positive', age >= 0.15);
    }
    if (reading)
      reading.textContent = flip
        ? age >= 0.15
          ? '已经反接'
          : '原接法'
        : Math.abs(value) < 0.025
          ? '在零位'
          : value > 0
            ? '向右偏转'
            : '向左偏转';
    stage.textContent = state;
    caption.textContent = text;
  };
}

declare global {
  interface Window {
    filmRenderer?: {
      mount: (id: ActionFilmId) => void;
      draw: (t: number, duration: number) => void;
    };
  }
}
let draw: ReturnType<typeof mount>;
window.filmRenderer = {
  mount: (id) => {
    draw = mount(id);
  },
  draw: (t, duration) => draw(t, duration),
};
