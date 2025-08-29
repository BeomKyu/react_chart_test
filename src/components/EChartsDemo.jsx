import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as echarts from 'echarts';
import { buildMock } from './mockData';

// 전체 지원 타입 (요청된 18종)
const DATASETS = [
  'line','bar','pie','scatter','candlestick','radar','boxplot','heatmap','graph','tree','treemap','sunburst','sankey','funnel','gauge','pictorialBar','calendar','matrix'
];

// 타입별 기본 파라미터 스키마
const SCHEMAS = {
  line: { points:200, series:2 },
  bar: { categories:8, series:2 },
  pie: { slices:6 },
  scatter: { points:400, clusters:3 },
  candlestick: { points:120 },
  radar: { axes:6, series:3 },
  boxplot: { groups:5, samples:30 },
  heatmap: { x:12, y:7 },
  graph: { nodes:30, extraLinks:20 },
  tree: { depth:3, breadth:3 },
  treemap: { depth:3, breadth:3 },
  sunburst: { depth:3, breadth:3 },
  sankey: { nodes:8, links:15 },
  funnel: { stages:5, startValue:1000, drop:0.25 },
  gauge: { min:0, max:100 },
  pictorialBar: { categories:6 },
  calendar: { days:90 },
  matrix: { x:12, y:7 }
};

// 매핑 함수: raw 데이터 -> ECharts option
function buildOption(type, raw) {
  switch(type) {
    case 'line': {
      const series = raw.map(s => ({ name: s.name, type:'line', showSymbol:false, data: s.data }));
      return { xAxis:{ type:'time' }, yAxis:{ type:'value' }, tooltip:{ trigger:'axis' }, legend:{ top:0 }, series };
    }
    case 'bar': {
      return { xAxis:{ type:'category', data: raw.categories }, yAxis:{ type:'value' }, tooltip:{ trigger:'axis' }, legend:{ top:0 }, series: raw.series.map(s=>({ name:s.name, type:'bar', data:s.data })) };
    }
    case 'pie': {
      return { tooltip:{ trigger:'item' }, legend:{ top:0 }, series:[{ type:'pie', radius:['35%','70%'], data: raw }] };
    }
    case 'scatter': {
      return { xAxis:{}, yAxis:{}, tooltip:{ trigger:'item' }, series:[{ type:'scatter', symbolSize:6, data: raw }] };
    }
    case 'candlestick': {
      // raw: [time, open, high, low, close]; ECharts: category + [open, close, low, high]
      const times = raw.map(r=>r[0]);
      const data = raw.map(r=>[r[1], r[4], r[3], r[2]]);
      return { xAxis:{ type:'category', data: times }, yAxis:{ scale:true }, tooltip:{ trigger:'axis' }, series:[{ type:'candlestick', data }] };
    }
    case 'radar': {
      return { tooltip:{}, legend:{ top:0 }, radar:{ indicator: raw.indicators }, series:[{ type:'radar', data: raw.series.map(s=>({ name:s.name, value:s.value })) }] };
    }
    case 'boxplot': {
      // raw: [{name,value:[min,q1,median,q3,max]}]
      return { xAxis:{ type:'category', data: raw.map(r=>r.name) }, yAxis:{ type:'value', scale:true }, tooltip:{ trigger:'item' }, series:[{ type:'boxplot', data: raw.map(r=>r.value) }] };
    }
    case 'heatmap':
    case 'matrix': {
      const { xLabels, yLabels, data } = raw;
      return { tooltip:{ position:'top' }, grid:{ top:50 }, xAxis:{ type:'category', data:xLabels }, yAxis:{ type:'category', data:yLabels }, visualMap:{ min:0, max:100, orient:'horizontal', left:'center', bottom:10 }, series:[{ type:'heatmap', data, emphasis:{ itemStyle:{ shadowBlur:10, shadowColor:'rgba(0,0,0,0.4)' } } }] };
    }
    case 'graph': {
      return { tooltip:{}, series:[{ type:'graph', layout:'force', roam:true, data: raw.nodes.map(n=>({ name:n.id, value:n.value })), links: raw.links, force:{ repulsion:60 } }] };
    }
    case 'tree': {
      return { tooltip:{ trigger:'item', triggerOn:'mousemove' }, series:[{ type:'tree', data:[raw], top:'5%', bottom:'5%', symbolSize:8, expandAndCollapse:true, initialTreeDepth:2, animationDuration:300 }] };
    }
    case 'treemap': {
      return { tooltip:{}, series:[{ type:'treemap', data: raw.children }] };
    }
    case 'sunburst': {
      return { tooltip:{}, series:[{ type:'sunburst', radius:['10%','80%'], data: raw.children, sort:undefined }] };
    }
    case 'sankey': {
      return { tooltip:{}, series:[{ type:'sankey', data: raw.nodes, links: raw.links, emphasis:{ focus:'adjacency' } }] };
    }
    case 'funnel': {
      return { tooltip:{ trigger:'item' }, legend:{ top:0 }, series:[{ type:'funnel', data: raw, minSize:'10%', maxSize:'80%', label:{ show:true, position:'inside' } }] };
    }
    case 'gauge': {
      return { series:[{ type:'gauge', progress:{ show:true }, detail:{ valueAnimation:true }, data:[{ value: raw.value }] }] };
    }
    case 'pictorialBar': {
      return { xAxis:{ type:'category', data: raw.map(r=>r.name) }, yAxis:{ type:'value' }, tooltip:{ trigger:'axis' }, series:[{ type:'pictorialBar', symbol:'rect', symbolRepeat:true, data: raw.map(r=>r.value) }] };
    }
    case 'calendar': {
      const first = raw[0][0]; const last = raw[raw.length-1][0];
      return { tooltip:{}, visualMap:{ min:0, max:100, calculable:true, orient:'horizontal', left:'center' }, calendar:{ range:[first,last] }, series:[{ type:'heatmap', coordinateSystem:'calendar', data: raw }] };
    }
    default:
      return { series:[] };
  }
}

