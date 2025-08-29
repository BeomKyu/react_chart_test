import React, { useState, useRef, useEffect, useMemo } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { buildMock } from './mockData';

// 전체 지원 타입 (EChartsDemo와 동일)
const DATASETS = [
  'line','bar','pie','scatter','candlestick','radar','boxplot','heatmap','graph','tree','treemap','sunburst','sankey','funnel','gauge','pictorialBar','calendar','matrix'
];

// uPlot에서 구현 가능한 타입들
const SUPPORTED = [
  'line','bar','scatter','pie','candlestick','boxplot','heatmap','funnel','gauge','pictorialBar','calendar','matrix'
];

// 타입별 기본 파라미터 스키마 (EChartsDemo와 동일)
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

// 색상 팔레트 (ChartjsDemo와 동일)
const palette = ['#2563eb','#16a34a','#dc2626','#9333ea','#f59e0b','#0d9488','#be123c','#0891b2','#f472b6','#475569'];

// ========== uPlot 플러그인들 ==========

// Bar 플러그인
function barPlugin() {
  return {
    hooks: {
      draw: (u) => {
        const { ctx, data, series } = u;
        const seriesCount = series.length - 1; // x축 제외
        if (seriesCount <= 0) return;
        
        const xVals = data[0];
        const len = xVals.length;
        if (len === 0) return;
        
        // 바 간격 계산
        let gap = 60;
        if (len > 1) {
          gap = u.valToPos(1, 'x', true) - u.valToPos(0, 'x', true);
        }
        
        const groupWidth = gap * 0.8;
        const barWidth = groupWidth / seriesCount;
        
        for (let i = 0; i < len; i++) {
          const xPos = u.valToPos(i, 'x', true);
          const leftStart = xPos - groupWidth / 2;
          
          for (let s = 1; s <= seriesCount; s++) {
            const val = data[s][i];
            if (val == null) continue;
            
            const yPos = u.valToPos(val, 'y', true);
            const yZero = u.valToPos(0, 'y', true);
            const height = Math.abs(yZero - yPos);
            
            ctx.fillStyle = palette[(s-1) % palette.length];
            ctx.fillRect(
              Math.round(leftStart + (s-1) * barWidth),
              Math.round(Math.min(yPos, yZero)),
              Math.round(barWidth - 2),
              Math.round(height)
            );
          }
        }
      }
    }
  };
}

