import { defineConfig } from 'vite';
import { media } from './src/media.js';
import { BREAKPOINTS, DEFAULT_COLUMNS, distribute } from './src/layout.js';

// Before main.js fills #wall, reserve the exact height the masonry will have
// so content below it (the footer) doesn't shift. Percentage padding resolves
// against the wall's content width, matching the flex column math in
// styles.css (.wall / .wall-column). The tallest column wins via max().
function wallHeight(count) {
  const columnWidth = `(100% - ${count - 1} * var(--gutter)) / ${count}`;
  const terms = distribute(media, count).map((items) => {
    const ratio = items.reduce((sum, item) => sum + item.height / item.width, 0);
    return `calc(${columnWidth} * ${+ratio.toFixed(6)} + ${items.length - 1} * var(--gutter))`;
  });
  return `max(${terms.join(', ')})`;
}

function wallReserveCss() {
  const rule = (count) => `.wall:empty::before{content:"";padding-top:${wallHeight(count)}}`;
  // Later rules win, so emit in reverse to match columnCount()'s first-match lookup.
  const queries = [...BREAKPOINTS]
    .reverse()
    .map(({ minWidth, columns }) => `@media (min-width:${minWidth}px){${rule(columns)}}`);
  return [rule(DEFAULT_COLUMNS), ...queries].join('');
}

const wallReserve = {
  name: 'wall-reserve',
  transformIndexHtml() {
    return [{ tag: 'style', children: wallReserveCss(), injectTo: 'head' }];
  },
};

export default defineConfig({
  plugins: [wallReserve],
});
