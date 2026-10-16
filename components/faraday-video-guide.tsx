'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import videoAsset from '@/content/faraday-video-asset.json';

const publicAsset = (path: string) =>
  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`;

const chapters = [
  {
    start: 0,
    title: '先看懂装置',
    action: '找到两组互不相连的导线',
    observation: '左边接电池，右边接检流计。两组线圈彼此绝缘，共用一个铁环。',
  },
  {
    start: 12,
    title: '接通，再保持',
    action: '别急着断开，继续看指针',
    observation:
      '比较接通的瞬间与保持接通后的状态。电池仍在供电，不代表右线圈一直有电流。',
  },
  {
    start: 24,
    title: '断开与原理',
    action: '比较接通和断开的偏转方向',
    observation:
      '穿过右线圈的磁通量变化，产生感应电动势；右回路闭合时，就有短暂的感应电流。',
  },
];

export const faradayVideoReady = videoAsset.ready;

export function FaradayVideoGuide({
  onTry,
  onBack,
}: {
  onTry: () => void;
  onBack?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [time, setTime] = useState(0);
  const [playBlocked, setPlayBlocked] = useState(false);
  const chapterIndex = time >= 24 ? 2 : time >= 12 ? 1 : 0;
  const chapter = chapters[chapterIndex];

  if (!videoAsset.ready) return null;

  const playFrom = async (seconds?: number) => {
    const player = video.current;
    if (!player) return;
    if (seconds !== undefined) player.currentTime = seconds;
    try {
      await player.play();
      setPlayBlocked(false);
    } catch {
      setPlayBlocked(true);
    }
  };

  return (
    <section className="video-guide" aria-labelledby="video-guide-title">
      <div className="video-guide__heading">
        <div>
          <p className="eyebrow">
            <Play /> 36 秒 · 跟着看一遍
          </p>
          <h2 id="video-guide-title">为什么指针只动一下？</h2>
          <p>先认识装置和动作，再到实验台亲手验证。</p>
        </div>
        {onBack ? (
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft /> 返回
          </Button>
        ) : null}
      </div>

      <div className="video-guide__layout">
        <div className="video-guide__player">
          <video
            ref={video}
            controls
            playsInline
            preload="metadata"
            poster={publicAsset(videoAsset.poster)}
            aria-label="法拉第感应环实验操作与原理演示，36秒，带中文讲解"
            onPlay={() => {
              setStarted(true);
              setEnded(false);
            }}
            onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
            onEnded={() => setEnded(true)}
            onError={() => setFailed(true)}
          >
            <source src={publicAsset(videoAsset.path)} type="video/mp4" />
            <track
              kind="captions"
              src={publicAsset(videoAsset.captions)}
              srcLang="zh"
              label="中文"
            />
            你的浏览器暂不支持视频播放，请阅读下面的文字操作说明。
          </video>
          {!started && !failed ? (
            <button
              type="button"
              className="video-guide__play"
              onClick={() => void playFrom()}
            >
              <span>
                <Play fill="currentColor" />
              </span>
              播放操作演示
            </button>
          ) : null}
          {failed ? (
            <div className="video-guide__error" aria-live="polite">
              <strong>视频暂时未能加载</strong>
              <p>你可以先阅读下面的操作说明，再进入实验台。</p>
              <Button
                variant="outline"
                onClick={() => {
                  setFailed(false);
                  video.current?.load();
                }}
              >
                <RotateCcw /> 重新加载
              </Button>
            </div>
          ) : null}
        </div>

        <aside className="video-guide__companion">
          <span className="video-guide__step">
            现在只看这一件事 · {chapterIndex + 1}/3
          </span>
          <h3>{ended ? '轮到你亲手验证了' : chapter.action}</h3>
          <p>
            {ended
              ? '看懂演示只是起点。下一步亲自接通、保持、断开，留下你自己的实验记录。'
              : chapter.observation}
          </p>
          <div
            className="video-guide__progress"
            aria-label={`视频已播放 ${Math.round(time)} 秒，共36秒`}
          >
            <span style={{ width: `${Math.min(100, (time / 36) * 100)}%` }} />
          </div>
          <Button
            className="primary-cta"
            size="lg"
            onClick={() => {
              video.current?.pause();
              onTry();
            }}
          >
            {ended ? <Check /> : <ArrowRight />} 我来试一试
          </Button>
          <small>观看视频不会代替你的实验，也不会自动填入证据。</small>
          {playBlocked ? (
            <p aria-live="polite">
              请点击画面中的播放按钮，或使用视频自带的播放键。
            </p>
          ) : null}
        </aside>
      </div>

      <div className="video-guide__below">
        <details className="video-guide__transcript">
          <summary>展开步骤说明 / 重看某一步</summary>
          <ol>
            {chapters.map((item, index) => (
              <li key={item.start}>
                <button type="button" onClick={() => void playFrom(item.start)}>
                  <Play /> {String(item.start).padStart(2, '0')} 秒 ·{' '}
                  {item.title}
                </button>
                <p>{item.observation}</p>
                {index === 2 ? (
                  <small>
                    偏转的左右随接线而变；这里应比较接通与断开是否反向。
                  </small>
                ) : null}
              </li>
            ))}
          </ol>
        </details>
        <p className="video-guide__source-note">
          AI
          教学重现，非历史录像。磁场光效是现代示意；实验判断以可复核的操作、记录与史料为依据。{' '}
          <a
            href="https://www.rigb.org/explore-science/explore/collection/michael-faradays-ring-coil-apparatus"
            target="_blank"
            rel="noopener noreferrer"
          >
            查看原始装置
          </a>
        </p>
      </div>
    </section>
  );
}
