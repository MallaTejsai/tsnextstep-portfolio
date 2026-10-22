import { useState } from "react";
import { ARCHITECTURE_FLOW, ARCHITECTURE_NOTE } from "../data/alliArchitecture";
import Reveal from "./Reveal";

/**
 * USER → PYTHON → ALLI → OLLAMA → QWEN → RESPONSE
 *
 * Selecting a node shows its explanation in the panel beside the flow.
 * Horizontal on desktop, vertical on mobile (pure CSS), keyboard operable.
 */
export default function AlliArchitecture() {
  const [activeId, setActiveId] = useState("alli");
  const active = ARCHITECTURE_FLOW.find((n) => n.id === activeId) || ARCHITECTURE_FLOW[0];

  return (
    <Reveal className="arch" delay={0.05}>
      <div className="arch-head">
        <span className="eyebrow">Under the hood</span>
        <h3 className="arch-title">
          How a message travels through ALLI
        </h3>
        <p className="arch-lead">
          Select any step to see what happens there. It is the same path every time you talk to
          ALLI on my machine.
        </p>
      </div>

      <div className="arch-body">
        <div
          className="arch-flow"
          role="group"
          aria-label="ALLI architecture flow — select a step to learn more"
        >
          {ARCHITECTURE_FLOW.map((node, i) => {
            const isActive = node.id === activeId;
            return (
              <div className="arch-step" key={node.id} data-active={isActive || undefined}>
                {i > 0 ? (
                  <span className="arch-connector" aria-hidden="true">
                    <span className="arch-connector-line" />
                  </span>
                ) : null}
                <button
                  type="button"
                  className={`arch-node${isActive ? " is-active" : ""}`}
                  aria-pressed={isActive}
                  aria-controls="alli-architecture-detail"
                  onClick={() => setActiveId(node.id)}
                >
                  <span className="arch-index">{node.index}</span>
                  <span className="arch-label">{node.label}</span>
                  <span className="arch-role">{node.role}</span>
                </button>
              </div>
            );
          })}
        </div>

        <aside className="arch-panel" id="alli-architecture-detail" aria-live="polite">
          <span className="arch-panel-eyebrow">
            Step {active.index} · {active.role}
          </span>
          <h4 className="arch-panel-title">{active.title}</h4>
          <p className="arch-panel-label">{active.label}</p>
          <p className="arch-panel-detail">{active.detail}</p>
          <p className="arch-panel-note">{ARCHITECTURE_NOTE}</p>
        </aside>
      </div>
    </Reveal>
  );
}
