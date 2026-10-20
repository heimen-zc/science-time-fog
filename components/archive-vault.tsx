'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ExternalLink,
  KeyRound,
  Map,
  RotateCcw,
  ShieldCheck,
  Stamp,
  X,
} from 'lucide-react';
import './archive-vault.css';

type VaultSource = {
  label: string;
  institution: string;
  url: string;
};

export interface VaultArtifact {
  id: string;
  date: string;
  kind: string;
  title: string;
  body: string;
  supports: string;
  limit: string;
  note: string;
  source: VaultSource;
  secondarySource?: VaultSource;
  tone: string;
}

interface ArchiveVaultProps {
  artifacts: VaultArtifact[];
  onBack: () => void;
  onMap: () => void;
  onReplay: () => void;
}

type Review = { open: number; seen: number; stamped: boolean };
const UNREAD: Review = { open: 0, seen: 0, stamped: false };
const SUPPORT = 1;
const LIMIT = 2;
const BOTH = SUPPORT | LIMIT;

const folioNumber = (index: number) => String(index + 1).padStart(2, '0');

function SourceLink({ source }: { source: VaultSource }) {
  let href: string | undefined;
  try {
    const parsed = new URL(source.url);
    // COSEC: restrict source navigation to web protocols, including for future supplied artifacts.
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      href = parsed.href;
    }
  } catch {
    href = undefined;
  }

  return (
    <div className="av-source">
      <small>{source.institution}</small>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          <span>{source.label}</span>
          <ExternalLink aria-hidden="true" />
          <span className="av-sr-only">（在新窗口打开原始来源）</span>
        </a>
      ) : (
        <span className="av-source-unavailable">
          {source.label} · 来源地址暂不可用
        </span>
      )}
    </div>
  );
}

function InkSeal({
  number,
  small = false,
}: {
  number: string;
  small?: boolean;
}) {
  return (
    <span className={`av-ink-seal${small ? ' av-ink-seal--small' : ''}`}>
      <span className="av-ink-seal__top">EVIDENCE · REVIEWED</span>
      <ShieldCheck aria-hidden="true" />
      <strong>{number}</strong>
      <span className="av-ink-seal__bottom">已检查边界</span>
    </span>
  );
}

