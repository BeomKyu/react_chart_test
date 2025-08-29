// src/App.jsx

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import ApexDemo from './components/ApexDemo';
import EChartsDemo from './components/EChartsDemo';
import UPlotDemo from './components/UPlotDemo';
import ChartjsDemo from './components/ChartjsDemo';
import PerformanceBenchmark from './components/PerformanceBenchmark';

function Home() {
  return (
    <div style={{padding:'2rem', fontFamily:'sans-serif'}}>
      <h1>Chart Demos</h1>
      <ul style={{lineHeight:1.8}}>
        <li><Link to="/viewer">Unified Viewer</Link></li>
        <li><Link to="/benchmark">🚀 Performance Benchmark</Link></li>
        <li><Link to="/apex">Apex</Link></li>
        <li><Link to="/echarts">ECharts</Link></li>
        <li><Link to="/uplot">uPlot</Link></li>
        <li><Link to="/chartjs">Chart.js</Link></li>
      </ul>
    </div>
  );
}

const LIBS = {
  apex: ApexDemo,
  echarts: EChartsDemo,
  uplot: UPlotDemo,
  chartjs: ChartjsDemo
};

function UnifiedViewer() {
  const [lib, setLib] = useState('echarts');
  const Demo = LIBS[lib];
  return (
    <div style={{padding:'1rem', fontFamily:'sans-serif'}}>
      <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:12}}>
        <h2 style={{margin:0}}>Unified Chart Viewer</h2>
        <label>Chart Library
          <select value={lib} onChange={e=> setLib(e.target.value)} style={{marginLeft:8}}>
            {Object.keys(LIBS).map(k=> <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <Link to="/" style={{marginLeft:'auto'}}>Home</Link>
      </div>
      <div style={{border:'1px solid #ddd', borderRadius:6, padding:8, background:'#fff'}}>
        <Demo />
      </div>
      <div style={{marginTop:20, fontSize:12, color:'#555', lineHeight:1.5}}>
        <strong>성능 비교 지표 아이디어</strong><br/>
        1. 초기 렌더 시간 (mount 시점 ~ first paint) → performance.now 측정<br/>
        2. 재생성(Mock regenerate) 시간 (데이터 n포인트 재생성 + 차트 업데이트 소요)<br/>
        3. 메모리 사용 변화 (Performance API memory; Chrome 전용) / heap snapshot<br/>
        4. 상호작용 응답성 (마우스 이동 시 tooltip latency 평균) → requestAnimationFrame 타임스탬프 차 측정<br/>
        5. 프레임 드롭률 (PerformanceObserver로 long tasks / FPS 계산; 60fps 대비)<br/>
        6. 큰 데이터 임계점 (연속 데이터 포인트 수 증가시키며 렌더 실패/현저한 지연 발생 지점)
        7. 번들 크기 (빌드 후 gzip 크기: 각 라이브러리 import 분리하여 측정)
        8. CPU 사용률 (Performance profile 또는 navigator.scheduling.isInputPending 기반 지표)
        9. 메모리 GC 빈도 (performance.measure + PerformanceObserver 'gc' 이벤트 Chrome flag)
        10. 사용자 체감: 줌/팬(지원 라이브러리) 한 번 당 평균 처리시간
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/viewer" element={<UnifiedViewer />} />
        <Route path="/benchmark" element={<PerformanceBenchmark />} />
        <Route path="/apex" element={<ApexDemo />} />
        <Route path="/echarts" element={<EChartsDemo />} />
        <Route path="/uplot" element={<UPlotDemo />} />
        <Route path="/chartjs" element={<ChartjsDemo />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;