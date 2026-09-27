import { describe, expect, it } from "vitest";
import { SaveQueue } from "./saveQueue";

describe("SaveQueue", () => {
  it("preserves rapid edit order even when writes are delayed", async () => {
    const persisted: number[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const queue = new SaveQueue<number>(async (value) => {
      if (value === 1) await firstGate;
      persisted.push(value);
    }, () => undefined);
    const first = queue.enqueue(1);
    const second = queue.enqueue(2);
    const third = queue.enqueue(3);
    releaseFirst();
    await Promise.all([first, second, third]);
    expect(persisted).toEqual([1, 2, 3]);
    expect(queue.snapshot()).toMatchObject({ status: "saved", revision: 3, acknowledgedRevision: 3 });
  });

  it("retains an error until the latest value is successfully retried", async () => {
    let shouldFail = true;
    const persisted: string[] = [];
    const queue = new SaveQueue<string>(async (value) => {
      if (shouldFail) throw new Error("disk full");
      persisted.push(value);
    }, () => undefined);
    await expect(queue.enqueue("latest")).rejects.toThrow("disk full");
    expect(queue.snapshot().status).toBe("error");
    shouldFail = false;
    await queue.retry();
    expect(persisted).toEqual(["latest"]);
    expect(queue.snapshot().status).toBe("saved");
  });
});
