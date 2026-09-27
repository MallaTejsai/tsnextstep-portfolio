import { useCallback, useEffect, useRef, useState } from "react";
import { NAV_LINKS, SITE } from "../data/site";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useSectionSpy } from "../hooks/useReveal";
import { MenuIcon, CloseIcon, ArrowUpRight } from "./icons";

const IDS = NAV_LINKS.map((l) => l.id);

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const active = useSectionSpy(IDS);
  const toggleRef = useRef(null);
  const menuRef = useRef(null);

  useBodyScrollLock(open);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }

      if (e.key === "Tab" && menuRef.current) {
        const focusables = menuRef.current.querySelectorAll("a[href], button:not([disabled])");
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => {
      menuRef.current?.querySelector("a, button")?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const onNavClick = (e, id) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    setOpen(false);
  };

  return (
    <>
      <header className={`nav${scrolled || open ? " is-scrolled" : ""}`}>
        <div className="nav-inner">
          <a
            className="brand"
            href="#home"
            aria-label="TS nextstep — home"
            onClick={(e) => onNavClick(e, "home")}
          >
            <span className="brand-mark" aria-hidden="true">
              TS
            </span>
            <span className="brand-name">
              TS <span>nextstep</span>
            </span>
          </a>

          <nav className="nav-links" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className={`nav-link${active === link.id ? " is-active" : ""}`}
                aria-current={active === link.id ? "page" : undefined}
                onClick={(e) => onNavClick(e, link.id)}
              >
                {link.label}
              </a>
            ))}
            <a
              className="btn btn-primary nav-cta"
              href="#contact"
              onClick={(e) => onNavClick(e, "contact")}
            >
              GET IN TOUCH
              <ArrowUpRight />
            </a>
          </nav>

          <button
            ref={toggleRef}
            className="nav-toggle"
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span
              style={{
                display: "grid",
                placeItems: "center",
                position: "relative",
                width: 22,
                height: 22,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  gridArea: "1 / 1",
                  opacity: open ? 0 : 1,
                  transform: open ? "rotate(-90deg) scale(0.6)" : "none",
                  transition: "transform .35s cubic-bezier(.22,1,.36,1), opacity .25s ease",
                }}
              >
                <MenuIcon />
              </span>
              <span
                style={{
                  position: "absolute",
                  gridArea: "1 / 1",
                  opacity: open ? 1 : 0,
                  transform: open ? "none" : "rotate(90deg) scale(0.6)",
                  transition: "transform .35s cubic-bezier(.22,1,.36,1), opacity .25s ease",
                }}
              >
                <CloseIcon />
              </span>
            </span>
          </button>
        </div>
      </header>

      <div
        id="mobile-menu"
        ref={menuRef}
        className={`mobile-menu${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        hidden={!open}
      >
        <nav aria-label="Mobile">
          <ul>
            {NAV_LINKS.map((link, i) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  className={`mobile-link${active === link.id ? " is-active" : ""}`}
                  style={{ "--d": `${0.06 + i * 0.045}s` }}
                  onClick={(e) => onNavClick(e, link.id)}
                  tabIndex={open ? 0 : -1}
                >
                  <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mobile-menu-foot">
          <a
            className="btn btn-primary"
            href="#contact"
            onClick={(e) => onNavClick(e, "contact")}
            tabIndex={open ? 0 : -1}
          >
            GET IN TOUCH
            <ArrowUpRight />
          </a>
        </div>
        <p
          style={{
            marginTop: "2rem",
            fontSize: "0.72rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          {SITE.copyright}
        </p>
      </div>
    </>
  );
}
