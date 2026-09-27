/**
 * ALLI public development roadmap — authoritative source.
 *
 * PUBLIC SCOPE: the website only ever shows v0.1 → v1.0.
 * Nothing beyond v1.0 belongs in this file or anywhere in the shipped site.
 *
 * - Capabilities must NOT be moved between versions.
 * - v0.6 is the CURRENT development milestone — never present it as completed.
 *
 * status:
 *   "past"     → earlier stage (subdued appearance)
 *   "current"  → CURRENT DEVELOPMENT (subtle animated pulse, timeline stops here)
 *   "future"   → roadmap / upcoming (dark, outlined, subdued)
 */

export const CURRENT_VERSION = "v0.6";

export const ALLI_ROADMAP = [
  {
    id: "v0.1",
    version: "v0.1",
    title: "Basic AI",
    summary: "Python → Ollama → Qwen conversation",
    status: "past",
  },
  {
    id: "v0.2",
    version: "v0.2",
    title: "Working Memory",
    summary: "Remembers conversation during the session",
    status: "past",
  },
  {
    id: "v0.3",
    version: "v0.3",
    title: "Persistent Conversation",
    summary: "Saves conversations to disk",
    status: "past",
  },
  {
    id: "v0.4",
    version: "v0.4",
    title: "Long-Term Memory",
    summary: "Stores important personal information",
    status: "past",
  },
  {
    id: "v0.5",
    version: "v0.5",
    title: "Semantic Memory",
    summary: "Embeddings + vector retrieval",
    status: "past",
  },
  {
    id: "v0.6",
    version: "v0.6",
    title: "Intelligent Memory Engine",
    summary:
      "Automatic extraction, validation, deduplication, updating, contradiction handling, retrieval and lifecycle",
    status: "current",
    note: "Current development",
  },
  {
    id: "v0.7",
    version: "v0.7",
    title: "Knowledge Base",
    summary: "PDFs, notes, documents, textbooks, structured knowledge",
    status: "future",
  },
  {
    id: "v0.8",
    version: "v0.8",
    title: "File Intelligence",
    summary: "Understand, search and summarize files and folders",
    status: "future",
  },
  {
    id: "v0.9",
    version: "v0.9",
    title: "Tool System",
    summary: "Safe tools for Python, terminal, files, applications, etc.",
    status: "future",
  },
  {
    id: "v1.0",
    version: "v1.0",
    title: "Personal PC Assistant",
    summary: "ALLI can reason → use tools → complete multi-step tasks",
    status: "future",
  },
];

/** Core concepts orbiting the ALLI animation node. */
export const ALLI_CORE_NODES = ["MEMORY", "KNOWLEDGE", "TOOLS", "REASONING", "WORKFLOWS"];

/**
 * Roadmap caveat taken from the locked roadmap PDF: actual future capabilities
 * depend on models, hardware, operating-system permissions, integrations and
 * safety controls.
 */
export const ROADMAP_DISCLAIMER =
  "A planned development structure. Future capabilities depend on available models, hardware, OS permissions, integrations and safety controls.";
