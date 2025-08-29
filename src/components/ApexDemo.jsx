import React, { useState, useMemo, useEffect } from 'react';
import ReactApexChart from 'react-apexcharts';
import { buildMock } from './mockData';

// 지원/매핑 대상 타입 목록 (Apex에서 직접 표현 가능하거나 근사 표현)
const SUPPORTED = [
  'line','bar','pie','scatter','candlestick','radar','boxplot','heatmap','treemap','pictorialBar','gauge','matrix'
];
// 선택 목록 (요구된 18종 모두, 미지원은 안내만)
const ALL_DATASETS = [
  'line','bar','pie','scatter','candlestick','radar','boxplot','heatmap','graph','tree','treemap','sunburst','sankey','funnel','gauge','pictorialBar','calendar','matrix'
];

// 기본 파라미터 스키마
const SCHEMAS = {
  line: { points:200, series:2 },
  bar: { categories:8, series:2 },
  pie: { slices:6 },
  scatter: { points:500, clusters:3 },
  candlestick: { points:120 },
  radar: { axes:6, series:3 },
  boxplot: { groups:5, samples:30 },
  heatmap: { x:12, y:7 },
  treemap: { depth:3, breadth:3 },
  pictorialBar: { categories:6 },
  gauge: { min:0, max:100 },
  matrix: { x:12, y:7 },
  graph: {}, tree:{}, sunburst:{}, sankey:{}, funnel:{}, calendar:{}
};

// 타입별 Apex 변환기
function mapToApex(dataset, raw) {
  switch(dataset) {
    case 'line':
      return {
        type: 'line',
        series: raw.map(s=>({ name: s.name, data: s.data })),
        options: { xaxis:{ type:'datetime' }, stroke:{ curve:'smooth', width:2 } }
      };
    case 'bar':
      return {
        type: 'bar',
        series: raw.series.map(s=>({ name: s.name, data: s.data })),
        options: { xaxis:{ categories: raw.categories } }
      };
    case 'pie': {
      return {
        type: 'pie',
        series: raw.map(r=>r.value),
        options: { labels: raw.map(r=>r.name) }
      };
    }
    case 'scatter':
      return {
        type: 'scatter',
        series: [{ name:'Scatter', data: raw }],
        options: {}
      };
    case 'candlestick':
      return {
        type: 'candlestick',
        series: [{ data: raw.map(d=>({ x:d[0], y:[d[1],d[2],d[3],d[4]] })) }],
        options: { xaxis:{ type:'datetime' } }
      };
    case 'radar':
      return {
        type: 'radar',
        series: raw.series.map(s=>({ name:s.name, data:s.value })),
        options: { xaxis:{ categories: raw.indicators.map(i=>i.name) } }
      };
    case 'boxplot':
      return {
        type: 'boxPlot',
        series: [{ type:'boxPlot', data: raw.map(r=>({ x:r.name, y:r.value })) }],
        options: {}
      };
    case 'heatmap':
    case 'matrix': { // 동일 구조
      const { xLabels, yLabels, data } = raw;
      // yLabel 별 series 구성
      const matrix = yLabels.map((yl, yi)=>({
        name: yl,
        data: xLabels.map((xl, xi)=>{
          const cell = data.find(d=>d[0]===xi && d[1]===yi);
            return { x: xl, y: cell ? cell[2] : null };
        })
      }));
      return {
        type: 'heatmap',
        series: matrix,
        options: {}
      };
    }
    case 'treemap': {
      // raw is hierarchical root -> flatten leaves
      const leaves = [];
      function walk(node){
        if (node.children && node.children.length) node.children.forEach(walk); else if (typeof node.value === 'number') leaves.push({ x: node.name, y: node.value });
      }
      walk(raw);
      return {
        type: 'treemap',
        series: [{ data: leaves }],
        options: { legend:{ show:false } }
      };
    }
    case 'pictorialBar': {
      // 근사: 일반 bar 로 표현
      const categories = raw.map(r=>r.name);
      return {
        type: 'bar',
        series: [{ name:'Value', data: raw.map(r=>r.value) }],
        options: { xaxis:{ categories } }
      };
    }
    case 'gauge': {
      // 근사: radialBar
      return {
        type: 'radialBar',
        series: [ raw.value ],
        options: { labels:['Gauge'], plotOptions:{ radialBar:{ hollow:{ size:'55%' }, dataLabels:{ value:{ formatter: v=>v.toFixed(1) } } } }, yaxis:{ min:raw.min, max:raw.max } }
      };
    }
    default:
      return { type: 'line', series: [], options: {} };
  }
}

export default function ApexDemo() {
  const [dataset, setDataset] = useState('line');
  const [params, setParams] = useState(() => ({ ...SCHEMAS.line }));
  const [regenKey, setRegenKey] = useState(0); // 재생성 트리거

  // dataset 변경 시 기본 파라미터 리셋
  useEffect(()=>{ setParams({ ...SCHEMAS[dataset] }); setRegenKey(k=>k+1); }, [dataset]);

  // raw data 생성 (선택 타입만)
  const raw = useMemo(()=> {
    if (!SUPPORTED.includes(dataset)) return null;
    return buildMock(dataset, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, JSON.stringify(params), regenKey]);

  const mapped = useMemo(()=> raw ? mapToApex(dataset, raw) : null, [raw, dataset]);

  const isSupported = SUPPORTED.includes(dataset);

  // 파라미터 입력 렌더
  const paramInputs = Object.entries(params || {}).map(([k,v]) => (
    <label key={k} style={{display:'flex', alignItems:'center', gap:4}}>
      {k}
      <input
        type="number"
        value={v}
        onChange={e=> setParams(p=> ({ ...p, [k]: Number(e.target.value) }))}
        style={{width:80}}
      />
    </label>
  ));

  return (
    <div style={{padding:'1rem', fontFamily:'sans-serif'}}>
      <h2>Apex Demo (선택형 Mock)</h2>
      <div style={{display:'flex', flexWrap:'wrap', gap:'1rem', alignItems:'center', marginBottom:'0.75rem'}}>
        <label>Dataset
          <select value={dataset} onChange={e=>setDataset(e.target.value)} style={{marginLeft:8}}>
            {ALL_DATASETS.map(d=> <option key={d} value={d}>{d}{!SUPPORTED.includes(d) ? ' (x)' : ''}</option>)}
          </select>
        </label>
        {isSupported && paramInputs}
        {isSupported && <button onClick={()=> setRegenKey(k=>k+1)}>Regenerate</button>}
      </div>
      {!isSupported && (
        <div style={{padding:'1rem', border:'1px solid #f99', background:'#fff5f5', borderRadius:6}}>
          <strong>{dataset}</strong> 타입은 ApexCharts에서 직접 지원되지 않거나 샘플 매퍼가 없습니다.
        </div>
      )}
      {isSupported && mapped && (
        <ReactApexChart
          key={dataset}
          type={mapped.type}
          series={mapped.series}
            options={{
              chart:{ type: mapped.type, animations:{ enabled:false }, height:500 },
              legend:{ position:'top' },
              ...mapped.options
            }}
          height={500}
        />
      )}
    </div>
  );
}
