# ALLI v0.6 — Gap Audit and Complete Memory Engine Build Prompt

> Before pasting: put `ALLI_v0_6_FINAL_MASTER_BIBLE.pdf` (or its text) inside the repo at `docs/` and replace `<BIBLE_PATH>` below with that path.

---

## 0. ROLE AND MISSION

You are the engineering agent for **ALLI v0.6, the Advanced Memory Engine**. ALLI is a local personal assistant built on Python, Ollama and Qwen (qwen2.5:7b) with durable structured memory.

An implementation of v0.6 already exists on this machine. It was written earlier and is **not trusted** until proven. Your mission, in this order:

1. **Inspect everything** that exists, read-only.
2. **Audit it against the Bible**, requirement by requirement, with evidence.
3. **Build every missing or broken part** so that the **complete memory engine** described in the Bible exists and works.
4. **Prove it** with real tests and real CLI runs, honestly reported.

The governing document is the **FINAL MASTER BIBLE** at `<BIBLE_PATH>`. **Read it completely before doing anything else.** Where this prompt and the Bible disagree, the Bible wins, and you must tell me about the disagreement.

### The 100K test is NOT part of this task
**Do not run, generate data for, or claim anything about the 100K-memory scale test now.**
- First build the complete engine and make it correct at small scale.
- You may use small correctness datasets (up to about 1,000 records) for functional tests.
- Design the engine to be scale-ready (indexes, batched writes, rebuildable derived indexes), but do not run a 100K benchmark until I write exactly: **"APPROVED: run the 100K scale test."**
- Never report a latency, throughput or accuracy number you did not measure.

---

## 1. NON-NEGOTIABLE RULES

These come from the Bible's doctrine (§2) and agent rules (§14). Violating any of them is a failure of the task.

1. **Correctness before fluency or speed.**
2. **A vector database alone is not a memory engine.** Do not reduce reads to "embed the question → fetch nearest text → ask the LLM."
3. **The transcript and canonical long-term memory are separate stores.**
4. **The LLM proposes and interprets. Deterministic application code validates and owns canonical state.** LLM output is untrusted data.
5. **A candidate extraction is not a committed memory.**
6. **Canonical storage is the source of truth.** Embeddings, FTS tables and other indexes are derived and must be rebuildable.
7. **Preserve history.** Updating or superseding is not deleting.
8. **"Unknown", "ambiguous", "conflicted", "incomplete" and "unsupported" are valid, explicit outcomes.** Never guess personal facts or invent relationships, dates, evidence or certainty.
9. **Importance is not relevance. Recency affects ranking, not truth.**
10. **No question-specific hardcoding, no example-specific branches, no giant regex-only intent systems.** Examples in documents are illustrative categories, never keys for `if` branches. Prefer policy tables and schemas.
11. **No permanent deletion without explicit confirmation and a traceable workflow.**
12. **No silent failures, no weakened tests, no fake placeholders, no certification by appearance.** Never edit an expected result just to make a test pass.
13. **Local, open-source, zero-cost core operation.** No cloud or paid API for core memory.
14. **Do not adopt any new language, major database, vector service or major dependency without asking me first.** Report benefit, cost, complexity, license and deployment impact, then wait.
15. **Root cause, not patching.** For every failure: reproduce → classify → find the earliest diverging stage → causal hypothesis → general fix → regression test → rerun affected suites → real CLI check → record. Do not restart from scratch as a default response.
16. **Do not claim a test passed unless you ran it and show the command and output.**
17. **Do not omit requirements to save time.** Label every item: implemented, tested, pending, blocked, or deferred, with a reason.
18. **Never use my real/existing user memory database for development or tests.** Never blindly restore or overwrite runtime memory. Use a separate dev DB and test fixtures.
19. **Stay in scope.** Do not absorb v0.7 Knowledge Base, v0.8 File Intelligence, v1.1 Web, v1.2 Study Assistant, voice, or unrelated tools. Provide stable interfaces only.

