import type { EngineId, FormState, RatioId } from "../types";

export interface Preset {
  label: string;
  value: string;
}

/* ---------------------------------- 01 · The Muse ---------------------------------- */

export const MODEL_PRESETS: Preset[] = [
  {
    label: "Vogue Cover Model",
    value:
      "a striking 24-year-old Scandinavian female supermodel, porcelain skin, sculpted cheekbones, ice-blue eyes, slicked-back platinum blonde hair, flawless dewy base with a bold red lip",
  },
  {
    label: "High-Fashion Androgynous",
    value:
      "an androgynous model in their early twenties, sharp jawline, cropped black hair, strong defined brows, lean silhouette, minimal matte makeup",
  },
  {
    label: "Editorial Beauty",
    value:
      "a 28-year-old Brazilian model, warm caramel skin, freckles across the nose, dark espresso waves, glossy nude makeup, luminous hydrated skin",
  },
  {
    label: "Street-Style Muse",
    value:
      "a confident East Asian model with a blunt black bob, glass skin, graphic eyeliner, effortless cool energy",
  },
  {
    label: "Silver-Age Icon",
    value:
      "an elegant 60-year-old model, silver hair swept into an updo, luminous mature skin, statement gold earrings, subtle rose makeup",
  },
  {
    label: "Freckled Redhead",
    value:
      "a pale-skinned redhead with copper coils, constellation freckles, green eyes, barely-there makeup",
  },
  {
    label: "Golden-Hour Bombshell",
    value:
      "a sun-kissed 26-year-old Brazilian bombshell, cascading chestnut waves, honey-gold skin, a cat-eye flick and a glossy brick-red lip",
  },
  {
    label: "Parisian Chic",
    value:
      "an effortlessly chic 23-year-old Parisienne with a blunt black bob, straight brows, a natural flushed cheek and that je-ne-sais-quoi ease",
  },
  {
    label: "Desert Nomad Muse",
    value:
      "a bronzed 25-year-old model of Moroccan heritage, kohl-rimmed almond eyes, dark braids wrapped in gold thread, luminous sun-warmed skin",
  },
  {
    label: "Ice Queen Couture",
    value:
      "an ethereal 22-year-old Ukrainian model, white-platinum hair sculpted into a high bun, alabaster skin, glassy pale-blue eyes, frosted nude makeup",
  },
  {
    label: "Classic Hollywood Glamour",
    value:
      "an old-Hollywood 27-year-old beauty, deep side-parted waves, porcelain skin, drawn-on beauty mark, vermilion lipstick and winged liner",
  },
  {
    label: "Minimalist Cool-Girl",
    value:
      "an understated 21-year-old East Asian model, sleek center-parted hair, clean bare skin, straight-cut brows, a quiet magnetic composure",
  },
  {
    label: "Renaissance Muse",
    value:
      "a Botticelli-esque 24-year-old Italian muse, copper-red ringlets, soft ivory skin, rosebud lips, wide serene hazel eyes",
  },
  {
    label: "Punk Editorial",
    value:
      "a bold 23-year-old with a shaved-undercut buzz, bleached brows, a dusting of fake freckles and a matte scarlet lip",
  },
  {
    label: "Ballet-Inspired Grace",
    value:
      "a poised 22-year-old ballerina-turned-model, a flawless low bun, swan-like neck, dewy skin, softly flushed cheeks",
  },
  {
    label: "Mediterranean Siren",
    value:
      "a statuesque 25-year-old Greek model, olive skin, dark glossy waves, strong brows, a deep wine lip",
  },
  {
    label: "Nordic Frost",
    value:
      "a porcelain 23-year-old Icelandic model, pale freckled skin, ash-blonde braids, ice-grey eyes, barely-there makeup",
  },
  {
    label: "Safari-Chic Adventurer",
    value:
      "a tanned 24-year-old South African model, windswept caramel curls, warm brown eyes, a bronzed glow and a natural bitten-berry lip",
  },
  {
    label: "Art-Deco Flapper",
    value:
      "a sculpted 26-year-old with finger-waved dark hair, a cupid's-bow crimson lip, smoky kohl eyes and a jewelled headband",
  },
  {
    label: "Avant-Garde Icon",
    value:
      "a striking 24-year-old with a sculptural buzz cut and painted-on brows, striking bone structure, graphic silver liner",
  },
];

