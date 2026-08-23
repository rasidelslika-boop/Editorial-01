import type { MuseDetails } from "../types";

/* ------------------------------------------------------------------ */
/*  The muse trait system — pools, rollers and measurement options.   */
/*  Every field rolls independently so traits can be locked while     */
/*  others are re-rolled.                                             */
/* ------------------------------------------------------------------ */

export const EMPTY_MUSE: MuseDetails = {
  hairstyle: "",
  hairColor: "",
  heightIn: null,
  weightLb: null,
  bust: "",
  waistIn: null,
  hipsIn: null,
  eyeColor: "",
  eyeShape: "",
  skinTone: "",
  undertone: "",
  skinDetail: "",
  faceShape: "",
  faceFeatures: "",
  makeup: "",
  bodyType: "",
  distinctive: "",
  museVibe: "",
};

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randInt(min: number, max: number, step = 1): number {
  const steps = Math.floor((max - min) / step);
  return min + Math.floor(Math.random() * (steps + 1)) * step;
}

export function fmtHeight(inches: number): string {
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

/* ------------------------------ 01 · identity ------------------------------ */

const ETHNICITIES = [
  "Scandinavian",
  "Brazilian",
  "Japanese",
  "Nigerian",
  "Lebanese",
  "Korean",
  "Indian",
  "Italian",
  "Ethiopian",
  "French-Polynesian",
  "Colombian",
  "Ukrainian",
  "Thai",
  "Moroccan",
  "Mexican",
  "Greek",
] as const;

export const MUSE_VIBES = [
  "elegant supermodel",
  "girl-next-door goddess",
  "exotic beauty",
  "ethereal nymph",
  "fierce runway icon",
  "vintage Hollywood glamour",
  "minimalist cool-girl",
  "bohemian muse",
  "regal editorial queen",
  "sun-kissed surfer spirit",
] as const;

/* ------------------------------ 01a · hairstyle ---------------------------- */

export const HAIRSTYLES_TRENDY = [
  "sleek glass bob",
  "long beach waves",
  "high slicked-back bun",
  "curtain bangs with soft layers",
  "blunt lob",
  "voluminous blowout",
  "wet-look slicked hair",
  "tousled shag with wispy bangs",
  "braided crown",
  "sculpted ponytail with hair jewelry",
  "pin-straight middle part",
  "soft romantic updo with face-framing tendrils",
] as const;

export const HAIRSTYLES_FANTASY = [
  "floor-length silver waves with weightless floating strands",
  "braids woven with tiny wildflowers",
  "an iridescent holographic bob",
  "hair sculpted like ocean waves, strung with pearls",
  "a cloud-soft white updo pinned with gold",
  "twin braids wrapped in glowing thread",
  "rose-petal layered locks",
  "a crown of living butterflies resting in the hair",
] as const;

/* --------------------------- 01c · hair colour + texture ------------------- */

export const HAIR_COMBOS = [
  "espresso · glossy straight",
  "platinum · slick",
  "chestnut · soft waves",
  "honey balayage · loose curls",
  "auburn · voluminous blowout",
  "jet black · glass shine",
  "strawberry blonde · beach waves",
  "mocha · bouncy curls",
  "ash brown · tousled shag",
  "champagne · pin-straight",
  "cherry cola · glossy waves",
  "caramel · curtain-framed layers",
] as const;

export const HAIR_COMBOS_FANTASY = [
  "opalescent white · weightless floating",
  "rose-gold metallic · liquid waves",
  "midnight indigo · starlit sheen",
  "molten copper · flame-like volume",
  "lavender mist · cloud curls",
  "gold-leaf sheen · sculpted waves",
] as const;

/* ---------------------------- 01b · measurements ---------------------------- */

export const HEIGHT_OPTIONS = buildRange(56, 81, 1).map((n) => ({ id: String(n), label: fmtHeight(n) }));
export const WEIGHT_OPTIONS = buildRange(85, 250, 5).map((n) => ({ id: String(n), label: `${n} lb` }));
export const WAIST_OPTIONS = buildRange(18, 36, 1).map((n) => ({ id: String(n), label: `${n}"` }));
export const HIPS_OPTIONS = buildRange(30, 50, 1).map((n) => ({ id: String(n), label: `${n}"` }));

function buildRange(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let n = min; n <= max; n += step) out.push(n);
  return out;
}

