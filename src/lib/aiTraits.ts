/**
 * Live AI trait generation. The dice / Random / Fantasy / Wild / Hot buttons
 * call a free text model (Pollinations text API — no key required) so every
 * press returns something genuinely new instead of cycling a finite pool.
 *
 * If the model is unreachable or throttled, the curated local pools take
 * over, de-duplicated against a recent-roll memory so even the fallback
 * avoids immediate repeats.
 */

const TEXT_ENDPOINT = "https://text.pollinations.ai/";
const MODEL = "openai";
const TIMEOUT = 12_000;

/** Recent outputs, so neither the model nor the fallback repeats itself. */
const memory = new Set<string>();

function remember(value: string) {
  memory.add(value.toLowerCase());
  if (memory.size > 60) {
    const oldest = memory.values().next().value;
    if (oldest) memory.delete(oldest);
  }
}

function sanitize(raw: string): string {
  const line = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)[0];
  if (!line) return "";
  return line
    .replace(/^["'`*\-–—\d.)\s]+/, "")
    .replace(/["'`*]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function callModel(instruction: string): Promise<string | null> {
  const prompt =
    "You are a fashion photographer's creative assistant. Reply with ONLY the requested phrase — no quotes, no lists, no explanation, one line, under 14 words, completely fresh and never generic.\n" +
    instruction;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    const res = await fetch(
      `${TEXT_ENDPOINT}${encodeURIComponent(prompt)}?model=${MODEL}&private=true&seed=${Math.floor(Math.random() * 1e9)}`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = sanitize(await res.text());
    return text.length >= 3 && text.length <= 180 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Roll one trait with the live model. `fallback` is the curated local pool,
 * used only when the model can't answer (and is itself de-duplicated).
 */
export async function aiTrait(opts: { describe: string; fallback: () => string }): Promise<string> {
  let result = await callModel(opts.describe);
  if (result && memory.has(result.toLowerCase())) {
    // Seen before — ask once more for something entirely different.
    result = await callModel(`${opts.describe} It must be completely different from: "${result}".`);
  }
  if (result) {
    remember(result);
    return result;
  }
  for (let i = 0; i < 6; i++) {
    const local = opts.fallback();
    if (!memory.has(local.toLowerCase())) {
      remember(local);
      return local;
    }
  }
  const local = opts.fallback();
  remember(local);
  return local;
}

/**
 * Re-cast the whole muse dossier in a single model call — returns the eight
 * trait lines, or null so the caller can fall back to the local rollers.
 */
export async function aiMuseBlock(): Promise<Record<string, string> | null> {
  const prompt =
    "You are a fashion photographer's creative assistant. Describe a completely new, breathtaking 21-year-old fashion model. Reply with EXACTLY 8 lines, nothing else, each a short phrase:\n" +
    "1. hairstyle\n" +
    "2. hair colour and texture (format: colour · texture)\n" +
    "3. eye colour and shape (format: shape colour eyes)\n" +
    "4. skin tone, undertone and finish in one phrase\n" +
    "5. face shape, standout features and makeup in one phrase\n" +
    "6. body type descriptor\n" +
    "7. one subtle distinctive detail (dimples, mole, tiny tattoo or piercing)\n" +
    "8. overall muse vibe";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    const res = await fetch(
      `${TEXT_ENDPOINT}${encodeURIComponent(prompt)}?model=${MODEL}&private=true&seed=${Math.floor(Math.random() * 1e9)}`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const lines = (await res.text())
      .split("\n")
      .map((l) => l.replace(/^\s*[-•*\d.)]+\s*/, "").replace(/^["'`]+|["'`]+$/g, "").trim())
      .filter((l) => l.length > 2);
    if (lines.length < 8) return null;
    return {
      hairstyle: lines[0],
      hairColor: lines[1],
      eyes: lines[2],
      skin: lines[3],
      face: lines[4],
      bodyType: lines[5],
      distinctive: lines[6],
      museVibe: lines[7],
    };
  } catch {
    return null;
  }
}

/** A fresh model identity line — "a breathtaking 21-year-old … woman". */
export async function aiIdentity(fallback: () => string): Promise<string> {
  const result = await callModel(
    "An identity phrase for a completely new breathtaking 21-year-old fashion model from a random part of the world. Start with 'a', e.g. 'a breathtaking 21-year-old Colombian woman'. A fresh origin every time."
  );
  if (result) {
    remember(result);
    return result;
  }
  return fallback();
}
