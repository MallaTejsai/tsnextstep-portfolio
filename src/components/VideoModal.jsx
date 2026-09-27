import { useCallback, useEffect, useRef } from "react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { CloseIcon, InstagramIcon, YoutubeIcon } from "./icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Episode picker modal: "Where do you want to watch this episode?"
 * Supports Esc, backdrop click, focus trap and focus restoration.
 * Links always open in a new tab (noopener + noreferrer).
 */
export default function VideoModal({ video, onClose, originRef }) {
  const modalRef = useRef(null);
  const closeRef = useRef(null);

  useBodyScrollLock(Boolean(video));

  const close = useCallback(() => {
    onClose();
    originRef?.current?.focus?.();
  }, [onClose, originRef]);

  useEffect(() => {
    if (!video) return undefined;

    const t = window.setTimeout(() => closeRef.current?.focus(), 60);

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        return;
      }

      if (e.key !== "Tab") return;

      const nodes = modalRef.current?.querySelectorAll(FOCUSABLE);
      if (!nodes || !nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [video, close]);

  if (!video) return null;

  const watchLabel = `Watch ${video.title}`;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-modal-title"
        aria-describedby="video-modal-desc"
        ref={modalRef}
      >
        <button
          ref={closeRef}
          className="modal-close"
          type="button"
          onClick={close}
          aria-label="Close dialog"
        >
          <CloseIcon />
        </button>

        <p className="modal-eyebrow">{watchLabel}</p>
        <h2 id="video-modal-title">{video.title}</h2>
        <p id="video-modal-desc">Choose where you want to watch this episode.</p>
        <p className="modal-desc">{video.description}</p>

        <div className="modal-actions">
          <a
            className="modal-btn modal-btn-yt"
            href={video.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <YoutubeIcon />
            WATCH ON YOUTUBE
          </a>
          <a
            className="modal-btn modal-btn-ig"
            href={video.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <InstagramIcon />
            WATCH ON INSTAGRAM
          </a>
        </div>

        <p className="modal-note">Opens in a new tab · press Esc to close</p>
      </div>
    </div>
  );
}
