// Computes the minimal single-range edit that turns `current` into `next` by
// stripping the shared prefix and suffix. Returning a minimal change (rather
// than replacing the whole document) lets CodeMirror map the existing
// selection through the change, so a caret outside the edited span stays put.
// Returns null when the strings are identical (no edit needed).
export function computeDocPatch(
  current: string,
  next: string
): { from: number; to: number; insert: string } | null {
  if (current === next) return null;

  const maxPrefix = Math.min(current.length, next.length);
  let start = 0;
  while (start < maxPrefix && current[start] === next[start]) start++;

  // Shared suffix, stopping before `start` in either string so the removed and
  // inserted ranges never overlap (e.g. 'aaaa' -> 'aa').
  let endCurrent = current.length;
  let endNext = next.length;
  while (endCurrent > start && endNext > start && current[endCurrent - 1] === next[endNext - 1]) {
    endCurrent--;
    endNext--;
  }

  return { from: start, to: endCurrent, insert: next.slice(start, endNext) };
}
