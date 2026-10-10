import Reveal from "./Reveal";
import AlliScene from "./AlliScene";
import AlliArchitecture from "./AlliArchitecture";
import AlliRoadmap from "./AlliRoadmap";

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

export default function Alli() {
  return (
    <section className="section section-alt alli-section" id="alli" aria-labelledby="alli-title">
      <div className="container">
        <Reveal className="section-head alli-head">
          <div>
            <span className="eyebrow">Flagship project</span>
            <h2 className="section-title" id="alli-title">
              Meet <span className="accent">ALLI</span>
            </h2>
            <p className="section-lead">
              My personal AI assistant, built one version at a time.
            </p>
          </div>
          <p className="alli-honesty">
            The scene below is an <strong>interactive architecture visualization</strong> of the
            project. ALLI itself runs locally as a Python application — it is not connected to
            this website, and nothing here is live inference or real telemetry.
          </p>
        </Reveal>

        <div className="alli-experience">
          <AlliScene />

          <div className="alli-side">
            <p className="alli-side-lead">
              ALLI started as a basic Python chatbot and is growing into a personal AI system with
              real memory, retrieval and tools.
            </p>
            <div className="alli-highlights">
              {HIGHLIGHTS.map((h, i) => (
                <div
                  className="alli-highlight"
                  key={h.title}
                  style={{ transitionDelay: `${i * 0.04}s` }}
                >
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

        <AlliArchitecture />
        <AlliRoadmap />
      </div>
    </section>
  );
}
