/**
 * The public ALLI content gallery is derived from the same generated resource
 * catalog as the Resource Hub. This keeps episode titles, posters and verified
 * platform links in one authoring source.
 */

import { RESOURCES } from "./resources";

export const ALLI_VIDEOS = RESOURCES
  .filter((resource) => resource.kind === "episode")
  .map(({ id, cover, poster, number, title, description, youtubeUrl, instagramUrl }) => ({
    id,
    poster: poster || cover,
    number,
    title,
    description,
    instagramUrl,
    youtubeUrl,
  }));
