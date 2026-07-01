import type { BracketMatch } from "../types";

// Reorder a round so a plain binary-tree pairing (child 2i / 2i+1 → parent i)
// lines up with the *real* feeders. The API lists matches by external_id, which
// is not bracket order, so positional pairing alone links the wrong matches.
// We group each child under the parent it actually feeds (backend source ids);
// still-TBD parents contribute nothing, so their children keep their original
// order — enough to render a valid skeleton until identity is known.
export function orderChildRound(
  parents: BracketMatch[],
  children: BracketMatch[],
): BracketMatch[] {
  const byId = new Map(children.map((c) => [c.id, c]));
  const used = new Set<number>();
  const ordered: BracketMatch[] = [];
  for (const p of parents) {
    for (const cid of [p.home_source_match_id, p.away_source_match_id]) {
      const child = cid != null ? byId.get(cid) : undefined;
      if (child && !used.has(child.id)) {
        ordered.push(child);
        used.add(child.id);
      }
    }
  }
  for (const c of children) if (!used.has(c.id)) ordered.push(c);
  return ordered;
}