---

## 2. STEP 1 — INSPECT (READ-ONLY, NO CODE CHANGES YET)

Do all of this before editing anything.

1. **Locate** all ALLI code, memory files, databases, tests, configs and docs. Map the repository structure.
2. **Git state.** Report `git status`, current branch, last commits, dirty/untracked files, and what `.gitignore` covers. The Bible records that runtime JSON and `__pycache__` were reportedly tracked, so check and report this.
3. **Classify what exists.** Separate (a) the historical older line (`src/main.py`, `src/memory/{answers,config,embeddings,extractor,manager,query_intent,retriever,store}.py`, `memory/*.json`) from (b) the newer v0.6 prototype. State which is which, with evidence.
4. **Checkpoint safely.** Create a git checkpoint/branch (for example `v0.6-audit-checkpoint`) **without modifying any runtime memory data.** Back up memory files to a separate location first.
5. **Environment.** Verify, by running commands: Python version, installed packages, Ollama running, exact model names available (`qwen2.5:7b` and the embedding model, including the exact Ollama identifier for all-minilm), model and dependency licenses, OS, CPU, GPU/VRAM, RAM.
6. **Read the code.** Read every source file. Run the existing tests. Record pass/fail/blocked with counts.
7. **Inspect the data model actually in use**: schema, tables, migrations, JSON layouts, how embeddings are stored.
8. **Reproduce the five known baseline problems** (§15 of the Bible) and record the exact input, output and state for each:
   - "I am learning C" → answered "You are learning Python"; C not stored; deletion impossible.
   - Duplicated phrasing: "You are interested in I am interested in video editing…".
   - Broad profile/introduction query cannot synthesize identity, goals, skills, interests and learning.
   - Semantic retrieval with differently worded questions is unaudited.
   - Git/runtime hygiene problems.

**Output of Step 1:** `docs/audit/01_INSPECTION_REPORT.md` containing the above, plus a dependency map and architecture-readiness assessment. Then continue to Step 2 (do not wait).

---

## 3. STEP 2 — GAP ANALYSIS AGAINST THE BIBLE

Create `docs/audit/02_GAP_MATRIX.md`: a table with one row per requirement below, with columns:
**ID | Requirement | Status (IMPLEMENTED / PARTIAL / MISSING / BROKEN / UNTESTED) | Evidence (file, function, test, or command output) | Gap | Planned fix**

Status must be based on **code you read and tests you ran**, never on file names or docstrings.

Use every requirement in Section 5 of this prompt as a row. Add the Bible release gates (§17) as a final checklist, all initially unchecked.

Then write `docs/audit/03_BUILD_PLAN.md`: ordered vertical slices (Section 4), each with files to add or change, tests to add, and acceptance criteria. **Stop and wait for my message "Proceed to Slice 1" only if** the plan requires a major dependency, a rewrite of an existing storage layer, or contradicts the Bible. Otherwise proceed slice by slice and report at each slice end.

---

## 4. STEP 3 — BUILD ORDER (VERTICAL SLICES)

Build in dependency order. **Do not build the whole engine in one shot.** Complete, test and report each slice before starting the next. Reuse working parts of the existing code where they meet the Bible; replace parts that do not, with justification.

1. **Canonical contracts**: Entity, MemoryClaim/Fact, Relationship, Episode, MemoryEvent, QuerySpec, Evidence, RetrievalReceipt, MutationReceipt; enums; controlled relation vocabulary; policy tables.
2. **Storage**: SQLite schema, migrations, WAL, transactions, backups, derived-index rebuild, restart persistence.
3. **Write pipeline**: admission, completeness gate, staged extraction, validation, pending lifecycle, receipts.
4. **Entity, relationship and temporal semantics**: resolution states, aliases, valid/recorded time, lifecycle transitions, supersession.
5. **Comparison and mutation**: comparison classifier separated from deterministic mutation executor.
6. **QuerySpec and query understanding**, using the same entity-resolution service as writes.
7. **Hybrid retrieval**: structured, lexical, semantic, relationship, temporal; hard constraints before ranking; fixed named fusion formula.
8. **Evidence assessment and answer engine**: sufficiency, conflict, abstention, grammar, verification.
9. **Control plane**: correction, confirmed forgetting, archive/restore, Memory Explorer, Conflict Workspace, `/why`, integrity checks, export/backup/recovery.
10. **Security and failure containment**.
11. **Test hardening**: golden paraphrase scenarios, adversarial, concurrency, persistence, real CLI.
12. **Consolidation job** (periodic, explicit, offline, bounded).
13. **STOP.** Present the final gap matrix and release-gate checklist. The 100K test waits for my approval phrase.

