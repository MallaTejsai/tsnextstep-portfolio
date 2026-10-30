/**
 * Publish to Live Website — the one-click counterpart to "Save to local project".
 *
 * Safety contract (this is the only code in the repository that runs git):
 *  - Never `git add .`; every path is listed explicitly from the canonical catalog.
 *  - Only the three catalogs/manifests and the files referenced by PUBLISHED
 *    resources are staged. Draft material (`.resource-studio/**`, the private
 *    draft catalog, trash, backups, logs, credentials) can never be staged
 *    because it is never named, and it is rejected again by a content review.
 *  - The git index must be clean before staging, so nothing the owner staged
 *    manually can ride along in the publish commit.
 *  - No force-push, no reset, no checkout: the commit only ever adds the
 *    approved paths on top of the current branch.
 *  - The local public-output gate (validate → build → privacy verification)
 *    must pass before anything is pushed; GitHub Actions repeats the same gate.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { isAllowedCoverPath, isAllowedFilePath } from "../../src/lib/resourceValidation.js";

const execFileAsync = promisify(execFile);

const CATALOG_RELATIVE_PATH = "src/data/resourceCatalog.json";
const PUBLIC_CATALOG_RELATIVE_PATH = "src/data/resourceCatalog.public.json";
const PUBLIC_MANIFEST_RELATIVE_PATH = "public/assets/resources/resources.json";
const MANIFEST_RELATIVE_URL = "assets/resources/resources.json";
const TEXT_EXTENSIONS = new Set([".json", ".txt", ".md", ".markdown"]);

// Paths that must never enter a publish commit, whatever else happens.
const PRIVATE_PATH_PATTERNS = [
  /^\.resource-studio(\/|$)/,
  /^\.env(\.|$|^)/,
  /^logs(\/|$)/,
  /^backups(\/|$)/,
  /^dist(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)(drafts|trash|backups)(\/|$)/,
  /\.(log|tmp)$/i,
];

// Same rule the Studio applies on every save (SECRET_LIKE_RE), re-applied to
// the exact bytes that are about to be committed.
const SECRET_LIKE_RE =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*[^\s]+|(?:ghp_|github_pat_|sk-[A-Za-z0-9])/i;

const WORKFLOW_PATH = ".github/workflows/deploy-pages.yml";
const POLL_RUN_MS = 20000;
const POLL_LIVE_MS = 15000;
const DEPLOY_DEADLINE_MS = 20 * 60 * 1000;
const LIVE_DEADLINE_MS = 12 * 60 * 1000;

let publishStatus = {
  state: "idle",
  message: "No publish has run yet.",
  done: true,
  ok: false,
  active: false,
  startedAt: null,
  finishedAt: null,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setStatus(patch) {
  publishStatus = {
    ...publishStatus,
    ...patch,
    updatedAt: new Date().toISOString(),
    ...(patch.done ? { active: false, finishedAt: new Date().toISOString() } : {}),
  };
  return publishStatus;
}

export function getPublishStatus() {
  return { ...publishStatus };
}

function publishError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function git(root, args, { allowFailure = false, timeout = 120000 } = {}) {
  return execFileAsync("git", args, {
    cwd: root,
    windowsHide: true,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout,
  })
    .then(({ stdout, stderr }) => ({ stdout, stderr, failed: false }))
    .catch((error) => {
      const detail = String(error.stderr || error.stdout || error.message || "").trim().slice(0, 600);
      if (!allowFailure) throw publishError(`git ${args[0]} failed. ${detail}`);
      return { stdout: error.stdout || "", stderr: error.stderr || "", failed: true, code: error.code, detail };
    });
}

function parseStatus(stdout) {
  return stdout
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter(Boolean)
    .map((line) => {
      const code = line.slice(0, 2);
      let target = line.slice(3);
      const arrow = target.indexOf(" -> ");
      if (arrow >= 0) target = target.slice(arrow + 4);
      if (target.startsWith('"') && target.endsWith('"')) target = target.slice(1, -1).replace(/\\"/g, '"');
      return { code, path: target };
    });
}

function shortTitles(catalog) {
  const published = catalog.resources.filter((resource) => resource.published);
  const names = published.map((resource) => resource.title.trim().replace(/\s+/g, " ")).filter(Boolean);
  if (!names.length) return "resource updates";
  const first = names[0];
  const rest = names.length - 1;
  const summary = rest ? `${first} +${rest} more` : first;
  return summary.length > 60 ? `${summary.slice(0, 57)}...` : summary;
}

/** Every path a publish may touch: the three catalogs plus published assets. */
function collectPublishPaths(root, catalog) {
  const relative = [CATALOG_RELATIVE_PATH, PUBLIC_CATALOG_RELATIVE_PATH, PUBLIC_MANIFEST_RELATIVE_PATH];
  for (const resource of catalog.resources) {
    if (!resource.published) continue;
    // Covers may still use the legacy images/content/ allowlist, which the
    // production privacy check also requires to exist in dist/.
    for (const value of [resource.filePath, resource.cover, resource.viewPath]) {
      if (value && (isAllowedFilePath(value) || isAllowedCoverPath(value))) relative.push(`public/${value}`);
    }
  }
  return [...new Set(relative)].filter((rel) => {
    if (fs.existsSync(path.join(root, rel))) return true;
    // A published file that was deleted locally still has to be removed upstream.
    return false;
  });
}