export const EXPRESSION_PRESETS: string[] = [
  "serene gaze just past the lens",
  "fierce, direct stare into camera",
  "soft unguarded smile",
  "pensive, eyes closed",
  "laughing mid-motion",
  "smouldering over-the-shoulder glance",
];

/* --------------------------------- 02 · The Setting --------------------------------- */

export const LOCATION_PRESETS: Preset[] = [
  {
    label: "Parisian Rooftop, Golden Hour",
    value: "a zinc Parisian rooftop with chimney pots, the Eiffel Tower soft in the haze, golden-hour glow",
  },
  {
    label: "Minimalist Infinity Studio",
    value: "a seamless white infinity cove studio, generous negative space, gallery quiet",
  },
  {
    label: "Cyberpunk Tokyo Night",
    value: "a rain-slicked Shinjuku backstreet, neon kanji signage, steam rising from vents, wet reflections",
  },
  {
    label: "Icelandic Black Sand Beach",
    value: "Reynisfjara black volcanic sand, basalt columns, low arctic light, sea mist on the wind",
  },
  {
    label: "Brutalist Concrete Atrium",
    value: "a monumental brutalist concrete atrium with a single shaft of daylight",
  },
  {
    label: "Amalfi Lemon Terrace",
    value: "an Amalfi coast terrace strung with lemon trees above a turquoise sea",
  },
  {
    label: "Surreal Mirror Desert",
    value: "a surreal salt-flat desert scattered with freestanding mirrors reflecting a violet sky",
  },
  {
    label: "1970s Grand Hotel",
    value: "a faded grand hotel lobby — marble, brass, velvet — in a cinematic seventies palette",
  },
  {
    label: "Grand Palais Glasshouse",
    value: "a 19th-century glass conservatory, wrought iron and misty ferns, soft diffused greenhouse light",
  },
  {
    label: "Moroccan Riad Courtyard",
    value: "a Moroccan riad courtyard of zellige tile, carved cedar and orange trees, dappled afternoon light",
  },
  {
    label: "English Country Manor",
    value: "a wood-panelled English manor library, leather armchairs, leaded windows, late amber light",
  },
  {
    label: "New York Fire Escape",
    value: "a cast-iron New York fire escape above a brick street, dawn light and waking steam",
  },
  {
    label: "Santorini Cliffside",
    value: "whitewashed cubic terraces on a Santorini cliff above the Aegean, bougainvillea and hard midday light",
  },
  {
    label: "Industrial Warehouse Loft",
    value: "a vast industrial loft, steel beams and polished concrete, long shafts of north window light",
  },
  {
    label: "Venetian Canal, Dusk",
    value: "a palazzo facade on a Venetian canal at dusk, lamplight rippling across dark water",
  },
  {
    label: "Desert Highway Motel",
    value: "a roadside desert motel at blue hour, neon sign humming, chrome and Americana",
  },
  {
    label: "Scottish Highlands Estate",
    value: "a heather moor below a stone tower, Scottish mist rolling through the glen",
  },
  {
    label: "Art-Deco Oceanliner",
    value: "the teak deck of an art-deco oceanliner, brass rails and an endless sea horizon",
  },
  {
    label: "Provence Lavender Field",
    value: "a Provençal lavender field running to the horizon, hazy summer light and humming cicadas",
  },
  {
    label: "Backstage, Fashion Week",
    value: "a fashion-week backstage, garment racks and ring-light mirrors, beautiful controlled chaos",
  },
];

/* ---------------------------------- 03 · The Pose ----------------------------------- */

