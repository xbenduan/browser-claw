import type { BatchProgress, BatchResult } from '@/types';

interface BatchExecutorOptions {
  concurrency?: number;
  delayMs?: number;
  onProgress?: (progress: BatchProgress) => void;
  shouldContinue?: () => boolean;
}

/**
 * 批量执行引擎
 * 支持并发控制、进度回调、暂停机制
 */
export class BatchExecutor {
  /**
   * 批量执行任务
   */
  static async execute<T>(
    items: T[],
    executeFn: (item: T, index: number) => Promise<{ success: boolean; error?: string }>,
    options: BatchExecutorOptions = {}
  ): Promise<BatchResult> {
    const { concurrency = 3, delayMs = 200, onProgress, shouldContinue } = options;

    const result: BatchResult = {
      total: items.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < items.length; i += concurrency) {
      // 检查是否应继续
      if (shouldContinue && !shouldContinue()) {
        break;
      }

      const batch = items.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((item, j) => executeFn(item, i + j))
      );

      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        if (r.status === 'fulfilled' && r.value.success) {
          result.success++;
        } else {
          result.failed++;
          result.errors.push({
            item: batch[j],
            error:
              r.status === 'rejected'
                ? String(r.reason)
                : (r.value.error ?? 'Unknown error'),
          });
        }
      }

      // 进度回调
      onProgress?.({
        completed: Math.min(i + concurrency, items.length),
        total: items.length,
        success: result.success,
        failed: result.failed,
      });

      // 请求间隔
      if (i + concurrency < items.length) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    return result;
  }
}