---

## 5. DETAILED REQUIREMENTS (AUDIT EVERY ONE, BUILD EVERY MISSING ONE)

### A. Canonical data model (§4)

- **A1 Entity**: stable ID, canonical name, entity type, aliases with provenance and confidence/evidence, scope, importance enum, lifecycle/status, created/updated timestamps. Optional attributes only when evidence supports them. Entity identity is stored separately from descriptive claims about it.
- **A2 MemoryClaim/Fact**: stable ID; subject/entity reference; controlled predicate/relation; object value or target entity; polarity; modality/epistemic level; memory type; scope; **valid/event time and recorded/transaction time**, each with precision and source (never invent exact dates); lifecycle status; importance enum; confidence (stored, but never treated as a calibrated probability); provenance/episode reference; version, supersession and contradiction links; created/updated timestamps; the original source statement or a traceable evidence span.
- **A3 Relationship**: stable ID, source entity, controlled relation type, target entity or value, scope, provenance, temporal validity, lifecycle and history. Never infer unsupported edges.
- **A4 Episode**: source conversation/session/turn reference, timestamps when known, evidence anchoring each extracted claim. Enough provenance to explain why a memory exists.
- **A5 MemoryEvent**: append-only audit event for every canonical mutation, correction, supersession, invalidation, archive, restore and confirmed deletion. Records actor/operation, target IDs, before/after references as policy permits, timestamp, reason, receipt ID.
- **A6 QuerySpec**: intent; subjects/entities; predicates; requested attributes/values; relationship path; temporal/state constraints; polarity/modality; specificity/cardinality; scope; semantic representation; ambiguity/unresolved references; expected answer shape.
- **A7 Evidence, RetrievalReceipt, MutationReceipt**: Evidence identifies selected claims, source episodes, constraint results and limitations. RetrievalReceipt records the query plan, channels used, candidate IDs and scores, constraints applied, selected evidence, and why items were excluded or selected (bounded and privacy-conscious). MutationReceipt records operation, affected IDs, previous and current lifecycle states, provenance/event and outcome.
- **A8 Memory types**: all four with explicit schema and lifecycle: **Episodic** (event tied to time/source episode), **Semantic** (fact, attribute, preference, goal, identity detail, relationship), **Procedural** (durable instruction or method), **Temporary** (short-lived, explicit expiry and cleanup, must never silently become permanent). Do not collapse them into one text field.
- **A9 Controlled relation vocabulary**: extensible vocabulary mapping natural language to relations (for example learning, studying, working_on, owns, prefers, dislikes, goal, enrolled_in). Similar words are not necessarily the same relation: "studying for a diploma" and "learning Python" must remain distinct if downstream meaning differs. New relations are added through policy/schema data, not scattered code.
- **A10 Importance**: three-level enum, first-class field on Fact and Entity, driven by an extensible **category → importance policy table**. Goals and active learning may get elevated category-wide importance. Preferences get a uniform baseline. Importance never overrides evidence, scope or correctness and is never confused with query relevance.
- **A11 Epistemic level and modality**: asserted, observed, reported, inferred, believed/opined, uncertain, hypothetical. A user's belief stays distinct from verified fact. A plan or possibility never becomes a completed event. **Polarity and negation are first-class fields.**
- **A12 Temporal model and lifecycle**: track valid time and recorded time with honest precision (exact date / approximate period / unknown). Lifecycle states: CANDIDATE, VALIDATED, ACTIVE, UPDATED, SUPERSEDED, INVALIDATED, ARCHIVED, plus PENDING for low-confidence extractions. **Define the legal transitions and invariants and enforce them in code.** Current-state and historical-state queries are different tasks. Supersession retains the prior version. Invalidation is not silent erasure. Temporary expiry is policy-driven and auditable.