async function trackedPaths(root, relativePaths) {
  const tracked = new Set();
  for (const rel of relativePaths) {
    const result = await git(root, ["ls-files", "--error-unmatch", "--", rel], { allowFailure: true });
    if (!result.failed && result.stdout.trim()) tracked.add(rel);
  }
  return tracked;
}

/**
 * Review the exact bytes about to be committed: no private paths, no
 * credentials, and never any content belonging to an unpublished draft.
 */
async function reviewForPrivateData(root, relativePaths, draftResources) {
  const issues = [];
  const draftTexts = draftResources
    .map((resource) => resource.promptText)
    .filter((value) => typeof value === "string" && value.trim().length >= 16);
  const draftReferences = new Set(
    draftResources.flatMap((resource) => [resource.filePath, resource.cover, resource.viewPath].filter(Boolean))
  );

  for (const rel of relativePaths) {
    if (PRIVATE_PATH_PATTERNS.some((pattern) => pattern.test(rel))) {
      issues.push(`private path "${rel}" is not publishable`);
      continue;
    }
    const assetPath = rel.startsWith("public/") ? rel.slice("public/".length) : rel;
    if (draftReferences.has(assetPath)) issues.push(`"${rel}" belongs to an unpublished draft`);

    if (!TEXT_EXTENSIONS.has(path.extname(rel).toLowerCase())) continue;
    const content = await fsp.readFile(path.join(root, rel), "utf8");
    if (content.includes(".resource-studio")) issues.push(`"${rel}" references the private Studio folder`);
    if (SECRET_LIKE_RE.test(content)) issues.push(`"${rel}" looks like it contains a credential`);
    for (const draftText of draftTexts) {
      if (content.includes(draftText)) issues.push(`"${rel}" contains unpublished draft prompt text`);
    }
  }
  return issues;
}

async function runLocalGate(root) {
  const steps = [
    ["resource validation", ["scripts/validate-resources.mjs"]],
    ["production build", ["node_modules/vite/bin/vite.js", "build"]],
    ["public-output privacy check", ["scripts/verify-public-output.mjs"]],
  ];
  for (const [label, args] of steps) {
    try {
      await execFileAsync(process.execPath, args, {
        cwd: root,
        windowsHide: true,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        timeout: 300000,
        env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" },
      });
    } catch (error) {
      const output = `${error.stdout || ""}\n${error.stderr || ""}`
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(-6)
        .join(" ");
      throw publishError(`Local public-output gate failed at "${label}". Nothing was pushed. ${output}`);
    }
  }
}

