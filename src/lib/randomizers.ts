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
] as const;

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
