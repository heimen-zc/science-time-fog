'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Atom,
  Battery,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  CloudFog,
  Compass,
  ExternalLink,
  FileText,
  FlaskConical,
  Gauge,
  History,
  Layers3,
  Lightbulb,
  LockKeyhole,
  Magnet,
  Map as MapIcon,
  Minus,
  Network,
  Notebook,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Scale,
  Search,
  Settings2,
  ShieldQuestion,
  Sparkles,
  Swords,
  Trophy,
  Waves,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';

const publicAsset = (path: string) =>
  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`;

type Screen = 'intro' | 'map' | 'mission' | 'archive';
type MissionStage = 'prediction' | 'experiment' | 'court';
type HypothesisId = 'conduction' | 'instrument' | 'temporary-state';
type ApparatusMode = 'ring' | 'magnet';
type RingAction = 'connect' | 'hold' | 'disconnect';
type MagnetAction = 'insert' | 'hold' | 'withdraw';
type ExperimentAction = RingAction | MagnetAction;
type CoreMaterial = 'iron' | 'copper' | 'air';
type Polarity = 'normal' | 'reversed';
type SignalDirection = 'left' | 'right' | 'none';
type ArchiveView = 'history' | 'mine' | 'community';

type ExperimentSetup = {
  mode: ApparatusMode;
  action: ExperimentAction;
  core: CoreMaterial;
  polarity: Polarity;
  turns: number;
  batteryPairs: number;
  motionSpeed: number;
};

type ExperimentRecord = ExperimentSetup & {
  id: number;
  direction: SignalDirection;
  strength: number;
  observation: string;
  signature: string;
};

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

type ArchiveSource = { label: string; institution: string; url: string };

type HistoryNode = {
  date: string;
  kind: string;
  title: string;
  body: string;
  supports: string;
  limit: string;
  note: string;
  source: ArchiveSource;
  secondarySource?: ArchiveSource;
  tone:
    | 'context'
    | 'failure'
    | 'breakthrough'
    | 'test'
    | 'invention'
    | 'publication';
};

type Insights = ReturnType<typeof getInsights>;

const STORAGE_KEY = 'science-time-fog-progress-v2';

const hypotheses: Array<{
  id: HypothesisId;
  title: string;
  description: string;
  faction: string;
}> = [
  {
    id: 'conduction',
    title: '电的影响沿着铁环传了过去',
    description: '铁也许像导线一样，把电从左侧送到了右侧。',
    faction: '隐秘传导说',
  },
  {
    id: 'instrument',
    title: '开关动作碰巧震动了仪表',
    description: '指针的摆动可能来自桌面冲击，而不是新的电流。',
    faction: '仪器怀疑说',
  },
  {
    id: 'temporary-state',
    title: '铁环短暂进入了某种未知状态',
    description: '它可能只在电池接通的一刻发生变化，随后又恢复平静。',
    faction: '瞬态作用说',
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
    title: '只动一下的指针',
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
] as const;

const actionLabels: Record<ExperimentAction, string> = {
  connect: '接通电池',
  hold: '保持不动',
  disconnect: '断开电池',
  insert: '把磁铁推入线圈',
  withdraw: '把磁铁抽出线圈',
};

const coreLabels: Record<CoreMaterial, string> = {
  iron: '软铁环',
  copper: '铜环',
  air: '无铁芯',
};

const archiveSources = {
  diary: {
    label: '1831 年 8 月 29 日实验日记',
    institution: '法拉第日记 · 皇家研究院授权预览',
    url: 'https://faradaysdiary.com/ws3/faraday.pdf',
  },
  ring: {
    label: '法拉第原始感应环藏品',
    institution: '英国皇家研究院 · Faraday Museum',
    url: 'https://www.rigb.org/explore-science/explore/collection/michael-faradays-ring-coil-apparatus',
  },
  manuscript: {
    label: '《电学实验研究》原始手稿',
    institution: '英国皇家学会档案馆 · PT/20/4',
    url: 'https://makingscience.royalsociety.org/items/pt_20_4/paper-experimental-researches-in-electricity-by-m-michael-faraday',
  },
  report: {
    label: '完整实验报告（公共领域文本）',
    institution: 'Michael Faraday · Experimental Researches in Electricity',
    url: 'https://www.gutenberg.org/files/14986/14986-h/14986-h.htm',
  },
  generator: {
    label: '法拉第原始发电机藏品',
    institution: '英国皇家研究院 · Faraday Museum',
    url: 'https://www.rigb.org/explore-science/explore/collection/michael-faradays-generator',
  },
  motor: {
    label: '电磁旋转装置藏品',
    institution: '英国皇家研究院 · Faraday Museum',
    url: 'https://www.rigb.org/explore-science/explore/collection/michael-faradays-electric-magnetic-rotation-apparatus-motor',
  },
} satisfies Record<string, ArchiveSource>;

const historicalPath: HistoryNode[] = [
  {
    date: '1821',
    kind: '问题出现',
    title: '电能制造磁，那么磁能制造电吗？',
    body: '奥斯特和安培打开了电与磁之间的联系。法拉第先用电流制造持续旋转，再把问题反过来。',
    supports: '证明当时已经存在“电与磁可相互作用”的实验背景。',
    limit: '它没有证明磁能够产生电，更没有给出产生条件。',
    note: '好问题很少凭空出现；它往往是把一个已经成立的关系反过来追问。',
    source: archiveSources.motor,
    tone: 'context',
  },
  {
    date: '1825',
    kind: '失败记录',
    title: '平行导线没有给出任何可见结果',
    body: '他没有删除这次失败。1832 年整理报告时，法拉第回看旧记录，已经能解释当初为什么错过了短暂信号。',
    supports: '证明成功之前存在长期而明确的失败尝试。',
    limit: '一次无现象不能证明感应不存在，只能约束当时的装置与观察方式。',
    note: '失败不是空白数据：它告诉你，效应可能太短、太弱，或你观察了错误的时刻。',
    source: archiveSources.report,
    tone: 'failure',
  },
  {
    date: '1831 · 08 · 29',
    kind: '异常出现',
    title: '接通时一摆，持续时归零，断开时反向',
    body: '软铁环两侧缠绕彼此绝缘的线圈。真正关键的不是“指针动了”，而是它只在状态发生改变时行动。',
    supports: '证明彼此不接触的两个回路之间出现了短暂电作用。',
    limit: '单次偏转尚不能排除震动、漏电或仪器偶然误差。',
    note: '法拉第记录了针的振荡、归零和断开后的再次扰动，没有把第一次摆动直接写成定律。',
    source: archiveSources.diary,
    secondarySource: archiveSources.ring,
    tone: 'breakthrough',
  },
  {
    date: '1831 · 08 · 30',
    kind: '排除解释',
    title: '静止的大磁铁没有带来持续电流',
    body: '紧接着的实验不断排除“永久状态”和简单传导等解释。零结果开始成为最锋利的证据。',
    supports: '支持效应依赖改变过程，而不是磁性本身持续存在。',
    limit: '这仍未说明改变的快慢、方向和几何关系如何决定电流。',
    note: '没有偏转并非失败；只要条件被准确记录，它就能击穿一个看似合理的解释。',
    source: archiveSources.diary,
    tone: 'test',
  },
  {
    date: '1831 · 10',
    kind: '装置进化',
    title: '让磁铁运动，电流终于可以被主动制造',
    body: '磁铁穿过线圈时产生电流，停住时消失，反向运动时电流反向。观察正在变成可以操纵的规律。',
    supports: '证明不依赖电池接触，也能通过磁体与线圈的相对运动产生电流。',
    limit: '装置展示了原理，但距离高效、稳定的现代发电系统仍很遥远。',
    note: '当现象可以被主动控制，它才从“奇怪的一下”迈向一种技术能力。',
    source: archiveSources.generator,
    tone: 'invention',
  },
  {
    date: '1831 · 11 · 24',
    kind: '公开检验',
    title: '私人实验进入科学共同体',
    body: '论文在皇家学会宣读。发现必须留下可检查的装置、记录和论证，才能从个人经验变成公共知识。',
    supports: '证明发现经过正式记录、提交与科学共同体的公开程序。',
    limit: '发表不是永恒正确的认证；理论仍会被后来的实验和数学继续修订。',
    note: '科学结论的力量，不来自发现者的身份，而来自别人可以追查、质疑与重做。',
    source: archiveSources.manuscript,
    tone: 'publication',
  },
];

const communityNodes = [
  {
    year: '1820',
    name: '奥斯特',
    role: '让电流使磁针偏转',
    contribution: '提供了问题的入口，而不是最终答案。',
  },
  {
    year: '1821',
    name: '安培与法拉第',
    role: '探索电流与运动',
    contribution: '把零散现象变成可以操纵的装置。',
  },
  {
    year: '1831',
    name: '法拉第与约瑟夫·亨利',
    role: '独立探索电磁感应',
    contribution: '发现从来不只属于孤立的天才时刻。',
  },
  {
    year: '1834',
    name: '楞次',
    role: '澄清感应电流方向',
    contribution: '让“反向”成为可以普遍表达的规律。',
  },
  {
    year: '1860s',
    name: '麦克斯韦',
    role: '将场思想写进数学体系',
    contribution: '实验图景被压缩成可推演、可迁移的理论。',
  },
  {
    year: '后来',
    name: '工程师与公共系统',
    role: '发电机、变压器与电网',
    contribution: '一条实验规律最终成为文明基础设施。',
  },
];

function clampInteger(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function simulateExperiment(
  setup: ExperimentSetup,
): Omit<ExperimentRecord, 'id'> {
  const normalized: ExperimentSetup = {
    ...setup,
    turns: clampInteger(setup.turns, 1, 3),
    batteryPairs: [1, 10, 100].includes(setup.batteryPairs)
      ? setup.batteryPairs
      : 10,
    motionSpeed: clampInteger(setup.motionSpeed, 1, 5),
  };
  const isStill = normalized.action === 'hold';
  const coreFactor =
    normalized.core === 'iron' ? 1 : normalized.core === 'copper' ? 0.42 : 0.3;
  const polarityFactor = normalized.polarity === 'normal' ? 1 : -1;
  const actionFactor =
    normalized.action === 'disconnect' || normalized.action === 'withdraw'
      ? -1
      : 1;
  let strength = 0;

  if (!isStill) {
    strength =
      normalized.mode === 'ring'
        ? Math.min(
            100,
            Math.round(
              (18 +
                normalized.turns * 9 +
                Math.log10(normalized.batteryPairs + 1) * 22) *
                coreFactor,
            ),
          )
        : Math.min(
            100,
            Math.round(
              (12 + normalized.turns * 8 + normalized.motionSpeed * 13) * 0.92,
            ),
          );
  }

  const signedSignal = strength * polarityFactor * actionFactor;
  const direction: SignalDirection =
    signedSignal > 0 ? 'right' : signedSignal < 0 ? 'left' : 'none';
  const extreme =
    normalized.mode === 'ring' &&
    normalized.batteryPairs === 100 &&
    strength > 70;
  const observation = isStill
    ? normalized.mode === 'ring'
      ? '电池仍连接，铁环仍有磁性，但指针回到零位。'
      : '磁铁停在线圈内部，指针回到零位。'
    : extreme
      ? `指针向${direction === 'right' ? '右' : '左'}猛冲并越过刻度；强电池让短促信号变得异常明显。`
      : `指针向${direction === 'right' ? '右' : '左'}瞬时偏转，峰值约为 ${strength} 格，随后回零。`;
  const signature = [
    normalized.mode,
    normalized.action,
    normalized.core,
    normalized.polarity,
    normalized.turns,
    normalized.batteryPairs,
    normalized.motionSpeed,
  ].join(':');

  return { ...normalized, direction, strength, observation, signature };
}

type RelevantField =
  | 'action'
  | 'core'
  | 'polarity'
  | 'turns'
  | 'batteryPairs'
  | 'motionSpeed';

function relevantFieldsFor(mode: ApparatusMode): RelevantField[] {
  return mode === 'ring'
    ? ['action', 'core', 'polarity', 'turns', 'batteryPairs']
    : ['action', 'polarity', 'turns', 'motionSpeed'];
}

function sameContextExcept(
  first: ExperimentRecord,
  second: ExperimentRecord,
  ignoredField: RelevantField,
) {
  return (
    first.mode === second.mode &&
    relevantFieldsFor(first.mode).every(
      (field) => field === ignoredField || first[field] === second[field],
    )
  );
}

function hasControlledActionSeries(
  records: ExperimentRecord[],
  mode: ApparatusMode,
  actions: ExperimentAction[],
) {
  const candidates = records.filter((record) => record.mode === mode);
  return candidates.some((baseline) =>
    actions.every((action) =>
      candidates.some(
        (candidate) =>
          candidate.action === action &&
          sameContextExcept(baseline, candidate, 'action'),
      ),
    ),
  );
}

function getInsights(records: ExperimentRecord[]) {
  const transient = hasControlledActionSeries(records, 'ring', [
    'connect',
    'hold',
    'disconnect',
  ]);
  const magnetMotion = hasControlledActionSeries(records, 'magnet', [
    'insert',
    'hold',
    'withdraw',
  ]);
  const polarity = records.some((record, index) =>
    records
      .slice(index + 1)
      .some(
        (candidate) =>
          sameContextExcept(record, candidate, 'polarity') &&
          candidate.polarity !== record.polarity &&
          candidate.direction !== record.direction,
      ),
  );
  const rate = records.some((record, index) =>
    records
      .slice(index + 1)
      .some(
        (candidate) =>
          record.mode === 'magnet' &&
          candidate.mode === 'magnet' &&
          sameContextExcept(record, candidate, 'motionSpeed') &&
          candidate.motionSpeed !== record.motionSpeed &&
          candidate.strength !== record.strength,
      ),
  );
  const core = records.some((record, index) =>
    records
      .slice(index + 1)
      .some(
        (candidate) =>
          record.mode === 'ring' &&
          candidate.mode === 'ring' &&
          sameContextExcept(record, candidate, 'core') &&
          candidate.core !== record.core &&
          candidate.strength !== record.strength,
      ),
  );
  return { transient, polarity, magnetMotion, rate, core };
}

function countControlledComparisons(records: ExperimentRecord[]) {
  let count = 0;
  for (let index = 0; index < records.length; index += 1) {
    for (
      let candidateIndex = index + 1;
      candidateIndex < records.length;
      candidateIndex += 1
    ) {
      const first = records[index];
      const second = records[candidateIndex];
      if (first.mode !== second.mode) continue;
      const changedFields = relevantFieldsFor(first.mode).filter(
        (field) => first[field] !== second[field],
      );
      if (changedFields.length === 1) count += 1;
    }
  }
  return count;
}

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
            <Compass /> 实验追问者
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
          一场时间迷雾正在把科学压缩成待背诵的结论。回到答案尚未诞生的年代，亲手设计实验、追踪异常，并证明哪种解释能够活下来。
        </p>
        <div className="intro-actions">
          <Button className="primary-cta" size="lg" onClick={onLaunch}>
            {portalReady ? '穿过时间迷雾' : '启动时间入口'} <ArrowRight />
          </Button>
          <span>首关约 15 分钟 · 无需预备知识</span>
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
          alt="现代实验室通过时间迷雾连接到1831年的法拉第实验室"
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
            <span>结论尚未诞生</span>
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
              ? '入口稳定。过去的人不知道正确答案。'
              : '发电机、变压器与电网正在从历史中消失。'}
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
          <h1 id="map-title">从现代出发，追回发现答案的方法</h1>
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
            alt="法拉第感应实验场景"
            fill
            sizes="(max-width: 819px) 100vw, 54vw"
          />
          <span className="mission-card__chapter">主线任务 01 · 重制版</span>
        </div>
        <div className="mission-card__copy">
          <div className="mission-card__meta">
            <span>物理 · 实验推理</span>
            <span>1831 · 伦敦</span>
          </div>
          <h2>只动一下的指针</h2>
          <p>
            不再寻找预设答案。你将自由改变装置、记录实验、制造对照，并用最有区分力的证据击破三种替代解释。
          </p>
          <div className="mission-card__rewards">
            <span>
              <Gauge /> 15 分钟
            </span>
            <span>
              <Notebook /> 实验日志
            </span>
            <span>
              <Archive /> 真实档案
            </span>
          </div>
          <Button className="primary-cta" size="lg" onClick={onEnterMission}>
            {completed ? '重新进入发现现场' : '进入时间坐标'} <ChevronRight />
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
  confidence,
  onSelect,
  onConfidenceChange,
  onConfirm,
  onBack,
}: {
  selected: HypothesisId | null;
  confidence: number;
  onSelect: (id: HypothesisId) => void;
  onConfidenceChange: (value: number) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mission-layout prediction-stage">
      <div className="mission-story">
        <Button variant="ghost" className="back-button" onClick={onBack}>
          <ArrowLeft /> 返回时间地图
        </Button>
        <p className="eyebrow">发现现场 · 1831/08/29</p>
        <h1>
          没有一个选项
          <br />
          写着正确答案
        </h1>
        <div className="story-transcript">
          <p>
            软铁环两侧缠着相互绝缘的铜线。一侧连接电池，另一侧连接三英尺之外的磁针。
          </p>
          <p>
            六年前，相似的尝试没有产生任何可见效果。今天，法拉第准备重新动手。
          </p>
        </div>
        <div className="historical-note">
          <BookOpen />
          <span>
            <strong>史实复原规则</strong>
            “磁通量”“电磁感应”等现代词汇暂时封存。你只能使用当时能看见的现象。
          </span>
        </div>
      </div>
      <div className="hypothesis-panel">
        <div className="panel-kicker">
          <ShieldQuestion /> 行动 01 · 留下可被推翻的判断
        </div>
        <h2>如果指针真的动了，你认为最可能发生了什么？</h2>
        <p>这里没有标准答案。你的选择只决定之后需要接受哪种证据的挑战。</p>
        <div
          className="hypothesis-list"
          role="radiogroup"
          aria-label="选择初始解释"
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
        <div className="confidence-control">
          <div>
            <span>你对这个解释有多大把握？</span>
            <strong>{confidence}%</strong>
          </div>
          <Slider
            aria-label="初始解释信心"
            value={confidence}
            min={20}
            max={90}
            step={10}
            onValueChange={(value) => onConfidenceChange(Number(value))}
          />
          <small>高信心没有额外奖励；愿意被证据改变才有。</small>
        </div>
        <Button
          className="primary-cta w-full"
          size="lg"
          disabled={!selected}
          onClick={onConfirm}
        >
          写入实验日志，进入实验台 <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

function SignalTrace({ record }: { record: ExperimentRecord | null }) {
  const strength = record?.strength ?? 0;
  const sign =
    record?.direction === 'left' ? -1 : record?.direction === 'right' ? 1 : 0;
  const peak = 50 - sign * Math.min(36, strength * 0.36);
  const points =
    sign === 0
      ? '0,50 100,50 200,50 300,50 400,50'
      : `0,50 80,50 112,${peak} 142,${50 + sign * 12} 176,${50 - sign * 6} 218,50 400,50`;

  return (
    <div
      className="signal-trace"
      aria-label={record ? `本次信号强度 ${strength}` : '等待实验信号'}
    >
      <div className="signal-trace__header">
        <span>
          <Radio /> 瞬时信号记录
        </span>
        <strong>
          {record
            ? `${record.direction === 'none' ? '' : record.direction === 'right' ? '+' : '−'}${strength}`
            : '待机'}
        </strong>
      </div>
      <svg viewBox="0 0 400 100" aria-hidden="true">
        <line x1="0" y1="50" x2="400" y2="50" className="signal-trace__axis" />
        <polyline
          points={points}
          className={`signal-trace__line signal-trace__line--${record?.direction ?? 'none'}`}
        />
      </svg>
      <div className="signal-trace__scale">
        <span>动作前</span>
        <span>动作瞬间</span>
        <span>恢复</span>
      </div>
    </div>
  );
}

function LabApparatus({
  setup,
  record,
  pulsing,
}: {
  setup: ExperimentSetup;
  record: ExperimentRecord | null;
  pulsing: boolean;
}) {
  const angle =
    !pulsing || !record
      ? 0
      : record.direction === 'right'
        ? Math.min(58, record.strength * 0.65)
        : record.direction === 'left'
          ? -Math.min(58, record.strength * 0.65)
          : 0;

  return (
    <div
      className={`lab-apparatus lab-apparatus--${setup.mode} ${pulsing ? 'is-pulsing' : ''}`}
    >
      <div className="lab-apparatus__scene">
        {setup.mode === 'ring' ? (
          <>
            <div className="lab-battery">
              <Battery />
              <span>{setup.batteryPairs} 对极板</span>
            </div>
            <div className="lab-link lab-link--left" />
            <div className={`lab-ring lab-ring--${setup.core}`}>
              <span className="lab-coil lab-coil--a">A</span>
              <span className="lab-ring__core">{coreLabels[setup.core]}</span>
              <span className="lab-coil lab-coil--b">B</span>
              {pulsing && record?.strength ? (
                <span className="lab-field-wave" />
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div
              className={`lab-magnet lab-magnet--${setup.polarity} ${pulsing ? `lab-magnet--${setup.action}` : ''}`}
            >
              <Magnet />
              <span>
                {setup.polarity === 'normal' ? 'N 极在前' : 'S 极在前'}
              </span>
            </div>
            <div className="lab-motion">
              <ArrowRight />
              <small>
                {setup.action === 'insert'
                  ? '推入'
                  : setup.action === 'withdraw'
                    ? '抽出'
                    : '静止'}
              </small>
            </div>
            <div className="lab-solenoid">
              <Waves />
              <span>{setup.turns}× 匝数</span>
            </div>
          </>
        )}
        <div className="lab-link lab-link--right" />
        <div className="lab-meter">
          <div className="lab-meter__scale">
            <span>−</span>
            <strong>0</strong>
            <span>＋</span>
          </div>
          <div
            className="lab-meter__needle"
            style={{ transform: `rotate(${angle}deg)` }}
          />
          <div className="lab-meter__pivot" />
          <small>检流计</small>
        </div>
      </div>
      <SignalTrace record={record} />
    </div>
  );
}

const insightDefinitions: Array<{
  id: keyof Insights;
  title: string;
  description: string;
  optional?: boolean;
}> = [
  {
    id: 'transient',
    title: '追踪三个时刻',
    description: '比较接通、持续和断开。',
  },
  {
    id: 'polarity',
    title: '排除机械震动',
    description: '只反转电池或磁极，再做同一动作。',
  },
  {
    id: 'magnetMotion',
    title: '切断“漏电”退路',
    description: '不用原线圈电池，改用磁铁运动。',
  },
  {
    id: 'rate',
    title: '量化变化快慢',
    description: '只改变磁铁运动速度，比较峰值。',
  },
  {
    id: 'core',
    title: '检查材料作用',
    description: '只更换铁环、铜环或空气。',
    optional: true,
  },
];

function ExperimentStage({
  setup,
  records,
  latestRecord,
  pulsing,
  announcement,
  onSetupChange,
  onRun,
  onCourt,
  onBack,
}: {
  setup: ExperimentSetup;
  records: ExperimentRecord[];
  latestRecord: ExperimentRecord | null;
  pulsing: boolean;
  announcement: string;
  onSetupChange: (patch: Partial<ExperimentSetup>) => void;
  onRun: () => void;
  onCourt: () => void;
  onBack: () => void;
}) {
  const insights = getInsights(records);
  const requiredComplete =
    insights.transient &&
    insights.polarity &&
    insights.magnetMotion &&
    insights.rate;
  const completedCount = insightDefinitions.filter(
    (item) => insights[item.id],
  ).length;
  const ringActions: RingAction[] = ['connect', 'hold', 'disconnect'];
  const magnetActions: MagnetAction[] = ['insert', 'hold', 'withdraw'];
  const nextHint = !insights.transient
    ? '先用感应环分别记录接通、保持和断开。'
    : !insights.polarity
      ? '保持其他条件不变，只反转电池方向，再重复一个动作。'
      : !insights.magnetMotion
        ? '切换到磁铁与线圈，比较推入、静止和抽出。'
        : !insights.rate
          ? '用相同磁极做两次相同运动，只改变速度。'
          : '核心证据完整。你可以继续寻找材料效应，或进入科学质询。';

  const switchMode = (mode: ApparatusMode) => {
    onSetupChange({ mode, action: mode === 'ring' ? 'connect' : 'insert' });
  };

  return (
    <section className="lab-v2" aria-labelledby="lab-title">
      <div className="experiment-topbar">
        <Button variant="ghost" className="back-button" onClick={onBack}>
          <ArrowLeft /> 退出坐标
        </Button>
        <div className="chapter-progress">
          <span>猜想</span>
          <i />
          <strong>实验台</strong>
          <i />
          <span>科学质询</span>
          <i />
          <span>档案馆</span>
        </div>
        <Badge className="bg-amber-300 text-slate-950">
          行动 02 · 自由实验
        </Badge>
      </div>
      <div className="lab-v2__heading">
        <div>
          <p className="eyebrow">
            <Settings2 /> 1831 地下实验室
          </p>
          <h1 id="lab-title">不要找答案，找能区分解释的实验</h1>
        </div>
        <div className="lab-v2__progress">
          <span>发现任务</span>
          <strong>{completedCount}/5</strong>
          <Progress value={completedCount * 20} aria-label="发现任务进度" />
        </div>
      </div>

      <div className="lab-v2__grid">
        <aside className="inquiry-board">
          <div className="panel-kicker">
            <Search /> 调查板
          </div>
          <p className="inquiry-board__hint">{nextHint}</p>
          <div className="insight-list">
            {insightDefinitions.map((item) => (
              <div
                className={`insight-item ${insights[item.id] ? 'is-found' : ''}`}
                key={item.id}
              >
                <span>
                  {insights[item.id] ? <Check /> : item.optional ? '＋' : '?'}
                </span>
                <div>
                  <strong>
                    {item.title}
                    {item.optional ? ' · 可选' : ''}
                  </strong>
                  <small>
                    {insights[item.id]
                      ? '已经形成可比较的证据组。'
                      : item.description}
                  </small>
                </div>
              </div>
            ))}
          </div>
          <div className="science-rule">
            <Lightbulb />
            <p>
              <strong>本关规则</strong>
              改变多个变量也能看到现象，但只有一次改变一个变量，证据才有解释力。
            </p>
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={!requiredComplete}
            onClick={onCourt}
          >
            {requiredComplete ? '接受三项科学质询' : '核心证据尚不完整'}{' '}
            <Swords />
          </Button>
        </aside>

        <div className="lab-workbench">
          <div
            className="apparatus-tabs"
            role="tablist"
            aria-label="选择实验装置"
          >
            <button
              type="button"
              role="tab"
              aria-selected={setup.mode === 'ring'}
              className={setup.mode === 'ring' ? 'is-active' : ''}
              onClick={() => switchMode('ring')}
            >
              <Layers3 /> 感应环 · 史实复原
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={setup.mode === 'magnet'}
              className={setup.mode === 'magnet' ? 'is-active' : ''}
              onClick={() => switchMode('magnet')}
            >
              <Magnet /> 磁铁与线圈 · 后续实验
            </button>
          </div>
          <LabApparatus setup={setup} record={latestRecord} pulsing={pulsing} />
          <div className="live-announcement" aria-live="polite">
            <Gauge />
            <span>{announcement}</span>
          </div>
          <p className="model-boundary-note">
            <ShieldQuestion />{' '}
            教学模型使用相对刻度，并暂时省略随机误差；真实实验需要重复测量并报告不确定度。
          </p>

          <div className="lab-controls">
            <div className="control-group control-group--wide">
              <span className="control-label">这次要做什么</span>
              <div className="segmented-control">
                {(setup.mode === 'ring' ? ringActions : magnetActions).map(
                  (action) => (
                    <button
                      type="button"
                      key={action}
                      className={setup.action === action ? 'is-active' : ''}
                      onClick={() => onSetupChange({ action })}
                    >
                      {actionLabels[action]}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="control-group">
              <span className="control-label">
                {setup.mode === 'ring' ? '电池方向' : '进入线圈的磁极'}
              </span>
              <div className="polarity-control">
                <button
                  type="button"
                  className={setup.polarity === 'normal' ? 'is-active' : ''}
                  onClick={() => onSetupChange({ polarity: 'normal' })}
                >
                  {setup.mode === 'ring' ? '＋ → −' : 'N 极'}
                </button>
                <button
                  type="button"
                  className={setup.polarity === 'reversed' ? 'is-active' : ''}
                  onClick={() => onSetupChange({ polarity: 'reversed' })}
                >
                  {setup.mode === 'ring' ? '− → ＋' : 'S 极'}
                </button>
              </div>
            </div>
            <div className="control-group">
              <span className="control-label">线圈匝数组</span>
              <div className="stepper-control">
                <button
                  type="button"
                  aria-label="减少线圈匝数"
                  onClick={() =>
                    onSetupChange({ turns: Math.max(1, setup.turns - 1) })
                  }
                >
                  <Minus />
                </button>
                <strong>{setup.turns}×</strong>
                <button
                  type="button"
                  aria-label="增加线圈匝数"
                  onClick={() =>
                    onSetupChange({ turns: Math.min(3, setup.turns + 1) })
                  }
                >
                  <Plus />
                </button>
              </div>
            </div>
            {setup.mode === 'ring' ? (
              <>
                <div className="control-group control-group--wide">
                  <span className="control-label">环芯材料</span>
                  <div className="segmented-control">
                    {(['iron', 'copper', 'air'] as CoreMaterial[]).map(
                      (core) => (
                        <button
                          type="button"
                          key={core}
                          className={setup.core === core ? 'is-active' : ''}
                          onClick={() => onSetupChange({ core })}
                        >
                          {coreLabels[core]}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                <div className="control-group control-group--wide">
                  <span className="control-label">电池规模</span>
                  <div className="segmented-control">
                    {[1, 10, 100].map((pairs) => (
                      <button
                        type="button"
                        key={pairs}
                        className={
                          setup.batteryPairs === pairs ? 'is-active' : ''
                        }
                        onClick={() => onSetupChange({ batteryPairs: pairs })}
                      >
                        {pairs} 对极板
                      </button>
                    ))}
                  </div>
                  <small>
                    100 对极板是隐藏的极端条件，可能让指针冲出刻度。
                  </small>
                </div>
              </>
            ) : (
              <div className="control-group control-group--wide motion-speed-control">
                <div>
                  <span className="control-label">磁铁运动速度</span>
                  <strong>{setup.motionSpeed}×</strong>
                </div>
                <Slider
                  aria-label="磁铁运动速度"
                  value={setup.motionSpeed}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={(value) =>
                    onSetupChange({ motionSpeed: Number(value) })
                  }
                />
                <small>真实可控变量是磁铁的运动速度，而不是“开关速度”。</small>
              </div>
            )}
          </div>
          <Button
            className="primary-cta lab-run-button"
            size="lg"
            disabled={pulsing}
            onClick={onRun}
          >
            <Play /> {pulsing ? '仪器正在记录…' : '执行这次实验并写入日志'}
          </Button>
        </div>

        <aside className="lab-notebook">
          <div className="panel-kicker">
            <Notebook /> 实验日志 · {records.length} 次
          </div>
          <div className="notebook-head">
            <span>条件</span>
            <span>结果</span>
          </div>
          <div className="notebook-records">
            {records.length === 0 ? (
              <div className="notebook-empty">
                <Radio />
                <strong>仪器已经归零</strong>
                <p>先执行一次实验。系统只记录现象，不替你解释。</p>
              </div>
            ) : (
              [...records]
                .reverse()
                .slice(0, 8)
                .map((record) => (
                  <article className="notebook-record" key={record.id}>
                    <div>
                      <span>#{String(record.id).padStart(2, '0')}</span>
                      <strong>
                        {record.mode === 'ring' ? '感应环' : '磁铁线圈'} ·{' '}
                        {actionLabels[record.action]}
                      </strong>
                      <small>
                        {record.mode === 'ring'
                          ? `${coreLabels[record.core]} / ${record.polarity === 'normal' ? '正向' : '反向'}电池 / ${record.batteryPairs} 对极板`
                          : `${record.polarity === 'normal' ? 'N' : 'S'} 极 / ${record.motionSpeed}× 速度`}{' '}
                        / {record.turns}× 匝数
                      </small>
                    </div>
                    <div
                      className={`record-result record-result--${record.direction}`}
                    >
                      <strong>
                        {record.direction === 'none'
                          ? '归零'
                          : record.direction === 'right'
                            ? `＋${record.strength}`
                            : `−${record.strength}`}
                      </strong>
                      <small>{record.observation}</small>
                    </div>
                  </article>
                ))
            )}
          </div>
          <p className="notebook-footnote">
            重复完全相同的条件会增加“可重复性”记录，不会被视为浪费。
          </p>
        </aside>
      </div>
    </section>
  );
}

const claims = [
  {
    id: 'jolt',
    title: '“只是开关震动了桌面，磁针才会摆。”',
    prompt: '从日志中选出两条只改变电池方向或磁极、其余条件相同的记录。',
    success:
      '机械震动不会因为电池方向改变而反向；信号却反向了。这个解释失去生存空间。',
    failure: '这组记录还同时改变了其他条件，无法把方向反转归因于电池或磁极。',
  },
  {
    id: 'leak',
    title: '“电一定是沿着铁环偷偷漏到了另一侧。”',
    prompt: '选出一条没有原线圈电池、仍然出现电流的磁铁实验。',
    success: '磁铁与线圈没有导线接触，运动时仍出现电流。“漏电”解释被切断。',
    failure:
      '这条记录还不能排除电流沿铁环传递。寻找磁铁运动且信号不为零的实验。',
  },
  {
    id: 'static',
    title: '“只要磁性存在，就应该一直产生电流。”',
    prompt: '选出同一装置中的一条变化记录和一条保持不动的零记录。',
    success: '磁性仍存在，但不变化时信号为零；只有状态改变的过程产生短暂电流。',
    failure: '需要在尽量相同的装置中比较“变化”和“保持”，否则零结果没有区分力。',
  },
] as const;

function recordsDefeatClaim(
  claimId: (typeof claims)[number]['id'],
  selected: ExperimentRecord[],
) {
  if (claimId === 'jolt') {
    if (selected.length !== 2) return false;
    const [first, second] = selected;
    return (
      sameContextExcept(first, second, 'polarity') &&
      first.polarity !== second.polarity &&
      first.direction !== second.direction
    );
  }
  if (claimId === 'leak')
    return selected.some(
      (record) => record.mode === 'magnet' && record.strength > 0,
    );
  if (selected.length !== 2) return false;
  const changing = selected.find((record) => record.strength > 0);
  const still = selected.find((record) => record.strength === 0);
  return Boolean(
    changing && still && sameContextExcept(changing, still, 'action'),
  );
}

function CourtStage({
  records,
  selectedHypothesis,
  confidence,
  onComplete,
  onBack,
}: {
  records: ExperimentRecord[];
  selectedHypothesis: HypothesisId | null;
  confidence: number;
  onComplete: () => void;
  onBack: () => void;
}) {
  const [claimIndex, setClaimIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [feedback, setFeedback] = useState(
    '从实验日志中选择一到两条记录，组成能排除当前解释的证据。',
  );
  const [roundSolved, setRoundSolved] = useState(false);
  const claim = claims[claimIndex];
  const hypothesis = hypotheses.find((item) => item.id === selectedHypothesis);
  const selectedRecords = records.filter((record) =>
    selectedIds.includes(record.id),
  );
  const bossHp = Math.max(
    0,
    100 - claimIndex * 33 - (roundSolved ? (claimIndex === 2 ? 34 : 33) : 0),
  );

  const toggleRecord = (id: number) => {
    if (roundSolved) return;
    setFeedback('证据已放上论证台。现在检查它是否真正区分了两个解释。');
    setSelectedIds((current) => {
      if (current.includes(id))
        return current.filter((recordId) => recordId !== id);
      if (current.length >= 2) return [current[1], id];
      return [...current, id];
    });
  };

  const submitEvidence = () => {
    if (!selectedRecords.length || roundSolved) return;
    const solved = recordsDefeatClaim(claim.id, selectedRecords);
    setFeedback(solved ? claim.success : claim.failure);
    if (solved) setRoundSolved(true);
  };

  const advance = () => {
    if (!roundSolved) return;
    if (claimIndex === claims.length - 1) {
      onComplete();
      return;
    }
    setClaimIndex((current) => current + 1);
    setSelectedIds([]);
    setRoundSolved(false);
    setFeedback('新的替代解释出现了。重新选择最有区分力的实验记录。');
  };

  return (
    <section className="tribunal-v2" aria-labelledby="tribunal-title">
      <div className="experiment-topbar">
        <Button variant="ghost" className="back-button" onClick={onBack}>
          <ArrowLeft /> 返回实验台
        </Button>
        <div className="chapter-progress">
          <span>猜想</span>
          <i />
          <span>实验台</span>
          <i />
          <strong>科学质询</strong>
          <i />
          <span>档案馆</span>
        </div>
        <Badge className="bg-amber-300 text-slate-950">行动 03 · 论证</Badge>
      </div>
      <div className="tribunal-v2__heading">
        <p className="eyebrow">
          <Swords /> 解释不是敌人，无法接受检验才是
        </p>
        <h1 id="tribunal-title">
          别向迷雾提交答案，
          <br />
          提交一个它无法逃避的实验。
        </h1>
      </div>
      <div className="tribunal-grid">
        <aside className="theory-dossier">
          <CloudFog />
          <span>你最初的解释</span>
          <h2>{hypothesis?.faction ?? '未命名猜想'}</h2>
          <p>{hypothesis?.title}</p>
          <div>
            <small>初始信心</small>
            <strong>{confidence}%</strong>
          </div>
          <p className="theory-dossier__note">
            科学诚实不是从不犯错，而是允许更强的证据改变自己。
          </p>
        </aside>
        <div className="claim-arena">
          <div className="claim-arena__meta">
            <span>质询 {claimIndex + 1}/3</span>
            <span>迷雾解释力 {bossHp}/100</span>
          </div>
          <Progress value={bossHp} aria-label="迷雾解释力" />
          <div className={`claim-card ${roundSolved ? 'is-defeated' : ''}`}>
            <span>{roundSolved ? <CheckCircle2 /> : <CloudFog />}</span>
            <div>
              <small>{roundSolved ? '解释已被排除' : '迷雾提出替代解释'}</small>
              <h2>{claim.title}</h2>
              <p>{claim.prompt}</p>
            </div>
          </div>
          <div
            className={`reasoning-feedback ${roundSolved ? 'is-success' : ''}`}
            aria-live="polite"
          >
            <Brain />
            <p>{feedback}</p>
          </div>
          <div className="court-actions">
            {roundSolved ? (
              <Button className="primary-cta" size="lg" onClick={advance}>
                {claimIndex === claims.length - 1
                  ? '打开真实历史档案馆'
                  : '接受下一项质询'}{' '}
                <ArrowRight />
              </Button>
            ) : (
              <Button
                className="primary-cta"
                size="lg"
                disabled={!selectedIds.length}
                onClick={submitEvidence}
              >
                检验证据的区分力 <Scale />
              </Button>
            )}
          </div>
        </div>
        <aside className="evidence-ledger">
          <div className="panel-kicker">
            <Notebook /> 选择实验记录 · {selectedIds.length}/2
          </div>
          <div className="evidence-ledger__records">
            {[...records].reverse().map((record) => {
              const selected = selectedIds.includes(record.id);
              return (
                <button
                  type="button"
                  className={`court-record ${selected ? 'is-selected' : ''}`}
                  key={record.id}
                  onClick={() => toggleRecord(record.id)}
                  disabled={roundSolved}
                >
                  <span>#{String(record.id).padStart(2, '0')}</span>
                  <div>
                    <strong>
                      {record.mode === 'ring' ? '感应环' : '磁铁线圈'} ·{' '}
                      {actionLabels[record.action]}
                    </strong>
                    <small>
                      {record.mode === 'ring'
                        ? `${coreLabels[record.core]} / ${record.polarity === 'normal' ? '正向' : '反向'}电池 / ${record.batteryPairs} 对 / ${record.turns}× 匝`
                        : `${record.polarity === 'normal' ? 'N' : 'S'} 极 / ${record.motionSpeed}× 速度 / ${record.turns}× 匝`}
                    </small>
                  </div>
                  <em
                    className={`court-record__signal court-record__signal--${record.direction}`}
                  >
                    {record.direction === 'none'
                      ? '0'
                      : record.direction === 'right'
                        ? `+${record.strength}`
                        : `−${record.strength}`}
                  </em>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}

function SkillMeter({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="skill-meter">
      <div>
        <strong>{label}</strong>
        <span aria-label={`${value} 级`}>
          {[1, 2, 3].map((level) => (
            <i className={level <= value ? 'is-on' : ''} key={level} />
          ))}
        </span>
      </div>
      <p>{detail}</p>
    </article>
  );
}

function ArchiveScreen({
  records,
  selectedHypothesis,
  onMap,
  onReplay,
}: {
  records: ExperimentRecord[];
  selectedHypothesis: HypothesisId | null;
  onMap: () => void;
  onReplay: () => void;
}) {
  const [view, setView] = useState<ArchiveView>('history');
  const [selectedNode, setSelectedNode] = useState(2);
  const node = historicalPath[selectedNode];
  const insights = getInsights(records);
  const controlledComparisons = useMemo(
    () => countControlledComparisons(records),
    [records],
  );
  const repeatCount =
    records.length - new Set(records.map((record) => record.signature)).size;
  const zeroCount = records.filter((record) => record.strength === 0).length;
  const reversalCount = records.filter(
    (record) => record.direction === 'left',
  ).length;
  const initial = hypotheses.find((item) => item.id === selectedHypothesis);
  const observationVariety = new Set(
    records.map((record) => `${record.action}:${record.direction}`),
  ).size;
  const skillData = [
    {
      label: '精确观察',
      value: observationVariety >= 6 ? 3 : 2,
      detail: `你记录了 ${records.length} 次实验，其中 ${zeroCount} 次是容易被忽略的零结果。`,
    },
    {
      label: '控制变量',
      value: Math.min(3, Math.max(1, controlledComparisons)),
      detail: `日志中形成了 ${controlledComparisons} 组只改变一个条件的比较。`,
    },
    {
      label: '重复验证',
      value: Math.min(3, repeatCount),
      detail: repeatCount
        ? `你主动重复了 ${repeatCount} 次完全相同的条件。`
        : '本次没有复现实验；下次可以确认信号是否稳定出现。',
    },
    {
      label: '排除解释',
      value: 3,
      detail: '你没有凭立场取胜，而是为三种替代解释分别寻找了区分证据。',
    },
    {
      label: '模型边界',
      value: insights.core ? 3 : 2,
      detail: insights.core
        ? '你还检查了材料如何影响信号强弱。'
        : '你发现了变化规律；材料与几何条件仍值得继续追问。',
    },
  ];

  return (
    <section className="archive-v2" aria-labelledby="archive-title">
      <div className="archive-hero">
        <div className="archive-hero__seal">
          <Archive />
        </div>
        <p className="eyebrow">
          <Sparkles /> 时间迷雾已退去 · 档案权限开启
        </p>
        <h1 id="archive-title">
          你让一个解释活了下来。
          <br />
          现在看看历史究竟怎样发生。
        </h1>
        <p>
          这里不提供英雄神话。你的实验、法拉第的真实路径和整个科学共同体，将被放在同一张证据地图上。
        </p>
      </div>
      <nav className="archive-tabs" aria-label="选择档案视角">
        <button
          type="button"
          className={view === 'history' ? 'is-active' : ''}
          onClick={() => setView('history')}
        >
          <History /> 法拉第真实路径
        </button>
        <button
          type="button"
          className={view === 'mine' ? 'is-active' : ''}
          onClick={() => setView('mine')}
        >
          <Notebook /> 我的发现轨迹
        </button>
        <button
          type="button"
          className={view === 'community' ? 'is-active' : ''}
          onClick={() => setView('community')}
        >
          <Network /> 科学共同体
        </button>
      </nav>

      {view === 'history' && (
        <div className="history-path">
          <div className="history-path__rail">
            {historicalPath.map((item, index) => (
              <button
                type="button"
                className={`history-node history-node--${item.tone} ${selectedNode === index ? 'is-active' : ''}`}
                key={`${item.date}-${item.title}`}
                onClick={() => setSelectedNode(index)}
              >
                <span className="history-node__dot" />
                <small>
                  {item.date} · {item.kind}
                </small>
                <strong>{item.title}</strong>
              </button>
            ))}
          </div>
          <article className={`archive-dossier archive-dossier--${node.tone}`}>
            <div className="archive-dossier__top">
              <Badge variant="outline">史实复原</Badge>
              <span>{node.date}</span>
            </div>
            <h2>{node.title}</h2>
            <p className="archive-dossier__lede">{node.body}</p>
            <div className="archive-facsimile">
              <FileText />
              <div>
                <small>档案旁注</small>
                <p>{node.note}</p>
              </div>
            </div>
            <div className="source-logic">
              <div>
                <CheckCircle2 />
                <p>
                  <strong>这份史料能够支持</strong>
                  {node.supports}
                </p>
              </div>
              <div>
                <ShieldQuestion />
                <p>
                  <strong>它不能单独证明</strong>
                  {node.limit}
                </p>
              </div>
            </div>
            <div className="source-links">
              {[
                node.source,
                ...(node.secondarySource ? [node.secondarySource] : []),
              ].map((source) => (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={source.url}
                >
                  <Archive />
                  <span>
                    <small>{source.institution}</small>
                    <strong>{source.label}</strong>
                  </span>
                  <ExternalLink />
                </a>
              ))}
            </div>
            <p className="source-note">
              外部档案在原机构页面打开。本项目只做摘要与出处说明，不把剧情演绎冒充原始史料。
            </p>
          </article>
        </div>
      )}

      {view === 'mine' && (
        <div className="my-trail">
          <div className="my-trail__summary">
            <p className="eyebrow">
              <Notebook /> 你的实验不是答案单，而是一条可审计的路径
            </p>
            <h2>
              从「{initial?.faction ?? '未命名猜想'}」出发，你留下了{' '}
              {records.length} 次实验。
            </h2>
            <div className="trail-stat-grid">
              <div>
                <strong>{records.length}</strong>
                <span>实验总数</span>
              </div>
              <div>
                <strong>{zeroCount}</strong>
                <span>零结果</span>
              </div>
              <div>
                <strong>{controlledComparisons}</strong>
                <span>控制变量比较</span>
              </div>
              <div>
                <strong>{reversalCount}</strong>
                <span>反向信号</span>
              </div>
            </div>
          </div>
          <div className="skills-report">
            <div className="panel-kicker">
              <Brain /> 本次科学行为回放
            </div>
            {skillData.map((skill) => (
              <SkillMeter key={skill.label} {...skill} />
            ))}
            <p>这不是人格评分，只描述你在本次探索中使用过哪些方法。</p>
          </div>
          <div className="trail-log">
            {records.map((record) => (
              <div className="trail-log__item" key={record.id}>
                <span>#{String(record.id).padStart(2, '0')}</span>
                <div>
                  <strong>
                    {record.mode === 'ring' ? '感应环' : '磁铁线圈'} ·{' '}
                    {actionLabels[record.action]}
                  </strong>
                  <p>{record.observation}</p>
                </div>
                <em>
                  {record.direction === 'none'
                    ? '零结果'
                    : record.direction === 'right'
                      ? `右偏 ${record.strength}`
                      : `左偏 ${record.strength}`}
                </em>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'community' && (
        <div className="community-map">
          <div className="community-map__intro">
            <p className="eyebrow">
              <Network /> 没有孤立的天才时刻
            </p>
            <h2>
              法拉第改变了时代，但他站在问题、同行、仪器和后来者组成的网络里。
            </h2>
            <p>
              科学的开创性既需要个人判断，也需要别人能够复现、反驳、形式化和工程化。
            </p>
          </div>
          <div className="community-network">
            {communityNodes.map((item, index) => (
              <article
                className={index === 2 ? 'is-focus' : ''}
                key={`${item.year}-${item.name}`}
              >
                <span>{item.year}</span>
                <div>
                  <strong>{item.name}</strong>
                  <h3>{item.role}</h3>
                  <p>{item.contribution}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="archive-principle">
        <Trophy />
        <div>
          <small>本章真正解锁的能力</small>
          <strong>把“我相信什么”变成“什么实验能让我改变相信”。</strong>
        </div>
      </div>
      <div className="impact-chain">
        <span>异常</span>
        <ChevronRight />
        <span>对照</span>
        <ChevronRight />
        <span>排除</span>
        <ChevronRight />
        <span>规律</span>
        <ChevronRight />
        <strong>可迁移的方法</strong>
      </div>
      <div className="victory-actions">
        <Button className="primary-cta" size="lg" onClick={onMap}>
          返回地图，查看新坐标 <MapIcon />
        </Button>
        <Button variant="outline" size="lg" onClick={onReplay}>
          <RotateCcw /> 换一条实验路径
        </Button>
      </div>
      <aside className="next-hook">
        <FlaskConical />
        <div>
          <small>下一次迁移测试</small>
          <strong>一块金属被烧掉一部分，为什么反而更重了？</strong>
          <p>1774 年。你将只拿到天平、密闭容器和一个占据时代的错误理论。</p>
        </div>
      </aside>
    </section>
  );
}

const initialSetup: ExperimentSetup = {
  mode: 'ring',
  action: 'connect',
  core: 'iron',
  polarity: 'normal',
  turns: 2,
  batteryPairs: 10,
  motionSpeed: 3,
};

export default function Expedition() {
  const [screen, setScreen] = useState<Screen>('intro');
  const [portalReady, setPortalReady] = useState(false);
  const [missionStage, setMissionStage] = useState<MissionStage>('prediction');
  const [selectedHypothesis, setSelectedHypothesis] =
    useState<HypothesisId | null>(null);
  const [confidence, setConfidence] = useState(50);
  const [setup, setSetup] = useState<ExperimentSetup>(initialSetup);
  const [records, setRecords] = useState<ExperimentRecord[]>([]);
  const [latestRecord, setLatestRecord] = useState<ExperimentRecord | null>(
    null,
  );
  const [pulsing, setPulsing] = useState(false);
  const [announcement, setAnnouncement] = useState(
    '仪器归零。请选择条件并执行第一次实验。',
  );
  const [xp, setXp] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const recordId = useRef(0);
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
          if (typeof parsed.xp === 'number' && Number.isFinite(parsed.xp))
            setXp(Math.max(0, Math.min(9999, Math.round(parsed.xp))));
          if (typeof parsed.completed === 'boolean')
            setCompleted(parsed.completed);
        }
      } catch {
        // Local progress is optional; malformed browser storage must not break the experience.
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
      // The expedition remains usable when browser storage is blocked.
    }
  }, [completed, hydrated, xp]);

  const resetMission = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    recordId.current = 0;
    setMissionStage('prediction');
    setSelectedHypothesis(null);
    setConfidence(50);
    setSetup(initialSetup);
    setRecords([]);
    setLatestRecord(null);
    setPulsing(false);
    setAnnouncement('仪器归零。请选择条件并执行第一次实验。');
  };

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = context.registerTool(
      {
        name: 'start_faraday_expedition',
        title: '开始法拉第科学历险',
        description:
          '打开“只动一下的指针”任务，从初始猜想进入可设计的电磁实验。',
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
          )
            throw new Error('This action does not accept arguments.');
          resetMission();
          setPortalReady(true);
          setScreen('mission');
          await new Promise<void>((resolve) =>
            window.requestAnimationFrame(() => resolve()),
          );
          return {
            status: 'ready',
            mission: 'faraday-inquiry-1831',
            mode: 'open-laboratory',
          };
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
  const resetAll = () => {
    resetMission();
    setXp(0);
    setCompleted(false);
    setPortalReady(false);
    setScreen('intro');
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage is optional.
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
  const updateSetup = (patch: Partial<ExperimentSetup>) =>
    setSetup((current) => ({ ...current, ...patch }));
  const runExperiment = () => {
    if (pulsing) return;
    const result = simulateExperiment(setup);
    const nextRecord: ExperimentRecord = {
      id: recordId.current + 1,
      ...result,
    };
    recordId.current = nextRecord.id;
    const repeated = records.some(
      (record) => record.signature === nextRecord.signature,
    );
    setRecords((current) => [...current, nextRecord].slice(-24));
    setLatestRecord(nextRecord);
    setPulsing(true);
    setAnnouncement(
      `${nextRecord.observation}${repeated ? ' 相同条件再次给出了相同类型的结果。' : ''}`,
    );
    awardXp(repeated ? 9 : 6);
    const timer = window.setTimeout(() => setPulsing(false), 1050);
    timers.current.push(timer);
  };
  const finishCourt = () => {
    setCompleted(true);
    awardXp(60);
    setScreen('archive');
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
          confidence={confidence}
          onSelect={setSelectedHypothesis}
          onConfidenceChange={setConfidence}
          onConfirm={confirmHypothesis}
          onBack={openMap}
        />
      )}
      {screen === 'mission' && missionStage === 'experiment' && (
        <ExperimentStage
          setup={setup}
          records={records}
          latestRecord={latestRecord}
          pulsing={pulsing}
          announcement={announcement}
          onSetupChange={updateSetup}
          onRun={runExperiment}
          onCourt={() => setMissionStage('court')}
          onBack={openMap}
        />
      )}
      {screen === 'mission' && missionStage === 'court' && (
        <CourtStage
          records={records}
          selectedHypothesis={selectedHypothesis}
          confidence={confidence}
          onComplete={finishCourt}
          onBack={() => setMissionStage('experiment')}
        />
      )}
      {screen === 'archive' && (
        <ArchiveScreen
          records={records}
          selectedHypothesis={selectedHypothesis}
          onMap={openMap}
          onReplay={enterMission}
        />
      )}
    </main>
  );
}
