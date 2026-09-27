/**
 * Contact form delivery — Web3Forms (static site, no custom backend).
 *
 * Configure via env var (see .env.example):
 *   VITE_WEB3FORMS_ACCESS_KEY=your_access_key_here
 *
 * The access key is a client-side publish key per Web3Forms' own docs, but it
 * still stays centralized in env config — never hard-coded. No personal email
 * address, password or private credential is ever exposed in the UI or the
 * bundled code.
 */

const ACCESS_KEY = (import.meta.env.VITE_WEB3FORMS_ACCESS_KEY || "").trim();
const ENDPOINT = "https://api.web3forms.com/submit";
const SUBJECT = "New message from TS nextstep portfolio";

export function isContactConfigured() {
  return ACCESS_KEY.length > 0;
}

export async function sendContactMessage({ name, email, message, botcheck = "" }) {
  if (!isContactConfigured()) {
    const err = new Error("Web3Forms access key is not configured.");
    err.code = "NOT_CONFIGURED";
    throw err;
  }

  // Simple spam prevention: humans never see this honeypot field. Pretend the
  // message went through instead of telling the bot it was filtered.
  if (String(botcheck || "").trim()) {
    return { ok: true, spam: true };
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      access_key: ACCESS_KEY,
      name,
      email,
      message,
      subject: SUBJECT,
      from_name: "TS nextstep portfolio",
      botcheck: "",
    }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body — handled below */
  }

  if (!res.ok || data?.success === false) {
    const err = new Error(
      (data && (data.message || data.error)) || `Request failed with status ${res.status}.`,
    );
    err.status = res.status;
    throw err;
  }

  return { ok: true };
}
