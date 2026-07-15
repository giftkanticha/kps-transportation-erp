import { insertOne } from './crud'
import type { ActivityLog } from '../types'

// Logging failures must never break the mutation that already succeeded —
// swallow and report to console instead of throwing.
export async function logActivity(who: string, type: string, text: string): Promise<void> {
  try {
    await insertOne<ActivityLog>('activity_logs', {
      at: new Date().toISOString(),
      who,
      type,
      text,
    })
  } catch (e) {
    console.error('logActivity failed:', e)
  }
}
