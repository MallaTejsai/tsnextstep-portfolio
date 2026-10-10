import { CURRENT_FOCUS, EDUCATION, JOURNEY } from "../data/journey";
import Reveal from "./Reveal";

/**
 * "My journey" — the real timeline: education, content, learning and ALLI.
 * No video players here; the poster gallery lives in the Content section.
 */
export default function Journey() {
  return (
    <section className="section section-alt" id="journey" aria-labelledby="journey-title">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow">My journey</span>
          <h2 className="section-title" id="journey-title">
            Student. Builder. <span className="accent">AI developer.</span>
          </h2>
          <p className="section-lead">
            The path so far — one course, one project and one video at a time.
          </p>
        </Reveal>

        <div className="journey-layout">
          <ol className="jt">
            {JOURNEY.map((item, i) => (
              <Reveal as="li" key={item.id} delay={i * 0.06} className="jt-item">
                <span className="jt-node" aria-hidden="true" />
                <div className="jt-card">
                  <div className="jt-meta">
                    <span className="jt-period">{item.period}</span>
                    <span className="jt-tag">{item.tag}</span>
                  </div>
                  <h3 className="jt-title">{item.title}</h3>
                  <p className="jt-summary">{item.summary}</p>
                </div>
              </Reveal>
            ))}
          </ol>

          <aside className="journey-side">
            <Reveal className="journey-card">
              <span className="eyebrow">Education</span>
              <h3 className="journey-card-title">{EDUCATION.school}</h3>
              <p className="journey-card-status">{EDUCATION.status}</p>
              <p className="journey-card-body">{EDUCATION.body}</p>
            </Reveal>

            <Reveal className="journey-card" delay={0.08}>
              <span className="eyebrow">Current focus</span>
              <ul className="focus-list">
                {CURRENT_FOCUS.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Reveal>
          </aside>
        </div>
      </div>
    </section>
  );
}