/** Standard US band + cup combinations. */
export const BUST_COMBOS: string[] = (() => {
  const bands = [30, 32, 34, 36, 38, 40];
  const cups = ["A", "B", "C", "D", "DD", "E", "F"];
  const out: string[] = [];
  for (const band of bands) for (const cup of cups) out.push(`${band}${cup}`);
  return out;
})();
export const BUST_OPTIONS = BUST_COMBOS.map((c) => ({ id: c, label: c }));

/* -------------------------------- 01d · eyes -------------------------------- */

export const EYE_COLORS = [
  "deep espresso",
  "warm hazel",
  "ice blue",
  "emerald",
  "amber",
  "violet-tinged grey",
  "sea-glass green",
  "dark chocolate",
  "storm grey",
  "honey gold",
] as const;

export const EYE_SHAPES = ["almond", "doe-round", "cat-eye", "hooded", "upturned", "siren", "soft monolid", "deep-set"] as const;

/* ------------------------------ 01e · complexion ---------------------------- */

export const SKIN_TONES = [
  "porcelain",
  "ivory",
  "warm beige",
  "golden tan",
  "olive",
  "caramel",
  "honey",
  "bronze",
  "warm mahogany",
  "deep ebony",
  "rose-tinted fair",
  "sun-kissed medium",
] as const;

export const UNDERTONES = ["cool", "warm", "neutral", "golden"] as const;

export const SKIN_DETAILS = [
  "none — flawless matte",
  "a constellation of subtle freckles",
  "a luminous dewy glow",
  "a soft velvet finish",
  "a faint beauty shimmer",
  "natural bare skin",
  // Editorial beauty-finale finishes — genuine fashion-photography genres.
  "a glossy wet-look, skin glistening as if just emerged from water",
  "fine water droplets beading across the skin and collarbones",
  "skin glazed with slow-dripping amber honey, high-fashion beauty styling",
] as const;

/** Roll a skin finish — including the editorial wet/honey finishes. */
export function rollSkinDetail(): string {
  return pick(SKIN_DETAILS.filter((d) => d !== "none — flawless matte"));
}

/* ----------------------------- 01f · face & makeup -------------------------- */

export const FACE_SHAPES = ["oval", "heart", "sculpted diamond", "soft round", "elegant oblong", "defined square", "gentle pear"] as const;

export const FACE_FEATURES = [
  "high cheekbones",
  "a delicate jawline",
  "full lips",
  "a graceful arched brow",
  "a refined nose",
  "dimpled cheeks",
  "a sculpted cupid's bow",
  "striking symmetry",
] as const;

export const MAKEUP_LEVELS = [
  "bare no-makeup",
  "natural glow",
  "soft glam",
  "editorial bold",
  "graphic liner statement",
  "classic red-lip glamour",
] as const;

/* ------------------------------ 01g · body type ----------------------------- */

export const BODY_TYPES = [
  "hourglass",
  "athletic",
  "soft curvy",
  "slim and willowy",
  "statuesque",
  "toned ballerina",
  "petite",
  "gracefully full-figured",
  "lean runway",
  "balanced classic",
] as const;

/* --------------------------- 01h · distinctive details ----------------------- */

export const DISTINCTIVE_DETAILS = [
  "none",
  "a dimple on the left cheek",
  "a beauty mark by the lip",
  "a tiny star tattoo on the collarbone",
  "a delicate nose stud",
  "freckles dusted across the nose",
  "a single pearl ear cuff",
  "a fine-line wrist tattoo",
  "a small crescent-moon tattoo behind the ear",
] as const;

/* ------------------- Composed custom rollers (01a–01i boxes) ------------------- */
/*  These build a fresh phrase from part-pools every press, so the result is   */
/*  a unique description that never just selects one of the preset chips.      */

function twoDistinct<T>(arr: readonly T[]): [T, T] {
  const i = Math.floor(Math.random() * arr.length);
  let j = Math.floor(Math.random() * (arr.length - 1));
  if (j >= i) j++;
  return [arr[i], arr[j]];
}

