import { useRef, useState } from "react";
import { ALLI_VIDEOS } from "../data/alliVideos";
import Reveal from "./Reveal";
import VideoCard from "./VideoCard";
import VideoModal from "./VideoModal";

export default function Journey() {
  const [active, setActive] = useState(null);
  const originRef = useRef(null);

  const open = (video, trigger) => {
    originRef.current = trigger;
    setActive(video);
  };

  return (
    <section className="section" id="journey" aria-labelledby="journey-title">
      <div className="container">
        <Reveal className="section-head journey-head-row">
          <div>
            <span className="eyebrow">Video series</span>
            <h2 className="section-title" id="journey-title">
              The ALLI <span className="accent">build series</span>
            </h2>
            <p className="section-lead">
              I document the entire ALLI project as a video series — every milestone, from the
              first Python chatbot to the intelligent memory engine, filmed as it happens.
            </p>
          </div>
          <p className="journey-count">
            <strong>{String(ALLI_VIDEOS.length).padStart(2, "0")}</strong> episodes live · new
            parts added as they ship
          </p>
        </Reveal>

        <div className="video-grid">
          {ALLI_VIDEOS.map((video, i) => (
            <Reveal key={video.id} delay={Math.min(i * 0.05, 0.3)}>
              <VideoCard video={video} onOpen={(v, trigger) => open(v, trigger)} />
            </Reveal>
          ))}
        </div>
      </div>

      <VideoModal
        video={active}
        onClose={() => setActive(null)}
        originRef={originRef}
      />
    </section>
  );
}
