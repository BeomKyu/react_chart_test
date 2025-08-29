import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Chart, LineController, LineElement, PointElement, BarController, BarElement, PieController, ArcElement, ScatterController, CategoryScale, LinearScale, TimeScale, Tooltip, Legend, RadarController, RadialLinearScale } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { buildMock } from './mockData';
import { CandlestickController, CandlestickElement, OhlcController, OhlcElement } from 'chartjs-chart-financial';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';

Chart.register(
  LineController, LineElement, PointElement,
  BarController, BarElement,
  PieController, ArcElement,
  ScatterController,
  RadarController, RadialLinearScale,
  CategoryScale, LinearScale, TimeScale,
  Tooltip, Legend,
  CandlestickController, CandlestickElement, OhlcController, OhlcElement,
  MatrixController, MatrixElement
);

const DATASETS = [
  'line','bar','pie','scatter','candlestick','radar','boxplot','heatmap','funnel','gauge','pictorialBar','calendar','matrix'
];
// 제거된: graph, tree, treemap, sunburst, sankey (플러그인 미설치)

const SCHEMAS = {
  line: { points:200, series:2 },
  bar: { categories:8, series:2 },
  pie: { slices:6 },
  scatter: { points:400, clusters:3 },
  candlestick: { points:120 },
  radar: { axes:6, series:3 },
  boxplot: { groups:5, samples:30 }, // boxplot 플러그인 제거 -> 미지원 알림
  heatmap: { x:12, y:7 },
  funnel: { stages:5, startValue:1000, drop:0.25 }, // 근사 bar
  gauge: { min:0, max:100 },
  pictorialBar: { categories:6 },
  calendar: { days:90 },
  matrix: { x:12, y:7 }
};

const palette = ['#2563eb','#16a34a','#dc2626','#9333ea','#f59e0b','#0d9488','#be123c','#0891b2','#f472b6','#475569'];

function buildConfig(type, raw) {
  switch(type) {
    case 'line': {
      return {
        type:'line',
        data:{ datasets: raw.map((s,i)=> ({ label:s.name, data: s.data.map(p=> ({ x:p[0], y:p[1] })), pointRadius:0, borderWidth:2, borderColor: palette[i%palette.length], fill:false })) },
        options:{ scales:{ x:{ type:'time' }, y:{ type:'linear' } }, animation:false }
      };
    }
    case 'bar': return { type:'bar', data:{ labels: raw.categories, datasets: raw.series.map((s,i)=> ({ label:s.name, data:s.data, backgroundColor: palette[i%palette.length] })) } };
    case 'pie': return { type:'pie', data:{ labels: raw.map(r=>r.name), datasets:[{ data: raw.map(r=>r.value), backgroundColor: raw.map((_,i)=> palette[i%palette.length]) }] } };
    case 'scatter': return { type:'scatter', data:{ datasets:[{ label:'Scatter', data: raw.map(r=>({ x:r[0], y:r[1] })), backgroundColor: palette[0], pointRadius:3 }] }, options:{ scales:{ x:{ type:'linear' }, y:{ type:'linear' } } } };
    case 'candlestick': {
      return { type:'candlestick', data:{ datasets:[{ label:'OHLC', data: raw.map(r=> ({ x:r[0], o:r[1], h:r[2], l:r[3], c:r[4] }) ) }] }, options:{ scales:{ x:{ type:'time' }, y:{ type:'linear' } } } };
    }
    case 'radar': return { type:'radar', data:{ labels: raw.indicators.map(i=>i.name), datasets: raw.series.map((s,i)=> ({ label:s.name, data:s.value, borderColor:palette[i%palette.length], backgroundColor: palette[i%palette.length]+'33' })) } };
    case 'heatmap':
    case 'matrix': { const { xLabels, yLabels, data } = raw; return { type:'matrix', data:{ datasets:[{ label:'Heat', data: data.map(d=>({ x:xLabels[d[0]], y:yLabels[d[1]], v:d[2] })), width: ({chart})=> (chart.chartArea||{}).width / xLabels.length - 2, height: ({chart})=> (chart.chartArea||{}).height / yLabels.length - 2, backgroundColor: ctx => { const v=ctx.raw.v; const t=v/100; return `rgba(${Math.round(255*t)},80,${Math.round(255*(1-t))},0.9)`; } }] }, options:{ scales:{ x:{ type:'category' }, y:{ type:'category' } } } }; }
    case 'funnel': return { type:'bar', data:{ labels: raw.map(r=>r.name), datasets:[{ label:'Funnel', data: raw.map(r=>r.value), backgroundColor: raw.map((_,i)=> palette[i%palette.length]) }] }, options:{ indexAxis:'y' } };
    case 'gauge': { const pct = (raw.value - raw.min)/(raw.max - raw.min || 1)*100; return { type:'doughnut', data:{ labels:['Value','Remainder'], datasets:[{ data:[pct,100-pct], backgroundColor:['#2563eb','#e5e7eb'], circumference:180, rotation:270, borderWidth:0 }] }, options:{ plugins:{ legend:{ display:false } } } }; }
    case 'pictorialBar': return { type:'bar', data:{ labels: raw.map(r=>r.name), datasets:[{ label:'Value', data: raw.map(r=>r.value), backgroundColor: raw.map((_,i)=> palette[i%palette.length]) }] } };
    case 'calendar': return { type:'line', data:{ datasets:[{ label:'Value', data: raw.map(r=> ({ x:new Date(r[0]).getTime(), y:r[1] })), borderColor: palette[0], pointRadius:0, borderWidth:2 }] }, options:{ scales:{ x:{ type:'time' }, y:{ type:'linear' } } } };
    default: return { type:'line', data:{ labels:[], datasets:[] } };
  }
}