const HAIR_CUTS = [
  "a sleek high ponytail",
  "a sculpted wet-look bob",
  "long layered waves",
  "a blunt chin-length bob",
  "a voluminous blowout",
  "tousled shag layers",
  "a braided crown updo",
  "soft romantic curls",
  "a glass-smooth middle part",
  "an undone chignon",
  "beach-textured waves",
  "a retro Hollywood wave set",
] as const;
const HAIR_FINISHES = [
  "with wispy face-framing tendrils",
  "with a deep side part",
  "with pinned-back volume at the crown",
  "with a velvet ribbon detail",
  "with tucked-behind-the-ear strands",
  "with mirror shine and feathered ends",
  "with a windswept lift",
  "with jeweled hairpin accents",
  "with a light texturizing mist",
  "with braided under-layers",
] as const;
export const rollHairstyleCustom = () => `${pick(HAIR_CUTS)} ${pick(HAIR_FINISHES)}`;

const HAIR_F_CUTS = [
  "floor-length silver waves",
  "an iridescent holographic bob",
  "braids woven with starlight thread",
  "a cloud-soft white updo",
  "rose-gold liquid waves",
  "a crown of sculpted petals",
  "midnight-indigo waves",
  "a gravity-defying floating mane",
] as const;
const HAIR_F_FINISHES = [
  "strung with tiny pearls",
  "dusted with gold leaf",
  "with weightless floating strands",
  "pinned with moonstone clips",
  "glowing faintly at the tips",
  "with living butterfly ornaments",
  "cascading like a slow waterfall",
  "threaded with fine silver chain",
] as const;
export const rollHairstyleFantasy = () => `${pick(HAIR_F_CUTS)} ${pick(HAIR_F_FINISHES)}`;

const HAIR_COLOR_POOL = [
  "espresso", "platinum", "chestnut", "honey balayage", "auburn", "jet black",
  "strawberry blonde", "mocha", "ash brown", "champagne", "cherry cola",
  "caramel", "rose gold", "silver smoke",
] as const;
const HAIR_TEXTURE_POOL = [
  "glossy straight", "soft waves", "loose curls", "sleek and slick",
  "voluminous blowout", "beach waves", "tousled shag", "pin-straight",
  "bouncy curls", "glass shine", "liquid waves",
] as const;
export const rollHairCombo = () => `${pick(HAIR_COLOR_POOL)} · ${pick(HAIR_TEXTURE_POOL)}`;

const HAIR_F_COLOR_POOL = [
  "opalescent white", "rose-gold metallic", "midnight indigo", "molten copper",
  "lavender mist", "gold-leaf", "sea-glass green", "aurora-shifting",
] as const;
const HAIR_F_TEXTURE_POOL = [
  "weightless floating", "liquid waves", "cloud curls", "starlit sheen",
  "flame-like volume", "sculpted waves",
] as const;
export const rollHairComboFantasy = () => `${pick(HAIR_F_COLOR_POOL)} · ${pick(HAIR_F_TEXTURE_POOL)}`;

const EYE_LIGHT = [
  "heavy dark lashes",
  "a soft golden catchlight",
  "a subtle smoky outer corner",
  "lifted outer corners",
  "a fine graphic liner",
  "a dewy lower-lid shimmer",
  "long fluttering lashes",
  "a clean bare lash line",
] as const;
export const rollEyesCustom = () => `${pick(EYE_SHAPES)} ${pick(EYE_COLORS)} eyes with ${pick(EYE_LIGHT)}`;

const SKIN_FINISH_POOL = [
  "a luminous dewy glow",
  "a soft velvet finish",
  "a constellation of subtle freckles",
  "a faint beauty shimmer",
  "a natural bare radiance",
  "a hydrated glass-skin sheen",
] as const;
export const rollSkinCustom = () =>
  `${pick(SKIN_TONES)} skin with a ${pick(UNDERTONES)} undertone and ${pick(SKIN_FINISH_POOL)}`;

export const rollFaceCustom = () => {
  const [f1, f2] = twoDistinct(FACE_FEATURES);
  return `${pick(FACE_SHAPES)} face with ${f1} and ${f2}, ${pick(MAKEUP_LEVELS)} makeup`;
};

const BODY_BUILD = [
  "an hourglass", "an athletic", "a soft curvy", "a slim willowy", "a statuesque",
  "a toned ballerina", "a petite", "a lean runway", "a classic balanced", "a gracefully full",
] as const;
const BODY_LINES = [
  "a long elegant leg line",
  "toned shoulders",
  "a graceful neck and collarbones",
  "soft natural curves",
  "a statuesque posture",
  "a delicate frame",
  "strong athletic definition",
  "a fluid dancer's carriage",
] as const;
export const rollBodyCustom = () => `${pick(BODY_BUILD)} figure with ${pick(BODY_LINES)}`;

