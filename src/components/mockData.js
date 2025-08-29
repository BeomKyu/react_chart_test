// 다양한 차트 유형 목데이터 (지정된 18종: line, bar, pie, scatter, candlestick, radar, boxplot, heatmap, graph, tree, treemap, sunburst, sankey, funnel, gauge, pictorialBar, calendar, matrix)
// 불필요했던 이전 생성기 제거/미사용 처리. 필요한 것만 재정의.

// 공통 랜덤
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// line (time series)
export function generateLine({ series = 2, points = 200, start = Date.now() - points * 60_000, interval = 60_000, min = 0, max = 100, volatility = 10 } = {}) {
  const out = [];
  for (let s = 0; s < series; s++) {
    let base = rand(min, max);
    const data = [];
    for (let i = 0; i < points; i++) {
      base += rand(-volatility, volatility);
      if (base < min) base = min; if (base > max) base = max;
      data.push([start + i * interval, Number(base.toFixed(2))]);
    }
    out.push({ name: `L${s + 1}`, data });
  }
  return out;
}

// bar (category multi series)
export function generateBar({ categories = 8, series = 2, min = 10, max = 120 } = {}) {
  const cats = Array.from({ length: categories }, (_, i) => `C${i + 1}`);
  const ser = Array.from({ length: series }, (_, s) => ({
    name: `S${s + 1}`,
    data: cats.map(() => Number(rand(min, max).toFixed(2)))
  }));
  return { categories: cats, series: ser };
}

// pie
export function generatePie({ slices = 6, min = 10, max = 200 } = {}) {
  return Array.from({ length: slices }, (_, i) => ({ name: `Slice${i + 1}`, value: Number(rand(min, max).toFixed(2)) }));
}

// scatter
export function generateScatter({ points = 500, clusters = 3, spread = 50, centerRange = 200 } = {}) {
  const centers = Array.from({ length: clusters }, () => [rand(-centerRange, centerRange), rand(-centerRange, centerRange)]);
  const data = [];
  for (let i = 0; i < points; i++) {
    const [cx, cy] = centers[i % clusters];
    data.push([
      Number((cx + rand(-spread, spread)).toFixed(2)),
      Number((cy + rand(-spread, spread)).toFixed(2))
    ]);
  }
  return data;
}

// candlestick (OHLC)
export function generateCandlestick({ points = 120, start = Date.now() - 120 * 86_400_000, interval = 86_400_000, base = 100, volatility = 2 } = {}) {
  const data = [];
  let price = base;
  for (let i = 0; i < points; i++) {
    const time = start + i * interval;
    const open = price;
    price = Math.max(1, price + rand(-volatility, volatility));
    const close = price;
    const high = Math.max(open, close) + rand(0, volatility * 1.5);
    const low = Math.min(open, close) - rand(0, volatility * 1.5);
    data.push([time, Number(open.toFixed(2)), Number(high.toFixed(2)), Number(low.toFixed(2)), Number(close.toFixed(2))]);
  }
  return data;
}

// radar
export function generateRadar({ axes = 6, series = 3, min = 0, max = 100 } = {}) {
  const indicators = Array.from({ length: axes }, (_, i) => ({ name: `Dim${i + 1}`, max }));
  const data = Array.from({ length: series }, (_, s) => ({ name: `R${s + 1}`, value: indicators.map(() => Number(rand(min, max).toFixed(2))) }));
  return { indicators, series: data };
}

// boxplot
export function generateBoxplot({ groups = 5, samples = 30, min = 0, max = 100 } = {}) {
  const out = [];
  for (let g = 0; g < groups; g++) {
    const arr = Array.from({ length: samples }, () => rand(min, max)).sort((a, b) => a - b);
    const q1 = arr[Math.floor(samples * 0.25)];
    const q2 = arr[Math.floor(samples * 0.5)];
    const q3 = arr[Math.floor(samples * 0.75)];
    out.push({
      name: `G${g + 1}`,
      value: [Number(arr[0].toFixed(2)), Number(q1.toFixed(2)), Number(q2.toFixed(2)), Number(q3.toFixed(2)), Number(arr[arr.length - 1].toFixed(2))]
    });
  }
  return out;
}

// heatmap (matrix style but semantic heatmap)
export function generateHeatmap({ x = 12, y = 7, min = 0, max = 100 } = {}) {
  const xLabels = Array.from({ length: x }, (_, i) => `X${i + 1}`);
  const yLabels = Array.from({ length: y }, (_, i) => `Y${i + 1}`);
  const data = [];
  yLabels.forEach((yy, yi) => {
    xLabels.forEach((xx, xi) => data.push([xi, yi, Number(rand(min, max).toFixed(2))]));
  });
  return { xLabels, yLabels, data };
}

// matrix (generic row/col/value) -> 동일 구조 alias
export const generateMatrix = generateHeatmap;

