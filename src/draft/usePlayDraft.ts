import { useEffect, useMemo, useRef, useState } from "react";
import type { EvaluationResult, Play, Template } from "../engine/models";
import { evaluate } from "../engine/evaluate";
import { readPlay, writePlay } from "../storage/db";
import * as PlayDraft from "./playDraft";
import { SaveQueue, type SaveState, type SaveStatus } from "./saveQueue";

export interface PlayDraftApi {
  play: Play | null;
  evaluation: EvaluationResult | null;
  loadError: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  hasUnfinishedInput: boolean;
  setHasUnfinishedInput(value: boolean): void;
  setScore(playerIndex: number, text: string): boolean;
  setCategoryValue(playerIndex: number, categoryKey: string, text: string): boolean;
  recomputeTotal(playerIndex: number): void;
  setRank(playerIndex: number, text: string): boolean;
  setWin(playerIndex: number, won: boolean | null): void;
  applyTemplate(template: Template): Promise<void>;
  complete(): Promise<Play>;
  retry(): Promise<void>;
  flush(): Promise<void>;
}

const initialSaveState: SaveState = { status: "saved", revision: 0, acknowledgedRevision: 0, error: null };

export function usePlayDraft(id: string | undefined): PlayDraftApi {
  const [play, setPlay] = useState<Play | null>(null);
  const playRef = useRef<Play | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(initialSaveState);
  const [hasUnfinishedInput, setHasUnfinishedInput] = useState(false);
  const routeToken = useRef(0);
  const queueRef = useRef<SaveQueue<Play> | null>(null);

  useEffect(() => {
    if (!id) return;
    const token = ++routeToken.current;
    let cancelled = false;
    playRef.current = null;
    queueMicrotask(() => {
      if (cancelled || routeToken.current !== token) return;
      setPlay(null);
      setLoadError(null);
      setSaveState(initialSaveState);
    });
    queueRef.current = new SaveQueue(writePlay, (state) => {
      if (!cancelled && routeToken.current === token) setSaveState(state);
    });
    void readPlay(id).then(
      (loaded) => {
        if (!cancelled && routeToken.current === token) {
          playRef.current = loaded;
          setPlay(loaded);
        }
      },
      () => {
        if (!cancelled && routeToken.current === token) setLoadError("This play could not be loaded. It may be missing or unreadable.");
      },
    );
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    const protectUnload = (event: BeforeUnloadEvent) => {
      if (saveState.status === "saved" && !hasUnfinishedInput) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectUnload);
    return () => window.removeEventListener("beforeunload", protectUnload);
  }, [saveState.status, hasUnfinishedInput]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent<boolean>("meeplemark:persistence-safe", {
      detail: saveState.status === "saved" && !hasUnfinishedInput,
    }));
  }, [saveState.status, hasUnfinishedInput]);

  const evaluation = useMemo(() => (play ? evaluate(play) : null), [play]);

  function commit(update: (current: Play) => Play | null): Promise<void> | null {
    const current = playRef.current;
    const queue = queueRef.current;
    if (!current || !queue) return null;
    const updated = update(current);
    if (!updated) return null;
    playRef.current = updated;
    setPlay(updated);
    return queue.enqueue(updated);
  }

  return {
    play,
    evaluation,
    loadError,
    saveStatus: saveState.status,
    saveError: saveState.error ? "Changes are not saved yet. Check browser storage and try again." : null,
    hasUnfinishedInput,
    setHasUnfinishedInput,
    setScore(playerIndex, text) {
      const operation = commit((current) => PlayDraft.setScore(current, playerIndex, text));
      void operation?.catch(() => undefined);
      return operation !== null;
    },
    setCategoryValue(playerIndex, categoryKey, text) {
      const operation = commit((current) => PlayDraft.setCategoryValue(current, playerIndex, categoryKey, text));
      void operation?.catch(() => undefined);
      return operation !== null;
    },
    recomputeTotal(playerIndex) {
      void commit((current) => PlayDraft.recomputeTotal(current, playerIndex))?.catch(() => undefined);
    },
    setRank(playerIndex, text) {
      const operation = commit((current) => PlayDraft.setRank(current, playerIndex, text));
      void operation?.catch(() => undefined);
      return operation !== null;
    },
    setWin(playerIndex, won) {
      void commit((current) => PlayDraft.setWin(current, playerIndex, won))?.catch(() => undefined);
    },
    async applyTemplate(template) {
      const operation = commit((current) => PlayDraft.applyTemplate(current, template));
      if (!operation) throw new Error("No play is loaded.");
      await operation;
    },
    async complete() {
      const operation = commit((current) => PlayDraft.complete(current));
      if (!operation || !playRef.current) throw new Error("No play is loaded.");
      await operation;
      return playRef.current;
    },
    async retry() {
      await queueRef.current?.retry();
    },
    async flush() {
      await queueRef.current?.flush();
    },
  };
}