const DETAIL_POOL = [
  "a dimple on the left cheek",
  "a beauty mark above the lip",
  "a tiny star tattoo on the collarbone",
  "a delicate nose stud",
  "freckles dusted across the nose",
  "a single pearl ear cuff",
  "a fine-line wrist tattoo",
  "a small crescent-moon tattoo behind the ear",
  "a faint editorial scar through the brow",
  "a dermal sparkle at the cheekbone",
  "a thin gold anklet",
  "lace-fine henna on one hand",
] as const;
export const rollDistinctiveCustom = () => {
  const [d1, d2] = twoDistinct(DETAIL_POOL);
  return `${d1} and ${d2}`;
};

const VIBE_PRIMARY = [
  "elegant supermodel", "girl-next-door goddess", "exotic beauty", "ethereal nymph",
  "fierce runway icon", "vintage Hollywood glamour", "minimalist cool-girl",
  "bohemian muse", "regal editorial queen", "sun-kissed free spirit",
] as const;
const VIBE_SECOND = [
  "a hint of mischief",
  "old-money poise",
  "an effortless off-duty ease",
  "a quiet mysterious edge",
  "radiant warmth",
  "untamed confidence",
  "a dreamy softness",
  "a fearless rock-and-roll attitude",
] as const;
export const rollVibeCustom = () => {
  const p = pick(VIBE_PRIMARY);
  const art = /^[aeiou]/i.test(p) ? "an" : "a";
  return `${art} ${p} presence with ${pick(VIBE_SECOND)}`;
};

/* --------------------------------- Rollers ---------------------------------- */

/** Re-cast the muse entirely — a new breathtaking 21-year-old, head to toe. */
export function rollMuse(): { model: string; details: MuseDetails } {
  const details: MuseDetails = {
    hairstyle: pick(HAIRSTYLES_TRENDY),
    hairColor: pick(HAIR_COMBOS),
    heightIn: randInt(60, 74),
    weightLb: randInt(90, 170, 5),
    bust: pick(BUST_COMBOS),
    waistIn: randInt(20, 32),
    hipsIn: randInt(32, 46),
    eyeColor: pick(EYE_COLORS),
    eyeShape: pick(EYE_SHAPES),
    skinTone: pick(SKIN_TONES),
    undertone: pick(UNDERTONES),
    skinDetail: pick(SKIN_DETAILS),
    faceShape: pick(FACE_SHAPES),
    faceFeatures: pick(FACE_FEATURES),
    makeup: pick(MAKEUP_LEVELS),
    bodyType: pick(BODY_TYPES),
    distinctive: pick(DISTINCTIVE_DETAILS),
    museVibe: pick(MUSE_VIBES),
  };
  return { model: `a breathtaking 21-year-old ${pick(ETHNICITIES)} woman`, details };
}

/** Roll only the 01b measurements, across a wide creative range. */
export function rollMeasurements(): Pick<MuseDetails, "heightIn" | "weightLb" | "bust" | "waistIn" | "hipsIn"> {
  return {
    heightIn: randInt(56, 81),
    weightLb: randInt(85, 250, 5),
    bust: pick(BUST_COMBOS),
    waistIn: randInt(18, 36),
    hipsIn: randInt(30, 50),
  };
}

/* ------------------------------ 02 · the setting ----------------------------- */

export const RANDOM_SETTINGS = [
  "an empty seamless white photo studio, single strobe, infinite negative space",
  "a raw concrete studio loft with tall north-facing windows",
  "a lavish five-star hotel ballroom, crystal chandeliers and gilded mirrors",
  "a private white-sand beach cove at golden hour",
  "a weathered timber fishing shack on stilts, paint peeling in the salt air",
  "an abandoned factory hall, rusted machinery and shafts of dust-filled light",
  "a vast desert wasteland with a lone burnt-out car",
  "a grand opera house, rows of empty velvet seats",
  "a rain-soaked neon market alley, steam rising from food stalls",
  "a brutalist parking structure at dusk",
  "a field of wildflowers at the edge of an approaching storm",
  "a vintage laundromat humming under fluorescent light",
  "a palatial riad courtyard with zellige tile and marble fountains",
  "a fog-wrapped pine forest at first light",
  "a rooftop infinity pool overlooking a city skyline",
  "a dusty roadside gas station under a violet sky",
  "a candlelit library of towering dark-wood shelves",
  "an orchard of blossoming cherry trees, petals drifting",
] as const;

