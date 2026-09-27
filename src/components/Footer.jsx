import { NAV_LINKS, SITE, SOCIAL } from "../data/site";
import { InstagramIcon, YoutubeIcon } from "./icons";

export default function Footer() {
  const go = (e, id) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-main">
          <div className="footer-brand">
            <a className="brand" href="#home" onClick={(e) => go(e, "home")}>
              <span className="brand-mark" aria-hidden="true">
                TS
              </span>
              <span className="brand-name">
                Tejsai <span>/ TS nextstep</span>
              </span>
            </a>
            <p className="footer-tagline">{SITE.footerTagline}</p>
          </div>

          <div className="footer-socials">
            <a
              className="footer-social"
              href={SOCIAL.youtube.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`YouTube — ${SOCIAL.youtube.handle} (opens in a new tab)`}
            >
              <YoutubeIcon />
            </a>
            <a
              className="footer-social"
              href={SOCIAL.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Instagram — ${SOCIAL.instagram.handle} (opens in a new tab)`}
            >
              <InstagramIcon />
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copy">{SITE.copyright}</p>
          <nav className="footer-nav" aria-label="Footer">
            {NAV_LINKS.map((link) => (
              <a key={link.id} href={`#${link.id}`} onClick={(e) => go(e, link.id)}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