export default function EChartsDemo() {
  const [dataset, setDataset] = useState('line');
  const [params, setParams] = useState(()=> ({ ...SCHEMAS.line }));
  const [regenKey, setRegenKey] = useState(0);
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  // dataset 바뀌면 기본 파라미터 리셋
  useEffect(()=> { setParams({ ...SCHEMAS[dataset] }); setRegenKey(k=>k+1); }, [dataset]);

  const raw = useMemo(()=> buildMock(dataset, params), [dataset, JSON.stringify(params), regenKey]);
  const option = useMemo(()=> buildOption(dataset, raw), [dataset, raw]);

  // 차트 인스턴스 관리
  useEffect(()=> {
    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current);
    } else {
      // 타입 크게 바뀌는 경우 안전하게 clear
      chartRef.current.clear();
    }
    chartRef.current.setOption(option, true);
  }, [option]);

  // 리사이즈 반응
  useEffect(()=> {
    function onResize() { chartRef.current && chartRef.current.resize(); }
    window.addEventListener('resize', onResize); return ()=> window.removeEventListener('resize', onResize);
  }, []);

  const paramInputs = Object.entries(params).map(([k,v]) => (
    <label key={k} style={{display:'flex', alignItems:'center', gap:4}}>
      {k}
      <input
        type="number"
        value={v}
        onChange={e=> setParams(p=> ({ ...p, [k]: k==='drop'? parseFloat(e.target.value): Number(e.target.value) }))}
        step={k==='drop'? 0.01: 1}
        style={{width:80}}
      />
    </label>
  ));

  return (
    <div style={{padding:'1rem', fontFamily:'sans-serif'}}>
      <h2>ECharts Demo (선택형 Mock 전 타입)</h2>
      <div style={{display:'flex', flexWrap:'wrap', gap:'0.75rem', alignItems:'center', marginBottom:'0.75rem'}}>
        <label>Dataset
          <select value={dataset} onChange={e=>setDataset(e.target.value)} style={{marginLeft:8}}>
            {DATASETS.map(d=> <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        {paramInputs}
        <button onClick={()=> setRegenKey(k=>k+1)}>Regenerate</button>
      </div>
      <div ref={containerRef} style={{width:'100%', height:520, border:'1px solid #ddd'}} />
    </div>
  );
}
