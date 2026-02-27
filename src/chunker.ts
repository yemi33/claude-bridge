const MAX_CHUNK_BYTES = 25_000; // Teams limit is ~28 KB; leave headroom

/**
 * Splits a string into chunks that fit within the Teams message size limit.
 * Prefers splitting at paragraph boundaries (\n\n), then line boundaries (\n).
 * Adds [Part N/M] headers when the response is chunked.
 */
export function chunkResponse(text: string): string[] {
  if (Buffer.byteLength(text, 'utf-8') <= MAX_CHUNK_BYTES) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (Buffer.byteLength(remaining, 'utf-8') <= MAX_CHUNK_BYTES) {
      chunks.push(remaining);
      break;
    }

    // Find a split point that fits within the byte limit
    let splitAt = findSplitPoint(remaining);
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (chunks.length === 1) {
    return chunks;
  }

  return chunks.map((chunk, i) => `**[Part ${i + 1}/${chunks.length}]**\n\n${chunk}`);
}

function findSplitPoint(text: string): number {
  // Binary-search for the character index whose UTF-8 byte length is <= limit
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (Buffer.byteLength(text.slice(0, mid), 'utf-8') <= MAX_CHUNK_BYTES) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  const maxCharIndex = lo;

  // Try to split at a paragraph boundary
  const paraBreak = text.lastIndexOf('\n\n', maxCharIndex);
  if (paraBreak > maxCharIndex * 0.3) {
    return paraBreak + 2; // include the double newline in the current chunk
  }

  // Try to split at a line boundary
  const lineBreak = text.lastIndexOf('\n', maxCharIndex);
  if (lineBreak > maxCharIndex * 0.3) {
    return lineBreak + 1;
  }

  // Last resort: split at the byte limit
  return maxCharIndex;
}
