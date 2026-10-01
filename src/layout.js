// Shared by the browser (src/main.js) and the build (vite.config.js), so keep
// this module free of DOM access.

export const DEFAULT_COLUMNS = 2;
export const BREAKPOINTS = [{ minWidth: 1100, columns: 3 }];

// Greedy shortest-column placement keeps reading order roughly left-to-right
// while balancing column heights from each clip's aspect ratio.
// Returns one array of items per column.
export function distribute(items, count) {
  const columns = Array.from({ length: count }, () => []);
  const heights = new Array(count).fill(0);

  for (const item of items) {
    const shortest = heights.indexOf(Math.min(...heights));
    columns[shortest].push(item);
    heights[shortest] += item.height / item.width;
  }

  return columns;
}