export const POSE_PRESETS: Preset[] = [
  { label: "Full-Length Power Stance", value: "standing full-length, weight on one hip, chin lifted, commanding presence" },
  { label: "Mid-Stride Walk", value: "walking toward camera mid-stride, fabric caught in motion" },
  { label: "Reclining Divan", value: "reclining on a chaise longue, elongated limbs, relaxed tension" },
  { label: "Beauty Close-Up", value: "extreme close-up beauty crop at jaw and brow" },
  { label: "Dynamic Fabric Toss", value: "dynamic movement, fabric tossed and frozen in air" },
  { label: "Over-the-Shoulder", value: "back turned, looking over the shoulder" },
  { label: "Seated, Intimate", value: "seated on the floor, elbows on knees, intimate framing" },
  { label: "The Classic Lean", value: "leaning back against a wall, ankles crossed, one hand loose in a pocket" },
  { label: "Staircase Descent", value: "descending a grand staircase, one hand trailing the banister, gown flowing" },
  { label: "Hand-in-Pocket Stroll", value: "mid-walk with a hand in a pocket, candid and relaxed" },
  { label: "The Low Crouch", value: "crouching low, elbows on knees, street-style attitude" },
  { label: "Floor Recline", value: "lying across a rug, legs bent, head tipped back, fabric pooling around her" },
  { label: "Frozen Mid-Twirl", value: "frozen mid-twirl, dress fanning out like a halo, hair in flight" },
  { label: "Perched on a Ledge", value: "perched on a ledge with legs dangling, chin resting on one hand" },
  { label: "The Silhouette", value: "a pure profile silhouette, chin lifted toward the light" },
  { label: "Walking-Away Glance", value: "walking away from camera, a single glance back over the shoulder" },
  { label: "Kneeling in Fabric", value: "kneeling amid pooling fabric, back arched, chin tipped up" },
  { label: "The Leap", value: "frozen mid-jump with both feet off the ground, coat flaring, hair suspended" },
  { label: "Arm-Raise", value: "one arm raised overhead, chin following the hand, fabric sliding down the arm" },
];

/* ------------------------------- 04 · Light & Glass --------------------------------- */

export const LIGHTING_CUSTOM_ID = "custom";

export const LIGHTING_OPTIONS: { id: string; label: string; prompt: string }[] = [
  { id: "soft-diffused", label: "Soft diffused beauty light", prompt: "soft diffused beauty lighting" },
  { id: "golden", label: "Golden-hour sunlight", prompt: "warm golden-hour sunlight with long shadows" },
  { id: "chiaroscuro", label: "Dramatic chiaroscuro", prompt: "dramatic chiaroscuro from a single hard source" },
  { id: "high-key", label: "High-key seamless", prompt: "high-key seamless white studio light" },
  { id: "neon", label: "Neon mixed light", prompt: "saturated neon mixed lighting, teal and magenta" },
  { id: "window", label: "North window light", prompt: "soft directional north-facing window light" },
  { id: "strobe", label: "Raw direct strobe", prompt: "raw direct on-camera strobe, hard shadows" },
  { id: "overcast", label: "Moody overcast", prompt: "moody overcast daylight, muted tones" },
  { id: LIGHTING_CUSTOM_ID, label: "Custom…", prompt: "" },
];

export const CAMERA_OPTIONS: { id: string; label: string; prompt: string }[] = [
  { id: "85", label: "85mm ƒ/1.4 prime", prompt: "85mm ƒ/1.4 prime lens, creamy bokeh" },
  { id: "hasselblad", label: "Medium format Hasselblad", prompt: "medium format Hasselblad, 80mm, tactile skin detail" },
  { id: "anamorphic", label: "Cinematic anamorphic", prompt: "cinematic anamorphic glass, soft flares, oval bokeh" },
  { id: "35", label: "35mm reportage", prompt: "35mm reportage lens, environmental intimacy" },
  { id: "135", label: "135mm ƒ/2 compressed", prompt: "135mm ƒ/2 lens, compressed editorial portrait" },
  { id: "largeformat", label: "4×5 large format", prompt: "4×5 large format, infinite depth and fine grain" },
  { id: "50", label: "50mm ƒ/1.2 classic", prompt: "50mm ƒ/1.2, the classic fashion standard" },
];

export const REFERENCE_OPTIONS: string[] = [
  "Vogue Italia",
  "i-D Magazine",
  "Harper's Bazaar",
  "Dazed",
  "W Magazine",
  "art direction by Tim Walker",
  "art direction by Steven Meisel",
  "the monochrome mood of Peter Lindbergh",
  "the boldness of Helmut Newton",
  "none",
];

/* ---------------------------------- 05 · The Frame ---------------------------------- */