export function ArchiveVault({
  artifacts,
  onBack,
  onMap,
  onReplay,
}: ArchiveVaultProps) {
  const uid = useId();
  const [latches, setLatches] = useState([false, false]);
  const [opened, setOpened] = useState(false);
  const [pagination, setPagination] = useState({
    page: 0,
    direction: 'next',
    turn: 0,
  });
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [announcement, setAnnouncement] = useState('');
  const roomRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const passportRef = useRef<HTMLDialogElement>(null);
  const pageIndex = Math.min(
    pagination.page,
    Math.max(0, artifacts.length - 1),
  );
  const artifact = artifacts[pageIndex];
  const review = artifact ? (reviews[artifact.id] ?? UNREAD) : UNREAD;
  const unlocked = latches.every(Boolean);
  const stampCount = artifacts.filter(
    (item) => reviews[item.id]?.stamped,
  ).length;
  const complete = artifacts.length > 0 && stampCount === artifacts.length;
  const backgroundPath = `${(process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '')}/evidence-room.webp`;

  function turnTo(nextPage: number) {
    const next = Math.max(0, Math.min(artifacts.length - 1, nextPage));
    if (next === pageIndex || !artifacts.length) return;
    setPagination((previous) => ({
      page: next,
      direction: next > pageIndex ? 'next' : 'previous',
      turn: previous.turn + 1,
    }));
    setAnnouncement(
      `第 ${next + 1} 份，共 ${artifacts.length} 份。${artifacts[next].date}，${artifacts[next].title}`,
    );
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function closeBook() {
    setOpened(false);
    setAnnouncement('研究手记已合上，检验印章保留。');
    requestAnimationFrame(() => openRef.current?.focus());
  }

  function openBook() {
    if (!unlocked || !artifacts.length) return;
    setOpened(true);
    setAnnouncement('研究手记已展开。左右方向键翻页，Escape 合书。');
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function liftFlap(bit: number) {
    if (!artifact) return;
    setReviews((previous) => {
      const current = previous[artifact.id] ?? UNREAD;
      return {
        ...previous,
        [artifact.id]: {
          ...current,
          open: current.open ^ bit,
          seen: current.seen | bit,
        },
      };
    });
  }

  function stampPage() {
    if (!artifact || review.seen !== BOTH || review.stamped) return;
    setReviews((previous) => ({
      ...previous,
      [artifact.id]: { ...review, stamped: true },
    }));
    setAnnouncement(
      `第 ${pageIndex + 1} 份史料已盖检验印章。已收集 ${stampCount + 1} 枚，共 ${artifacts.length} 枚。${stampCount === 0 ? '方法徽章已解锁，可打开科学护照查看。' : ''}`,
    );
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (!opened || passportRef.current?.open || event.defaultPrevented)
        return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return;
      const active = document.activeElement;
      if (
        active &&
        active !== document.body &&
        !roomRef.current?.contains(active)
      )
        return;
      if (
        active instanceof HTMLElement &&
        (active.isContentEditable ||
          active.matches('input, textarea, select, [role="slider"]'))
      )
        return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpened(false);
        setAnnouncement('研究手记已合上，检验印章保留。');
        requestAnimationFrame(() => openRef.current?.focus());
        return;
      }
      const delta =
        event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!delta) return;
      event.preventDefault();
      setPagination((previous) => {
        const current = Math.min(
          previous.page,
          Math.max(0, artifacts.length - 1),
        );
        const next = Math.max(
          0,
          Math.min(artifacts.length - 1, current + delta),
        );
        return next === current
          ? previous
          : {
              page: next,
              direction: delta > 0 ? 'next' : 'previous',
              turn: previous.turn + 1,
            };
      });
      requestAnimationFrame(() => headingRef.current?.focus());
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [opened, artifacts.length]);

  return (
    <section
      className="archive-vault"
      ref={roomRef}
      aria-labelledby={`${uid}-title`}
    >
      <div
        className="av-scenery"
        aria-hidden="true"
        style={{ backgroundImage: `url("${backgroundPath}")` }}
      />
      <header className="av-header">
        <button type="button" className="av-text-button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" /> 返回证据室
        </button>
        <span className="av-room-label">
          <span /> THE ARCHIVE VAULT
        </span>
        <button
          type="button"
          className="av-passport-button"
          onClick={() => passportRef.current?.showModal()}
        >
          <Stamp aria-hidden="true" />
          <span>
            科学护照{' '}
            <small>
              {stampCount} / {artifacts.length}
            </small>
          </span>
        </button>
      </header>

      <div className={`av-intro${opened ? ' av-intro--reading' : ''}`}>
        <p className="av-eyebrow">时间迷雾 · 历史档案室</p>
        <h1 id={`${uid}-title`}>每个发现，都有尚未写完的那一页。</h1>
        <p>
          {opened
            ? '顺着真实记录翻阅。也留意：每一份证据，究竟能走多远。'
            : '封印已经解除。打开书匣，回到结论尚未成为结论的时刻。'}
        </p>
      </div>

      {!opened ? (
        <div className="av-case-stage">
          <div className={`av-case${unlocked ? ' av-case--unlocked' : ''}`}>
            <i
              className="av-case-corner av-case-corner--tl"
              aria-hidden="true"
            />
            <i
              className="av-case-corner av-case-corner--tr"
              aria-hidden="true"
            />
            <i
              className="av-case-corner av-case-corner--bl"
              aria-hidden="true"
            />
            <i
              className="av-case-corner av-case-corner--br"
              aria-hidden="true"
            />
            <div className="av-case-spine" aria-hidden="true">
              <span /> <span /> <span />
            </div>
            <div className="av-case-face">
              <div className="av-case-rule" aria-hidden="true">
                <span /> ✦ <span />
              </div>
              <p className="av-case-edition">THE EVIDENCE COLLECTION</p>
              <div className="av-case-emblem" aria-hidden="true">
                <BookOpen />
                <span>F</span>
              </div>
              <h2>研究手记</h2>
              <p className="av-case-subtitle">发现的来路 · 证据的边界</p>
              <span className="av-case-label">
                {artifacts.length
                  ? `${String(artifacts.length).padStart(2, '0')} 份真实来源索引`
                  : '暂无可用档案'}
                <span>史料释义本</span>
              </span>
              <div
                className="av-case-rule av-case-rule--bottom"
                aria-hidden="true"
              >
                <span /> ◇ <span />
              </div>
            </div>
            <div className="av-latches" aria-label="书匣锁扣">
              {latches.map((released, index) => (
                <button
                  type="button"
                  className={`av-latch${released ? ' av-latch--released' : ''}`}
                  key={index}
                  aria-label={`${index === 0 ? '左' : '右'}侧锁扣${released ? '已松开' : '，点击松开'}`}
                  aria-pressed={released}
                  disabled={released}
                  onClick={() => {
                    setLatches((previous) =>
                      previous.map(
                        (value, position) => position === index || value,
                      ),
                    );
                    setAnnouncement(
                      `${index === 0 ? '左' : '右'}侧锁扣已松开。`,
                    );
                  }}
                >
                  <span className="av-latch__plate">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="av-latch__tongue">
                    {released ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <KeyRound aria-hidden="true" />
                    )}
                  </span>
                  <span className="av-latch__label">
                    {released ? '已松开' : '松开锁扣'}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="av-case-invitation">
            <p>
              {unlocked ? '铜扣轻响，书匣已可开启。' : '先松开两侧黄铜锁扣。'}
            </p>
            <button
              ref={openRef}
              type="button"
              className="av-brass-button"
              disabled={!unlocked || !artifacts.length}
              onClick={openBook}
            >
              <BookOpen aria-hidden="true" />
              {pagination.turn || stampCount
                ? '继续翻阅研究手记'
                : '打开研究手记'}
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : artifact ? (
        <div className="av-reading-desk">
          <div className="av-book-toolbar">
            <span>
              <BookOpen aria-hidden="true" /> 研究手记{' '}
              <span className="av-toolbar-divider">/</span> 第{' '}
              {folioNumber(pageIndex)} 份
            </span>
            <button
              type="button"
              className="av-text-button"
              onClick={closeBook}
            >
              <X aria-hidden="true" /> 合书 <kbd>Esc</kbd>
            </button>
          </div>
          <div className="av-book">
            <nav className="av-ribbons" aria-label="按页码翻阅史料">
              {artifacts.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  className={`av-ribbon${index === pageIndex ? ' av-ribbon--current' : ''}${reviews[item.id]?.stamped ? ' av-ribbon--stamped' : ''}`}
                  aria-current={index === pageIndex ? 'page' : undefined}
                  aria-label={`第 ${index + 1} 份，${item.date}，${item.kind}${reviews[item.id]?.stamped ? '，已检验' : ''}`}
                  title={`${item.date} · ${item.kind}`}
                  onClick={() => turnTo(index)}
                >
                  <span>{folioNumber(index)}</span>
                  {reviews[item.id]?.stamped ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <i aria-hidden="true" />
                  )}
                </button>
              ))}
            </nav>
            <div className="av-page-edges" aria-hidden="true" />
            <div className="av-binding" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div
              className={`av-spread av-spread--${pagination.direction}`}
              key={`${artifact.id}-${pagination.turn}`}
            >
              <article
                className="av-page av-page--record"
                aria-labelledby={`${uid}-record-title`}
              >
                <div className="av-folio-header">
                  <span>历史记录 / {artifact.kind}</span>
                  <span>FOLIO {folioNumber(pageIndex)}</span>
                </div>
                <div className="av-date">
                  <span>{artifact.date}</span>
                  <i aria-hidden="true">✧</i>
                </div>
                <h2 id={`${uid}-record-title`} ref={headingRef} tabIndex={-1}>
                  {artifact.title}
                </h2>
                <p className="av-record-body">{artifact.body}</p>
                <aside className="av-margin-note">
                  <span className="av-note-pin" aria-hidden="true" />
                  <span className="av-small-label">手记旁注</span>
                  <p>{artifact.note}</p>
                </aside>
                <div className="av-source-index">
                  <div className="av-source-index__heading">
                    <span>查阅原始来源</span>
                    <span aria-hidden="true">↗</span>
                  </div>
                  <SourceLink source={artifact.source} />
                  {artifact.secondarySource && (
                    <SourceLink source={artifact.secondarySource} />
                  )}
                </div>
                <p className="av-paper-disclaimer">
                  史料释义 / 索引，并非原件扫描
                </p>
                <div className="av-page-number" aria-hidden="true">
                  — {folioNumber(pageIndex)} —
                </div>
              </article>

              <section
                className="av-page av-page--inspection"
                aria-labelledby={`${uid}-inspect-title`}
              >
                <div className="av-folio-header">
                  <span>读者检验页</span>
                  <span>READ WITH CARE</span>
                </div>
                <p className="av-inspection-kicker">
                  <span aria-hidden="true">✦</span> 结论之前，再问一步
                </p>
                <h3 id={`${uid}-inspect-title`}>
                  这份证据，
                  <br />
                  能说到哪里？
                </h3>
                <p className="av-inspection-hint">
                  掀开两张批注。读过支持范围与限制，再为这一页盖章。
                </p>
                <div
                  className={`av-flap av-flap--support${review.open & SUPPORT ? ' av-flap--open' : ''}`}
                >
                  <button
                    type="button"
                    aria-expanded={Boolean(review.open & SUPPORT)}
                    aria-controls={`${uid}-support`}
                    onClick={() => liftFlap(SUPPORT)}
                  >
                    <span className="av-flap__number">01</span>
                    <span>
                      <small>EVIDENCE</small>
                      <strong>能支持什么</strong>
                    </span>
                    <ChevronDown aria-hidden="true" />
                  </button>
                  <div
                    id={`${uid}-support`}
                    hidden={!(review.open & SUPPORT)}
                    className="av-flap__content"
                  >
                    <p>{artifact.supports}</p>
                    <span>
                      <Check aria-hidden="true" /> 支持范围已展开
                    </span>
                  </div>
                </div>
                <div
                  className={`av-flap av-flap--limit${review.open & LIMIT ? ' av-flap--open' : ''}`}
                >
                  <button
                    type="button"
                    aria-expanded={Boolean(review.open & LIMIT)}
                    aria-controls={`${uid}-limit`}
                    onClick={() => liftFlap(LIMIT)}
                  >
                    <span className="av-flap__number">02</span>
                    <span>
                      <small>BOUNDARY</small>
                      <strong>还不能证明什么</strong>
                    </span>
                    <ChevronDown aria-hidden="true" />
                  </button>
                  <div
                    id={`${uid}-limit`}
                    hidden={!(review.open & LIMIT)}
                    className="av-flap__content"
                  >
                    <p>{artifact.limit}</p>
                    <span>
                      <Check aria-hidden="true" /> 证据边界已展开
                    </span>
                  </div>
                </div>
                <div
                  className={`av-stamp-station${review.stamped ? ' av-stamp-station--done' : ''}`}
                >
                  {review.stamped ? (
                    <>
                      <InkSeal number={folioNumber(pageIndex)} />
                      <p>
                        为结论留一点余地。
                        <small>这份史料的支持范围与边界，已由你检查。</small>
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="av-stamp-ghost" aria-hidden="true">
                        <Stamp />
                      </span>
                      <button
                        type="button"
                        className="av-stamp-button"
                        disabled={review.seen !== BOTH}
                        onClick={stampPage}
                      >
                        <Stamp aria-hidden="true" /> 我已检查边界 · 盖章
                      </button>
                      <small>
                        {review.seen === BOTH
                          ? '记录这次检查，不把未知盖成定论。'
                          : `还有 ${review.seen === 0 ? '两张' : '一张'}批注等待你掀开`}
                      </small>
                    </>
                  )}
                </div>
              </section>
            </div>
          </div>
          <nav className="av-pagination" aria-label="研究手记翻页">
            <button
              type="button"
              onClick={() => turnTo(pageIndex - 1)}
              disabled={pageIndex === 0}
            >
              <ArrowLeft aria-hidden="true" />
              <span>前一份</span>
            </button>
            <div aria-live="polite" aria-atomic="true">
              <span>
                {artifact.date} <i>·</i> {artifact.kind}
              </span>
              <small>
                {folioNumber(pageIndex)} /{' '}
                {String(artifacts.length).padStart(2, '0')}
                <span className="av-key-hint">左右键翻页</span>
              </small>
            </div>
            <button
              type="button"
              onClick={() => turnTo(pageIndex + 1)}
              disabled={pageIndex === artifacts.length - 1}
            >
              <span>后一份</span>
              <ArrowRight aria-hidden="true" />
            </button>
          </nav>
          {stampCount > 0 && (
            <button
              type="button"
              className="av-earned-notice"
              onClick={() => passportRef.current?.showModal()}
            >
              <ShieldCheck aria-hidden="true" />
              <span>
                {complete
                  ? '全部印章已集齐 · 领取「证据守门人」方法徽章'
                  : '你已获得方法徽章 · 在科学护照中查看'}
              </span>
              <ArrowRight aria-hidden="true" />
            </button>
          )}
        </div>
      ) : null}

      <footer className="av-footer">
        <p>
          {opened
            ? '可以随时离开，按自己的节奏翻阅。'
            : '背景为艺术化场景；书页为史料释义。'}
        </p>
        <div>
          <button type="button" className="av-text-button" onClick={onReplay}>
            <RotateCcw aria-hidden="true" /> 重做实验
          </button>
          <button type="button" className="av-text-button" onClick={onMap}>
            <Map aria-hidden="true" /> 时空地图{' '}
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </footer>

      <dialog
        className="av-passport-dialog"
        ref={passportRef}
        aria-labelledby={`${uid}-passport-title`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            passportRef.current?.close();
          }
        }}
      >
        <div className="av-passport">
          <header className="av-passport__header">
            <span>THE SCIENTIFIC PASSPORT</span>
            <button
              type="button"
              aria-label="关闭科学护照"
              onClick={() => passportRef.current?.close()}
            >
              <X aria-hidden="true" />
            </button>
          </header>
          <div className="av-passport__body">
            <div className="av-passport__identity">
              <div className="av-passport__crest">
                <ShieldCheck aria-hidden="true" />
              </div>
              <p className="av-small-label">科学护照 / 方法记录</p>
              <h2 id={`${uid}-passport-title`}>
                {complete
                  ? '证据守门人'
                  : stampCount > 0
                    ? '证据有边界'
                    : '留给下一次追问'}
              </h2>
              <p>
                {complete
                  ? '你为每一份史料保留了它的边界。'
                  : stampCount > 0
                    ? '第一枚方法徽章已解锁：分清证据能支持什么，与它尚不能证明什么。'
                    : '检查任意一份史料的两张批注并盖章，即可解锁第一枚方法徽章。'}
              </p>
              <span
                className={`av-method-badge${stampCount ? ' av-method-badge--earned' : ''}`}
              >
                <ShieldCheck aria-hidden="true" />
                {stampCount ? '方法徽章 · 已获得' : '方法徽章 · 待开启'}
              </span>
              <small>
                印章记录阅读中的主动检查，
                <br />
                不代表已经复现原始实验。
              </small>
            </div>
            <div className="av-passport__stamps">
              <div className="av-passport__ledger">
                <span>档案检验印记</span>
                <strong>
                  {stampCount} / {artifacts.length}
                </strong>
              </div>
              <div className="av-passport__grid">
                {artifacts.map((item, index) => (
                  <div
                    className={`av-passport-slot${reviews[item.id]?.stamped ? ' av-passport-slot--filled' : ''}`}
                    key={item.id}
                  >
                    {reviews[item.id]?.stamped ? (
                      <InkSeal number={folioNumber(index)} small />
                    ) : (
                      <span className="av-empty-seal">
                        <span>{folioNumber(index)}</span>
                        <small>待检验</small>
                      </span>
                    )}
                    <span>{item.date}</span>
                    <small>{item.kind}</small>
                  </div>
                ))}
              </div>
              <p>无需一次集齐。好的追问，值得慢慢留下。</p>
            </div>
          </div>
          <footer className="av-passport__footer">
            <button type="button" onClick={() => passportRef.current?.close()}>
              <BookOpen aria-hidden="true" /> 返回手记{' '}
              <ArrowRight aria-hidden="true" />
            </button>
          </footer>
        </div>
      </dialog>
      <output className="av-sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </output>
    </section>
  );
}
