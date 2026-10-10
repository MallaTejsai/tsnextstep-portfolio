/**
 * ALLI architecture — the real request path of the project.
 *
 * USER → PYTHON → ALLI → OLLAMA → QWEN → RESPONSE
 * Each node is a real stage of how ALLI works today: a Python program on my
 * machine talks to a local Ollama runtime, which runs the Qwen model.
 *
 * `flow` describes the pipeline; `detail` is shown in the info panel when a
 * visitor selects a node.
 */

export const ARCHITECTURE_FLOW = [
  {
    id: "user",
    index: "01",
    label: "USER",
    title: "You",
    role: "Input",
    detail:
      "It starts with a plain question typed into the terminal — no app store, no cloud account, just a conversation on my own machine.",
  },
  {
    id: "python",
    index: "02",
    label: "PYTHON",
    title: "Python program",
    role: "Runtime",
    detail:
      "A Python script is the entry point. It reads the input, keeps the conversation context and prepares the request for the model.",
  },
  {
    id: "alli",
    index: "03",
    label: "ALLI",
    title: "Assistant layer",
    role: "My code",
    detail:
      "ALLI is the layer I wrote — conversation handling, memory, and from v0.6 onward the intelligent memory engine that decides what is worth remembering.",
  },
  {
    id: "ollama",
    index: "04",
    label: "OLLAMA",
    title: "Local runtime",
    role: "Local",
    detail:
      "Ollama runs locally on my machine and serves the model over a small local API. Everything stays on-device — no cloud dependency for everyday use.",
  },
  {
    id: "qwen",
    index: "05",
    label: "QWEN",
    title: "Language model",
    role: "Model",
    detail:
      "Qwen is the open model doing the actual language work — reading the prompt and generating the reply. It is the part I do not write; the system around it is.",
  },
  {
    id: "response",
    index: "06",
    label: "RESPONSE",
    title: "Answer",
    role: "Output",
    detail:
      "The generated answer travels back through the same chain and is printed in the terminal — and, from v0.3 onward, the conversation is stored instead of forgotten.",
  },
];

export const ARCHITECTURE_NOTE =
  "A visualization of how ALLI is architected today. This website is not connected to ALLI — nothing here is live inference or real system telemetry.";
