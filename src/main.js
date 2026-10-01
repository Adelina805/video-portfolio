import { inject } from '@vercel/analytics';
import { media } from './media.js';

inject();

const wall = document.getElementById('wall');
const loader = document.getElementById('loader');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const breakpoints = [
  { query: window.matchMedia('(min-width: 1100px)'), columns: 3 },
];

const PLAY_RATIO = 0.35;
const NEAR_MARGIN = '50% 0px';
// Upper bound on how long the loader waits for first-screen posters.
const READY_TIMEOUT = 2500;

const tiles = media.map(createTile);
const tileByFigure = new Map(tiles.map((tile) => [tile.figure, tile]));
let currentColumns = 0;
let started = false;

function createTile(item) {
  const figure = document.createElement('figure');
  figure.className = 'tile';
  figure.style.aspectRatio = `${item.width} / ${item.height}`;

  let poster = null;
  if (item.poster) {
    poster = document.createElement('img');
    poster.className = 'tile-poster';
    poster.alt = '';
    poster.decoding = 'async';
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
  video.addEventListener('loadeddata', () => figure.classList.add('is-ready'), { once: true });

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
  return match ? match.columns : 2;
}

// Greedy shortest-column placement keeps reading order roughly left-to-right
// while balancing column heights from each clip's aspect ratio.
function layout() {
  const count = columnCount();
  if (count === currentColumns) return;
  currentColumns = count;

  const columns = Array.from({ length: count }, () => {
    const column = document.createElement('div');
    column.className = 'wall-column';
    return column;
  });
  const heights = new Array(count).fill(0);

  for (const { item, figure } of tiles) {
    const shortest = heights.indexOf(Math.min(...heights));
    columns[shortest].append(figure);
    heights[shortest] += item.height / item.width;
  }

  wall.replaceChildren(...columns);
}

// Must run after layout(): first-screen posters load eagerly at high priority,
// the rest defer to native lazy loading. Returns the first-screen posters.
function loadPosters() {
  const fold = window.innerHeight;
  const initial = [];

  for (const tile of tiles) {
    if (!tile.poster) continue;
    if (tile.figure.getBoundingClientRect().top < fold) {
      tile.poster.setAttribute('fetchpriority', 'high');
      initial.push(tile.poster);
    } else {
      tile.poster.loading = 'lazy';
    }
    tile.poster.src = tile.item.poster;
  }

  return initial;
}

function whenDecoded(images) {
  const decoded = Promise.allSettled(images.map((img) => img.decode()));
  const timeout = new Promise((resolve) => setTimeout(resolve, READY_TIMEOUT));
  return Promise.race([decoded, timeout]);
}

function dismissLoader() {
  if (!loader) return;
  loader.classList.add('is-done');
  setTimeout(() => loader.remove(), 400);
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
  dismissLoader();
  for (const { figure } of tiles) {
    nearObserver.observe(figure);
    playObserver.observe(figure);
  }
});

breakpoints.forEach(({ query }) => query.addEventListener('change', layout));
reducedMotion.addEventListener('change', updateAll);
document.addEventListener('visibilitychange', updateAll);