export const FANTASY_SETTINGS = [
  "a floating marble palace above a sea of clouds at sunrise",
  "a bioluminescent crystal cavern with mirrored pools",
  "a frozen aurora cathedral with walls of green ice",
  "a sunken golden temple beneath turquoise water, light rays piercing down",
  "a grove of giant glowing mushrooms at violet dusk",
  "a celestial observatory with a spiral staircase into the stars",
  "an enchanted rose labyrinth under twin moons",
  "a throne room grown from a single ancient redwood",
  "a desert of black glass beneath a shattered moon",
  "an underwater ballroom lit by jellyfish chandeliers",
  "a hanging garden suspended between waterfalls of light",
  "a palace of mirrors at the edge of a silver desert",
] as const;

/* --------------------- Series & Seq — pose drawing + wardrobe steps --------------------- */

/**
 * Series vocabulary — the full range of editorial body language: static
 * stances, floor work, frozen action, and in-motion frames.
 */
export const SERIES_POSES = [
  "standing tall, weight on one hip, chin lifted, a commanding full-length stance",
  "crouching low with knees bent, elbows resting on knees, street-style attitude",
  "lying flat on her back, limbs relaxed and elongated, shot from directly above",
  "lying on her side propped on one elbow, a languid editorial repose",
  "frozen mid-air in a full jump, feet off the ground, hair and fabric suspended",
  "walking briskly toward the camera mid-stride, coat and fabric caught in motion",
  "caught mid-spin, dress fanning out like a halo, hair in flight",
  "sitting on the floor with legs crossed, elbows on knees, intimate and unguarded",
  "leaning back against a wall with ankles crossed, hands loose in pockets",
  "kneeling on one knee, back arched, chin tipped toward the light",
  "running in profile at full sprint, a pure action shot",
  "perched on the edge of a step, legs dangling, caught between frames",
  "twirling with one arm raised, skirt flaring, pure movement",
  "striding away from the camera, coat swinging, glancing back over the shoulder",
] as const;

export const SERIES_FRAMINGS = [
  "full-length wide frame",
  "three-quarter editorial crop",
  "medium shot from the waist up",
  "low-angle power framing",
  "high-angle fashion crop",
  "tight environmental frame",
] as const;

export const SERIES_EXPRESSIONS = [
  "a fierce direct stare into the lens",
  "laughing unguarded, caught mid-moment",
  "a serene gaze just past the camera",
  "a smouldering over-the-shoulder look",
  "eyes closed, chin lifted to the sky",
  "head thrown back in full laughter",
  "cool and unbothered, utterly at ease",
  "a surprised wide-eyed glance",
] as const;

export const MOTION_MODIFIERS = [
  "tack-sharp frozen motion, every edge crisp",
  "slight motion blur on the moving limbs only, face perfectly sharp",
  "shutter-drag streaks trailing behind her, subject sharp",
  "1/30s handheld energy with subtle movement blur",
] as const;

/** The unexpected-results deck — drawn occasionally for surprise frames. */
export const WILDCARD_FRAMES = [
  "shot from behind, walking away, a single glance back over her shoulder",
  "a dramatic pure-profile silhouette against the setting",
  "candid and off-guard, adjusting her hair mid-motion",
  "composed in a mirror or window reflection, the reflection framing the shot",
  "an extreme low worm's-eye view, towering over the camera",
] as const;

/**
 * Draw `n` series frames — poses, expressions, framings and motion treatments
 * never repeat within a shoot, and 1–2 frames are pulled from the wildcard
 * deck for genuinely unexpected results.
 */
