import { useReveal } from "../hooks/useReveal";

/** Wraps children in a scroll-reveal container. */
export default function Reveal({ children, delay = 0, as: Tag = "div", className = "", ...rest }) {
  const [ref, revealed] = useReveal();

  return (
    <Tag
      ref={ref}
      className={`reveal${revealed ? " is-in" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--reveal-delay": `${delay}s` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
