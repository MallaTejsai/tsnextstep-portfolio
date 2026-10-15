/**
 * Projects shown under "WHAT I'M BUILDING".
 *
 * ALLI is the featured project. Every status, description and link here is
 * factual — never add a GitHub URL, demo URL or capability that does not
 * exist yet. `links` may be empty.
 */

import { SOCIAL } from "./site";

export const PROJECTS = [
  {
    id: "alli",
    name: "ALLI",
    tagline: "My Personal AI Assistant",
    status: "Active development",
    statusTone: "live",
    description:
      "ALLI is my personal AI assistant, built from scratch with Python, Ollama and local models. It started as a basic chatbot and is growing version by version toward real memory, retrieval and tools.",
    tags: ["Python", "Ollama", "Qwen", "Memory Engine", "Embeddings"],
    featured: true,
    links: [{ label: "VIEW ALLI", href: "#alli", internal: true }],
  },
  {
    id: "portfolio",
    name: "Personal Portfolio",
    tagline: "This website",
    status: "Live",
    statusTone: "live",
    description:
      "My personal developer portfolio, built and rebuilt while learning web development — the site you are reading right now.",
    tags: ["HTML", "CSS", "JavaScript", "React", "Vite"],
    links: [
      {
        label: "SOURCE REPO",
        href: "https://github.com/MallaTejsai/tsnextstep-portfolio",
        external: true,
      },
    ],
  },
  {
    id: "ai-tools",
    name: "AI Tools Content Series",
    tagline: "TS nextstep",
    status: "Ongoing",
    description:
      "An educational content series exploring useful AI tools and explaining them simply — published as short-form video.",
    tags: ["Content", "AI Tools", "Education"],
    links: [
      { label: "INSTAGRAM", href: SOCIAL.instagram.url, external: true },
      { label: "YOUTUBE", href: SOCIAL.youtube.url, external: true },
    ],
  },
  {
    id: "programming",
    name: "Programming Projects",
    tagline: "Experiments & practice",
    status: "In progress",
    description:
      "A growing collection of experiments and small projects built while learning programming — the practice behind the bigger builds.",
    tags: ["Python", "Java", "JavaScript"],
    links: [],
  },
];
