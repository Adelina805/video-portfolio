import { inject } from '@vercel/analytics';
import { media } from './media.js';
import { BREAKPOINTS, DEFAULT_COLUMNS, distribute } from './layout.js';
import posterVariants from './posters.json';

inject();

const wall = document.getElementById('wall');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const breakpoints = BREAKPOINTS.map(({ minWidth, columns }) => ({
  query: window.matchMedia(`(min-width: ${minWidth}px)`),
  columns,
}));

const PLAY_RATIO = 0.35;
const NEAR_MARGIN = '50% 0px';
// Upper bound on how long videos wait for first-screen posters.
const READY_TIMEOUT = 2500;

// Rendered tile width per column count; mirrors --margin, --gutter and the
// .wall / .wall-column flex layout in styles.css.
const MARGIN = 'clamp(16px, 3.2vw, 48px)';
const GUTTER = 'clamp(8px, 1vw, 16px)';
const columnSize = (count) => `calc((100vw - 2 * ${MARGIN} - ${count - 1} * ${GUTTER}) / ${count})`;
const POSTER_SIZES = [
  ...BREAKPOINTS.map(({ minWidth, columns }) => `(min-width: ${minWidth}px) ${columnSize(columns)}`),
  columnSize(DEFAULT_COLUMNS),
].join(', ');

const tiles = media.map(createTile);
const tileByFigure = new Map(tiles.map((tile) => [tile.figure, tile]));
const tileByItem = new Map(tiles.map((tile) => [tile.item, tile]));
let currentColumns = 0;
let started = false;

function createTile(item) {
  const figure = document.createElement('figure');
  figure.className = 'tile';
  figure.style.aspectRatio = `${item.width} / ${item.height}`;
  const markLoaded = () => figure.classList.add('is-loaded');

  let poster = null;
  if (item.poster) {
    poster = document.createElement('img');
    poster.className = 'tile-poster';
    poster.alt = '';
    poster.decoding = 'async';
    poster.addEventListener('load', markLoaded, { once: true });
    poster.addEventListener('error', () => poster.remove(), { once: true });
  }

  const video = document.createElement('video');
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  video.disablePictureInPicture = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('disableremoteplayback', '');
  video.width = item.width;
  video.height = item.height;
  video.addEventListener('loadeddata', () => figure.classList.add('is-ready', 'is-loaded'), { once: true });

  if (item.alt) {
    video.setAttribute('aria-label', item.alt);
  } else if (!item.label) {
    video.setAttribute('aria-hidden', 'true');
  }

  const meta = document.createElement(item.label ? 'figcaption' : 'div');
  meta.className = 'tile-meta';
  if (!item.label) meta.setAttribute('aria-hidden', 'true');
  const dot = document.createElement('span');
  dot.className = 'tile-dot';
  dot.setAttribute('aria-hidden', 'true');
  meta.append(dot);
  if (item.label) meta.append(item.label);

  if (poster) figure.append(poster);
  figure.append(video, meta);
  return { item, figure, video, poster, sourced: false, visible: false };
}

function columnCount() {
  const match = breakpoints.find((bp) => bp.query.matches);
  return match ? match.columns : DEFAULT_COLUMNS;
}

function layout() {
  const count = columnCount();
  if (count === currentColumns) return;
  currentColumns = count;

  const columns = distribute(media, count).map((items) => {
    const column = document.createElement('div');
    column.className = 'wall-column';
    column.append(...items.map((item) => tileByItem.get(item).figure));
    return column;
  });

  wall.replaceChildren(...columns);
}

// Must run after layout(): first-screen posters load eagerly, and only the one
// covering the most of the viewport (the likely LCP element) gets high
// priority. The rest defer to native lazy loading. Returns the first-screen
// posters.
function loadPosters() {
  const fold = window.innerHeight;
  const initial = new Set();
  let largest = null;
  let largestArea = 0;

  for (const tile of tiles) {
    if (!tile.poster) continue;
    const rect = tile.figure.getBoundingClientRect();
    if (rect.top >= fold) continue;
    initial.add(tile);
    const area = rect.width * (Math.min(rect.bottom, fold) - Math.max(rect.top, 0));
    if (area > largestArea) {
      largest = tile;
      largestArea = area;
    }
  }

  for (const tile of tiles) {
    const { poster, item } = tile;
    if (!poster) continue;
    if (tile === largest) {
      poster.setAttribute('fetchpriority', 'high');
    } else if (!initial.has(tile)) {
      poster.loading = 'lazy';
    }
    const variants = posterVariants[item.poster];
    if (variants) {
      poster.sizes = POSTER_SIZES;
      poster.srcset = variants.map(({ src, width }) => `${src} ${width}w`).join(', ');
    }
    poster.src = item.poster;
  }

  return [...initial].map((tile) => tile.poster);
}

function whenDecoded(images) {
  const decoded = Promise.allSettled(images.map((img) => img.decode()));
  const timeout = new Promise((resolve) => setTimeout(resolve, READY_TIMEOUT));
  return Promise.race([decoded, timeout]);
}

function loadTile(tile, preload) {
  const { item, video } = tile;

  if (tile.sourced) {
    if (preload === 'auto') video.preload = 'auto';
    return;
  }

  tile.sourced = true;
  if (item.webm) video.append(createSource(item.webm, 'video/webm'));
  video.append(createSource(item.src, 'video/mp4'));
  video.preload = preload;
  video.load();
}

function createSource(src, type) {
  const source = document.createElement('source');
  source.src = src;
  source.type = type;
  return source;
}

function updatePlayback(tile) {
  const shouldPlay = started && tile.visible && !reducedMotion.matches && !document.hidden;

  if (shouldPlay) {
    loadTile(tile, 'auto');
    if (tile.video.paused) tile.video.play().catch(() => {});
  } else if (!tile.video.paused) {
    tile.video.pause();
  }
}

function updateAll() {
  tiles.forEach(updatePlayback);
}

const nearObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const tile = tileByFigure.get(entry.target);
      if (reducedMotion.matches && tile.poster) continue;
      loadTile(tile, 'metadata');
      nearObserver.unobserve(entry.target);
    }
  },
  { rootMargin: NEAR_MARGIN },
);

const playObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const tile = tileByFigure.get(entry.target);
      tile.visible = entry.isIntersecting && entry.intersectionRatio >= PLAY_RATIO;
      updatePlayback(tile);
    }
  },
  { threshold: [0, PLAY_RATIO] },
);

layout();

// Videos wait for first-screen posters so they don't compete for bandwidth
// with the initial visual state.
whenDecoded(loadPosters()).then(() => {
  started = true;
  for (const { figure } of tiles) {
    nearObserver.observe(figure);
    playObserver.observe(figure);
  }
});

breakpoints.forEach(({ query }) => query.addEventListener('change', layout));
reducedMotion.addEventListener('change', updateAll);
document.addEventListener('visibilitychange', updateAll);
