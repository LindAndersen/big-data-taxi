/** Stateless FNV-1a hash mapped to [0, 1); results never depend on call/render order. */
export function deterministicFraction(key: string): number {
  let hash = 2166136261
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619)
  }
  return (hash >>> 0) / 4294967296
}
