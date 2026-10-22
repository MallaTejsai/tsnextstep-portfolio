/**
 * Public resource data consumed by the visitor-facing Resource Hub.
 *
 * `src/data/resourceCatalog.json` is the owner-facing authoring catalog.
 * `npm run validate:resources` generates `resourceCatalog.public.json` before
 * every production build, filtering out unpublished records and validating all
 * file references. The public app imports only that generated catalog.
 */

import publicCatalog from "./resourceCatalog.public.json";
import { DEFAULT_CATEGORIES, getCategoryLabel } from "../lib/resourceValidation";

export const RESOURCE_MANIFEST_PATH = "assets/resources/resources.json";
const ALL_CATEGORIES = (publicCatalog.categories || DEFAULT_CATEGORIES).map((category) => ({
  id: category.id,
  label: category.label,
}));

const TYPE_LABELS = {
  episode: "Build notes",
  pdf: "PDFs",
  prompt: "Prompts",
  note: "Notes",
  image: "Images",
};

export const RESOURCES = (publicCatalog.resources || []).map((resource) => ({
  ...resource,
  category: resource.category || getCategoryLabel(resource.categoryId, ALL_CATEGORIES),
}));

const TOOLKIT_RESOURCES = RESOURCES.filter((resource) => resource.kind !== "episode");

export const RESOURCE_CATEGORIES = [
  { id: "all", label: "All topics" },
  ...ALL_CATEGORIES.filter((category) => TOOLKIT_RESOURCES.some((resource) => resource.categoryId === category.id)),
];

export const RESOURCE_TYPES = [
  { id: "all", label: "All resources" },
  ...Array.from(new Map(TOOLKIT_RESOURCES.map((resource) => [resource.kind, resource])).values()).map((resource) => ({
    id: resource.kind,
    label: TYPE_LABELS[resource.kind] || resource.kind,
  })),
];

export const PROMPT_RESOURCES = RESOURCES.filter((resource) => resource.kind === "prompt");
export const DOWNLOAD_RESOURCES = RESOURCES.filter(
  (resource) => resource.filePath && ["pdf", "note", "prompt"].includes(resource.kind)
);

export const RESOURCE_MANIFEST = publicCatalog;

export default RESOURCES;
