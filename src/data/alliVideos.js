/**
 * ALLI video series data — single source of truth.
 *
 * Add "Part 8", "Part 9"... by appending an object here: gallery card,
 * counter and modal are all generated from this array.
 *
 * `poster` is the REAL cover artwork for the episode (the original YouTube
 * Short thumbnail, cropped to the poster and stored in public/images/content/).
 * Drop a new webp there and point `poster` at it — nothing else changes.
 *
 * NOTE: each episode's Instagram / YouTube pair must never be mixed up.
 */

export const ALLI_VIDEOS = [
  {
    id: "introduction",
    poster: "images/content/introduction.webp",
    number: "00",
    title: "INTRODUCTION",
    description: "Why I'm building my own personal AI assistant — the series begins.",
    instagramUrl: "https://www.instagram.com/reel/DdB_6-nIVYC/?stkn=MWltcWx3aWx5YjZlOA==",
    youtubeUrl: "https://youtube.com/shorts/N8_ovfiK10w?si=NgHDpHSYsoXvWzo7",
  },
  {
    id: "part-1",
    poster: "images/content/part-01.webp",
    number: "01",
    title: "PART 1",
    description: "The first connection — Python, Ollama and Qwen working together.",
    instagramUrl: "https://www.instagram.com/reel/Dbge5E4IKjb/?stkn=OWt1bThyb2hrNGRi",
    youtubeUrl: "https://youtube.com/shorts/xJ2YpU9Yz6s?si=1QJ6GDwMN7eTppCq",
  },
  {
    id: "part-2",
    poster: "images/content/part-02.webp",
    number: "02",
    title: "PART 2",
    description: "A basic interactive assistant with conversation handling.",
    instagramUrl: "https://www.instagram.com/reel/DbgdWg_ok84/?stkn=Ym10a2MycDJwdjB4",
    youtubeUrl: "https://youtube.com/shorts/BvTR4WPv0gQ?si=YEQC_LUP-PDS1tV",
  },
  {
    id: "part-3",
    poster: "images/content/part-03.webp",
    number: "03",
    title: "PART 3",
    description: "Memory begins — ALLI starts remembering within a session.",
    instagramUrl: "https://www.instagram.com/reel/Dbl9O88TNpx/?stkn=MWdvd3h6cXJnMHZubQ==",
    youtubeUrl: "https://youtube.com/shorts/2aYsPUaaPV0?si=PBOco9LIjlNs7i7h",
  },
  {
    id: "part-4",
    poster: "images/content/part-04.webp",
    number: "04",
    title: "PART 4",
    description: "Saving conversations to disk for real persistence.",
    instagramUrl: "https://www.instagram.com/reel/Dbx_n1toyYm/?stkn=eDRkbW54M3hsd3Jw",
    youtubeUrl: "https://youtube.com/shorts/1NoY32t2dB8?si=4GGDqslQF1ILUufT",
  },
  {
    id: "part-5",
    poster: "images/content/part-05.webp",
    number: "05",
    title: "PART 5",
    description: "Long-term memory — storing important personal information.",
    instagramUrl: "https://www.instagram.com/reel/DcJzBo_BuP4/?stkn=OG4zYmxua3NhY3hy",
    youtubeUrl: "https://youtube.com/shorts/zr-wjVGPko8?si=FXjxlWRQukAvRZLE",
  },
  {
    id: "part-6",
    poster: "images/content/part-06.webp",
    number: "06",
    title: "PART 6",
    description: "Semantic memory — embeddings and vector retrieval.",
    instagramUrl: "https://www.instagram.com/reel/Dcf3MiIo_m6/?stkn=MThucHE1NDVwdnFjaQ==",
    youtubeUrl: "https://youtube.com/shorts/5PLI6ziiOC0?si=Mn1BrI6GNsaAo10N",
  },
  {
    id: "part-7",
    poster: "images/content/part-07.webp",
    number: "07",
    title: "PART 7",
    description: "The intelligent memory engine — extraction, validation and retrieval.",
    instagramUrl: "https://www.instagram.com/reel/DdhOFpVhjlO/?stkn=bGd0MXRydTA3aTZr",
    youtubeUrl: "https://youtube.com/shorts/c1ZBx9hK4CE?si=67POD7cZedQfA_V0",
  },
];
