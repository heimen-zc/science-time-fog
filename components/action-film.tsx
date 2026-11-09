'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, Clapperboard, Play, RotateCcw, X } from 'lucide-react';
import { actionFilms, type ActionFilmId } from '@/lib/action-films';
import './action-film.css';

/** Showing the film never runs a bench action or writes an observation. */
export function ActionFilm({
  id,
  onViewingChange,
  onResume,
  disabled,
}: {
  id: ActionFilmId;
  onViewingChange?: (viewing: boolean) => void;
  onResume?: () => void;
  disabled?: boolean;
}) {
  const clip = actionFilms[id];
  const label = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [play, setPlay] = useState(0);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const binary = useRef<Blob | null>(null);
  const path = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/action-films/${id}`;

  useEffect(() => {
    if (!open || !play) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    async function load() {
      try {
        if (!binary.current) {
          const response = await fetch(`${path}.gif`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error('Film unavailable');
          const blob = await response.blob();
          if (controller.signal.aborted) return;
          binary.current = blob;
        }
        objectUrl = URL.createObjectURL(binary.current);
        setSrc(objectUrl);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, path, play]);

  const startPlayback = () => {
    setError(false);
    setSrc(null);
    setPlay((n) => n + 1);
  };
  const show = () => {
    if (!dialog.current || dialog.current.open || disabled) return;
    dialog.current.scrollTop = 0;
    dialog.current.showModal();
    onViewingChange?.(true);
    setOpen(true);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      startPlayback();
  };
  const close = () => {
    setOpen(false);
    setPlay(0);
    setSrc(null);
    setError(false);
    onViewingChange?.(false);
  };

  return (
    <div className="action-film">
      <div className="action-film__cue">
        <span className="action-film__tag">完成信号</span>
        <p>{clip.next}</p>
      </div>
      <button
        type="button"
        className="action-film__trigger"
        onClick={show}
        disabled={disabled}
      >
        <Clapperboard aria-hidden="true" /> 看动作 GIF{' '}
        <span>· {clip.label}</span>
      </button>
      <dialog
        ref={dialog}
        className="action-film__dialog"
        aria-labelledby={label}
        onClose={close}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            dialog.current?.close();
          }
        }}
      >
        <header className="action-film__header">
          <div>
            <small>雾灯动作放映台 · 只示范，不记证据</small>
            <h2 id={label}>{clip.title}</h2>
          </div>
          <button
            type="button"
            aria-label="关闭动作示范"
            onClick={() => dialog.current?.close()}
          >
            <X />
          </button>
        </header>
        {open && (
          <>
            <div className="action-film__screen">
              {/* eslint-disable-next-line @next/next/no-img-element -- An untransformed GIF/Blob preserves the original animation. */}
              <img
                src={src ?? `${path}.webp`}
                width={640}
                height={360}
                alt={`${clip.action} ${clip.watch}`}
                onError={() => {
                  if (src) {
                    binary.current = null;
                    setSrc(null);
                  }
                  setError(true);
                }}
              />
              {play > 0 && !src && !error && (
                <output className="action-film__loading">正在装入胶片…</output>
              )}
            </div>
            {error && (
              <output className="action-film__error">
                胶片暂时没装好。可重试，也可以按下面的步骤直接做实验。
              </output>
            )}
            <dl className="action-film__notes">
              <div>
                <dt>怎么做</dt>
                <dd>{clip.action}</dd>
              </div>
              <div>
                <dt>看哪里</dt>
                <dd>{clip.watch}</dd>
              </div>
              <div>
                <dt>接下来</dt>
                <dd>{clip.next}</dd>
              </div>
            </dl>
            <footer className="action-film__footer">
              <button
                type="button"
                onClick={startPlayback}
                disabled={play > 0 && !src && !error}
              >
                {play ? <RotateCcw /> : <Play />}
                {play ? '重播 GIF' : '播放 GIF'}
              </button>
              <button
                type="button"
                className="action-film__return"
                onClick={() => {
                  dialog.current?.close();
                  onResume?.();
                }}
              >
                轮到我了 <ArrowRight />
              </button>
            </footer>
          </>
        )}
      </dialog>
    </div>
  );
}