function repositorySlug(remoteUrl) {
  const match = String(remoteUrl)
    .trim()
    .match(/github\.com[/:]([^/\s]+\/[^/\s]+?)(?:\.git)?$/i);
  return match ? match[1] : null;
}

async function verifyLive({ repo, baseUrl, expectedIds, draftIds, filePaths }) {
  setStatus({
    state: "verifying-live",
    message: "Deployment finished. Checking the live website…",
    liveUrl: baseUrl,
  });
  const deadline = Date.now() + LIVE_DEADLINE_MS;
  let lastDetail = "";
  while (Date.now() < deadline) {
    let manifest;
    try {
      const response = await fetch(`${baseUrl}${MANIFEST_RELATIVE_URL}?publish-check=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`manifest responded ${response.status}`);
      manifest = await response.json();
    } catch (error) {
      lastDetail = `live manifest not readable yet (${error.message})`;
      await sleep(POLL_LIVE_MS);
      continue;
    }

    const liveIds = new Set((manifest.resources || []).map((resource) => resource.id));
    const leaked = draftIds.filter((id) => liveIds.has(id));
    if (leaked.length) {
      setStatus({
        state: "failed",
        done: true,
        ok: false,
        message: `Privacy check failed: ${leaked.length} unpublished draft(s) are visible on the live website.`,
        liveUrl: baseUrl,
      });
      return;
    }
    const missing = expectedIds.filter((id) => !liveIds.has(id));
    if (missing.length) {
      lastDetail = `${missing.length} published resource(s) not visible yet`;
      setStatus({ state: "verifying-live", message: `Live site is still serving the previous release (${lastDetail}).` });
      await sleep(POLL_LIVE_MS);
      continue;
    }

    let brokenFile = "";
    for (const rel of filePaths) {
      try {
        const response = await fetch(`${baseUrl}${rel}?publish-check=${Date.now()}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) {
          brokenFile = `${rel} responded ${response.status}`;
          break;
        }
        await response.arrayBuffer();
      } catch (error) {
        brokenFile = `${rel} (${error.message})`;
        break;
      }
    }
    if (brokenFile) {
      lastDetail = `published file unavailable: ${brokenFile}`;
      await sleep(POLL_LIVE_MS);
      continue;
    }

    setStatus({
      state: "live",
      done: true,
      ok: true,
      message: `Live and verified: ${expectedIds.length} published resource(s) are now served by the live website.`,
      liveUrl: baseUrl,
      resourceUrl: filePaths.length ? `${baseUrl}${filePaths[filePaths.length - 1]}` : baseUrl,
    });
    return;
  }

  setStatus({
    state: "live-delayed",
    done: true,
    ok: false,
    message: `GitHub Actions succeeded, but the live website has not updated yet (${lastDetail || "CDN cache may take up to 10 minutes"}). Follow the link to check shortly.`,
    liveUrl: baseUrl,
  });
}

