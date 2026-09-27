/**
 * Contact form delivery — Web3Forms (static site, no custom backend).
 *
 * Configure via env variable (see .env.example):
 *   VITE_WEB3FORMS_ACCESS_KEY=your_web3forms_access_key_here
 *
 * Load it into `.env`, then RESTART the dev server (Vite reads env vars when
 * the server starts) or rebuild for production. Never hard-code the key.
 */

const ACCESS_KEY = (import.meta.env.VITE_WEB3FORMS_ACCESS_KEY || "").trim();
const ENDPOINT = "https://api.web3forms.com/submit";
const SUBJECT = "New message from TS nextstep portfolio";

export function isContactConfigured() {
  return ACCESS_KEY.length > 0;
}

export async function sendContactMessage({ name, email, message, botcheck = "" }) {
  if (!isContactConfigured()) {
    console.error("Web3Forms access key is missing.");
    console.error(
      "Set VITE_WEB3FORMS_ACCESS_KEY in .env (copy .env.example), then restart the dev server or rebuild.",
    );
    const err = new Error("Web3Forms access key is missing.");
    err.code = "NOT_CONFIGURED";
    throw err;
  }

  // Spam protection: humans never see this honeypot field. If it was filled,
  // pretend the message went through instead of telling the bot it was filtered.
  if (String(botcheck || "").trim()) {
    return { ok: true, spam: true };
  }

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        access_key: ACCESS_KEY,
        subject: SUBJECT,
        name,
        email,
        message,
        botcheck: "",
      }),
    });
  } catch (networkErr) {
    console.error(
      "Web3Forms request failed (network):",
      networkErr?.message || networkErr,
    );
    const err = new Error("Network error — check your connection and try again.");
    err.code = "NETWORK";
    throw err;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    console.error("Web3Forms returned a non-JSON response. HTTP status:", res.status);
  }

  // Success ONLY when Web3Forms confirms it.
  if (res.ok && data?.success === true) {
    return { ok: true };
  }

  const detail =
    (data && (data.message || data.error)) ||
    `Web3Forms returned HTTP ${res.status} without an error message.`;
  console.error("Web3Forms submission failed:", {
    url: ENDPOINT,
    status: res.status,
    ok: res.ok,
    response: data,
  });
  const err = new Error(detail);
  err.status = res.status;
  throw err;
}
