import { SITE } from "../data/site";
import Reveal from "./Reveal";
import { CoreIcon, CodeIcon, LayersIcon, VideoIcon } from "./icons";

const FACTS = [
  {
    icon: CoreIcon,
    title: "Building ALLI",
    body: "My long-term personal AI assistant — designed and built step by step, from a basic Python chatbot to a memory engine with real retrieval.",
  },
  {
    icon: CodeIcon,
    title: "Learning in public",
    body: "I learn by building. Every project is documented openly — including the wrong turns, the fixes and what actually worked.",
  },
  {
    icon: LayersIcon,
    title: "AI + development",
    body: "Local models, embeddings, memory systems, APIs and the everyday tools that turn ideas into working software.",
  },
  {
    icon: VideoIcon,
    title: "Creating content",
    body: "I share the journey through short-form video about AI, programming, technology and building projects.",
  },
];

export default function About() {
  return (
    <section className="section section-alt" id="about" aria-labelledby="about-title">
      <div className="container">
        <div className="about-grid">
          <Reveal className="about-copy">
            <span className="eyebrow">About</span>
            <h2 className="section-title" id="about-title">
              Student. Developer. <span className="accent">AI Builder.</span>
            </h2>
            <p>
              I'm <strong>Tejsai</strong>, also known as <strong>TS nextstep</strong>. I spend my
              time exploring <strong>AI, programming and technology</strong> — and I document what
              I build while I build it.
            </p>
            <p>
              My main project is <strong>ALLI</strong>, a personal AI assistant I'm developing from
              the ground up. It started as a basic chatbot and is growing into something with real
              memory, reasoning and tools. Alongside that, I create content about the process so
              other learners can see how a project like this actually comes together.
            </p>

            <div className="roles" aria-label="Roles">
              {SITE.roles.map((role) => (
                <span className="role-tag" key={role}>
                  {role}
                </span>
              ))}
            </div>
          </Reveal>

          <div className="about-facts">
            {FACTS.map((fact, i) => (
              <Reveal key={fact.title} delay={i * 0.08}>
                <article className="fact">
                  <span className="fact-icon" aria-hidden="true">
                    <fact.icon />
                  </span>
                  <div>
                    <h3>{fact.title}</h3>
                    <p>{fact.body}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