### B. Write / memory formation (§3.1, §5)

Required flow:
`turn → cheap pre-filter / no-op fast path → completeness and ambiguity gate → staged extraction into candidate claims → schema and deterministic validation → entity/coreference resolution → relation and temporal interpretation → retrieve related canonical claims → compare → lifecycle and policy decision → transactional mutation → provenance + event + MutationReceipt → update derived indexes → report result or ask targeted clarification`

- **B1 Admission classes**: every turn is MEMORY_WORTHY, TEMPORARY, IGNORE or CLARIFY. A deterministic pre-filter may skip obvious greetings and acknowledgements, but it is a conservative optimization, never the only semantic system.
- **B2 Completeness gate**:
  - Unresolved pronoun/reference with no defensible antecedent → do not store or guess; ask a focused clarification.
  - Incomplete or unparseable question → a clear "I can't understand the question as written" outcome, not a retrieval that happened to find nothing.
  - **Unknown** (understood, evidence absent) must remain distinct from **not understood**.
  - A specific identifiable instance with fixed known attributes may be stored as stated without interrogating the user.
  - A generic variable-configuration item: ask for detail only if the missing attribute plausibly affects a known goal/project; otherwise store the partial statement.
- **B3 Staged narrow model calls**: never one giant prompt. Stages: heuristic gate → constrained-schema extraction → deterministic validation → retrieval of related memories (SQL/lexical/embedding) → narrow comparison decision using the candidate plus a small number of related memories → deterministic application → persistence, event/receipt and index update.
- **B4 LLM JSON is untrusted**: validate schema, required fields, enums, references and consistency. Retry only within a bounded policy. Malformed output must never mutate canonical storage. If there is no related memory, a deterministic create path is allowed only after validation and admission policy pass.
- **B5 Pending lifecycle**: low-confidence candidates stay PENDING or trigger clarification; they must not silently become facts. Define and test **promotion and drop rules** (reinforcement, expiry, clarification). Do not treat LLM confidence as calibrated probability; set thresholds from test results.
- **B6 Comparison vocabulary**: NONE, DUPLICATE, COMPATIBLE, UPDATE, SUPERSESSION, CONTRADICTION, MERGE_CANDIDATE, UNCERTAIN. Mutation decisions: ADD/CREATE, UPDATE, MERGE, IGNORE_DUPLICATE, SUPERSEDE, INVALIDATE, ARCHIVE, RESTORE. **The comparison classifier is separate from the deterministic mutation executor.**
- **B7 Category-driven policy tables** (not example logic) for: admission, missing-detail prompts, relation mapping, importance, pending promotion/drop, lifecycle/retention, answer form.
- **B8 Asynchronous extraction**: non-blocking where feasible, with honest user-visible pending status and correct concurrency.
- **B9 Multiple facts in one sentence** must each be extracted, validated and stored separately.

### C. Entity, coreference and relationships (§6)

- **C1** Resolution results: RESOLVED, AMBIGUOUS, NEW_ENTITY, UNRESOLVED.
- **C2** Resolve aliases and references across turns only when evidence supports it (for example a family relation named once, later referred to by pronoun or alias). Store **evidence-backed aliases, never guessed merges.**
- **C3** **One shared entity-resolution service** used by both write extraction and query understanding.
- **C4** Support direct and reverse relationship questions and justified multi-hop reasoning. **A multi-hop answer must expose a supported path. No path, no answer.**
- **C5** Ambiguous resolution triggers clarification when the ambiguity changes the answer.

