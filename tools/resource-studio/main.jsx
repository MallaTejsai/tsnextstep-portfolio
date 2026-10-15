import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ResourceStudio from "./ResourceStudio.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ResourceStudio />
  </StrictMode>
);
