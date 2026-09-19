import { useEffect, useMemo, useState } from "react";
import type { EvaluationResult, Play, Template } from "../engine/models";
import { evaluate } from "../engine/evaluate";
import { readPlay, writePlay } from "../storage/db";
import * as PlayDraft from "./playDraft";

/**
 * React-side counterpart to `Persistence`'s `PlayDraft` class: owns one
 * play's in-progress state and writes through to IndexedDB on every
 * mutation (mirrors `PlayDraft.save()`). The mutation semantics
 * themselves live in `playDraft.ts` as pure functions — this hook only
 * adds "load it, keep it in state, persist every change".
 */
export interface PlayDraftApi {
  play: Play | null;
  evaluation: EvaluationResult | null;
  loadError: string | null;
  setScore(playerIndex: number, text: string): void;
  setCategoryValue(playerIndex: number, categoryKey: string, text: string): void;
  recomputeTotal(playerIndex: number): void;
  setRank(playerIndex: number, text: string): void;
  setWin(playerIndex: number, won: boolean): void;
  applyTemplate(template: Template): Promise<void>;
  complete(): void;
}

export function usePlayDraft(id: string | undefined): PlayDraftApi {
  const [play, setPlay] = useState<Play | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setPlay(null);
    readPlay(id)
      .then((loaded) => {
        if (!cancelled) setPlay(loaded);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const evaluation = useMemo(() => (play ? evaluate(play) : null), [play]);

  function persist(updated: Play) {
    setPlay(updated);
    writePlay(updated).catch((err) => setLoadError(String(err)));
  }

  return {
    play,
    evaluation,
    loadError,
    setScore(playerIndex, text) {
      if (!play) return;
      const updated = PlayDraft.setScore(play, playerIndex, text);
      if (updated) persist(updated);
    },
    setCategoryValue(playerIndex, categoryKey, text) {
      if (!play) return;
      const updated = PlayDraft.setCategoryValue(play, playerIndex, categoryKey, text);
      if (updated) persist(updated);
    },
    recomputeTotal(playerIndex) {
      if (!play) return;
      persist(PlayDraft.recomputeTotal(play, playerIndex));
    },
    setRank(playerIndex, text) {
      if (!play) return;
      const updated = PlayDraft.setRank(play, playerIndex, text);
      if (updated) persist(updated);
    },
    setWin(playerIndex, won) {
      if (!play) return;
      persist(PlayDraft.setWin(play, playerIndex, won));
    },
    async applyTemplate(template) {
      if (!play) throw new Error("no play loaded");
      const updated = PlayDraft.applyTemplate(play, template);
      setPlay(updated);
      await writePlay(updated);
    },
    complete() {
      if (!play) return;
      persist(PlayDraft.complete(play));
    },
  };
}