export const RATIOS: { id: RatioId; label: string }[] = [
  { id: "1:1", label: "Square" },
  { id: "5:4", label: "Plate" },
  { id: "4:3", label: "View" },
  { id: "3:2", label: "Landscape" },
  { id: "4:5", label: "Insta" },
  { id: "3:4", label: "Print" },
  { id: "2:3", label: "35mm" },
  { id: "16:9", label: "Wide" },
  { id: "9:16", label: "Story" },
  { id: "21:9", label: "Cinema" },
];

export const ENGINES: { id: EngineId; label: string }[] = [
  { id: "qwen-image", label: "Qwen-Image 3.0 Pro (DashScope)" },
  { id: "wanx-plus", label: "Wan 2.7 Pro (DashScope)" },
  { id: "wanx-turbo", label: "Z-Image Turbo · fast (DashScope)" },
  { id: "flux-pro", label: "Flux 1.1 Pro" },
  { id: "flux-dev", label: "Flux Dev" },
  { id: "sd3", label: "Stable Diffusion 3.5" },
  { id: "dalle3", label: "DALL·E 3" },
  { id: "mj6", label: "Midjourney v6 style" },
  { id: "custom", label: "Custom endpoint" },
];

export const NEGATIVE_DEFAULT =
  "deformed hands, extra fingers, low quality, blurry, watermark, text, logo, oversaturated, plastic skin";

/* ------------------------------- Scene starters (empty state) ------------------------ */

export interface SceneStarter {
  id: string;
  no: string;
  label: string;
  note: string;
  form: Partial<FormState>;
}

export const SCENE_STARTERS: SceneStarter[] = [
  {
    id: "parisienne",
    no: "N°1",
    label: "Golden-Hour Parisienne",
    note: "Crimson silk on a zinc rooftop, the tower in the haze.",
    form: {
      model: MODEL_PRESETS[0].value,
      expression: EXPRESSION_PRESETS[0],
      outfit: "a flowing crimson silk gown with an open back, opera gloves",
      pose: POSE_PRESETS[1].value,
      location: LOCATION_PRESETS[0].value,
      lighting: "golden",
      camera: "hasselblad",
      reference: "Vogue Italia",
      ratio: "4:5",
    },
  },
  {
    id: "neo-tokyo",
    no: "N°2",
    label: "Neo-Tokyo Rain",
    note: "An iridescent trench under neon kanji, puddles like mirrors.",
    form: {
      model: MODEL_PRESETS[3].value,
      expression: EXPRESSION_PRESETS[1],
      outfit: "an iridescent trench coat, cropped trousers, platform boots",
      pose: POSE_PRESETS[0].value,
      location: LOCATION_PRESETS[2].value,
      lighting: "neon",
      camera: "anamorphic",
      reference: "i-D Magazine",
      ratio: "2:3",
    },
  },
  {
    id: "salt-flat",
    no: "N°3",
    label: "Salt-Flat Surreal",
    note: "Liquid silver at dusk among freestanding mirrors.",
    form: {
      model: MODEL_PRESETS[1].value,
      expression: EXPRESSION_PRESETS[3],
      outfit: "a liquid silver slip dress, bare feet",
      pose: POSE_PRESETS[1].value,
      location: LOCATION_PRESETS[6].value,
      lighting: "overcast",
      camera: "largeformat",
      reference: "art direction by Tim Walker",
      ratio: "16:9",
    },
  },
];

/* --------------------------------- Quick-action presets ------------------------------ */

export const OUTFIT_PRESETS: Preset[] = [
  { label: "Couture Gown", value: "a sculptural couture gown with architectural shoulders" },
  { label: "Oversized Tailoring", value: "an oversized double-breasted suit, nothing beneath the blazer" },
  { label: "Liquid Slip Dress", value: "a bias-cut liquid satin slip dress in champagne" },
  { label: "Leather & Shearling", value: "a vintage leather aviator jacket over shearling, heavy boots" },
  { label: "Sheer Organza", value: "layered sheer organza in smoke grey, floating as she moves" },
  { label: "Monochrome Knit", value: "a head-to-toe ivory ribbed knit column dress" },
];

export const QUICK_LOCATION_PRESETS = LOCATION_PRESETS.slice(0, 6);
export const QUICK_POSE_PRESETS = POSE_PRESETS;