### D. Storage, indexes, concurrency, providers (§7)

- **D1** Python orchestration; SQLite canonical store (entities, facts, relationships, episodes, memory events); **WAL mode**; NumPy sidecar for embeddings; no dedicated vector DB. SQLite + NumPy is a *candidate*; record the benchmark-backed decision in an ADR rather than assuming it.
- **D2** Committed transactionally. Write event and MutationReceipt consistent with the mutation. Index-update failure must not corrupt canonical truth; provide **recoverable index rebuild/reconciliation**.
- **D3** Embeddings and FTS indexes are derived and rebuildable from canonical records.
- **D4** Transcript persistence separate from canonical memory.
- **D5** Schema versions, migrations, backup/restore procedure.
- **D6** Tests: write → shutdown → restart → retrieve; async extraction writes concurrent with query reads in WAL mode.
- **D7** **Provider abstractions** for LLM, embeddings, structured storage, lexical search, vector search, clock/time parsing and diagnostics. Model-specific prompts live behind providers. The core must not be permanently tied to one model or GPU.
- **D8** Verify the exact embedding model identifier, license and dimensions before relying on it.

### E. Query understanding (§3.2, §8.1)

Flow: `classify request and completeness → understand intent and resolve references → build and validate QuerySpec → plan bounded retrieval`.

- **E1** Validate QuerySpec **before** retrieval.
- **E2** Planner: understand → plan → retrieve → check evidence → **bounded** replan → reason → plan answer → generate → verify → answer / clarify / unknown. Set explicit maximum retrieval and replanning attempts.
- **E3** Target the requested attribute or relationship; never dump every related memory.
- **E4** Route each request to **personal memory, general knowledge, or a tool**. Absence of personal evidence must not block ordinary general-knowledge answers or valid tool routing. Never invent personal information from general knowledge.
- **E5** Handle paraphrases, reverse relations, current-vs-historical questions, broad "introduce me / what do you know about me" questions, and multi-fact questions through QuerySpec, not question-specific code.

### F. Retrieval (§7.3, §8.2)

- **F1** Five channels: structured/exact fields; lexical (SQLite FTS5/BM25); semantic embeddings; relationship/graph-like traversal; temporal/state filtering.
- **F2** **Apply hard constraints first** (scope, entity identity, relation, polarity, temporal/state), then soft ranking. Similarity is a candidate signal, not proof.
- **F3** Current-state questions exclude stale/superseded claims; historical questions may retrieve them. **No cross-scope contamination.**
- **F4** **Fusion formula**: choose one named method (weighted sum, RRF, or lightweight reranker) by benchmark on the golden dataset; record exact formula, weights, normalization, tie-breaks and thresholds in an ADR. Do not pretend any value is validated before it is measured.
- **F5** Every retrieval produces a RetrievalReceipt.
- **F6** Explain, with a failing test first, why "I am learning C" was answered with Python in the old code, then make sure the new retrieval cannot do this (relation and entity hard filters).

### G. Evidence, answer generation and grammar (§8.3–8.5)

- **G1** Evidence assessment classifies at least: **sufficient, insufficient, conflicting, ambiguous, stale/temporally mismatched.** A fluent answer cannot compensate for missing evidence.
- **G2** Weak or irrelevant evidence → say it is not known from memory. **Never fill the gap with an unrelated semantic neighbor.** Expose conflicts or resolve them by lifecycle/time policy; never hide them.
- **G3** The LLM receives only selected evidence and the query interpretation, never unrestricted memory dumps.
- **G4** Answer forms: yes/no → "Yes," / "No," plus grounded restatement; wh-question → complete natural sentence, converting first-person stored text to second-person; multiple results → concise list/summary preserving scope and time; unknown → explicit uncertainty; ambiguous → targeted clarification; not understood → explicit not-understood; conflict → explain the conflict.
- **G5** Never return raw database fields. Never prepend a template to text that already contains the same wording (this is the "You are interested in I am interested in…" bug). Prefer a deterministic template for validated answer types where it avoids a second free-form generation.
- **G6** **Verify answer claims against the evidence** before returning.
- **G7** Profile/introduction synthesis combining identity, goals, skills, interests and learning, with every statement grounded.