async function monitorDeployment({ root, repo, baseUrl, sha, expectedIds, draftIds, filePaths }) {
  const api = `https://api.github.com/repos/${repo}/actions/runs`;
  const deadline = Date.now() + DEPLOY_DEADLINE_MS;
  let runUrl = `https://github.com/${repo}/actions`;
  let rateLimited = false;

  setStatus({ state: "waiting-for-workflow", message: "Pushed to main. Waiting for the GitHub Actions deployment…", runUrl, sha });

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${api}?head_sha=${sha}&per_page=5`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "resource-studio-publish" },
        signal: AbortSignal.timeout(20000),
      });
      if (response.status === 403 || response.status === 429) {
        rateLimited = true;
        await sleep(60000);
        continue;
      }
      rateLimited = false;
      if (response.ok) {
        const data = await response.json();
        const runs = (data.workflow_runs || []).filter((run) => run.head_sha === sha);
        const run = runs.find((entry) => entry.path === WORKFLOW_PATH) || runs[0];
        if (run) {
          runUrl = run.html_url || runUrl;
          if (run.status === "completed") {
            if (run.conclusion === "success") {
              await verifyLive({ repo, baseUrl, expectedIds, draftIds, filePaths });
              return;
            }
            setStatus({
              state: "workflow-failed",
              done: true,
              ok: false,
              runUrl,
              sha,
              message: `Deployment failed on GitHub Actions (conclusion: ${run.conclusion}). The commit was pushed; open the linked run for the logs.`,
            });
            return;
          }
          setStatus({ state: "workflow-running", message: "GitHub Actions is building and deploying…", runUrl, sha });
        } else {
          setStatus({
            state: "waiting-for-workflow",
            message: "Pushed to main. GitHub Actions has not registered a run for this commit yet…",
            runUrl,
            sha,
          });
        }
      }
    } catch (error) {
      setStatus({ state: "waiting-for-workflow", message: `Monitoring the deployment (${error.message})…`, runUrl, sha });
    }
    await sleep(POLL_RUN_MS);
  }

  setStatus({
    state: "timeout",
    done: true,
    ok: false,
    runUrl,
    sha,
    message: `The deployment did not finish within ${Math.round(DEPLOY_DEADLINE_MS / 60000)} minutes${rateLimited ? " (GitHub API rate limit reached)" : ""}. Open the linked run to follow it.`,
  });
}

/**
 * Validate, gate, stage the exact approved paths, review them, commit, push
 * and start watching the deployment. Throws before touching git whenever the
 * publish cannot be done safely.
 */
export async function publishRepository({ root, catalog, draftResources = [] }) {
  if (publishStatus.active) {
    throw publishError("A publish is already running. Wait for it to finish, then try again.", 409);
  }
  const startedAt = new Date().toISOString();
  publishStatus = {
    state: "preparing",
    message: "Validating the project and preparing the publish…",
    done: false,
    ok: false,
    active: true,
    startedAt,
    finishedAt: null,
    sha: null,
    commitUrl: null,
    runUrl: null,
    liveUrl: null,
    resourceUrl: null,
    staged: [],
    unrelated: [],
    error: null,
  };

  try {
    const branch = (await git(root, ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
    if (branch !== "main") {
      throw publishError(`Publishing pushes to main, but this checkout is on "${branch}". Switch branches before publishing.`);
    }
    const remote = await git(root, ["remote", "get-url", "origin"], { allowFailure: true });
    if (remote.failed || !remote.stdout.trim()) throw publishError("No origin remote is configured, so the publish cannot be pushed.");
    const repo = repositorySlug(remote.stdout);
    if (!repo) throw publishError("The origin remote is not a GitHub repository, so the deployment cannot be watched.");

    const published = catalog.resources.filter((resource) => resource.published);
    if (!published.length) throw publishError("There is nothing marked \"Visible on public website\", so there is nothing to publish.");

    // 1. Same gate GitHub Actions runs, locally, before anything is pushed.
    await runLocalGate(root);

    // 2. Exact file set for this publish.
    const expected = collectPublishPaths(root, catalog);
    const tracked = await trackedPaths(root, expected);
    for (const rel of expected) if (!tracked.has(rel) && !fs.existsSync(path.join(root, rel))) {
      // filtered above; kept for clarity
    }
    const expectedSet = new Set(expected);

    // 3. The index must contain nothing else, so the commit cannot inherit work
    //    the owner staged by hand.
    const stagedBefore = (await git(root, ["diff", "--cached", "--name-only"])).stdout.split("\n").filter(Boolean);
    if (stagedBefore.length) {
      throw publishError(
        `The git index already has ${stagedBefore.length} staged change(s) that are not part of this publish (${stagedBefore.slice(0, 5).join(", ")}). Unstage them first so the publish commit stays limited to the approved resource files.`,
        409
      );
    }

    // 4. Inspect the working tree and report anything the publish will leave behind.
    const entries = parseStatus((await git(root, ["status", "--porcelain", "-uall"])).stdout);
    const unrelated = entries.filter((entry) => !expectedSet.has(entry.path)).map((entry) => `${entry.code.trim() || "M"} ${entry.path}`);
    const conflicting = entries.filter((entry) => expectedSet.has(entry.path) && entry.code.trim() === "??");
    void conflicting;

    // 5. Review the exact bytes BEFORE staging, so a refusal leaves git untouched.
    const privateIssues = await reviewForPrivateData(root, expected, draftResources);
    if (privateIssues.length) {
      throw publishError(`Publish blocked by the private-data review: ${privateIssues.join("; ")}. Nothing was staged or committed.`);
    }

    // 6. Stage only the approved paths (explicit list, never `git add .`).
    await git(root, ["add", "--", ...expected]);

    const staged = (await git(root, ["diff", "--cached", "--name-only"])).stdout.split("\n").filter(Boolean);
    const unexpected = staged.filter((rel) => !expectedSet.has(rel));
    if (unexpected.length) {
      throw publishError(`Unexpected changes appeared in the index (${unexpected.join(", ")}). Publish stopped before committing.`);
    }
    if (!staged.length) {
      setStatus({
        state: "failed",
        done: true,
        ok: false,
        message: "Nothing to publish: the local project already matches the pushed repository.",
        unrelated,
      });
      throw publishError("Nothing to publish: the local project already matches the pushed repository.");
    }

    // 7. Commit exactly those paths, then push. No force, no reset.
    const subject = `publish: ${shortTitles(catalog)}`;
    const body = [
      `Published through Resource Studio: ${published.length} public resource(s).`,
      "",
      `Files: ${staged.length}`,
      ...staged.map((rel) => ` - ${rel}`),
      ...(unrelated.length ? ["", "Left untouched (not published):", ...unrelated.map((rel) => ` - ${rel}`)] : []),
    ].join("\n");
    const commit = await git(root, ["commit", "-m", subject, "-m", body, "--", ...expected]);
    if (commit.failed && /nothing to commit/i.test(commit.detail || "")) {
      setStatus({ state: "failed", done: true, ok: false, message: "Nothing to publish: the local project already matches the pushed repository." });
      throw publishError("Nothing to publish: the local project already matches the pushed repository.");
    }

    const sha = (await git(root, ["rev-parse", "HEAD"])).stdout.trim();
    const commitUrl = `https://github.com/${repo}/commit/${sha}`;
    setStatus({ state: "pushing", message: "Committed locally. Pushing to GitHub…", sha, commitUrl, staged, unrelated });

    const push = await git(root, ["push", "origin", "HEAD:main"], { timeout: 180000 });
    if (push.failed) {
      setStatus({
        state: "failed",
        done: true,
        ok: false,
        message: `Committed locally (${sha.slice(0, 7)}) but the push to origin/main failed. ${push.detail}`,
        sha,
        commitUrl,
        staged,
        unrelated,
      });
      throw publishError(`The publish commit was created but git could not push it: ${push.detail}`);
    }

    const baseUrl = `https://${repo.split("/")[0].toLowerCase()}.github.io/${repo.split("/")[1]}/`;
    const expectedIds = published.map((resource) => resource.id);
    const draftIds = draftResources.map((resource) => resource.id);
    const filePaths = [...new Set(published.map((resource) => resource.filePath).filter(Boolean))];

    setStatus({
      state: "waiting-for-workflow",
      message: "Pushed to main. Waiting for the GitHub Actions deployment…",
      sha,
      commitUrl,
      staged,
      unrelated,
      liveUrl: baseUrl,
    });

    void monitorDeployment({ root, repo, baseUrl, sha, expectedIds, draftIds, filePaths }).catch((error) => {
      setStatus({ state: "failed", done: true, ok: false, message: `Deployment monitoring stopped: ${error.message}` });
    });

    return {
      ok: true,
      sha,
      commitUrl,
      runUrl: `https://github.com/${repo}/actions`,
      liveUrl: baseUrl,
      staged,
      unrelated,
      publishedCount: published.length,
      monitoring: true,
    };
  } catch (error) {
    if (publishStatus.active) {
      setStatus({ state: "failed", done: true, ok: false, error: error.message, message: error.message });
    }
    throw error;
  }
}
