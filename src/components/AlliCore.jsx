import { ALLI_CORE_NODES } from "../data/alliRoadmap";

const HIGHLIGHTS = [
  {
    title: "Local first",
    body: "Runs on my own machine with local models through Ollama — no cloud dependency for everyday use.",
  },
  {
    title: "Real memory",
    body: "Extraction, validation, deduplication and retrieval — so ALLI remembers what matters instead of everything.",
  },
  {
    title: "Built in public",
    body: "Every version is documented as an episode: what was planned, what broke and what shipped.",
  },
];

/**
 * Central glowing hub with MEMORY / KNOWLEDGE / TOOLS / REASONING / WORKFLOWS
 * orbiting around it. Pure CSS + SVG — no 3D engine.
 */
export default function AlliCore() {
  const count = ALLI_CORE_NODES.length;

  return (
    <div className="alli-stage">
      <div className="alli-core-wrap">
        <div className="alli-core" aria-hidden="true">
          <div className="orbit orbit-1" />
          <div className="orbit orbit-2" />
          <div className="orbit orbit-3" />
          <div className="core-ping" />
          <div className="core-ping" />

          <div className="core-hub">
            <span className="hub-label">
              ALLI
              <span className="hub-sub">v0.6 · in development</span>
            </span>
          </div>

          {ALLI_CORE_NODES.map((node, i) => (
            <div
              className="core-arm"
              key={node}
              style={{
                "--arm-dur": `${28 + i * 3}s`,
                "--arm-delay": `${-(i * (28 + i * 3)) / count}s`,
              }}
            >
              <span className="core-node">{node}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="alli-stage-copy">
        <span className="eyebrow">Flagship project</span>
        <h2 className="section-title" id="alli-core-title">
          ALLI — my personal <span className="accent">AI assistant</span>
        </h2>
        <p className="section-lead">
          ALLI is a long-term project to build a personal AI assistant that can actually remember,
          reason and help — starting from a basic Python chatbot and growing version by version
          toward a complete personal AI system.
        </p>

        <div className="alli-highlights">
          {HIGHLIGHTS.map((h, i) => (
            <div className="alli-highlight" key={h.title} style={{ transitionDelay: `${i * 0.03}s` }}>
              <span className="fact-icon" aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {i === 0 ? (
                    <path d="M12 3.5 4.5 7.5v9L12 20.5l7.5-4v-9L12 3.5Zm0 0v17" />
                  ) : i === 1 ? (
                    <>
                      <circle cx="12" cy="12" r="3.2" />
                      <circle cx="12" cy="12" r="8.2" strokeDasharray="3 3.6" />
                    </>
                  ) : (
                    <>
                      <path d="M4 6h16M4 12h10M4 18h7" />
                      <path d="m16.5 15.5 4 4m-1.5-5.5 1.5 1.5" />
                    </>
                  )}
                </svg>
              </span>
              <div>
                <h3>{h.title}</h3>
                <p>{h.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