// graph (force / network)
export function generateGraph({ nodes = 30, extraLinks = 20 } = {}) {
  const nodeArr = Array.from({ length: nodes }, (_, i) => ({ id: `N${i}`, name: `Node ${i}`, value: randInt(1, 10) }));
  const links = [];
  for (let i = 1; i < nodes; i++) links.push({ source: `N${randInt(0, i - 1)}`, target: `N${i}`, value: randInt(1, 5) });
  for (let k = 0; k < extraLinks; k++) {
    const a = randInt(0, nodes - 1); const b = randInt(0, nodes - 1); if (a !== b) links.push({ source: `N${a}`, target: `N${b}`, value: randInt(1, 5) });
  }
  return { nodes: nodeArr, links };
}

// tree / treemap / sunburst 공통
function buildTree(depth, breadth, level = 0, prefix = 'T') {
  if (depth === 0) return [];
  return Array.from({ length: breadth }, (_, i) => {
    const name = `${prefix}${level}-${i}`;
    const children = buildTree(depth - 1, breadth, level + 1, prefix);
    const value = children.length ? undefined : randInt(10, 100);
    const node = { name };
    if (children.length) node.children = children;
    if (value !== undefined) node.value = value;
    return node;
  });
}
export function generateTree({ depth = 3, breadth = 3 } = {}) { return { name: 'root', children: buildTree(depth, breadth) }; }
export const generateTreemap = generateTree;
export const generateSunburst = generateTree;

// sankey
export function generateSankey({ nodes = 8, links = 15, min = 1, max = 50 } = {}) {
  const nodeArr = Array.from({ length: nodes }, (_, i) => ({ name: `N${i}` }));
  const linkArr = [];
  while (linkArr.length < links) {
    const s = randInt(0, nodes - 2);
    const t = randInt(s + 1, nodes - 1);
    linkArr.push({ source: `N${s}`, target: `N${t}`, value: randInt(min, max) });
  }
  return { nodes: nodeArr, links: linkArr };
}

// funnel
export function generateFunnel({ stages = 5, startValue = 1000, drop = 0.25 } = {}) {
  let current = startValue; const data = [];
  for (let i = 0; i < stages; i++) { data.push({ name: `Stage${i + 1}`, value: Math.round(current) }); current *= (1 - drop * rand(0.8, 1.2)); }
  return data;
}

// gauge (단일 값)
export function generateGauge({ min = 0, max = 100 } = {}) {
  return { value: Number(rand(min, max).toFixed(2)), min, max };
}

// pictorialBar (심볼 형태 카테고리 값)
export function generatePictorialBar({ categories = 6, min = 10, max = 150 } = {}) {
  const cats = Array.from({ length: categories }, (_, i) => `P${i + 1}`);
  return cats.map(c => ({ name: c, value: Number(rand(min, max).toFixed(2)) }));
}

// calendar (YYYY-MM-DD -> value)
export function generateCalendar({ days = 90, startDate = new Date(Date.now() - 90 * 86_400_000), min = 0, max = 100 } = {}) {
  const data = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate.getTime() + i * 86_400_000);
    data.push([d.toISOString().slice(0, 10), Number(rand(min, max).toFixed(2))]);
  }
  return data;
}

// 타입 → 생성기 매핑
const GENERATORS = {
  line: generateLine,
  bar: generateBar,
  pie: generatePie,
  scatter: generateScatter,
  candlestick: generateCandlestick,
  radar: generateRadar,
  boxplot: generateBoxplot,
  heatmap: generateHeatmap,
  graph: generateGraph,
  tree: generateTree,
  treemap: generateTreemap,
  sunburst: generateSunburst,
  sankey: generateSankey,
  funnel: generateFunnel,
  gauge: generateGauge,
  pictorialBar: generatePictorialBar,
  calendar: generateCalendar,
  matrix: generateMatrix
};

// 단일 타입 생성
export function buildMock(type, config = {}) {
  const gen = GENERATORS[type];
  if (!gen) throw new Error(`Unknown mock type: ${type}`);
  return gen(config);
}

// 다중 타입 선택 생성 (성능 위해 요청된 것만)
// usage: buildMockBundle([ 'line', { type:'bar', config:{ categories:12 }} ])
export function buildMockBundle(requests = []) {
  const bundle = {};
  requests.forEach(r => {
    if (typeof r === 'string') bundle[r] = buildMock(r, {});
    else if (r && typeof r === 'object') bundle[r.type] = buildMock(r.type, r.config || {});
  });
  return bundle;
}

export default {
  generateLine,
  generateBar,
  generatePie,
  generateScatter,
  generateCandlestick,
  generateRadar,
  generateBoxplot,
  generateHeatmap,
  generateGraph,
  generateTree,
  generateTreemap,
  generateSunburst,
  generateSankey,
  generateFunnel,
  generateGauge,
  generatePictorialBar,
  generateCalendar,
  generateMatrix,
  buildMock,
  buildMockBundle
};
