import { CONTENT_TOPICS } from "../data/contentTopics";
import { SOCIAL } from "../data/site";
import Reveal from "./Reveal";
import { getIcon, ArrowUpRight } from "./icons";

export default function Content() {
  return (
    <section className="section" id="content" aria-labelledby="content-title">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow">Content</span>
          <h2 className="section-title" id="content-title">
            What I <span className="accent">create</span>
          </h2>
          <p className="section-lead">
            TS nextstep is more than one project. I make content about AI, programming,
            technology and building things — with ALLI as one long-running thread inside a much
            bigger journey.
          </p>
        </Reveal>

        <div className="content-grid">
          {CONTENT_TOPICS.map((topic, i) => {
            const Icon = getIcon(topic.icon);
            return (
              <Reveal key={topic.id} delay={i * 0.06}>
                <article className="content-card">
                  <span className="content-num">{topic.number}</span>
                  <span className="fact-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <h3>{topic.title}</h3>
                  <p>{topic.description}</p>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="work-note" delay={0.1}>
          <a
            className="btn btn-ghost"
            href={SOCIAL.youtube.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            WATCH ON YOUTUBE
            <ArrowUpRight />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
