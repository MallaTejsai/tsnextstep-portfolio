import { SKILL_GROUPS } from "../data/skills";
import Reveal from "./Reveal";
import { getIcon } from "./icons";

export default function Skills() {
  return (
    <section className="section section-alt" id="skills" aria-labelledby="skills-title">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow">Skills</span>
          <h2 className="section-title" id="skills-title">
            What I work <span className="accent">with</span>
          </h2>
          <p className="section-lead">
            Areas I'm actively learning and using in real projects — hands-on, not certified.
          </p>
        </Reveal>

        <div className="skills-grid">
          {SKILL_GROUPS.map((group, i) => {
            const Icon = getIcon(group.icon);
            return (
              <Reveal key={group.id} delay={i * 0.07}>
                <article className="skill-group">
                  <header className="skill-group-head">
                    <span className="fact-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <h3>{group.label}</h3>
                  </header>
                  <ul className="skill-list">
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="skills-note" delay={0.15}>
          These are learning areas and tools I use while building — not certifications.
        </Reveal>
      </div>
    </section>
  );
}
