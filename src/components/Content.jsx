import { useRef, useState } from "react";
import { ALLI_VIDEOS } from "../data/alliVideos";
import { CONTENT_TOPICS } from "../data/contentTopics";
import { SOCIAL, SITE } from "../data/site";
import Reveal from "./Reveal";
import VideoCard from "./VideoCard";
import VideoModal from "./VideoModal";
import { ArrowUpRight, getIcon } from "./icons";

/**
 * "Sharing What I Learn" — an editorial poster gallery of the ALLI build
 * series. Real cover artwork first, no embedded video players.
 */
export default function Content() {
  const [active, setActive] = useState(null);
  const originRef = useRef(null);

  const open = (video, trigger) => {
    originRef.current = trigger;
    setActive(video);
  };

  return (
    <section className="section" id="content" aria-labelledby="content-title">
      <div className="container">
        <Reveal className="section-head content-head">
          <div>
            <span className="eyebrow">TS nextstep · Content</span>
            <h2 className="section-title" id="content-title">
              Sharing What I <span className="accent">Learn</span>
            </h2>
            <p className="section-lead">
              I document what I build, the tools I discover, and the concepts I'm learning.
            </p>
          </div>

          <div className="content-meta">
            <p className="content-brand">
              <span className="content-brand-mark" aria-hidden="true">
                TS
              </span>
              <span>
                <strong>{SITE.brand}</strong>
                <em>{String(ALLI_VIDEOS.length).padStart(2, "0")} episodes live</em>
              </span>
            </p>
            <div className="content-links">
              <a
                className="btn btn-ghost"
                href={SOCIAL.youtube.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                YouTube
                <ArrowUpRight />
              </a>
              <a
                className="btn btn-ghost"
                href={SOCIAL.instagram.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
                <ArrowUpRight />
              </a>
            </div>
          </div>
        </Reveal>

        <div className="poster-grid">
          {ALLI_VIDEOS.map((video, i) => (
            <Reveal key={video.id} delay={Math.min(i * 0.05, 0.3)}>
              <VideoCard video={video} onOpen={(v, trigger) => open(v, trigger)} eager={i < 2} />
            </Reveal>
          ))}
        </div>

        <Reveal className="content-pillars" delay={0.05}>
          <h3 className="content-pillars-title">What the channel covers</h3>
          <ul className="pillar-list">
            {CONTENT_TOPICS.map((topic) => {
              const Icon = getIcon(topic.icon);
              return (
                <li className="pillar" key={topic.id}>
                  <span className="pillar-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="pillar-text">
                    <strong>{topic.title}</strong>
                    <span>{topic.description}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>

      <VideoModal video={active} onClose={() => setActive(null)} originRef={originRef} />
    </section>
  );
}