export function drawSeriesFrames(n: number): import("../types").SeriesFrame[] {
  const frames: import("../types").SeriesFrame[] = [];
  const usedPoses = new Set<string>();
  const usedExpressions = new Set<string>();
  const wildcardBudget = n >= 5 ? 2 : 1;
  let wildcardsUsed = 0;

  for (let i = 0; i < n; i++) {
    if (wildcardsUsed < wildcardBudget && Math.random() < 0.25) {
      wildcardsUsed++;
      frames.push({
        pose: pick(WILDCARD_FRAMES),
        expression: pick(SERIES_EXPRESSIONS),
        framing: pick(SERIES_FRAMINGS),
        motion: "",
        wildcard: true,
      });
      continue;
    }

    let pose = pick(SERIES_POSES);
    for (let guard = 0; usedPoses.has(pose) && guard < 14; guard++) pose = pick(SERIES_POSES);
    usedPoses.add(pose);

    let expression = pick(SERIES_EXPRESSIONS);
    for (let guard = 0; usedExpressions.has(expression) && guard < 8; guard++) expression = pick(SERIES_EXPRESSIONS);
    usedExpressions.add(expression);

    // Action poses usually earn a motion treatment; static ones rarely do.
    const actiony = /jump|walk|run|spin|stride|sprint|twirl|mid-air/i.test(pose);
    const motion = actiony && Math.random() < 0.65 ? pick(MOTION_MODIFIERS) : Math.random() < 0.15 ? pick(MOTION_MODIFIERS) : "";

    frames.push({ pose, expression, framing: pick(SERIES_FRAMINGS), motion });
  }
  return frames;
}

