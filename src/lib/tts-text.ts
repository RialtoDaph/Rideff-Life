// Cuts a growing reply into sentences so the first one can be spoken while the rest is still being written.
// Pure: no DOM, no audio.

const END = /(?:[.!?…]+["')\]]*\s|\n)/;
/** A first chunk may be short so speech starts early; later ones are kept whole for a smoother voice. */
const MIN_FIRST = 12;

/** Takes the text so far. Returns the finished sentences and what is still open. */
export function takeSentences(buffer: string, final = false, first = false): { ready: string[]; rest: string } {
  const ready: string[] = [];
  let rest = buffer;
  for (;;) {
    const m = END.exec(rest);
    if (!m) break;
    const cut = m.index + m[0].length;
    const piece = rest.slice(0, cut).trim();
    if (piece.length < (first && !ready.length ? MIN_FIRST : 4)) {
      // A fragment such as "Ya." or "1." is joined with the next sentence.
      const next = END.exec(rest.slice(cut));
      if (!next) break;
      ready.push(rest.slice(0, cut + next.index + next[0].length).trim());
      rest = rest.slice(cut + next.index + next[0].length);
      continue;
    }
    ready.push(piece);
    rest = rest.slice(cut);
  }
  if (final && rest.trim()) {
    ready.push(rest.trim());
    rest = "";
  }
  return { ready, rest };
}

/** What the voice should read: no markdown marks, no bullets. */
export function speakable(text: string): string {
  return text.replace(/[*_`#>]+/g, "").replace(/^\s*[-•]\s+/gm, "").replace(/\s+/g, " ").trim();
}
