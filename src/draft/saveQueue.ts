export type SaveStatus = "saved" | "saving" | "error";

export interface SaveState {
  status: SaveStatus;
  revision: number;
  acknowledgedRevision: number;
  error: Error | null;
}

/** Ordered, revision-aware persistence for one document. */
export class SaveQueue<T> {
  private chain: Promise<void> = Promise.resolve();
  private latest: T | null = null;
  private state: SaveState = { status: "saved", revision: 0, acknowledgedRevision: 0, error: null };
  private readonly write: (value: T) => Promise<void>;
  private readonly onChange: (state: SaveState) => void;

  constructor(write: (value: T) => Promise<void>, onChange: (state: SaveState) => void) {
    this.write = write;
    this.onChange = onChange;
  }

  snapshot(): SaveState { return this.state; }

  enqueue(value: T): Promise<void> {
    this.latest = value;
    const revision = this.state.revision + 1;
    this.update({ ...this.state, status: "saving", revision });
    const operation = this.chain.catch(() => undefined).then(() => this.write(value));
    this.chain = operation;
    operation.then(
      () => {
        const acknowledgedRevision = Math.max(this.state.acknowledgedRevision, revision);
        this.update({
          ...this.state,
          acknowledgedRevision,
          status: revision === this.state.revision ? "saved" : this.state.status,
          error: revision === this.state.revision ? null : this.state.error,
        });
      },
      (caught: unknown) => {
        if (revision === this.state.revision) {
          this.update({ ...this.state, status: "error", error: caught instanceof Error ? caught : new Error(String(caught)) });
        }
      },
    );
    return operation;
  }

  retry(): Promise<void> {
    if (this.latest === null) return Promise.resolve();
    return this.enqueue(this.latest);
  }

  async flush(): Promise<void> {
    await this.chain;
    if (this.state.status === "error") throw this.state.error ?? new Error("Save failed.");
  }

  private update(state: SaveState) {
    this.state = state;
    this.onChange(state);
  }
}
