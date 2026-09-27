import { useRef, useState } from "react";
import { isContactConfigured, sendContactMessage } from "../lib/contact";
import { SOCIAL } from "../data/site";
import Reveal from "./Reveal";
import { AlertIcon, CheckIcon, InstagramIcon, SendIcon, YoutubeIcon } from "./icons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const EMPTY = { name: "", email: "", message: "", botcheck: "" };

const SUCCESS_STATUS = {
  type: "success",
  title: "MESSAGE SENT ✓",
  text: "Thanks for reaching out. I'll get back to you.",
};

const VALIDATION_STATUS = {
  type: "error",
  title: "PLEASE CHECK THE FORM",
  text: "Fix the highlighted fields and try again.",
};

export default function Contact() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const formRef = useRef(null);

  const validate = (v) => {
    const next = {};
    if (!v.name.trim()) next.name = "Please enter your name.";
    if (!v.email.trim()) next.email = "Please enter your email.";
    else if (!EMAIL_RE.test(v.email.trim())) next.email = "That email doesn't look right.";
    if (!v.message.trim()) next.message = "Please write a message.";
    else if (v.message.trim().length < 10) next.message = "Message is a little short.";
    return next;
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    if (status) setStatus(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (sending) return;
    const nextErrors = validate(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setStatus(VALIDATION_STATUS);
      const first = Object.keys(nextErrors)[0];
      formRef.current?.querySelector(`[name="${first}"]`)?.focus();
      return;
    }

    setSending(true);
    setStatus(null);

    try {
      await sendContactMessage({
        name: values.name.trim(),
        email: values.email.trim(),
        message: values.message.trim(),
        botcheck: values.botcheck,
      });
      // Reset the form only after a confirmed successful submission.
      setValues(EMPTY);
      setStatus(SUCCESS_STATUS);
    } catch (err) {
      // Keep whatever the visitor typed so they can retry.
      setStatus({
        type: "error",
        title: "MESSAGE COULD NOT BE SENT",
        text: err?.message || "Please try again.",
      });
    } finally {
      setSending(false);
    }
  };

  const isSuccess = status?.type === "success";

  return (
    <section className="section section-alt" id="contact" aria-labelledby="contact-title">
      <div className="container">
        <div className="contact-grid">
          <Reveal className="contact-info">
            <span className="eyebrow">Contact</span>
            <h2 className="section-title" id="contact-title">
              Let's <span className="accent">connect</span>
            </h2>
            <p className="section-lead">
              Have a question, an idea or a collaboration in mind? Send a message — or find me on
              YouTube and Instagram where I share the build.
            </p>

            <div className="contact-points">
              <div className="contact-point">
                <span className="fact-icon" aria-hidden="true">
                  <SendIcon />
                </span>
                <div>
                  <h3>Quick reply</h3>
                  <p>I read every message and reply as fast as I can.</p>
                </div>
              </div>
              <div className="contact-point">
                <span className="fact-icon" aria-hidden="true">
                  <CheckIcon />
                </span>
                <div>
                  <h3>Collaborations</h3>
                  <p>Open to content collaborations, feedback and project discussions.</p>
                </div>
              </div>
            </div>

            <div className="contact-socials">
              <a
                className="social-btn"
                href={SOCIAL.youtube.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <YoutubeIcon />
                YOUTUBE
              </a>
              <a
                className="social-btn"
                href={SOCIAL.instagram.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <InstagramIcon />
                INSTAGRAM
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <form className="contact-form" ref={formRef} onSubmit={onSubmit} noValidate>
              <div className="form-row">
                <div className={`field${errors.name ? " has-error" : ""}`} style={{ "--field-delay": "0.12s" }}>
                  <label htmlFor="contact-name">Name</label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Your name"
                    value={values.name}
                    onChange={onChange}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? "contact-name-error" : undefined}
                  />
                  {errors.name ? (
                    <span className="field-error" id="contact-name-error">
                      {errors.name}
                    </span>
                  ) : null}
                </div>

                <div className={`field${errors.email ? " has-error" : ""}`} style={{ "--field-delay": "0.24s" }}>
                  <label htmlFor="contact-email">Email</label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={values.email}
                    onChange={onChange}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "contact-email-error" : undefined}
                  />
                  {errors.email ? (
                    <span className="field-error" id="contact-email-error">
                      {errors.email}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className={`field${errors.message ? " has-error" : ""}`} style={{ "--field-delay": "0.36s" }}>
                <label htmlFor="contact-message">Message</label>
                <textarea
                  id="contact-message"
                  name="message"
                  placeholder="Tell me what's on your mind..."
                  value={values.message}
                  onChange={onChange}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? "contact-message-error" : undefined}
                />
                {errors.message ? (
                  <span className="field-error" id="contact-message-error">
                    {errors.message}
                  </span>
                ) : null}
              </div>

              {/* honeypot — invisible to humans, spam bots fill it */}
              <div className="hp-field" aria-hidden="true">
                <label htmlFor="contact-botcheck">Leave this field empty</label>
                <input
                  id="contact-botcheck"
                  name="botcheck"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={values.botcheck}
                  onChange={onChange}
                />
              </div>

              <div className="submit-row">
                <button
                  className={`btn btn-primary form-submit${isSuccess ? " is-success" : ""}`}
                  type="submit"
                  disabled={sending || isSuccess}
                >
                  {sending
                    ? "SENDING MESSAGE..."
                    : isSuccess
                      ? "MESSAGE SENT"
                      : "SEND MESSAGE"}
                  {sending ? null : isSuccess ? <CheckIcon /> : <SendIcon />}
                </button>
              </div>

              {status ? (
                <p
                  className={`form-status is-${status.type}`}
                  role={status.type === "error" ? "alert" : "status"}
                >
                  {status.type === "success" ? <CheckIcon /> : <AlertIcon />}
                  <span className="form-status-body">
                    <span className="form-status-title">{status.title}</span>
                    <span className="form-status-text">{status.text}</span>
                  </span>
                </p>
              ) : null}

              <p className="form-privacy">
                Your details are only used to reply to you. No email address is shown on this
                site.
              </p>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