/** Draw `n` distinct poses (Fisher–Yates shuffle), never repeating the avoided one first. */
export function drawPoses(n: number, avoid?: string): string[] {
  const pool = [...RANDOM_POSES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out = pool.filter((p) => p !== avoid).slice(0, n);
  while (out.length < n) out.push(pick(RANDOM_POSES));
  return out;
}

/**
 * Wardrobe progression for the Seq shooter — REMOVE direction.
 * Plate 0 keeps the starting outfit; each subsequent step pares the styling
 * back one editorial layer. Everything stays in professional fashion vocabulary
 * so renders stay within platform content moderation.
 */
export const REMOVE_STEPS = [
  "the same look pared back — outer layers removed, base garments only",
  "a minimalist silk slip dress, clean editorial styling",
  "an elegant fitted bodysuit with refined editorial styling",
  "a tasteful high-waisted two-piece swim ensemble, chic editorial styling",
  "a sculptural draped-fabric wrap, artistic couture styling, tasteful and elegant",
] as const;

/** Wardrobe progression for the Seq shooter — ADD direction, layering up to full couture. */
export const ADD_STEPS = [
  "the same look with a structured tailored blazer added",
  "the look with a dramatic statement coat, gloves and belt",
  "the look with a couture overskirt and sweeping train added",
  "the fully maximalist couture version — layered fabrics, jewelry and headpiece",
  "an avant-garde sculptural couture extension with architectural layers",
] as const;

/* ------------------------------- One-click composers ------------------------------- */
/*  "Masterpiece" and "Analog" build a complete, self-contained brief from scratch    */
/*  and bypass every form setting. Each press rolls a fresh combination.              */

const MP_MUSES = [
  "a breathtaking 21-year-old Scandinavian supermodel with luminous porcelain skin, sculpted high cheekbones and piercing ice-blue eyes",
  "a striking 24-year-old editorial model with golden-bronze skin, a statuesque frame and expressive amber eyes",
  "an ethereal 22-year-old haute-couture muse with flawless ivory skin, a swan-like neck and delicate arched brows",
  "a radiant 23-year-old cover model with warm caramel skin, freckles dusting her nose and deep espresso eyes",
  "an elegant 25-year-old runway icon with alabaster skin, sharp jawline and smouldering dark eyes",
] as const;

const MP_HAIR = [
  "hair swept into a sleek high-gloss chignon with wispy face-framing tendrils",
  "long platinum waves caught mid-motion with a healthy luminous sheen",
  "a sculpted wet-look bob, immaculately slicked and glass-smooth",
  "soft romantic curls pinned up loosely with gilded tendrils escaping",
  "a flawless center-parted curtain of silk-straight dark hair",
] as const;

const MP_COUTURE = [
  "an architectural liquid-silver couture gown with dramatic sculpted shoulders",
  "a bias-cut champagne silk slip gown that pours over every line",
  "an avant-garde sculptural white gown with origami pleating and a sweeping train",
  "a jewel-toned emerald velvet gown with a plunging neckline and opera gloves",
  "a couture black tulle gown layered with hand-sewn crystal beading",
] as const;

const MP_SETTINGS = [
  "a minimalist infinity-cove studio suffused with soft directional light",
  "a gilded Parisian ballroom at golden hour, light spilling through tall windows",
  "a monumental brutalist atrium with a single dramatic shaft of daylight",
  "a mirror-still salt flat at dusk beneath a violet-and-amber sky",
  "a grand marble staircase in a palatial hotel, lit by crystal chandeliers",
] as const;

const MP_LIGHTING = [
  "lit with a single soft diffused beauty dish for flawless, dimensional glow",
  "sculpted by dramatic chiaroscuro from one hard directional source",
  "bathed in warm golden-hour rim light with gentle falloff into shadow",
  "wrapped in high-key seamless light, airy and luminous",
  "lit with cinematic three-point glamour lighting, crisp and refined",
] as const;

const MP_CAMERAS = [
  "shot on Phase One IQ4 150MP medium format, 80mm ƒ/2.8, breathtaking resolution",
  "shot on Hasselblad H6D-100c, 120mm macro, tack-sharp with creamy tonality",
  "captured on a 100-megapixel medium format digital back, 110mm ƒ/2, 8k detail",
  "shot on Canon EOS R5 with an 85mm ƒ/1.2L prime, flawless bokeh",
  "captured on Leica SL2-S with a 75mm Summilux, exquisite micro-contrast",
] as const;

const MP_REFERENCES = [
  "in the style of Vogue Italia, art direction by Steven Meisel",
  "in the style of Harper's Bazaar, timeless high-glamour polish",
  "in the style of W Magazine, bold contemporary couture editorial",
  "in the style of Vogue Paris, effortless sophisticated elegance",
  "in the style of a global luxury campaign, immaculate retouching",
] as const;

const MP_FINISH = [
  "ultra-high-definition, immaculate skin detail, refined colour grade, professional fashion photography, 8k",
  "hyper-detailed, flawless retouching, luxurious tonal range, award-winning editorial quality, 8k",
  "masterful composition, razor-sharp focus, cinematic depth, museum-grade print quality, 8k",
] as const;

/** Roll the absolute-best-possible AI fashion photograph — a complete, self-contained brief. */
export function rollMasterpiecePrompt(): string {
  return (
    `Masterpiece fashion editorial photograph of ${pick(MP_MUSES)}, ${pick(MP_HAIR)}, ` +
    `wearing ${pick(MP_COUTURE)}, ${pick(RANDOM_POSES)}, set in ${pick(MP_SETTINGS)}, ` +
    `${pick(MP_LIGHTING)}, ${pick(MP_CAMERAS)}, ${pick(MP_REFERENCES)}, ${pick(MP_FINISH)}`
  );
}

const AN_CAMERAS = [
  "shot on a vintage Hasselblad 500C/M loaded with Kodak Portra 400 film",
  "captured on a classic Leica M6 with Ilford HP5 Plus black-and-white film",
  "shot on a 1970s Nikon FM2 with Fuji Superia 400, natural grain",
  "captured on a Rolleiflex twin-lens reflex with Kodak Tri-X 400",
  "shot on a Polaroid SX-70, instant film with soft organic tones",
] as const;

const AN_LIGHT = [
  "lit by a single analog bulb flash, hard and honest with deep shadows",
  "available window light only, soft and natural, no strobes",
  "a bare tungsten bulb overhead, warm and unpolished",
  "overcast daylight, flat and truthful, straight off the negative",
  "late-afternoon sun through a dusty window, warm and unretouched",
] as const;

const AN_SUBJECTS = [
  "a naturally beautiful young woman, bare-faced with minimal makeup and real skin texture",
  "a fresh-faced model with no retouching, honest skin and unstyled hair",
  "a girl-next-door muse, natural features, no cosmetics, relaxed and unposed",
  "a young woman in her own clothes, candid expression, genuine and unguarded",
] as const;

const AN_SETTINGS = [
  "a plain white seamless backdrop in a small working studio",
  "a sunlit kitchen with worn wooden counters",
  "the back seat of an old car, window light raking across",
  "a quiet street corner on an overcast afternoon",
  "a bare apartment with one tall window",
] as const;

const AN_PROCESS = [
  "darkroom-processed silver gelatin print with authentic film grain and soft tonal gradation",
  "hand-printed in the darkroom, gentle contrast, honest blacks and breathing highlights",
  "developed and scanned straight off the negative, subtle grain, true-to-life colour",
  "a darkroom print with slight vignette, organic grain and a timeless analogue warmth",
] as const;

/** Roll the most real-life analog film photograph — simple, natural, unretouched. */
export function rollAnalogPrompt(): string {
  return (
    `Authentic analog fashion photograph of ${pick(AN_SUBJECTS)}, ${pick(RANDOM_POSES)}, ` +
    `set in ${pick(AN_SETTINGS)}, ${pick(AN_LIGHT)}, ${pick(AN_CAMERAS)}, ${pick(AN_PROCESS)}, ` +
    `pleasingly natural, simple and sincere, no digital retouching, real-life photography`
  );
}

/* -------------------------------- 04 · the pose ------------------------------ */

export const RANDOM_POSES = [
  "standing full-length, weight on one hip, chin lifted, commanding presence",
  "walking toward camera mid-stride, fabric caught in motion",
  "reclining on a chaise longue, elongated limbs, relaxed tension",
  "extreme close-up beauty crop at jaw and brow",
  "dynamic movement, fabric tossed and frozen in air",
  "back turned, looking over the shoulder",
  "seated on the floor, elbows on knees, intimate framing",
  "perched on the edge of a marble staircase",
  "mid-twirl, hair fanning out like a halo",
  "draped across the hood of a vintage car",
  "kneeling in tall grass, hands loose",
  "caught laughing, head tilted back",
  "standing in a doorway, backlit silhouette",
  "walking through shallow surf, skirt lifted",
] as const;

/* -------------------------------- 03 · the look ------------------------------ */

/** The top ten trending looks in contemporary fashion photography. */
export const TRENDY_LOOKS = [
  "quiet luxury — tailored camel cashmere, fine ribbed knit, minimal gold jewellery",
  "balletcore — wrapped satin bodysuit, leg warmers, soft tulle layers",
  "mob-wife glamour — vintage fur, bold gold, animal print, a deep red lip",
  "office siren — fitted pencil skirt, sheer blouse, pointed heels, tortoiseshell glasses",
  "coquette — lace, ribbons and bows in a palette of blush and cream",
  "nineties minimalism — a bias-cut slip dress, clean lines, barely-there makeup",
  "gorpcore — technical shell and cargo silhouettes, hiking boots styled up",
  "cowboy-core — fringe, raw denim, turquoise, a wide-brim hat",
  "metallic futurism — liquid chrome and reflective fabrics, sculptural silhouettes",
  "coastal grandmother — crisp linen, pearls, relaxed tailoring",
] as const;

/** Timeless editorial classics for the Classic roller. */
export const CLASSIC_LOOKS = [
  "a little black dress, timeless elegance",
  "a crisp white shirt with high-waisted tailored trousers",
  "a belted trench coat, collar up",
  "a bouclé jacket with a knee-length skirt, pearls",
  "a silk blouse and pleated midi skirt",
  "a column gown in ivory crepe",
  "a double-breasted blazer, nothing beneath",
  "a knit turtleneck with wide-leg trousers",
  "a strapless cocktail dress in classic red",
  "a tweed suit, boxy and elegant",
] as const;

/** Avant-garde and unexpected for the Wild roller. */
export const WILD_LOOKS = [
  "an avant-garde sculptural gown with exaggerated architectural shoulders",
  "a deconstructed couture piece in unexpected mixed materials",
  "an oversized paper-bag silhouette in electric tangerine",
  "a couture cape of layered iridescent organza",
  "a sculptural pleated ensemble frozen mid-motion",
  "a mirror-tile mosaic bodysuit, fractured reflections",
  "an enormous ruffled taffeta ballgown, off-kilter proportions",
  "a wearable sculpture of chrome and tulle",
  "a patchwork couture coat of vintage textiles",
  "an asymmetric draped jersey look, one shoulder bare",
] as const;

/** Confident, alluring editorial styling — glamorous and tasteful. */
export const HOT_LOOKS = [
  "a fitted liquid-satin slip dress with a daring thigh-high slit, confidence in every line",
  "a form-fitting bandeau top with high-waisted satin trousers, magnetic presence",
  "a sheer-panel evening gown, alluring yet elegant",
  "a corseted bodice with a flowing skirt, hourglass silhouette",
  "a plunging velvet jumpsuit, statuesque and poised",
  "a body-skimming ribbed knit column dress, effortless allure",
  "an open-back halter gown with a dramatic train",
  "a lace-trimmed silk slip and sheer robe, boudoir elegance",
  "a sculpted leather bustier with tailored trousers, fierce glamour",
  "a draped jersey goddess gown clinging to every curve",
] as const;