// Scatter 플러그인
function scatterPlugin() {
  return {
    hooks: {
      draw: (u) => {
        const { ctx, data } = u;
        const x = data[0];
        const y = data[1];
        
        if (!x || !y) return;
        
        ctx.fillStyle = palette[0];
        for (let i = 0; i < x.length; i++) {
          const px = u.valToPos(x[i], 'x', true);
          const py = u.valToPos(y[i], 'y', true);
          
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  };
}

// Pie 플러그인
function piePlugin(rawData) {
  return {
    hooks: {
      draw: (u) => {
        const { ctx, bbox } = u;
        const centerX = bbox.left + bbox.width / 2;
        const centerY = bbox.top + bbox.height / 2;
        const radius = Math.min(bbox.width, bbox.height) * 0.35;
        
        const total = rawData.reduce((sum, item) => sum + item.value, 0);
        let currentAngle = -Math.PI / 2;
        
        rawData.forEach((item, index) => {
          const sliceAngle = (item.value / total) * 2 * Math.PI;
          
          ctx.fillStyle = palette[index % palette.length];
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
          ctx.closePath();
          ctx.fill();
          
          // 라벨
          const labelAngle = currentAngle + sliceAngle / 2;
          const labelX = centerX + Math.cos(labelAngle) * radius * 0.7;
          const labelY = centerY + Math.sin(labelAngle) * radius * 0.7;
          
          ctx.fillStyle = '#fff';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.name, labelX, labelY);
          
          currentAngle += sliceAngle;
        });
      }
    }
  };
}

// Candlestick 플러그인
function candlestickPlugin() {
  return {
    hooks: {
      draw: (u) => {
        const { ctx, data } = u;
        const x = data[0];
        const open = data[1];
        const high = data[2];
        const low = data[3];
        const close = data[4];
        
        if (!x || x.length === 0) return;
        
        const candleWidth = 8;
        
        for (let i = 0; i < x.length; i++) {
          const xPos = u.valToPos(x[i], 'x', true);
          const openY = u.valToPos(open[i], 'y', true);
          const highY = u.valToPos(high[i], 'y', true);
          const lowY = u.valToPos(low[i], 'y', true);
          const closeY = u.valToPos(close[i], 'y', true);
          
          const isUp = close[i] >= open[i];
          ctx.strokeStyle = isUp ? '#16a34a' : '#dc2626';
          ctx.fillStyle = isUp ? '#16a34a' : '#dc2626';
          ctx.lineWidth = 1;
          
          // 심지
          ctx.beginPath();
          ctx.moveTo(xPos, highY);
          ctx.lineTo(xPos, lowY);
          ctx.stroke();
          
          // 몸통
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.abs(openY - closeY);
          
          ctx.fillRect(
            xPos - candleWidth / 2,
            bodyTop,
            candleWidth,
            Math.max(bodyHeight, 1)
          );
        }
      }
    }
  };
}

// Boxplot 플러그인
function boxplotPlugin() {
  return {
    hooks: {
      draw: (u) => {
        const { ctx, data } = u;
        const x = data[0];
        const mins = data[1];
        const q1s = data[2];
        const medians = data[3];
        const q3s = data[4];
        const maxs = data[5];
        
        if (!x || x.length === 0) return;
        
        const boxWidth = 40;
        ctx.strokeStyle = '#666';
        ctx.fillStyle = '#e3f2fd';
        ctx.lineWidth = 1;
        
        for (let i = 0; i < x.length; i++) {
          const xPos = u.valToPos(i, 'x', true);
          const minY = u.valToPos(mins[i], 'y', true);
          const q1Y = u.valToPos(q1s[i], 'y', true);
          const medY = u.valToPos(medians[i], 'y', true);
          const q3Y = u.valToPos(q3s[i], 'y', true);
          const maxY = u.valToPos(maxs[i], 'y', true);
          
          // 박스
          const boxHeight = q1Y - q3Y;
          ctx.fillRect(xPos - boxWidth/2, q3Y, boxWidth, boxHeight);
          ctx.strokeRect(xPos - boxWidth/2, q3Y, boxWidth, boxHeight);
          
          // 중앙값 선
          ctx.beginPath();
          ctx.moveTo(xPos - boxWidth/2, medY);
          ctx.lineTo(xPos + boxWidth/2, medY);
          ctx.stroke();
          
          // 수염
          ctx.beginPath();
          ctx.moveTo(xPos, q3Y);
          ctx.lineTo(xPos, maxY);
          ctx.moveTo(xPos, q1Y);
          ctx.lineTo(xPos, minY);
          ctx.stroke();
          
          // 끝 캡
          ctx.beginPath();
          ctx.moveTo(xPos - boxWidth/4, maxY);
          ctx.lineTo(xPos + boxWidth/4, maxY);
          ctx.moveTo(xPos - boxWidth/4, minY);
          ctx.lineTo(xPos + boxWidth/4, minY);
          ctx.stroke();
        }
      }
    }
  };
}

// Heatmap 플러그인
function heatmapPlugin(rawData) {
  return {
    hooks: {
      draw: (u) => {
        const { ctx, bbox } = u;
        const { xLabels, yLabels, data } = rawData;
        
        const cellWidth = bbox.width / xLabels.length;
        const cellHeight = bbox.height / yLabels.length;
        
        const values = data.map(d => d[2]);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        
        data.forEach(([x, y, value]) => {
          const intensity = (value - minVal) / (maxVal - minVal);
          const red = Math.round(intensity * 255);
          const blue = Math.round((1 - intensity) * 255);
          
          ctx.fillStyle = `rgb(${red}, 100, ${blue})`;
          ctx.fillRect(
            bbox.left + x * cellWidth,
            bbox.top + y * cellHeight,
            cellWidth,
            cellHeight
          );
        });
      }
    }
  };
}

// Gauge 플러그인
function gaugePlugin(rawData) {
  return {
    hooks: {
      draw: (u) => {
        const { ctx, bbox } = u;
        const { min, max, value } = rawData;
        const percent = (value - min) / (max - min);
        
        const barHeight = 30;
        const y = bbox.top + bbox.height / 2 - barHeight / 2;
        
        // 배경
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(bbox.left, y, bbox.width, barHeight);
        
        // 진행바
        ctx.fillStyle = palette[0];
        ctx.fillRect(bbox.left, y, bbox.width * percent, barHeight);
        
        // 텍스트
        ctx.fillStyle = '#333';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          `${value.toFixed(1)} / ${max}`,
          bbox.left + bbox.width / 2,
          y + barHeight / 2
        );
      }
    }
  };
}

// ========== 매핑 함수 (EChartsDemo의 buildOption과 유사) ==========
function buildUplotConfig(type, raw) {
  switch(type) {
    case 'line': {
      const xData = raw[0]?.data.map(d => d[0]) || [];
      const seriesData = raw.map(s => s.data.map(d => d[1]));
      
      console.log('Line raw data:', raw);
      console.log('Line xData:', xData);
      console.log('Line seriesData:', seriesData);
      
      return {
        data: [xData, ...seriesData],
        series: [
          { },
          ...raw.map((s, i) => ({
            label: s.name,
            stroke: palette[i % palette.length],
            width: 2,
            points: { show: false }
          }))
        ],
        axes: [
          { scale: 'x', time: true },
          { scale: 'y' }
        ]
      };
    }
    
    case 'bar':
    case 'pictorialBar': {
      const xData = raw.categories.map((_, i) => i);
      const seriesData = raw.series.map(s => s.data);
      
      console.log('Bar raw data:', raw);
      console.log('Bar xData:', xData);
      console.log('Bar seriesData:', seriesData);
      
      return {
        data: [xData, ...seriesData],
        series: [
          { },
          ...raw.series.map((s, i) => ({
            label: s.name,
            stroke: palette[i % palette.length],
            width: 2,
            paths: () => null,
            points: { show: false }
          }))
        ],
        axes: [
          { 
            scale: 'x',
            values: (u, vals) => vals.map(v => raw.categories[v] || '')
          },
          { scale: 'y' }
        ],
        plugins: [barPlugin()]
      };
    }
    
    case 'scatter': {
      const xData = raw.map(p => p[0]);
      const yData = raw.map(p => p[1]);
      
      console.log('Scatter raw data:', raw);
      console.log('Scatter xData:', xData);
      console.log('Scatter yData:', yData);
      
      return {
        data: [xData, yData],
        series: [
          { },
          { 
            label: 'Points',
            stroke: palette[0],
            width: 2,
            fill: palette[0] + '20',
            paths: () => null,
            points: { show: false }
          }
        ],
        axes: [
          { scale: 'x' },
          { scale: 'y' }
        ],
        plugins: [scatterPlugin()]
      };
    }
    
    case 'pie': {
      return {
        data: [[0], [1]],
        series: [
          { label: 'X' },
          { label: 'Pie', show: false }
        ],
        axes: [
          { show: false },
          { show: false }
        ],
        plugins: [piePlugin(raw)]
      };
    }
    
    case 'candlestick': {
      const xData = raw.map(r => r[0]);
      const openData = raw.map(r => r[1]);
      const highData = raw.map(r => r[2]);
      const lowData = raw.map(r => r[3]);
      const closeData = raw.map(r => r[4]);
      
      return {
        data: [xData, openData, highData, lowData, closeData],
        series: [
          { label: 'Time' },
          { label: 'Open', show: false },
          { label: 'High', show: false },
          { label: 'Low', show: false },
          { label: 'Close', show: false }
        ],
        axes: [
          { scale: 'x', time: true },
          { scale: 'y' }
        ],
        plugins: [candlestickPlugin()]
      };
    }
    
    case 'boxplot': {
      const xData = raw.map((_, i) => i);
      const minData = raw.map(r => r.value[0]);
      const q1Data = raw.map(r => r.value[1]);
      const medianData = raw.map(r => r.value[2]);
      const q3Data = raw.map(r => r.value[3]);
      const maxData = raw.map(r => r.value[4]);
      
      return {
        data: [xData, minData, q1Data, medianData, q3Data, maxData],
        series: [
          { label: 'Groups' },
          { label: 'Min', show: false },
          { label: 'Q1', show: false },
          { label: 'Median', show: false },
          { label: 'Q3', show: false },
          { label: 'Max', show: false }
        ],
        axes: [
          { 
            scale: 'x',
            values: (u, vals) => vals.map(v => raw[v]?.name || `G${v+1}`)
          },
          { scale: 'y' }
        ],
        plugins: [boxplotPlugin()]
      };
    }
    
    case 'heatmap':
    case 'matrix': {
      const xData = raw.xLabels.map((_, i) => i);
      const dummyData = new Array(xData.length).fill(0);
      
      return {
        data: [xData, dummyData],
        series: [
          { label: 'X' },
          { label: 'Heat', show: false }
        ],
        axes: [
          { 
            scale: 'x',
            values: (u, vals) => vals.map(v => raw.xLabels[v] || '')
          },
          { 
            scale: 'y',
            values: (u, vals) => vals.map(v => raw.yLabels[v] || '')
          }
        ],
        plugins: [heatmapPlugin(raw)]
      };
    }
    
    case 'funnel': {
      const xData = raw.map((_, i) => i);
      const yData = raw.map(r => r.value);
      
      return {
        data: [xData, yData],
        series: [
          { label: 'Stages' },
          { 
            label: 'Value',
            stroke: palette[0],
            paths: () => null,
            points: { show: false }
          }
        ],
        axes: [
          { 
            scale: 'x',
            values: (u, vals) => vals.map(v => raw[v]?.name || '')
          },
          { scale: 'y' }
        ],
        plugins: [barPlugin()]
      };
    }
    
    case 'gauge': {
      return {
        data: [[0], [raw.value]],
        series: [
          { label: 'X' },
          { label: 'Gauge', show: false }
        ],
        axes: [
          { show: false },
          { show: false }
        ],
        plugins: [gaugePlugin(raw)]
      };
    }
    
    case 'calendar': {
      const xData = raw.map(r => new Date(r[0]).getTime());
      const yData = raw.map(r => r[1]);
      
      return {
        data: [xData, yData],
        series: [
          { label: 'Date' },
          { 
            label: 'Value',
            stroke: palette[0],
            width: 2,
            points: { show: false }
          }
        ],
        axes: [
          { scale: 'x', time: true },
          { scale: 'y' }
        ]
      };
    }
    
    default:
      return null;
  }
}

// ========== 메인 컴포넌트 (ChartjsDemo 구조 참고) ==========
export default function UPlotDemo() {
  const [dataset, setDataset] = useState('line');
  const [params, setParams] = useState(() => ({ ...SCHEMAS.line }));
  const [regenKey, setRegenKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const chartRef = useRef(null);
  const uplotRef = useRef(null);
  
  // dataset 변경 시 기본 파라미터 초기화
  useEffect(() => {
    setParams({ ...SCHEMAS[dataset] });
    setRegenKey(k => k + 1);
  }, [dataset]);
  
  // Raw 데이터 생성 (파라미터와 regenKey 의존)
  const raw = useMemo(() => {
    try {
      return buildMock(dataset, params);
    } catch (error) {
      console.error('buildMock 오류:', error);
      return null;
    }
  }, [dataset, JSON.stringify(params), regenKey]);
  
  // uPlot 설정 생성
  const config = useMemo(() => {
    if (!SUPPORTED.includes(dataset)) return null;
    try {
      return buildUplotConfig(dataset, raw);
    } catch (error) {
      console.error('buildUplotConfig 오류:', error);
      return null;
    }
  }, [dataset, raw]);
  
  // uPlot 인스턴스 생성/업데이트
  useEffect(() => {
    if (!config || !chartRef.current) return;
    
    setIsLoading(true);
    
    const timer = setTimeout(() => {
      try {
        // 기존 인스턴스 정리
        if (uplotRef.current) {
          uplotRef.current.destroy();
          uplotRef.current = null;
        }
        
        // 차트 컨테이너 비우기
        if (chartRef.current) {
          chartRef.current.innerHTML = '';
        }
        
        // 새 인스턴스 생성
        if (chartRef.current && config.data) {
          console.log('uPlot 데이터:', config.data);
          console.log('uPlot 시리즈:', config.series);
          
          const opts = {
            width: 800,
            height: 400,
            title: `uPlot - ${dataset.toUpperCase()}`,
            ...config
          };
          
          uplotRef.current = new uPlot(opts, config.data, chartRef.current);
          console.log('uPlot 생성 완료:', uplotRef.current);
        }
      } catch (error) {
        console.error('uPlot 생성 오류:', error);
      } finally {
        setIsLoading(false);
      }
    }, 100);
    
    return () => {
      clearTimeout(timer);
      if (uplotRef.current) {
        uplotRef.current.destroy();
        uplotRef.current = null;
      }
    };
  }, [config, dataset]);
  
  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (uplotRef.current) {
        uplotRef.current.destroy();
        uplotRef.current = null;
      }
    };
  }, []);
  
  const isSupported = SUPPORTED.includes(dataset);
  
  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h2>uPlot Demo</h2>
      
      {/* 타입 선택 및 파라미터 입력 */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '0.75rem', 
        alignItems: 'center', 
        marginBottom: '1rem',
        padding: '0.75rem',
        background: '#f9f9f9',
        borderRadius: '4px',
        border: '1px solid #ddd'
      }}>
        <label>
          Dataset Type:
          <select 
            value={dataset} 
            onChange={e => setDataset(e.target.value)}
            style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
          >
            {DATASETS.map(type => (
              <option key={type} value={type}>
                {type} {!SUPPORTED.includes(type) ? '(미지원)' : ''}
              </option>
            ))}
          </select>
        </label>
        
        {/* 파라미터 입력 (지원되는 타입만) */}
        {isSupported && Object.entries(params || {}).map(([key, value]) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {key}:
            <input
              type="number"
              value={value}
              step={key === 'drop' ? 0.01 : 1}
              min={key === 'drop' ? 0 : 1}
              max={key === 'drop' ? 1 : undefined}
              onChange={e => {
                const newValue = key === 'drop' 
                  ? parseFloat(e.target.value) 
                  : parseInt(e.target.value);
                setParams(prev => ({ ...prev, [key]: newValue }));
              }}
              style={{ width: '80px', padding: '0.25rem' }}
            />
          </label>
        ))}
        
        {/* 재생성 버튼 (지원되는 타입만) */}
        {isSupported && (
          <button 
            onClick={() => setRegenKey(k => k + 1)}
            style={{
              padding: '0.25rem 0.75rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Regenerate
          </button>
        )}
      </div>
      
      {/* 차트 영역 */}
      <div style={{ 
        border: '1px solid #ddd', 
        padding: '1rem', 
        background: '#fff',
        borderRadius: '4px'
      }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>
          uPlot - {dataset.toUpperCase()}
          {isSupported && (
            <span style={{ color: '#16a34a', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
              ✓ 지원됨
            </span>
          )}
          {!isSupported && (
            <span style={{ color: '#dc2626', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
              ⚠ 미구현
            </span>
          )}
        </h3>
        
        {/* 로딩 상태 */}
        {isLoading && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '400px',
            color: '#666'
          }}>
            차트를 생성하는 중...
          </div>
        )}
        
        {/* 미지원 타입 */}
        {!isSupported && !isLoading && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '400px',
            color: '#666',
            textAlign: 'center'
          }}>
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
              <div style={{ fontSize: '1.125rem' }}>이 차트 타입은 아직 구현되지 않았습니다</div>
              <div style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: '#999' }}>
                지원 타입: {SUPPORTED.join(', ')}
              </div>
            </div>
          </div>
        )}
        
        {/* 설정 오류 */}
        {isSupported && !isLoading && !config && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '400px',
            color: '#dc2626',
            textAlign: 'center'
          }}>
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
              <div>차트 설정 생성에 실패했습니다</div>
              <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                콘솔에서 오류 내용을 확인하세요
              </div>
            </div>
          </div>
        )}
        
        {/* 차트 컨테이너 */}
        {isSupported && config && (
          <div 
            ref={chartRef}
            style={{ 
              width: '100%',
              minHeight: '400px',
              opacity: isLoading ? 0.5 : 1
            }}
          />
        )}
      </div>
      
      {/* 지원 정보 */}
      <div style={{ 
        marginTop: '1rem', 
        fontSize: '0.75rem', 
        lineHeight: 1.5, 
        color: '#666',
        background: '#f9f9f9',
        padding: '0.75rem',
        borderRadius: '4px'
      }}>
        <strong>uPlot 지원 정보:</strong><br />
        <span style={{ color: '#16a34a' }}>지원 타입:</span> {SUPPORTED.join(', ')}<br />
        <span style={{ color: '#dc2626' }}>미지원 타입:</span> {DATASETS.filter(d => !SUPPORTED.includes(d)).join(', ')}<br />
        각 차트 타입별 커스텀 Canvas 렌더링으로 구현했습니다.
      </div>
      
      {/* 데이터 미리보기 (다른 데모들과 동일) */}
      {raw && (
        <details style={{ 
          marginTop: '1rem',
          background: '#f9f9f9',
          border: '1px solid #ddd',
          padding: '0.75rem',
          borderRadius: '4px'
        }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#666' }}>
            원본 데이터 미리보기 ({typeof raw === 'object' ? Object.keys(raw).length : '0'} 키)
          </summary>
          <pre style={{ 
            marginTop: '0.5rem', 
            fontSize: '0.75rem', 
            background: '#fff', 
            padding: '0.75rem', 
            borderRadius: '4px', 
            border: '1px solid #eee',
            overflow: 'auto', 
            maxHeight: '240px',
            color: '#666'
          }}>
            {JSON.stringify(raw, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
