import type { FormState, Generation } from "../types";
import { ENGINES } from "./presets";
import { promptSummary } from "./promptBuilder";

export interface ExportPayload {
  form: FormState;
  generations: Generation[];
  baseId: string | null;
}

export interface ExportArchive {
  blob: Blob;
  filename: string;
  plates: number;
}

const engineLabel = (id: string) => ENGINES.find((e) => e.id === id)?.label ?? id;

function manifest(payload: ExportPayload): string {
  const lines: string[] = [
    "EDITORIAL-RSF · SESSION MANIFEST",
    "=================================",
    `Exported ${new Date().toLocaleString()}`,
    `Plates   ${payload.generations.length}`,
    `Favorites ${payload.generations.filter((g) => g.favorite).length}`,
    "",
  ];
  // Oldest first reads like a contact sheet.
  const plates = [...payload.generations].reverse();
  plates.forEach((g, i) => {
    lines.push(
      `${String(i + 1).padStart(2, "0")} · plate №${g.seed} · ${engineLabel(g.engine)} · ${g.ratio}${g.favorite ? " · ★" : ""}${g.standIn ? " · stand-in" : ""}`
    );
    lines.push(`    ${promptSummary(g.prompt, 150)}`);
    lines.push(`    ${g.url}`);
    lines.push("");
  });
  return lines.join("\n");
}

function readme(): string {
  return [
    "EDITORIAL-RSF — project export",
    "",
    "Inside:",
    "  · editorial-rsf-project-*.json — the complete project: current direction,",
    "    every setting, and the full plate archive (prompts, seeds, metadata).",
    "  · plate-manifest.txt — a human-readable index of every plate.",
    "",
    "Note: plate image URLs are served by the rendering engines and may expire",
    "(DashScope links live ~24 hours). Download the plates themselves from the",
    "studio's Archive ZIP while they're fresh; this export preserves everything",
    "needed to rebuild the session's settings and prompts.",
  ].join("\n");
}

/** Pack the whole project into a single ZIP. */
export async function buildExportZip(payload: ExportPayload): Promise<ExportArchive> {
  const { default: JSZip } = await import("jszip");
  const stamp = new Date().toISOString().slice(0, 10);
  const jsonName = `editorial-rsf-project-${stamp}.json`;

  const doc = {
    app: "Editorial-RSF",
    version: 2,
    exportedAt: new Date().toISOString(),
    currentSettings: payload.form,
    lockedReferenceId: payload.baseId,
    archive: payload.generations,
  };

  const zip = new JSZip();
  zip.file(jsonName, JSON.stringify(doc, null, 2));
  zip.file("plate-manifest.txt", manifest(payload));
  zip.file("README.txt", readme());

  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, filename: `editorial-rsf-project-${stamp}.zip`, plates: payload.generations.length };
}