export default function ChartjsDemo() {
  const [dataset, setDataset] = useState('line');
  const [params, setParams] = useState(()=> ({ ...SCHEMAS.line }));
  const [regenKey, setRegenKey] = useState(0);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(()=> { setParams({ ...SCHEMAS[dataset] }); setRegenKey(k=>k+1); }, [dataset]);

  const raw = useMemo(()=> buildMock(dataset, params), [dataset, JSON.stringify(params), regenKey]);
  const cfg = useMemo(()=> buildConfig(dataset, raw), [dataset, raw]);

  useEffect(()=> {
    if (!cfg) return;
    if (!chartRef.current) {
      chartRef.current = new Chart(canvasRef.current.getContext('2d'), cfg);
    } else {
      chartRef.current.config.type = cfg.type;
      chartRef.current.data = cfg.data;
      chartRef.current.options = cfg.options || {};
      chartRef.current.update();
    }
  }, [cfg]);

  const paramInputs = Object.entries(params || {}).map(([k,v]) => (
    <label key={k} style={{display:'flex', alignItems:'center', gap:4}}>
      {k}
      <input type="number" value={v} step={k==='drop'?0.01:1} onChange={e=> setParams(p=> ({ ...p, [k]: k==='drop'? parseFloat(e.target.value): Number(e.target.value) }))} style={{width:90}} />
    </label>
  ));

  const unsupportedNotice = dataset === 'boxplot' ? 'boxplot 플러그인 미설치 (chartjs-chart-box-and-violin-plot) - 지원 제거' : null;

  return (
    <div style={{padding:'1rem', fontFamily:'sans-serif'}}>
      <h2>Chart.js Demo (선택형 Mock)</h2>
      <div style={{display:'flex', flexWrap:'wrap', gap:'0.75rem', alignItems:'center', marginBottom:12}}>
        <label>Dataset
          <select value={dataset} onChange={e=> setDataset(e.target.value)} style={{marginLeft:8}}>
            {DATASETS.map(d=> <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        {paramInputs}
        <button onClick={()=> setRegenKey(k=>k+1)}>Regenerate</button>
      </div>
      {unsupportedNotice && <div style={{padding:8, background:'#fff5f5', border:'1px solid #f99', marginBottom:12}}>{unsupportedNotice}</div>}
      <div style={{width:'100%', height:520, border:'1px solid #ddd', position:'relative'}}>
        <canvas ref={canvasRef} />
      </div>
      <div style={{marginTop:16, fontSize:12, color:'#555', lineHeight:1.5}}>
        제거된 고급 타입(graph/tree/treemap/sunburst/sankey/boxplot)은 Chart.js 전용 추가 플러그인 미설치 상태. 필요 시 호환 버전 재선정 후 다시 추가 가능.
      </div>
    </div>
  );
}
