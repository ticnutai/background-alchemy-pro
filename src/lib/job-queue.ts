/**
 * Concurrent job queue with retry, priority, and cancellation support.
 * Processes jobs in parallel up to `concurrency` limit.
 */

export interface Job<T> {
  id: string;
  fn: (signal: AbortSignal) => Promise<T>;
  priority?: number; // higher = sooner
  retries?: number;
  onProgress?: (status: "pending" | "running" | "done" | "error", progress?: number) => void;
}

interface QueuedJob<T> extends Job<T> {
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  attempt: number;
  abortController: AbortController;
}

export class JobQueue<T = unknown> {
  private queue: QueuedJob<T>[] = [];
  private runningJobs = new Map<string, QueuedJob<T>>();
  private concurrency: number;
  private readonly maxRetries: number;

  constructor(concurrency = 3, maxRetries = 2) {
    this.concurrency = concurrency;
    this.maxRetries = maxRetries;
  }

  add(job: Job<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queued: QueuedJob<T> = {
        ...job,
        fn: job.fn,
        resolve,
        reject,
        attempt: 0,
        retries: job.retries ?? this.maxRetries,
        abortController: new AbortController(),
      };
      this.queue.push(queued);
      this.queue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      this.processNext();
    });
  }

  addAll(jobs: Job<T>[]): Promise<PromiseSettledResult<T>[]> {
    return Promise.allSettled(jobs.map((job) => this.add(job)));
  }

  /** Cancel a specific job by ID. If running, aborts it. If queued, removes it. */
  cancel(jobId: string): boolean {
    // Check running jobs
    const running = this.runningJobs.get(jobId);
    if (running) {
      running.abortController.abort();
      running.onProgress?.("error");
      running.reject(new DOMException("Cancelled", "AbortError"));
      this.runningJobs.delete(jobId);
      return true;
    }
    // Check queue
    const idx = this.queue.findIndex((j) => j.id === jobId);
    if (idx !== -1) {
      const [removed] = this.queue.splice(idx, 1);
      removed.onProgress?.("error");
      removed.reject(new DOMException("Cancelled", "AbortError"));
      return true;
    }
    return false;
  }

  /** Cancel all queued and running jobs */
  cancelAll(): void {
    // Cancel running
    for (const [id, job] of this.runningJobs) {
      job.abortController.abort();
      job.onProgress?.("error");
      job.reject(new DOMException("Cancelled", "AbortError"));
    }
    this.runningJobs.clear();

    // Cancel queued
    for (const job of this.queue) {
      job.onProgress?.("error");
      job.reject(new DOMException("Cancelled", "AbortError"));
    }
    this.queue = [];
  }

  get pending() {
    return this.queue.length;
  }

  get active() {
    return this.runningJobs.size;
  }

  /** Dynamically adjust concurrency (e.g., batch mode = 5) */
  setConcurrency(n: number): void {
    this.concurrency = n;
    // Try to fill new slots
    this.processNext();
  }

  private async processNext() {
    if (this.runningJobs.size >= this.concurrency || this.queue.length === 0) return;

    const job = this.queue.shift()!;
    this.runningJobs.set(job.id, job);
    job.onProgress?.("running");

    try {
      const result = await job.fn(job.abortController.signal);
      this.runningJobs.delete(job.id);
      job.onProgress?.("done");
      job.resolve(result);
    } catch (err) {
      this.runningJobs.delete(job.id);

      // Don't retry if cancelled
      if (job.abortController.signal.aborted) return;

      job.attempt++;
      if (job.attempt < (job.retries ?? 0)) {
        const delay = Math.min(1000 * Math.pow(2, job.attempt - 1), 8000);
        setTimeout(() => {
          this.queue.unshift(job);
          this.processNext();
        }, delay);
      } else {
        job.onProgress?.("error");
        job.reject(err);
      }
    } finally {
      this.processNext();
    }
  }
}

/** Singleton queue for image processing (max 3 concurrent, 5 for batch) */
export const imageProcessingQueue = new JobQueue(3, 2);

/** Higher-concurrency batch queue */
export const batchProcessingQueue = new JobQueue(5, 2);
