'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  Atom,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CloudFog,
  Compass,
  FlaskConical,
  Gauge,
  Lightbulb,
  LockKeyhole,
  Map as MapIcon,
  RotateCcw,
  ShieldQuestion,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';

const publicAsset = (path: string) =>
  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`;

type Screen = 'intro' | 'map' | 'mission' | 'victory';
type MissionStage = 'prediction' | 'experiment' | 'court';
type ExperimentPhase = 'ready' | 'closing' | 'steady' | 'opening' | 'complete';
type HypothesisId = 'field' | 'fault' | 'change';

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Promise<Record<string, unknown>>;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

const STORAGE_KEY = 'science-time-fog-progress-v1';

const hypotheses: Array<{
  id: HypothesisId;
  title: string;
  description: string;
  faction: string;
}> = [
  {
    id: 'field',
    title: '只要有磁场，就会一直有电',
    description: '铁环已经带有磁性，第二组线圈理应持续产生电流。',
    faction: '静态磁场派',
  },
  {
    id: 'fault',
    title: '那一下只是仪器故障',
    description: '指针突然摆动，也许只是接触不良或桌面震动。',
    faction: '仪器怀疑派',
  },
  {
    id: 'change',
    title: '关键可能是磁场正在变化',
    description: '不是“有没有磁场”，而是磁场“有没有发生改变”。',
    faction: '变化猜想派',
  },
];

const evidenceCatalog = [
  {
    id: 'closing',
    number: '01',
    title: '接通瞬间，指针向右摆',
    detail: '电流从零快速增大，铁环中的磁效应也随之建立。',
    damage: 15,
  },
  {
    id: 'steady',
    number: '02',
    title: '持续通电，指针回到零',
    detail: '磁场依然存在，却不再产生可观察的感应电流。',
    damage: 50,
  },
  {
    id: 'opening',
    number: '03',
    title: '断开瞬间，指针向左摆',
    detail: '磁场消失时也产生电流，而且方向与建立磁场时相反。',
    damage: 35,
  },
];

const mapNodes = [
  {
    year: '2026',
    title: '现代指挥站',
    subtitle: '从结果追溯原因',
    state: 'home',
  },
  {
    year: '1831',
    title: '指针只动了一下',
    subtitle: '电磁感应',
    state: 'active',
  },
  {
    year: '1774',
    title: '金属为什么变重',
    subtitle: '氧气与燃烧',
    state: 'next',
  },
  {
    year: '1911',
    title: '粒子竟原路弹回',
    subtitle: '原子核',
    state: 'locked',
  },
];

function SiteHeader({
  screen,
  xp,
  onMap,
  onReset,
}: {
  screen: Screen;
  xp: number;
  onMap: () => void;
  onReset: () => void;
}) {
  return (
    <header className="site-header">
      <button
        className="brand"
        type="button"
        onClick={onMap}
        aria-label="返回科学时间地图"
      >
        <span className="brand__mark">
          <Atom />
        </span>
        <span>
          <strong>答案诞生之前</strong>
          <small>BEFORE THE ANSWER</small>
        </span>
      </button>

      {screen !== 'intro' && (
        <div className="player-stats" aria-label="历险状态">
          <span className="player-stats__rank">
            <Compass /> 雾外观察员
          </span>
          <span className="player-stats__xp">
            <Sparkles /> {xp} XP
          </span>
          <button
            type="button"
            onClick={onReset}
            aria-label="重置历险进度"
            title="重置历险进度"
          >
            <RotateCcw />
          </button>
        </div>
      )}
    </header>
  );
}

function IntroScreen({
  portalReady,
  onLaunch,
}: {
  portalReady: boolean;
  onLaunch: () => void;
}) {
  return (
    <section className="intro-screen" aria-labelledby="intro-title">
      <div className="intro-copy">
        <div className="alert-pill">
          <CloudFog /> 时间线异常警报
        </div>
        <p className="eyebrow">科学文明坐标：现代 · 2026</p>
        <h1 id="intro-title">
          人类忘记了
          <br />
          电从哪里来
        </h1>
        <p className="intro-lede">
          一场时间迷雾正在抹去现代科学。回到结论尚未诞生的年代，亲手重做关键实验，收集证据，把我们的世界一点点赢回来。
        </p>
        <div className="intro-actions">
          <Button className="primary-cta" size="lg" onClick={onLaunch}>
            {portalReady ? '穿过时间迷雾' : '启动时间入口'}
            <ArrowRight />
          </Button>
          <span>首关约 8 分钟 · 无需预备知识</span>
        </div>
        <div className="mission-coordinate">
          <FlaskConical />
          <p>
            <strong>坐标已锁定</strong>1831 年 8 月 29
            日，伦敦皇家研究院地下实验室。
          </p>
        </div>
      </div>

      <div
        className="portal-stage"
        aria-label={portalReady ? '时间入口已经稳定' : '时间入口正在充能'}
      >
        <Image
          className="portal-stage__image"
          src={publicAsset('/faraday-time-fog-hero.png')}
          alt="现代实验室通过时间迷雾连接到1831年的法拉第电磁感应实验装置"
          fill
          priority
          sizes="(max-width: 819px) 100vw, 56vw"
        />
        <div className="portal-stage__shade" />
        <div
          className={`portal-mini ${portalReady ? 'portal-mini--ready' : ''}`}
        >
          <div className="portal-mini__ring portal-mini__ring--one" />
          <div className="portal-mini__ring portal-mini__ring--two" />
          <div className="portal-mini__core">
            <small>DESTINATION</small>
            <strong>1831</strong>
            <span>电磁学 · 未解锁</span>
          </div>
        </div>
        <div className="integrity-card">
          <div>
            <span>科学时间线完整度</span>
            <strong>{portalReady ? '100%' : '42%'}</strong>
          </div>
          <Progress
            value={portalReady ? 100 : 42}
            aria-label="科学时间线完整度"
          />
          <p>
            {portalReady
              ? '入口稳定。记住：过去的人不知道答案。'
              : '变压器、发电机与电网正在从历史中消失。'}
          </p>
        </div>
      </div>
    </section>
  );
}

function MapScreen({
  completed,
  onEnterMission,
}: {
  completed: boolean;
  onEnterMission: () => void;
}) {
  return (
    <section className="map-screen" aria-labelledby="map-title">
      <div className="map-heading">
        <div>
          <p className="eyebrow">
            <MapIcon /> 科学时间地图
          </p>
          <h1 id="map-title">从现代出发，追回被遗忘的答案</h1>
        </div>
        <div className="civilization-meter">
          <span>文明知识恢复度</span>
          <strong>{completed ? '18%' : '7%'}</strong>
          <Progress value={completed ? 18 : 7} aria-label="文明知识恢复度" />
        </div>
      </div>

      <div className="timeline-shell">
        <div className="timeline-line" />
        <div className="timeline-nodes">
          {mapNodes.map((node, index) => {
            const unlocked =
              node.state === 'home' ||
              node.state === 'active' ||
              (node.state === 'next' && completed);
            const nodeCompleted =
              node.state === 'home' || (node.state === 'active' && completed);
            return (
              <div
                className={`timeline-node ${unlocked ? 'is-unlocked' : ''} ${nodeCompleted ? 'is-complete' : ''}`}
                key={node.year}
              >
                <div className="timeline-node__number">0{index}</div>
                <div className="timeline-node__dot">
                  {nodeCompleted ? (
                    <Check />
                  ) : unlocked ? (
                    <Zap />
                  ) : (
                    <LockKeyhole />
                  )}
                </div>
                <strong>{node.year}</strong>
                <span>{node.title}</span>
                <small>{node.subtitle}</small>
                {node.state === 'next' && completed && (
                  <Badge className="mt-2 bg-cyan-300 text-slate-950">
                    新坐标
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mission-card">
        <div className="mission-card__visual">
          <Image
            src={publicAsset('/faraday-time-fog-hero.png')}
            alt="铁环、两组线圈和指针仪表组成的法拉第实验装置"
            fill
            sizes="(max-width: 819px) 100vw, 54vw"
          />
          <span className="mission-card__chapter">主线任务 01</span>
        </div>
        <div className="mission-card__copy">
          <div className="mission-card__meta">
            <span>物理 · 电磁学</span>
            <span>1831 · 伦敦</span>
          </div>
          <h2>指针只动了一下</h2>
          <p>
            电池仍在供电，指针为什么只偏转了一瞬间？回到法拉第的实验桌前，在三个竞争解释中找出唯一能活到最后的那个。
          </p>
          <div className="mission-card__rewards">
            <span>
              <Gauge /> 8 分钟
            </span>
            <span>
              <Swords /> 1 场理论战
            </span>
            <span>
              <Trophy /> 120 XP
            </span>
          </div>
          <Button className="primary-cta" size="lg" onClick={onEnterMission}>
            {completed ? '重返 1831' : '进入时间坐标'} <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="next-mission">
        <div>
          <FlaskConical />
          <span>
            <strong>下一关：燃素幽灵</strong>金属烧掉一部分，为什么反而更重？
          </span>
        </div>
        <Badge
          variant="outline"
          className={
            completed ? 'border-cyan-300/40 text-cyan-200' : 'text-slate-500'
          }
        >
          {completed ? '已发现坐标 · 内容预告' : '完成主线 01 后解锁'}
        </Badge>
      </div>
    </section>
  );
}

function PredictionStage({
  selected,
  onSelect,
  onConfirm,
  onBack,
}: {
  selected: HypothesisId | null;
  onSelect: (id: HypothesisId) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mission-layout prediction-stage">
      <div className="mission-story">
        <Button variant="ghost" className="back-button" onClick={onBack}>
          <ArrowLeft /> 返回时间地图
        </Button>
        <p className="eyebrow">1831 · 伦敦皇家研究院</p>
        <h1>
          指针只动了
          <br />
          一下
        </h1>
        <div className="story-transcript">
          <p>
            铁环两侧分别缠着一组铜线。左侧接电池，右侧接灵敏的指针仪表。两组导线彼此绝缘，没有直接相连。
          </p>
          <p>法拉第准备合上开关。我们只有一次机会，在看见结果前留下判断。</p>
        </div>
        <div className="historical-note">
          <BookOpen />
          <span>
            <strong>时代迷雾已开启</strong>
            “电磁感应”这个词暂时不可用，因为此刻它还没有成为答案。
          </span>
        </div>
      </div>

      <div className="hypothesis-panel">
        <div className="panel-kicker">
          <ShieldQuestion /> 行动 01 · 锁定你的猜想
        </div>
        <h2>合上开关后，右边的指针会怎样？</h2>
        <p>不是考试。一个好猜想，只需要敢于接受下一条证据的挑战。</p>
        <div
          className="hypothesis-list"
          role="radiogroup"
          aria-label="选择实验猜想"
        >
          {hypotheses.map((item) => (
            <label
              className={`hypothesis-option ${selected === item.id ? 'is-selected' : ''}`}
              key={item.id}
            >
              <input
                className="sr-only"
                type="radio"
                name="faraday-hypothesis"
                value={item.id}
                checked={selected === item.id}
                onChange={() => onSelect(item.id)}
              />
              <span className="hypothesis-option__radio" aria-hidden="true">
                {selected === item.id ? <Check /> : null}
              </span>
              <span>
                <small>{item.faction}</small>
                <strong>{item.title}</strong>
                <em>{item.description}</em>
              </span>
            </label>
          ))}
        </div>
        <Button
          className="primary-cta w-full"
          size="lg"
          disabled={!selected}
          onClick={onConfirm}
        >
          锁定猜想，进入实验 <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

function Apparatus({
  phase,
  power,
}: {
  phase: ExperimentPhase;
  power: number;
}) {
  const needleAngle =
    phase === 'closing' ? power : phase === 'opening' ? -power : 0;
  const circuitOn = phase === 'closing' || phase === 'steady';
  const changing = phase === 'closing' || phase === 'opening';

  return (
    <div
      className={`apparatus ${circuitOn ? 'is-on' : ''} ${changing ? 'is-changing' : ''}`}
    >
      <div className="apparatus__labels" aria-hidden="true">
        <span>原线圈</span>
        <span>铁环</span>
        <span>副线圈</span>
        <span>检流计</span>
      </div>
      <div className="battery-bank" aria-label="电池">
        <span />
        <span />
        <span />
        <small>电池</small>
      </div>
      <div className="wire wire--input" />
      <div className="induction-ring" aria-label="带有两组相互绝缘线圈的铁环">
        <div className="coil coil--left" />
        <div className="coil coil--right" />
        <div className="field-wave field-wave--one" />
        <div className="field-wave field-wave--two" />
      </div>
      <div className="wire wire--output" />
      <div
        className="galvanometer"
        aria-label={`检流计指针角度 ${needleAngle} 度`}
      >
        <div className="galvanometer__scale">
          <span>−</span>
          <strong>0</strong>
          <span>＋</span>
        </div>
        <div
          className="galvanometer__needle"
          style={{ transform: `rotate(${needleAngle}deg)` }}
        />
        <div className="galvanometer__pivot" />
        <small>电流</small>
      </div>
      <div className={`switch-light ${circuitOn ? 'is-lit' : ''}`}>
        <Zap />
      </div>
    </div>
  );
}

function ExperimentStage({
  phase,
  evidence,
  speed,
  announcement,
  onSpeedChange,
  onCloseCircuit,
  onOpenCircuit,
  onCourt,
  onBack,
}: {
  phase: ExperimentPhase;
  evidence: string[];
  speed: number;
  announcement: string;
  onSpeedChange: (value: number) => void;
  onCloseCircuit: () => void;
  onOpenCircuit: () => void;
  onCourt: () => void;
  onBack: () => void;
}) {
  const canOpen = phase === 'steady';
  const finished =
    evidence.length === evidenceCatalog.length && phase === 'complete';
  return (
    <div className="experiment-screen">
      <div className="experiment-topbar">
        <Button variant="ghost" className="back-button" onClick={onBack}>
          <ArrowLeft /> 退出坐标
        </Button>
        <div className="chapter-progress">
          <span>预测</span>
          <i />
          <strong>实验</strong>
          <i />
          <span>理论战</span>
        </div>
        <Badge className="bg-amber-300 text-slate-950">行动 02</Badge>
      </div>

      <div className="experiment-grid">
        <aside className="experiment-brief">
          <p className="eyebrow">实验日志 · 1831/08/29</p>
          <h1>让证据说话</h1>
          <p>
            先接通电路并耐心观察，再断开。不要只盯着指针“有没有动”，还要注意它什么时候动、向哪边动。
          </p>

          <div className="speed-control">
            <div>
              <span>开关变化速度</span>
              <strong>{speed}×</strong>
            </div>
            <Slider
              aria-label="开关变化速度"
              value={speed}
              min={1}
              max={5}
              step={1}
              onValueChange={(value) => onSpeedChange(Number(value))}
            />
            <small>变化越快，指针瞬间偏转越明显。</small>
          </div>

          <div className="experiment-actions">
            <Button
              className="primary-cta"
              size="lg"
              disabled={phase !== 'ready'}
              onClick={onCloseCircuit}
            >
              <Zap /> 闭合开关
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={!canOpen}
              onClick={onOpenCircuit}
            >
              断开开关
            </Button>
          </div>
          <div className="live-announcement" aria-live="polite">
            <Gauge />
            <span>{announcement}</span>
          </div>
        </aside>

        <section className="apparatus-panel" aria-label="法拉第感应环互动实验">
          <div className="apparatus-panel__heading">
            <span>历史装置复原 · 教学模型</span>
            <span
              className={
                phase === 'ready' || phase === 'complete' ? '' : 'recording'
              }
            >
              ● REC
            </span>
          </div>
          <Apparatus phase={phase} power={24 + speed * 8} />
          <p className="apparatus-caption">
            两组铜线相互绝缘。右侧仪表没有电池，只能响应来自另一组线圈的影响。
          </p>
        </section>

        <aside className="evidence-inventory">
          <div className="panel-kicker">
            <Sparkles /> 证据背包 {evidence.length}/3
          </div>
          <div className="evidence-stack">
            {evidenceCatalog.map((item) => {
              const found = evidence.includes(item.id);
              return (
                <div
                  className={`evidence-mini ${found ? 'is-found' : ''}`}
                  key={item.id}
                >
                  <span>{found ? item.number : '?'}</span>
                  <div>
                    <strong>{found ? item.title : '等待实验现象'}</strong>
                    <small>
                      {found ? item.detail : '继续操作装置以收集证据。'}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            className="w-full"
            variant={finished ? 'default' : 'outline'}
            size="lg"
            disabled={!finished}
            onClick={onCourt}
          >
            {finished
              ? '带上证据，进入理论战'
              : `还差 ${3 - evidence.length} 条证据`}{' '}
            <Swords />
          </Button>
        </aside>
      </div>
    </div>
  );
}

function CourtStage({
  bossHp,
  usedEvidence,
  selectedHypothesis,
  onUseEvidence,
}: {
  bossHp: number;
  usedEvidence: string[];
  selectedHypothesis: HypothesisId | null;
  onUseEvidence: (id: string, damage: number) => void;
}) {
  const selected = hypotheses.find((item) => item.id === selectedHypothesis);
  return (
    <div className="court-screen">
      <div className="court-heading">
        <p className="eyebrow">
          <Swords /> 行动 03 · 科学法庭
        </p>
        <h1>
          旧理论不会因为口号倒下，
          <br />
          只会在证据面前退场。
        </h1>
        <p>用刚刚亲眼看到的现象，挑战迷雾中的“静态磁场说”。</p>
      </div>

      <div className="boss-card">
        <div className="boss-card__icon">
          <CloudFog />
        </div>
        <div className="boss-card__title">
          <span>时代迷雾 · 理论首领</span>
          <h2>“只要存在磁场，就会持续生电”</h2>
        </div>
        <div className="boss-health">
          <div>
            <span>理论解释力</span>
            <strong>{bossHp}/100</strong>
          </div>
          <Progress value={bossHp} aria-label="旧理论解释力" />
        </div>
        <p>
          它看起来相当合理——直到我们要求它同时解释接通、持续和断开三个时刻。
        </p>
      </div>

      <div className="evidence-weapons">
        {evidenceCatalog.map((item) => {
          const used = usedEvidence.includes(item.id);
          return (
            <button
              type="button"
              disabled={used}
              className={`evidence-weapon ${used ? 'is-used' : ''}`}
              key={item.id}
              onClick={() => onUseEvidence(item.id, item.damage)}
            >
              <span className="evidence-weapon__number">
                证据 {item.number}
              </span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <span className="evidence-weapon__damage">
                {used ? (
                  <>
                    <CheckCircle2 /> 已提交
                  </>
                ) : (
                  <>
                    提交证据 · −{item.damage} 解释力 <Zap />
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="prediction-reveal">
        <Lightbulb />
        <p>
          你最初加入了<strong>「{selected?.faction ?? '未命名阵营'}」</strong>
          。猜对不是重点；重要的是，你是否愿意让新证据改变原来的判断。
        </p>
      </div>
    </div>
  );
}

function VictoryScreen({
  onMap,
  onReplay,
}: {
  onMap: () => void;
  onReplay: () => void;
}) {
  return (
    <section className="victory-screen" aria-labelledby="victory-title">
      <div className="victory-glow">
        <Trophy />
      </div>
      <p className="eyebrow">
        <Sparkles /> 科学时间线已修复
      </p>
      <h1 id="victory-title">
        你没有背下答案。
        <br />
        你让答案发生了。
      </h1>
      <p className="victory-lede">
        静态磁场说无法解释全部证据。只有“磁场发生变化”时，另一组线圈中才出现短暂电流；变化方向相反，电流方向也随之反转。
      </p>

      <div className="level-up-card">
        <div>
          <span>LEVEL UP</span>
          <strong>雾外观察员 → 证据猎人</strong>
        </div>
        <Badge className="bg-amber-300 text-slate-950">+120 XP</Badge>
      </div>

      <div className="memory-anchors">
        <article>
          <span>01</span>
          <strong>存在不等于变化</strong>
          <p>磁场持续存在时，指针可以保持为零。</p>
        </article>
        <article>
          <span>02</span>
          <strong>变化越快，效应越强</strong>
          <p>更快建立或消失的磁场带来更明显的瞬时偏转。</p>
        </article>
        <article>
          <span>03</span>
          <strong>反向变化，反向电流</strong>
          <p>接通和断开时，指针向相反方向摆动。</p>
        </article>
      </div>

      <div className="impact-chain">
        <span>一根指针</span>
        <ChevronRight />
        <span>电磁感应</span>
        <ChevronRight />
        <span>变压器</span>
        <ChevronRight />
        <span>发电机</span>
        <ChevronRight />
        <strong>现代电网</strong>
      </div>

      <div className="victory-actions">
        <Button className="primary-cta" size="lg" onClick={onMap}>
          返回地图，查看新坐标 <MapIcon />
        </Button>
        <Button variant="outline" size="lg" onClick={onReplay}>
          <RotateCcw /> 重做实验
        </Button>
      </div>

      <aside className="next-hook">
        <FlaskConical />
        <div>
          <small>下一关已发现</small>
          <strong>一块金属被烧掉一部分，为什么反而更重了？</strong>
          <p>1774 年。燃素说占尽优势，而你手里只有一架天平。</p>
        </div>
      </aside>
    </section>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>('intro');
  const [portalReady, setPortalReady] = useState(false);
  const [missionStage, setMissionStage] = useState<MissionStage>('prediction');
  const [selectedHypothesis, setSelectedHypothesis] =
    useState<HypothesisId | null>(null);
  const [phase, setPhase] = useState<ExperimentPhase>('ready');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [usedEvidence, setUsedEvidence] = useState<string[]>([]);
  const [bossHp, setBossHp] = useState(100);
  const [switchSpeed, setSwitchSpeed] = useState(3);
  const [announcement, setAnnouncement] = useState('仪器归零。等待闭合开关。');
  const [xp, setXp] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as {
            xp?: unknown;
            completed?: unknown;
          };
          if (typeof parsed.xp === 'number' && Number.isFinite(parsed.xp)) {
            setXp(Math.max(0, Math.min(9999, Math.round(parsed.xp))));
          }
          if (typeof parsed.completed === 'boolean')
            setCompleted(parsed.completed);
        }
      } catch {
        // Local progress is optional; a blocked or malformed store must not break the demo.
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => {
      window.clearTimeout(restoreTimer);
      timers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ xp, completed }),
      );
    } catch {
      // Continue without persistence when browser storage is unavailable.
    }
  }, [completed, hydrated, xp]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();
    const registration = context.registerTool(
      {
        name: 'start_faraday_expedition',
        title: '开始法拉第科学历险',
        description: '打开“指针只动了一下”任务，并从选择实验猜想的第一幕开始。',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          if (
            typeof input !== 'object' ||
            input === null ||
            Array.isArray(input) ||
            Object.keys(input).length > 0
          ) {
            throw new Error('This action does not accept arguments.');
          }
          timers.current.forEach((timer) => window.clearTimeout(timer));
          timers.current = [];
          setMissionStage('prediction');
          setSelectedHypothesis(null);
          setPhase('ready');
          setEvidence([]);
          setUsedEvidence([]);
          setBossHp(100);
          setSwitchSpeed(3);
          setAnnouncement('仪器归零。等待闭合开关。');
          setPortalReady(true);
          setScreen('mission');
          await new Promise<void>((resolve) =>
            window.requestAnimationFrame(() => resolve()),
          );
          return { status: 'ready', mission: 'faraday-induction-1831' };
        },
      },
      { signal: lifecycle.signal },
    );
    void Promise.resolve(registration).catch(() => {
      // WebMCP is an optional progressive enhancement.
    });

    return () => lifecycle.abort();
  }, []);

  const awardXp = (amount: number) =>
    setXp((current) => Math.min(9999, current + amount));

  const resetMission = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setMissionStage('prediction');
    setSelectedHypothesis(null);
    setPhase('ready');
    setEvidence([]);
    setUsedEvidence([]);
    setBossHp(100);
    setSwitchSpeed(3);
    setAnnouncement('仪器归零。等待闭合开关。');
  };

  const resetAll = () => {
    resetMission();
    setXp(0);
    setCompleted(false);
    setPortalReady(false);
    setScreen('intro');
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Storage is optional. */
    }
  };

  const openMap = () => setScreen('map');

  const launchPortal = () => {
    if (!portalReady) {
      setPortalReady(true);
      return;
    }
    setScreen('map');
  };

  const enterMission = () => {
    resetMission();
    setScreen('mission');
  };

  const confirmHypothesis = () => {
    if (!selectedHypothesis) return;
    awardXp(10);
    setMissionStage('experiment');
  };

  const unlockEvidence = (id: string) => {
    setEvidence((current) =>
      current.includes(id) ? current : [...current, id],
    );
  };

  const closeCircuit = () => {
    if (phase !== 'ready') return;
    const duration = Math.max(420, 1180 - switchSpeed * 140);
    setPhase('closing');
    unlockEvidence('closing');
    awardXp(10);
    setAnnouncement('指针突然向右摆动——有电流，但只在这一瞬间！');
    const timer = window.setTimeout(() => {
      setPhase('steady');
      unlockEvidence('steady');
      awardXp(15);
      setAnnouncement(
        '电池仍在连接，指针却回到了零。别忽略这条“什么都没发生”的证据。',
      );
    }, duration);
    timers.current.push(timer);
  };

  const openCircuit = () => {
    if (phase !== 'steady') return;
    const duration = Math.max(420, 1180 - switchSpeed * 140);
    setPhase('opening');
    unlockEvidence('opening');
    awardXp(15);
    setAnnouncement('指针向左摆动！断开也产生电流，而且方向与接通时相反。');
    const timer = window.setTimeout(() => {
      setPhase('complete');
      setAnnouncement('磁场停止变化，指针再次归零。三条证据已集齐。');
    }, duration);
    timers.current.push(timer);
  };

  const useEvidence = (id: string, damage: number) => {
    if (usedEvidence.includes(id) || bossHp <= 0) return;
    setUsedEvidence((current) => [...current, id]);
    const nextHp = Math.max(0, bossHp - damage);
    setBossHp(nextHp);
    awardXp(10);
    if (nextHp === 0) {
      const timer = window.setTimeout(() => {
        setCompleted(true);
        awardXp(50);
        setScreen('victory');
      }, 650);
      timers.current.push(timer);
    }
  };

  return (
    <main className="app-shell">
      <SiteHeader screen={screen} xp={xp} onMap={openMap} onReset={resetAll} />
      {screen === 'intro' && (
        <IntroScreen portalReady={portalReady} onLaunch={launchPortal} />
      )}
      {screen === 'map' && (
        <MapScreen completed={completed} onEnterMission={enterMission} />
      )}
      {screen === 'mission' && missionStage === 'prediction' && (
        <PredictionStage
          selected={selectedHypothesis}
          onSelect={setSelectedHypothesis}
          onConfirm={confirmHypothesis}
          onBack={openMap}
        />
      )}
      {screen === 'mission' && missionStage === 'experiment' && (
        <ExperimentStage
          phase={phase}
          evidence={evidence}
          speed={switchSpeed}
          announcement={announcement}
          onSpeedChange={setSwitchSpeed}
          onCloseCircuit={closeCircuit}
          onOpenCircuit={openCircuit}
          onCourt={() => setMissionStage('court')}
          onBack={openMap}
        />
      )}
      {screen === 'mission' && missionStage === 'court' && (
        <CourtStage
          bossHp={bossHp}
          usedEvidence={usedEvidence}
          selectedHypothesis={selectedHypothesis}
          onUseEvidence={useEvidence}
        />
      )}
      {screen === 'victory' && (
        <VictoryScreen onMap={openMap} onReplay={enterMission} />
      )}
    </main>
  );
}