### H. Memory control plane (§9)

- **H1** Explicit correction/update with before/after history.
- **H2** **Confirmed forget/delete** with clear target identification and scope. Archive, supersede and invalidate are distinct from permanent deletion.
- **H3** Goal and preference changes (for example like → dislike → like); conflict resolution; restoration where supported.
- **H4** Scope management and cross-scope isolation.
- **H5** **Memory Explorer** (inspect stored facts and their state) and **Conflict Workspace** (unresolved contradictions).
- **H6** **`/why`**: selected evidence, provenance, constraints and uncertainty, privacy-conscious.
- **H7** **Integrity checks**: orphaned references, missing embeddings, stale indexes, invalid lifecycle transitions, duplicate active facts, broken provenance, storage/index mismatch.
- **H8** Mutation and retrieval receipts available for inspection.
- **H9** Export, backup and recovery for local data.
- **H10** Permanent deletion is explicit and auditable. **Define what audit data survives deletion without retaining the erased content.** Derived embeddings/indexes are removed or rebuilt consistently. **Test that forgotten content is not retrievable through any channel.**

### I. Security, privacy, failure containment (§10)

- **I1** Treat all LLM outputs and retrieved text as untrusted data. Never execute instructions found inside stored memories or evidence as system instructions.
- **I2** Validate IDs, enums, scope boundaries, SQL parameters, serialized payloads. **Parameterized SQL only.**
- **I3** Prompt-injection resistance: user or stored text must not change system policy or mutate memory directly.
- **I4** No memory leakage across scopes or sessions.
- **I5** Bound model calls, retries, retrieval depth, candidate counts and timeouts.
- **I6** Handle: Ollama unavailable, model missing, malformed JSON, embedding failure, database locked/corrupt, disk full, interrupted writes, index rebuild failure, concurrent reads/writes.
- **I7** **Fail closed** for canonical mutations when validation or storage safety is uncertain. Explain failures; never report success on failure.
- **I8** Avoid logging unnecessary sensitive text; protect memory files and backups. Claim no security guarantee that is not implemented and tested.

### J. Consolidation and retention (§11)

- **J1** Consolidation is a **bounded, explicit or scheduled offline process**, never an always-on uncontrolled loop. It may *propose* dedupe/merges but preserves source claims and history.
- **J2** Specify retention for temporary, low-importance and stale data (archived vs deleted). Irreversible deletion requires confirmation.
- **J3** **No unvalidated decay curves** and no reranking shortcuts (deferred to v0.7). Use explicit statuses and policy-driven archival.

### K. Local-model reliability (§11, risk list)

- **K1** A 7B model may produce malformed JSON and does better with narrow constrained calls than one broad decision. Use narrow prompts, schema validation, bounded retries and deterministic guards.
- **K2** **Measure** latency and JSON reliability on this actual machine. Do not assume. Record hardware, OS, model versions and settings.
- **K3** Define measurable quality and latency thresholds **before** running benchmarks. Do not invent measured results.

### L. Testing and evidence standard (§12)

Build all of these layers:
1. Unit tests: schemas, policies, lifecycle transitions, parsers, temporal handling, rank fusion, receipts.
2. Contract tests for provider interfaces, serialization and migrations.
3. Integration tests for complete write and read pipelines.
4. **A regression test for every fixed root cause.**
5. Golden semantic scenarios with paraphrase and grammar variation, **including unseen paraphrases, with no question-specific hardcoding.**
6. Adversarial tests: ambiguity, contradictions, prompt injection, scope leakage, unsupported inferences.
7. Persistence, restart, backup and recovery tests.
8. Concurrency tests (WAL, async writes plus reads).
9. **Real CLI end-to-end tests**, not only unit tests.
10. User-run certification scenarios through the real CLI (written for me to run; you cannot certify them yourself).
11. (Deferred) 100K scale test, only after my approval phrase.

