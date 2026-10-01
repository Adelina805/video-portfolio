import { inject } from '@vercel/analytics';
import { media } from './media.js';

inject();

const wall = document.getElementById('wall');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const breakpoints = [
  { query: window.matchMedia('(min-width: 1100px)'), columns: 3 },
];

const PLAY_RATIO = 0.35;
const LOAD_MARGIN = '600px 0px';

const tiles = media.map(createTile);
const tileByFigure = new Map(tiles.map((tile) => [tile.figure, tile]));
let currentColumns = 0;

function createTile(item) {
  const figure = document.createElement('figure');
  figure.className = 'tile';
  figure.style.aspectRatio = `${item.width} / ${item.height}`;

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
  if (item.poster) video.poster = item.poster;

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

  figure.append(video, meta);
  return { item, figure, video, loaded: false, visible: false };
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

function loadTile(tile) {
  if (tile.loaded) return;
  tile.loaded = true;

  const { item, video } = tile;
  if (item.webm) video.append(createSource(item.webm, 'video/webm'));
  video.append(createSource(item.src, 'video/mp4'));
  video.preload = reducedMotion.matches ? 'metadata' : 'auto';
  video.load();
}

function createSource(src, type) {
  const source = document.createElement('source');
  source.src = src;
  source.type = type;
  return source;
}

function updatePlayback(tile) {
  const shouldPlay = tile.visible && !reducedMotion.matches && !document.hidden;

  if (shouldPlay) {
    loadTile(tile);
    if (tile.video.paused) tile.video.play().catch(() => {});
  } else if (!tile.video.paused) {
    tile.video.pause();
  }
}

function updateAll() {
  tiles.forEach(updatePlayback);
}

const loadObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      loadTile(tileByFigure.get(entry.target));
      loadObserver.unobserve(entry.target);
    }
  },
  { rootMargin: LOAD_MARGIN },
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

for (const { figure } of tiles) {
  loadObserver.observe(figure);
  playObserver.observe(figure);
}

breakpoints.forEach(({ query }) => query.addEventListener('change', layout));
reducedMotion.addEventListener('change', updateAll);
document.addEventListener('visibilitychange', updateAll);
