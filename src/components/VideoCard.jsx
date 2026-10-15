import { ArrowUpRight, PlayIcon } from "./icons";
import { asset } from "../lib/asset";

/**
 * Poster gallery card for one episode.
 * The REAL cover artwork leads; the card is one big click target that opens
 * the platform picker (YouTube / Instagram). No video is embedded or autoplayed.
 */
export default function VideoCard({ video, onOpen, eager = false }) {
  const label = `Open ${video.title} — choose where to watch this episode`;

  return (
    <article className="poster-card" data-video={video.id}>
      <span className="poster-media">
        {video.poster ? (
          <img
            src={asset(video.poster)}
            alt={`${video.title} — cover artwork for the ALLI build series`}
            width={1000}
            height={1200}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
          />
        ) : (
          <span className="poster-missing" aria-hidden="true">
            {video.number}
          </span>
        )}
        <span className="poster-num">{video.number}</span>
        <span className="poster-platforms" aria-hidden="true">
          <span className="poster-platform yt">YT</span>
          <span className="poster-platform ig">IG</span>
        </span>
        <span className="poster-open" aria-hidden="true">
          <PlayIcon />
        </span>
      </span>

      <div className="poster-body">
        <h3>{video.title}</h3>
        <p>{video.description}</p>
        <span className="poster-cta">
          WATCH EPISODE
          <ArrowUpRight />
        </span>
      </div>

      <button
        type="button"
        className="poster-hit"
        onClick={(e) => onOpen(video, e.currentTarget)}
        aria-haspopup="dialog"
        aria-label={label}
      />
    </article>
  );
}