Golden categories to cover: identity/aliases/coreference across turns; goals, learning, studying, interests, preferences, skills, projects, relationships; positive/negative polarity and reversals; duplicate, compatible, update, merge candidate, contradiction, supersession; current vs historical and temporal order; exact, lexical, semantic paraphrase, reverse-relation and multi-hop questions; multiple facts in one sentence; ambiguous/incomplete input and pending promotion/drop; unknown facts, weak semantic neighbors, stale and conflicting evidence; general-knowledge vs personal-memory routing; natural answer form and first/second-person transformation; scope separation, confirmed deletion and non-retrievability; restart persistence, long conversation, concurrent read/write, index rebuild; malformed LLM JSON, model unavailable, database failures, interrupted operations.

**Every test report records:** test ID and requirement IDs; environment, commit, model and dependency versions; input and expected behavior; actual output and canonical DB state where relevant; pass/fail/blocked with logs; failure classification and root cause; fix commit; regression results; remaining risks.
**A test is not PASS merely because code runs or JSON parses.**

### M. Known bugs that must become permanent regression tests

1. "I am learning C" must be **stored**, answered correctly, and removable on explicit request, with remaining learning memories answered accurately. (Never "You are learning Python.")
2. Interest answers must never duplicate phrasing.
3. A broad profile/introduction query must synthesize a grounded brief introduction.
4. Differently worded questions must retrieve the right facts (paraphrase suite).
5. Preference reversal "like → dislike → like" (Java) must work, and **"I don't like Java" must not be captured by an overlapping interest-rejection handler.** Overlapping regex handlers are a known hazard; do not add regex-only handling.
6. Runtime JSON and `__pycache__` must not be tracked by git.

---

## 6. WORKING PROTOCOL

- **Work in vertical slices.** After each slice: run unit, contract, integration and affected regression tests; run the real CLI on representative inputs; commit a checkpoint.
- **Batch technology questions** at checkpoints instead of interrupting for every small choice. Ask before adopting any major dependency.
- **If a problem is architectural or two requirements conflict, stop and ask** rather than patching around it.
- **Do not weaken, skip or delete a failing test** to get green. If a test is wrong, explain why and get my agreement.
- Keep `docs/DECISIONS/` ADRs for: storage choice, fusion formula, thresholds, pending promotion/drop rules, retention policy, audit-after-deletion policy, concurrency model.
- Preserve working progress. Do not rewrite working modules without evidence they violate the Bible.

---

## 7. REPORT FORMAT (END OF EVERY SLICE)

1. Slice / phase and objective
2. Requirement IDs addressed (from Section 5)
3. Files added or changed, and why
4. Architecture and data flow implemented
5. **Exact commands executed**
6. Test inventory with pass / fail / blocked counts
7. Real inputs and real outputs for representative cases (including CLI)
8. Database state and receipts where relevant
9. Benchmark environment and measurements (only if measured)
10. Failures, classified root causes and fixes
11. Regression results
12. Remaining risks and open decisions
13. Confirmation that **my real user memory data was not modified**
14. Updated gap matrix and release-gate checklist
15. Next slice recommendation, and whether I must approve

---

## 8. DEFINITION OF DONE FOR THIS TASK

This task is complete when:
- Every row in the gap matrix is IMPLEMENTED and TESTED, or explicitly DEFERRED/BLOCKED with my agreement.
- All release gates in the Bible §17 are evidenced **except** the 100K scale test and my personal certification run, which are waiting on me.
- You have written the list of user-run certification scenarios for me to execute through the real CLI.
- You state honestly what is not proven. **No claim of production readiness may exceed the evidence.**

Begin with Step 1 now. Do not write or modify code until the inspection report exists.
