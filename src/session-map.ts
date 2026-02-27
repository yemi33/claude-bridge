import { createHash } from 'node:crypto';

/**
 * Derives a deterministic UUID v4-shaped string from a Teams conversation ID
 * using SHA-256. The same conversation ID always produces the same UUID,
 * even across process restarts.
 */
export function conversationToSessionId(conversationId: string): string {
  const hash = createHash('sha256').update(conversationId).digest('hex');

  // Format as UUID v4 (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}
