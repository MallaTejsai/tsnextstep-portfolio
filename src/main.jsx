import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

import "./styles/base.css";
import "./styles/navbar-hero.css";
import "./styles/sections.css";
import "./styles/alli.css";
import "./styles/journey.css";
import "./styles/contact-footer.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

/* Restore position if the page was opened with a #section hash. */
window.addEventListener("load", () => {
  const id = window.location.hash.replace("#", "");
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ block: "start" });
});
