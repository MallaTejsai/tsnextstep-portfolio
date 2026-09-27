/** Lightweight inline SVG icons — no icon library needed. */

const base = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

export const ArrowRight = (props) => (
  <svg {...base} {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const ArrowUpRight = (props) => (
  <svg {...base} {...props}>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

export const PlayIcon = (props) => (
  <svg {...base} strokeWidth={0} fill="currentColor" {...props}>
    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
  </svg>
);

export const CloseIcon = (props) => (
  <svg {...base} {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const MailIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);

export const InstagramIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export const YoutubeIcon = (props) => (
  <svg {...base} strokeWidth={0} fill="currentColor" {...props}>
    <path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15V9l5.2 3Z" />
  </svg>
);

export const CodeIcon = (props) => (
  <svg {...base} {...props}>
    <path d="m8 8-4 4 4 4m8-8 4 4-4 4M13.5 5l-3 14" />
  </svg>
);

export const CpuIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    <path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3" />
  </svg>
);

export const LayersIcon = (props) => (
  <svg {...base} {...props}>
    <path d="m12 3 8.5 4.5L12 12 3.5 7.5 12 3Z" />
    <path d="m4 12 8 4.3 8-4.3M4 16.4l8 4.3 8-4.3" />
  </svg>
);

export const VideoIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="6" width="13" height="12" rx="2.5" />
    <path d="m16 11 5-3v8l-5-3z" />
  </svg>
);

export const SparkIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 3.5 13.9 8l4.6.6-3.4 3.2.9 4.6-4-2.3-4 2.3.9-4.6L5.5 8.6 10.1 8 12 3.5Z" />
  </svg>
);

export const ChipIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="7" y="7" width="10" height="10" rx="2" />
    <path d="M10 3v4m4-4v4M10 17v4m4-4v4M3 10h4m-4 4h4m10-4h4m-4 4h4" />
  </svg>
);

export const HammerIcon = (props) => (
  <svg {...base} {...props}>
    <path d="m13.5 6.5 4-4 4 4-4 4m-6.5 1L4 17.5 6.5 20 16 10.5" />
    <path d="m9 15 2 2" />
  </svg>
);

export const CoreIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="3.2" />
    <circle cx="12" cy="12" r="8.2" strokeDasharray="3 3.6" />
  </svg>
);

export const MenuIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const SendIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4 12 20 4l-4 16-4.5-6.5L4 12Z" />
  </svg>
);

export const CheckIcon = (props) => (
  <svg {...base} {...props}>
    <path d="m5 13 4.5 4.5L19 7" />
  </svg>
);

export const AlertIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.2v.3" />
  </svg>
);

const ICONS = {
  code: CodeIcon,
  cpu: CpuIcon,
  layers: LayersIcon,
  video: VideoIcon,
  spark: SparkIcon,
  chip: ChipIcon,
  hammer: HammerIcon,
  core: CoreIcon,
};

export function getIcon(name) {
  return ICONS[name] || CodeIcon;
}
