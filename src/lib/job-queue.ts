/**
 * Concurrent job queue with retry and priority support.
 * Processes jobs in parallel up to `concurrency` limit.
 */

export interface Job<T> {
  id: string;
  fn: () => Promise<T>;
  priority?: number; // higher = sooner
  retries?: number;
  onProgress?: (status: "pending" | "running" | "done" | "error") => void;
}

interface QueuedJob<T> extends Job<T> {
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  attempt: number;
}

export class JobQueue<T = unknown> {
  private queue: QueuedJob<T>[] = [];
  private running = 0;
  private readonly concurrency: number;
  private readonly maxRetries: number;

  constructor(concurrency = 3, maxRetries = 2) {
    this.concurrency = concurrency;
    this.maxRetries = maxRetries;
  }

  add(job: Job<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queued: QueuedJob<T> = {
        ...job,
        resolve,
        reject,
        attempt: 0,
        retries: job.retries ?? this.maxRetries,
      };
      this.queue.push(queued);
      // Sort by priority (higher first)
      this.queue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      this.processNext();
    });
  }

  addAll(jobs: Job<T>[]): Promise<PromiseSettledResult<T>[]> {
    return Promise.allSettled(jobs.map((job) => this.add(job)));
  }

  get pending() {
    return this.queue.length;
  }

  get active() {
    return this.running;
  }

  private async processNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) return;

    const job = this.queue.shift()!;
    this.running++;
    job.onProgress?.("running");

    try {
      const result = await job.fn();
      job.onProgress?.("done");
      job.resolve(result);
    } catch (err) {
      job.attempt++;
      if (job.attempt < (job.retries ?? 0)) {
        // Exponential backoff: 1s, 2s, 4s...
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
      this.running--;
      this.processNext();
    }
  }
}

/** Singleton queue for image processing (max 3 concurrent) */
export const imageProcessingQueue = new JobQueue(3, 2);
