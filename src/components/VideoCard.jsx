import { ArrowUpRight, PlayIcon } from "./icons";

/**
 * Video episode card. The whole card is clickable via an overlay button,
 * so the markup stays valid (no interactive elements nested in a <button>).
 */
export default function VideoCard({ video, onOpen }) {
  const label = `Watch ${video.title} — choose where to watch this episode`;

  return (
    <article className="video-card" data-video={video.id}>
      <span className="video-thumb">
        <span className="video-num">{video.number}</span>
        <span className="video-play" aria-hidden="true">
          <PlayIcon />
        </span>
      </span>

      <div className="video-body">
        <h3>{video.title}</h3>
        <p>{video.description}</p>
        <span className="video-watch">
          WATCH EPISODE
          <ArrowUpRight />
        </span>
      </div>

      <button
        type="button"
        className="video-card-hit"
        onClick={(e) => onOpen(video, e.currentTarget)}
        aria-haspopup="dialog"
        aria-label={label}
      />
    </article>
  );
}
