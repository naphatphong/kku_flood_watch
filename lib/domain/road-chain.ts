import type { LngLat } from './geo';

export interface ChainSegment {
  id: number;
  source: number;
  target: number;
  lengthM: number;
  coords: LngLat[];
}

/** The two free node ids at the ends of a connected chain. */
function ends(chain: ChainSegment[]): [number, number] {
  if (chain.length === 1) return [chain[0].source, chain[0].target];
  const free = (s: ChainSegment, neighbour: ChainSegment) =>
    [s.source, s.target].find((n) => n !== neighbour.source && n !== neighbour.target) ?? s.source;
  return [free(chain[0], chain[1]), free(chain.at(-1)!, chain.at(-2)!)];
}

/**
 * Road-post picker (PLAN §4): tapping a segment next to either end extends the chain,
 * tapping an end segment removes it, tapping elsewhere starts a new chain.
 */
export function toggleSegment(chain: ChainSegment[], seg: ChainSegment): ChainSegment[] {
  if (chain[0]?.id === seg.id) return chain.slice(1);
  if (chain.at(-1)?.id === seg.id) return chain.slice(0, -1);
  if (chain.some((s) => s.id === seg.id) || !chain.length) return chain.length ? chain : [seg];
  const [head, tail] = ends(chain);
  const touches = (n: number) => seg.source === n || seg.target === n;
  if (touches(tail)) return [...chain, seg];
  if (touches(head)) return [seg, ...chain];
  return [seg];
}

export const chainLengthM = (chain: ChainSegment[]) => chain.reduce((s, c) => s + c.lengthM, 0);
