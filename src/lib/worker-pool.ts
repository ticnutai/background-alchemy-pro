/**
 * Reusable Web Worker pool — keeps N workers alive and dispatches tasks round-robin.
 * Avoids the cost of creating/destroying workers on every slider change.
 */

interface PoolTask {
  payload: unknown;
  transfer?: Transferable[];
  resolve: (result: unknown) => void;
  reject: (err: unknown) => void;
}

export class WorkerPool {
  private workers: Worker[] = [];
  private busy: boolean[] = [];
  private queue: PoolTask[] = [];
  private taskId = 0;

  constructor(
    private readonly createWorker: () => Worker,
    private readonly size = navigator.hardwareConcurrency
      ? Math.min(navigator.hardwareConcurrency, 4)
      : 2,
  ) {
    for (let i = 0; i < this.size; i++) {
      const w = this.createWorker();
      this.workers.push(w);
      this.busy.push(false);
    }
  }

  /**
   * Dispatch a message to the next available worker.
   * Returns a promise that resolves with the worker's response.
   */
  dispatch<R = unknown>(payload: unknown, transfer?: Transferable[]): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const task: PoolTask = { payload, transfer, resolve: resolve as (v: unknown) => void, reject };
      const freeIdx = this.busy.indexOf(false);
      if (freeIdx !== -1) {
        this.runTask(freeIdx, task);
      } else {
        this.queue.push(task);
      }
    });
  }

  private runTask(workerIdx: number, task: PoolTask) {
    this.busy[workerIdx] = true;
    const w = this.workers[workerIdx];

    const cleanup = () => {
      w.onmessage = null;
      w.onerror = null;
      this.busy[workerIdx] = false;
      // Pick up next queued task
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        this.runTask(workerIdx, next);
      }
    };

    w.onmessage = (e: MessageEvent) => {
      cleanup();
      task.resolve(e.data);
    };

    w.onerror = (err) => {
      cleanup();
      task.reject(err);
    };

    if (task.transfer) {
      w.postMessage(task.payload, task.transfer);
    } else {
      w.postMessage(task.payload);
    }
  }

  /** Number of workers currently executing */
  get activeCount(): number {
    return this.busy.filter(Boolean).length;
  }

  /** Terminate all workers */
  terminate(): void {
    this.workers.forEach((w) => w.terminate());
    this.workers = [];
    this.busy = [];
    this.queue = [];
  }
}

// ─── Singleton filter worker pool ────────────────────────────
let _filterPool: WorkerPool | null = null;

export function getFilterWorkerPool(): WorkerPool {
  if (!_filterPool) {
    _filterPool = new WorkerPool(
      () => new Worker(new URL("./filter-worker.ts", import.meta.url), { type: "module" }),
    );
  }
  return _filterPool;
}

// ─── Singleton export worker pool ────────────────────────────
let _exportPool: WorkerPool | null = null;

export function getExportWorkerPool(): WorkerPool {
  if (!_exportPool) {
    _exportPool = new WorkerPool(
      () => new Worker(new URL("./export-worker.ts", import.meta.url), { type: "module" }),
      2, // exports are less frequent, 2 workers enough
    );
  }
  return _exportPool;
}
