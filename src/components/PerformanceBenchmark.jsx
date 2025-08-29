import React, { useState, useRef, useEffect } from 'react';
import { buildMock } from './mockData';

// 차트 라이브러리 임포트
import Chart from 'chart.js/auto';
import * as echarts from 'echarts';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

// ApexCharts 동적 임포트를 위한 컴포넌트
let ApexCharts = null;
if (typeof window !== 'undefined') {
  import('apexcharts').then(module => {
    ApexCharts = module.default;
  });
}

// 지원하는 차트 라이브러리
const CHART_LIBRARIES = ['apex', 'echarts', 'uplot', 'chartjs'];

// 측정할 차트 타입들
const CHART_TYPES = ['line', 'bar', 'scatter'];

// 기본 데이터셋 크기
const DEFAULT_DATASETS = {
  line: { points: 1000, series: 3 },
  bar: { categories: 50, series: 3 },
  scatter: { points: 2000, series: 2 }
};

// 성능 측정 결과 저장용
const PerformanceResult = {
  library: '',
  chartType: '',
  iteration: 0,
  renderTime: 0,
  domNodes: 0,
  bundleSize: 0, // 정적 값
  dataProcessingTime: 0,
  memoryUsage: 0,
  fps: 0,
  webVitals: {
    fcp: 0,
    lcp: 0,
    tti: 0
  }
};

export default function PerformanceBenchmark() {
  const [iterations, setIterations] = useState(10);
  const [datasets, setDatasets] = useState({ ...DEFAULT_DATASETS });
  const [selectedLibraries, setSelectedLibraries] = useState(['apex', 'echarts', 'uplot', 'chartjs']);
  const [selectedChartTypes, setSelectedChartTypes] = useState(['line', 'bar', 'scatter']);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [currentProgress, setCurrentProgress] = useState({ library: '', chart: '', iteration: 0 });
  
  const chartContainer = useRef(null);

  // 데이터셋 파라미터 변경 핸들러
  const updateDatasetParam = (chartType, param, value) => {
    setDatasets(prev => ({
      ...prev,
      [chartType]: {
        ...prev[chartType],
        [param]: parseInt(value) || 1
      }
    }));
  };

  // 라이브러리 선택 토글
  const toggleLibrary = (library) => {
    setSelectedLibraries(prev => 
      prev.includes(library) 
        ? prev.filter(lib => lib !== library)
        : [...prev, library]
    );
  };

  // 차트 타입 선택 토글
  const toggleChartType = (chartType) => {
    setSelectedChartTypes(prev => 
      prev.includes(chartType) 
        ? prev.filter(type => type !== chartType)
        : [...prev, chartType]
    );
  };

  // 메모리 사용량 측정 (Chrome 전용)
  const measureMemory = () => {
    if (performance.memory) {
      // 강제 가비지 컬렉션 (가능한 경우)
      if (window.gc) {
        window.gc();
      }
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
    }
    return { used: 0, total: 0, limit: 0 };
  };

  // DOM 노드 수 계산
  const countDOMNodes = (container) => {
    if (!container) return 0;
    return container.querySelectorAll('*').length;
  };

  // FPS 측정 (애니메이션이 있는 경우)
  const measureFPS = () => {
    return new Promise((resolve) => {
      let frames = 0;
      let lastTime = performance.now();
      
      const measureFrame = () => {
        frames++;
        if (frames >= 60) { // 1초 정도 측정
          const currentTime = performance.now();
          const fps = (frames * 1000) / (currentTime - lastTime);
          resolve(fps);
        } else {
          requestAnimationFrame(measureFrame);
        }
      };
      
      requestAnimationFrame(measureFrame);
    });
  };

  // Web Vitals 측정 (간단한 버전)
  const measureWebVitals = () => {
    return new Promise((resolve) => {
      let fcp = 0;
      let lcp = 0;
      
      // FCP 측정
      const fcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            fcp = entry.startTime;
          }
        }
      });
      
      // LCP 측정
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          lcp = entries[entries.length - 1].startTime;
        }
      });

      try {
        fcpObserver.observe({ entryTypes: ['paint'] });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        console.warn('Web Vitals measurement not supported');
      }

      setTimeout(() => {
        fcpObserver.disconnect();
        lcpObserver.disconnect();
        resolve({ fcp, lcp, tti: performance.now() });
      }, 1000);
    });
  };

  // 단일 차트 성능 측정
  const measureSingleChart = async (library, chartType, datasetParams) => {
    if (!chartContainer.current) return null;

    // 컨테이너 초기화
    chartContainer.current.innerHTML = '';
    
    const startMemory = measureMemory();
    const startTime = performance.now();
    
    try {
      // 데이터 생성 시간 측정
      const dataStartTime = performance.now();
      let mockData = null;
      try {
        const rawData = buildMock(chartType, datasetParams);
        
        // 차트 타입별로 데이터 구조 변환
        switch (chartType) {
          case 'line':
            // generateLine이 반환하는 구조: [{ name: 'L1', data: [[timestamp, value], ...] }, ...]
            // 필요한 구조: [value1, value2, value3, ...]
            if (Array.isArray(rawData) && rawData[0]?.data) {
              mockData = rawData.flatMap(series => series.data.map(point => point[1])); // value만 추출
            } else {
              mockData = [];
            }
            break;
          case 'bar':
            // generateBar가 반환하는 구조: { categories: [...], series: [{ name: 'S1', data: [...] }, ...] }
            // 필요한 구조: [value1, value2, value3, ...]
            if (rawData?.series) {
              mockData = rawData.series.flatMap(series => series.data);
            } else {
              mockData = [];
            }
            break;
          case 'scatter':
            // generateScatter가 반환하는 구조: [[x, y], [x, y], ...]
            // 필요한 구조: [value1, value2, value3, ...]
            if (Array.isArray(rawData)) {
              mockData = rawData.map(point => point[1]); // y값만 추출
            } else {
              mockData = [];
            }
            break;
          default:
            mockData = Array.isArray(rawData) ? rawData : [];
        }
        
        console.log(`${library} - ${chartType}: 생성된 데이터 길이 = ${mockData?.length}`);
      } catch (dataError) {
        console.warn(`데이터 생성 실패 (${library} - ${chartType}):`, dataError);
        mockData = Array.from({ length: datasetParams.points || 100 }, () => Math.random() * 100); // 기본 데이터로 대체
      }
      const dataProcessingTime = performance.now() - dataStartTime;

      let chartInstance = null;
      
      // 라이브러리별 차트 생성
      try {
        switch (library) {
          case 'apex':
            if (ApexCharts) {
              // ApexCharts 차트 타입별 설정
              let apexConfig = {};
              if (mockData?.length) {
                switch (chartType) {
                  case 'line':
                    // 시리즈 개수만큼 데이터 생성
                    const seriesCount = datasetParams.series || 1;
                    const totalPoints = mockData.length;
                    const pointsPerSeries = Math.floor(totalPoints / seriesCount);
                    
                    console.log(`ApexCharts Line: 총 데이터 ${totalPoints}개, 시리즈 ${seriesCount}개, 시리즈당 ${pointsPerSeries}개`);
                    
                    apexConfig = {
                      chart: { type: 'line', height: 400 },
                      series: Array.from({ length: seriesCount }, (_, i) => ({
                        name: `Series ${i + 1}`,
                        data: mockData.slice(i * pointsPerSeries, (i + 1) * pointsPerSeries)
                      })),
                      xaxis: { 
                        categories: Array.from({ length: pointsPerSeries }, (_, i) => `Point${i}`),
                        title: { text: 'X Axis' }
                      },
                      yaxis: { title: { text: 'Value' } },
                      title: { text: `ApexCharts Line (${seriesCount} series, ${pointsPerSeries} points each)` }
                    };
                    break;
                  case 'bar':
                    const barSeriesCount = datasetParams.series || 1;
                    const barCategoriesCount = datasetParams.categories || 20;
                    const barTotalPoints = mockData.length;
                    const barPointsPerSeries = Math.floor(barTotalPoints / barSeriesCount);
                    
                    console.log(`ApexCharts Bar: 총 데이터 ${barTotalPoints}개, 시리즈 ${barSeriesCount}개, 카테고리 ${barCategoriesCount}개`);
                    
                    apexConfig = {
                      chart: { type: 'bar', height: 400 },
                      series: Array.from({ length: barSeriesCount }, (_, i) => ({
                        name: `Series ${i + 1}`,
                        data: mockData.slice(i * barPointsPerSeries, (i + 1) * barPointsPerSeries).slice(0, barCategoriesCount)
                      })),
                      xaxis: { 
                        categories: Array.from({ length: barCategoriesCount }, (_, i) => `Cat${i}`),
                        title: { text: 'Categories' }
                      },
                      yaxis: { title: { text: 'Value' } },
                      title: { text: `ApexCharts Bar (${barSeriesCount} series, ${barCategoriesCount} categories)` }
                    };
                    break;
                  case 'scatter':
                    const scatterSeriesCount = datasetParams.series || 1;
                    const scatterTotalPoints = mockData.length;
                    const scatterPointsPerSeries = Math.floor(scatterTotalPoints / scatterSeriesCount);
                    
                    console.log(`ApexCharts Scatter: 총 데이터 ${scatterTotalPoints}개, 시리즈 ${scatterSeriesCount}개, 시리즈당 ${scatterPointsPerSeries}개`);
                    
                    apexConfig = {
                      chart: { type: 'scatter', height: 400 },
                      series: Array.from({ length: scatterSeriesCount }, (_, i) => ({
                        name: `Series ${i + 1}`,
                        data: mockData.slice(i * scatterPointsPerSeries, (i + 1) * scatterPointsPerSeries)
                          .map((value, index) => ({ x: index, y: value }))
                      })),
                      title: { text: `ApexCharts Scatter (${scatterSeriesCount} series, ${scatterPointsPerSeries} points each)` }
                    };
                    break;
                  default:
                    apexConfig = {
                      chart: { type: 'line', height: 400 },
                      series: [{ name: 'Series', data: mockData.slice(0, 100) }],
                      xaxis: { categories: Array.from({ length: Math.min(100, mockData.length) }, (_, i) => i) }
                    };
                }
              } else {
                apexConfig = {
                  chart: { type: 'line', height: 400 },
                  series: [],
                  xaxis: { categories: [] }
                };
              }
              chartInstance = new ApexCharts(chartContainer.current, apexConfig);
              await chartInstance.render();
            }
            break;
            
          case 'echarts':
            // 기존 ECharts 인스턴스 완전 제거
            const existingInstance = echarts.getInstanceByDom(chartContainer.current);
            if (existingInstance) {
              existingInstance.dispose();
            }
            
            // 새 인스턴스 생성
            chartInstance = echarts.init(chartContainer.current);
            
            // 차트 타입별 옵션 생성
            let echartsOption = {};
            if (mockData?.length) {
              switch (chartType) {
                case 'line':
                  const seriesCount = datasetParams.series || 1;
                  const totalPoints = mockData.length;
                  const pointsPerSeries = Math.floor(totalPoints / seriesCount);
                  
                  console.log(`ECharts Line: 총 데이터 ${totalPoints}개, 시리즈 ${seriesCount}개, 시리즈당 ${pointsPerSeries}개`);
                  
                  echartsOption = {
                    title: { text: `ECharts Line (${seriesCount} series, ${pointsPerSeries} points each)` },
                    xAxis: { 
                      type: 'category', 
                      data: Array.from({ length: pointsPerSeries }, (_, i) => `Point${i}`),
                      name: 'X Axis'
                    },
                    yAxis: { type: 'value', name: 'Value' },
                    legend: { data: Array.from({ length: seriesCount }, (_, i) => `Series ${i + 1}`) },
                    series: Array.from({ length: seriesCount }, (_, i) => ({
                      name: `Series ${i + 1}`,
                      type: 'line',
                      data: mockData.slice(i * pointsPerSeries, (i + 1) * pointsPerSeries)
                    }))
                  };
                  break;
                case 'bar':
                  const barSeriesCount = datasetParams.series || 1;
                  const barCategoriesCount = datasetParams.categories || 20;
                  const barTotalPoints = mockData.length;
                  const barPointsPerSeries = Math.floor(barTotalPoints / barSeriesCount);
                  
                  console.log(`ECharts Bar: 총 데이터 ${barTotalPoints}개, 시리즈 ${barSeriesCount}개, 카테고리 ${barCategoriesCount}개`);
                  
                  echartsOption = {
                    title: { text: `ECharts Bar (${barSeriesCount} series, ${barCategoriesCount} categories)` },
                    xAxis: { 
                      type: 'category', 
                      data: Array.from({ length: barCategoriesCount }, (_, i) => `Cat${i}`),
                      name: 'Categories'
                    },
                    yAxis: { type: 'value', name: 'Value' },
                    legend: { data: Array.from({ length: barSeriesCount }, (_, i) => `Series ${i + 1}`) },
                    series: Array.from({ length: barSeriesCount }, (_, i) => ({
                      name: `Series ${i + 1}`,
                      type: 'bar',
                      data: mockData.slice(i * barPointsPerSeries, (i + 1) * barPointsPerSeries).slice(0, barCategoriesCount)
                    }))
                  };
                  break;
                case 'scatter':
                  const scatterSeriesCount = datasetParams.series || 1;
                  const scatterTotalPoints = mockData.length;
                  const scatterPointsPerSeries = Math.floor(scatterTotalPoints / scatterSeriesCount);
                  
                  console.log(`ECharts Scatter: 총 데이터 ${scatterTotalPoints}개, 시리즈 ${scatterSeriesCount}개, 시리즈당 ${scatterPointsPerSeries}개`);
                  
                  echartsOption = {
                    title: { text: `ECharts Scatter (${scatterSeriesCount} series, ${scatterPointsPerSeries} points each)` },
                    xAxis: { type: 'value', name: 'X Axis' },
                    yAxis: { type: 'value', name: 'Y Axis' },
                    legend: { data: Array.from({ length: scatterSeriesCount }, (_, i) => `Series ${i + 1}`) },
                    series: Array.from({ length: scatterSeriesCount }, (_, i) => ({
                      name: `Series ${i + 1}`,
                      type: 'scatter',
                      data: mockData.slice(i * scatterPointsPerSeries, (i + 1) * scatterPointsPerSeries)
                        .map((value, index) => [index, value])
                    }))
                  };
                  break;
                default:
                  echartsOption = {
                    title: { text: `ECharts ${chartType} (Default Line)` },
                    xAxis: { type: 'category', data: Array.from({ length: Math.min(100, mockData.length) }, (_, i) => i) },
                    yAxis: { type: 'value' },
                    series: [{ type: 'line', data: mockData.slice(0, 100) }]
                  };
              }
            } else {
              echartsOption = {
                title: { text: `ECharts ${chartType} (No Data)` },
                xAxis: { type: 'category', data: [] },
                yAxis: { type: 'value' },
                series: [{ type: 'line', data: [] }]
              };
            }
            
            chartInstance.setOption(echartsOption);
            
            // ECharts 렌더링 완료 대기
            await new Promise(resolve => setTimeout(resolve, 100));
            break;
            
          case 'uplot':
            // uPlot은 주로 시계열 데이터에 특화되어 있어서 일부 차트 타입만 지원
            if (mockData?.length) {
              let uplotConfig = {};
              let uplotData = [];
              
              switch (chartType) {
                case 'line':
                  const lineSeriesCount = datasetParams.series || 1;
                  const lineTotalPoints = mockData.length;
                  const linePointsPerSeries = Math.floor(lineTotalPoints / lineSeriesCount);
                  
                  console.log(`uPlot Line: 총 데이터 ${lineTotalPoints}개, 시리즈 ${lineSeriesCount}개, 시리즈당 ${linePointsPerSeries}개`);
                  
                  uplotData = [
                    Array.from({ length: linePointsPerSeries }, (_, i) => i),
                    ...Array.from({ length: lineSeriesCount }, (_, i) =>
                      mockData.slice(i * linePointsPerSeries, (i + 1) * linePointsPerSeries)
                    )
                  ];
                  uplotConfig = {
                    title: `uPlot Line (${lineSeriesCount} series, ${linePointsPerSeries} points each)`,
                    width: 800,
                    height: 400,
                    axes: [
                      { label: "X Axis" },
                      { label: "Value" }
                    ],
                    series: [
                      { label: 'x' },
                      ...Array.from({ length: lineSeriesCount }, (_, i) => ({ 
                        label: `Series ${i + 1}`, 
                        stroke: `hsl(${i * 60}, 70%, 50%)`,
                        width: 2,
                        points: { show: false }
                      }))
                    ]
                  };
                  break;
                case 'scatter':
                  const scatterSeriesCount = datasetParams.series || 1;
                  const scatterTotalPoints = mockData.length;
                  const scatterPointsPerSeries = Math.floor(scatterTotalPoints / scatterSeriesCount);
                  
                  console.log(`uPlot Scatter: 총 데이터 ${scatterTotalPoints}개, 시리즈 ${scatterSeriesCount}개, 시리즈당 ${scatterPointsPerSeries}개`);
                  console.log(`uPlot Scatter: 실제 시리즈 데이터 길이들 =`, Array.from({ length: scatterSeriesCount }, (_, i) => 
                    mockData.slice(i * scatterPointsPerSeries, (i + 1) * scatterPointsPerSeries).length
                  ));
                  
                  // X축 데이터: 고정된 값으로 생성 (0부터 순차적으로)
                  const xAxisData = Array.from({ length: scatterPointsPerSeries }, (_, i) => i);
                  
                  uplotData = [
                    xAxisData,
                    ...Array.from({ length: scatterSeriesCount }, (_, i) => {
                      const seriesData = mockData.slice(i * scatterPointsPerSeries, (i + 1) * scatterPointsPerSeries);
                      console.log(`Series ${i + 1} 실제 데이터 개수: ${seriesData.length}`);
                      return seriesData;
                    })
                  ];
                  uplotConfig = {
                    title: `uPlot Scatter (${scatterSeriesCount} series, ${scatterPointsPerSeries} points each)`,
                    width: 800,
                    height: 400,
                    axes: [
                      { label: "X Axis" },
                      { label: "Value" }
                    ],
                    scales: {
                      x: { time: false }, // 시계열 모드 비활성화
                      y: { time: false }
                    },
                    series: [
                      { label: 'x' },
                      ...Array.from({ length: scatterSeriesCount }, (_, i) => ({ 
                        label: `Series ${i + 1}`, 
                        stroke: null, // 선 연결 비활성화
                        paths: () => null, // 경로 그리기 비활성화
                        points: { 
                          show: true, 
                          size: 8,
                          width: 2,
                          fill: `hsl(${i * 60}, 70%, 60%)`,
                          stroke: `hsl(${i * 60}, 70%, 40%)`
                        }
                      }))
                    ]
                  };
                  break;
                case 'bar':
                  const barSeriesCount = datasetParams.series || 1;
                  const barCategoriesCount = datasetParams.categories || 20;
                  const barTotalPoints = mockData.length;
                  const barPointsPerSeries = Math.floor(barTotalPoints / barSeriesCount);
                  
                  console.log(`uPlot Bar: 총 데이터 ${barTotalPoints}개, 시리즈 ${barSeriesCount}개, 카테고리 ${barCategoriesCount}개`);
                  
                  uplotData = [
                    Array.from({ length: barCategoriesCount }, (_, i) => i),
                    ...Array.from({ length: barSeriesCount }, (_, i) =>
                      mockData.slice(i * barPointsPerSeries, (i + 1) * barPointsPerSeries).slice(0, barCategoriesCount)
                    )
                  ];
                  
                  // 바 차트를 위한 paths 함수 정의
                  const drawBars = (u, seriesIdx, idx0, idx1) => {
                    const { ctx } = u;
                    const { left, top, width, height } = u.bbox;
                    
                    ctx.save();
                    
                    const barWidth = width / barCategoriesCount * 0.8 / barSeriesCount;
                    const barSpacing = width / barCategoriesCount * 0.2;
                    
                    for (let i = idx0; i <= idx1; i++) {
                      const xVal = uplotData[0][i];
                      const yVal = uplotData[seriesIdx][i];
                      
                      if (yVal != null) {
                        const x = u.valToPos(xVal, 'x', true);
                        const y = u.valToPos(yVal, 'y', true);
                        const barX = x - (barWidth * barSeriesCount) / 2 + barWidth * (seriesIdx - 1);
                        const barHeight = height + top - y;
                        
                        ctx.fillStyle = `hsl(${(seriesIdx - 1) * 60}, 70%, 50%)`;
                        ctx.fillRect(barX, y, barWidth, barHeight);
                      }
                    }
                    
                    ctx.restore();
                  };
                  
                  uplotConfig = {
                    title: `uPlot Bar (${barSeriesCount} series, ${barCategoriesCount} categories)`,
                    width: 800,
                    height: 400,
                    axes: [
                      { label: "Categories" },
                      { label: "Value" }
                    ],
                    scales: {
                      x: { time: false }
                    },
                    series: [
                      { label: 'x' },
                      ...Array.from({ length: barSeriesCount }, (_, i) => ({ 
                        label: `Series ${i + 1}`, 
                        stroke: null,
                        fill: null,
                        paths: drawBars,
                        points: { show: false }
                      }))
                    ]
                  };
                  break;
                default:
                  // 기본값으로 선 차트
                  uplotData = [
                    Array.from({ length: Math.min(100, mockData.length) }, (_, i) => i),
                    mockData.slice(0, 100)
                  ];
                  uplotConfig = {
                    width: 800,
                    height: 400,
                    series: [
                      { label: 'x' },
                      { label: 'y', stroke: 'blue' }
                    ]
                  };
              }
              
              chartInstance = new uPlot(uplotConfig, uplotData, chartContainer.current);
              
              // uPlot 렌더링 완료 대기
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            break;
            
          case 'chartjs':
            const canvas = document.createElement('canvas');
            chartContainer.current.appendChild(canvas);
            
            // Chart.js 차트 타입별 설정
            let chartjsConfig = {};
            if (mockData?.length) {
              switch (chartType) {
                case 'line':
                  const seriesCount = datasetParams.series || 1;
                  const totalPoints = mockData.length;
                  const pointsPerSeries = Math.floor(totalPoints / seriesCount);
                  
                  console.log(`Chart.js Line: 총 데이터 ${totalPoints}개, 시리즈 ${seriesCount}개, 시리즈당 ${pointsPerSeries}개`);
                  
                  chartjsConfig = {
                    type: 'line',
                    data: {
                      labels: Array.from({ length: pointsPerSeries }, (_, i) => `Point${i}`),
                      datasets: Array.from({ length: seriesCount }, (_, i) => ({
                        label: `Series ${i + 1}`,
                        data: mockData.slice(i * pointsPerSeries, (i + 1) * pointsPerSeries),
                        borderColor: `hsl(${i * 60}, 70%, 50%)`,
                        backgroundColor: `hsla(${i * 60}, 70%, 50%, 0.1)`,
                        fill: false
                      }))
                    },
                    options: {
                      plugins: {
                        title: { display: true, text: `Chart.js Line (${seriesCount} series, ${pointsPerSeries} points each)` }
                      },
                      scales: {
                        x: { title: { display: true, text: 'X Axis' } },
                        y: { title: { display: true, text: 'Value' } }
                      }
                    }
                  };
                  break;
                case 'bar':
                  const barSeriesCount = datasetParams.series || 1;
                  const barCategoriesCount = datasetParams.categories || 20;
                  const barTotalPoints = mockData.length;
                  const barPointsPerSeries = Math.floor(barTotalPoints / barSeriesCount);
                  
                  console.log(`Chart.js Bar: 총 데이터 ${barTotalPoints}개, 시리즈 ${barSeriesCount}개, 카테고리 ${barCategoriesCount}개`);
                  
                  chartjsConfig = {
                    type: 'bar',
                    data: {
                      labels: Array.from({ length: barCategoriesCount }, (_, i) => `Cat${i}`),
                      datasets: Array.from({ length: barSeriesCount }, (_, i) => ({
                        label: `Series ${i + 1}`,
                        data: mockData.slice(i * barPointsPerSeries, (i + 1) * barPointsPerSeries).slice(0, barCategoriesCount),
                        backgroundColor: `hsla(${i * 60}, 70%, 50%, 0.6)`,
                        borderColor: `hsl(${i * 60}, 70%, 50%)`,
                        borderWidth: 1
                      }))
                    },
                    options: {
                      plugins: {
                        title: { display: true, text: `Chart.js Bar (${barSeriesCount} series, ${barCategoriesCount} categories)` }
                      },
                      scales: {
                        x: { title: { display: true, text: 'Categories' } },
                        y: { title: { display: true, text: 'Value' } }
                      }
                    }
                  };
                  break;
                case 'scatter':
                  const scatterSeriesCount = datasetParams.series || 1;
                  const scatterTotalPoints = mockData.length;
                  const scatterPointsPerSeries = Math.floor(scatterTotalPoints / scatterSeriesCount);
                  
                  console.log(`Chart.js Scatter: 총 데이터 ${scatterTotalPoints}개, 시리즈 ${scatterSeriesCount}개, 시리즈당 ${scatterPointsPerSeries}개`);
                  
                  chartjsConfig = {
                    type: 'scatter',
                    data: {
                      datasets: Array.from({ length: scatterSeriesCount }, (_, i) => ({
                        label: `Series ${i + 1}`,
                        data: mockData.slice(i * scatterPointsPerSeries, (i + 1) * scatterPointsPerSeries)
                          .map((value, index) => ({ x: index, y: value })),
                        backgroundColor: `hsla(${i * 60}, 70%, 50%, 0.6)`,
                        borderColor: `hsl(${i * 60}, 70%, 50%)`
                      }))
                    },
                    options: {
                      plugins: {
                        title: { display: true, text: `Chart.js Scatter (${scatterSeriesCount} series, ${scatterPointsPerSeries} points each)` }
                      },
                      scales: {
                        x: { title: { display: true, text: 'X Axis' } },
                        y: { title: { display: true, text: 'Y Axis' } }
                      }
                    }
                  };
                  break;
                default:
                  chartjsConfig = {
                    type: 'line',
                    data: {
                      labels: Array.from({ length: Math.min(100, mockData.length) }, (_, i) => i),
                      datasets: [{
                        label: 'Dataset',
                        data: mockData.slice(0, 100),
                        borderColor: 'blue',
                        fill: false
                      }]
                    }
                  };
              }
            } else {
              chartjsConfig = {
                type: 'line',
                data: {
                  labels: [],
                  datasets: [{ label: 'Dataset', data: [] }]
                }
              };
            }
            
            chartInstance = new Chart(canvas, chartjsConfig);
            
            // Chart.js 렌더링 완료 대기
            await new Promise(resolve => setTimeout(resolve, 100));
            break;
            
          default:
            console.warn(`지원하지 않는 라이브러리: ${library}`);
            return null;
        }
      } catch (chartError) {
        console.error(`차트 생성 실패 (${library} - ${chartType}):`, chartError);
        return null;
      }      // 렌더링 완료 후 추가 대기 (DOM 업데이트 완료)
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const renderTime = performance.now() - startTime;
      const domNodes = countDOMNodes(chartContainer.current);
      
      // 메모리 측정 개선 - 가비지 컬렉션 후 재측정
      let endMemory = measureMemory();
      await new Promise(resolve => setTimeout(resolve, 50)); // 메모리 안정화 대기
      endMemory = measureMemory(); // 재측정
      
      let memoryUsage = endMemory.used - startMemory.used;
      
      // 음수 메모리 사용량 처리 (가비지 컬렉션으로 인한 메모리 감소)
      if (memoryUsage < 0) {
        console.warn(`${library} - ${chartType}: 음수 메모리 사용량 감지 (${Math.round(memoryUsage/1024)}KB) - 가비지 컬렉션으로 추정`);
        // 음수인 경우 절댓값 사용
        memoryUsage = Math.abs(memoryUsage);
      }
      
      // FPS와 Web Vitals 측정
      const fps = await measureFPS();
      const webVitals = await measureWebVitals();

      // 인스턴스 정리
      if (chartInstance) {
        try {
          if (library === 'echarts') {
            chartInstance.dispose();
          } else if (library === 'uplot') {
            chartInstance.destroy();
          } else if (library === 'chartjs') {
            chartInstance.destroy();
          } else if (library === 'apex' && chartInstance.destroy) {
            chartInstance.destroy();
          }
        } catch (e) {
          console.warn(`차트 인스턴스 정리 실패 (${library}):`, e);
        }
      }
      
      // DOM 완전 초기화
      if (chartContainer.current) {
        chartContainer.current.innerHTML = '';
      }

      return {
        library,
        chartType,
        datasetParams, // 데이터셋 정보 추가
        renderTime: Math.round(renderTime * 100) / 100,
        domNodes,
        bundleSize: getBundleSize(library), // 정적 값
        dataProcessingTime: Math.round(dataProcessingTime * 100) / 100,
        memoryUsage: Math.round(memoryUsage / 1024), // KB 단위
        fps: Math.round(fps * 100) / 100,
        webVitals: {
          fcp: Math.round(webVitals.fcp * 100) / 100,
          lcp: Math.round(webVitals.lcp * 100) / 100,
          tti: Math.round(webVitals.tti * 100) / 100
        }
      };
      
    } catch (error) {
      console.error(`측정 실패 (${library} - ${chartType}):`, error);
      return null;
    }
  };

  // 번들 크기 (정적 값 - 실제로는 빌드 시 측정해야 함)
  const getBundleSize = (library) => {
    const sizes = {
      apex: 550, // KB (gzipped)
      echarts: 650,
      uplot: 45,
      chartjs: 180
    };
    return sizes[library] || 0;
  };

  // 전체 벤치마크 실행
  const runBenchmark = async () => {
    setIsRunning(true);
    setResults([]);
    
    const allResults = [];
    let totalTests = selectedLibraries.length * selectedChartTypes.length * iterations;
    let currentTest = 0;

    for (const library of selectedLibraries) {
      for (const chartType of selectedChartTypes) {
        const datasetParams = datasets[chartType];
        
        for (let i = 0; i < iterations; i++) {
          setCurrentProgress({ 
            library, 
            chart: chartType, 
            iteration: i + 1,
            progress: Math.round((currentTest / totalTests) * 100)
          });
          
          const result = await measureSingleChart(library, chartType, datasetParams);
          if (result) {
            result.iteration = i + 1;
            allResults.push(result);
          }
          
          currentTest++;
          
          // UI 업데이트를 위한 작은 지연 (차트 확인 시간 포함)
          await new Promise(resolve => setTimeout(resolve, isRunning ? 1000 : 100));
        }
      }
    }
    
    setResults(allResults);
    setIsRunning(false);
    setCurrentProgress({ library: '', chart: '', iteration: 0, progress: 100 });
  };

  // 결과를 CSV로 내보내기
  const exportToCSV = () => {
    if (results.length === 0) return;

    const headers = [
      'Library', 'Chart Type', 'Iteration', 'Dataset', 'Render Time (ms)', 
      'DOM Nodes', 'Bundle Size (KB)', 'Data Processing (ms)', 
      'Memory Usage (KB)', 'FPS', 'FCP (ms)', 'LCP (ms)', 'TTI (ms)'
    ];

    const csvData = results.map(result => [
      result.library,
      result.chartType,
      result.iteration,
      Object.entries(result.datasetParams).map(([key, value]) => `${key}:${value}`).join(' | '), // 파이프로 구분
      result.renderTime,
      result.domNodes,
      result.bundleSize,
      result.dataProcessingTime,
      result.memoryUsage,
      result.fps,
      result.webVitals.fcp,
      result.webVitals.lcp,
      result.webVitals.tti
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `chart_performance_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 평균 결과 계산
  const getAverageResults = () => {
    if (results.length === 0) return [];

    const grouped = results.reduce((acc, result) => {
      const datasetKey = JSON.stringify(result.datasetParams);
      const key = `${result.library}-${result.chartType}-${datasetKey}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(result);
      return acc;
    }, {});

    return Object.entries(grouped).map(([key, results]) => {
      const [library, chartType, datasetParamsStr] = key.split('-', 3);
      const datasetParams = JSON.parse(datasetParamsStr);
      const avg = {
        library,
        chartType,
        datasetParams,
        count: results.length,
        renderTime: results.reduce((sum, r) => sum + r.renderTime, 0) / results.length,
        domNodes: results.reduce((sum, r) => sum + r.domNodes, 0) / results.length,
        bundleSize: results[0].bundleSize, // 정적 값
        dataProcessingTime: results.reduce((sum, r) => sum + r.dataProcessingTime, 0) / results.length,
        memoryUsage: results.reduce((sum, r) => sum + r.memoryUsage, 0) / results.length,
        fps: results.reduce((sum, r) => sum + r.fps, 0) / results.length,
        webVitals: {
          fcp: results.reduce((sum, r) => sum + r.webVitals.fcp, 0) / results.length,
          lcp: results.reduce((sum, r) => sum + r.webVitals.lcp, 0) / results.length,
          tti: results.reduce((sum, r) => sum + r.webVitals.tti, 0) / results.length
        }
      };
      
      // 소수점 정리
      Object.keys(avg).forEach(key => {
        if (typeof avg[key] === 'number') {
          avg[key] = Math.round(avg[key] * 100) / 100;
        }
      });
      
      if (avg.webVitals) {
        Object.keys(avg.webVitals).forEach(key => {
          avg.webVitals[key] = Math.round(avg.webVitals[key] * 100) / 100;
        });
      }
      
      return avg;
    });
  };

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>📊 Chart Performance Benchmark</h1>
      
      {/* 설정 패널 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr 1fr', 
        gap: '1rem', 
        marginBottom: '2rem' 
      }}>
        {/* 기본 설정 */}
        <div style={{ 
          background: '#f9f9f9', 
          padding: '1rem', 
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}>
          <h3>🔧 기본 설정</h3>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            반복 회수:
            <input
              type="number"
              value={iterations}
              onChange={(e) => setIterations(parseInt(e.target.value) || 1)}
              min="1"
              max="100"
              style={{ marginLeft: '0.5rem', width: '80px', padding: '0.25rem' }}
            />
          </label>
          
          <div style={{ marginTop: '1rem' }}>
            <strong>라이브러리 선택:</strong>
            <div style={{ marginTop: '0.5rem' }}>
              {CHART_LIBRARIES.map(lib => (
                <label key={lib} style={{ display: 'block', marginBottom: '0.25rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedLibraries.includes(lib)}
                    onChange={() => toggleLibrary(lib)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  {lib}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 차트 타입 선택 */}
        <div style={{ 
          background: '#f9f9f9', 
          padding: '1rem', 
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}>
          <h3>📈 차트 타입 선택</h3>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {CHART_TYPES.map(type => (
              <label key={type} style={{ display: 'block', marginBottom: '0.25rem' }}>
                <input
                  type="checkbox"
                  checked={selectedChartTypes.includes(type)}
                  onChange={() => toggleChartType(type)}
                  style={{ marginRight: '0.5rem' }}
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        {/* 데이터셋 크기 설정 */}
        <div style={{ 
          background: '#f9f9f9', 
          padding: '1rem', 
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}>
          <h3>📊 데이터셋 크기</h3>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {CHART_TYPES.map(chartType => (
              <div key={chartType} style={{ marginBottom: '0.75rem' }}>
                <strong>{chartType}:</strong>
                <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {Object.entries(datasets[chartType] || {}).map(([param, value]) => (
                    <label key={param} style={{ display: 'block', marginBottom: '0.25rem' }}>
                      {param}:
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => updateDatasetParam(chartType, param, e.target.value)}
                        min="1"
                        style={{ marginLeft: '0.5rem', width: '60px', padding: '0.125rem' }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 실행 버튼 */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <button
          onClick={runBenchmark}
          disabled={isRunning || selectedLibraries.length === 0 || selectedChartTypes.length === 0}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.125rem',
            background: isRunning ? '#ccc' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          {isRunning ? '측정 중...' : '🚀 벤치마크 시작'}
        </button>
        
        {results.length > 0 && (
          <button
            onClick={exportToCSV}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.125rem',
              background: '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              marginLeft: '1rem'
            }}
          >
            📥 CSV 내보내기
          </button>
        )}
      </div>

      {/* 진행 상황 */}
      {isRunning && (
        <div style={{ 
          background: '#fff3cd', 
          border: '1px solid #ffeaa7', 
          padding: '1rem', 
          borderRadius: '8px',
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          <div style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
            📊 측정 진행 중: {currentProgress.library} - {currentProgress.chart} ({currentProgress.iteration}/{iterations})
          </div>
          <div style={{ 
            background: '#ddd', 
            height: '20px', 
            borderRadius: '10px', 
            overflow: 'hidden',
            marginTop: '0.5rem'
          }}>
            <div 
              style={{ 
                background: '#2563eb', 
                height: '100%', 
                width: `${currentProgress.progress || 0}%`,
                transition: 'width 0.3s ease'
              }} 
            />
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            {currentProgress.progress || 0}% 완료
          </div>
        </div>
      )}

      {/* 차트 컨테이너 (측정 중에는 보이도록) */}
      <div 
        ref={chartContainer}
        style={{ 
          width: '800px', 
          height: '400px', 
          margin: '0 auto',
          border: isRunning ? '2px solid #2563eb' : '1px solid #ddd',
          borderRadius: '8px',
          display: isRunning ? 'block' : 'none',
          backgroundColor: '#f9f9f9',
          marginBottom: '2rem'
        }}
      />

      {/* 측정 중 차트 정보 */}
      {isRunning && (
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '2rem',
          padding: '1rem',
          background: '#e3f2fd',
          borderRadius: '8px',
          border: '1px solid #2196f3'
        }}>
          <h4>🎯 현재 측정 중인 차트</h4>
          <p style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: '0.5rem 0' }}>
            {currentProgress.library?.toUpperCase()} - {currentProgress.chart?.toUpperCase()}
          </p>
          <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>
            위 차트가 실제로 그려지고 있는 모습을 확인할 수 있습니다
          </p>
        </div>
      )}

      {/* 결과 표시 */}
      {results.length > 0 && (
        <div>
          <h2>📈 측정 결과</h2>
          
          {/* 평균 결과 테이블 */}
          <div style={{ marginBottom: '2rem' }}>
            <h3>📊 평균 성능 지표</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '0.875rem'
              }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem' }}>라이브러리</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem' }}>차트 타입</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem' }}>데이터셋</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem' }}>횟수</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem' }}>렌더링 시간(ms)</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem' }}>DOM 노드</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem' }}>번들 크기(KB)</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem' }}>데이터 처리(ms)</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem' }}>메모리(KB)</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem' }}>FPS</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem' }}>FCP(ms)</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.5rem' }}>LCP(ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {getAverageResults().map((result, index) => (
                    <tr key={index}>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{result.library}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{result.chartType}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem', fontSize: '0.75rem' }}>
                        {Object.entries(result.datasetParams).map(([key, value]) => 
                          `${key}:${value}`
                        ).join(' | ')}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{result.count}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{result.renderTime}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{result.domNodes}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{result.bundleSize}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{result.dataProcessingTime}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{result.memoryUsage}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{result.fps}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{result.webVitals.fcp}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{result.webVitals.lcp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 상세 결과 (접을 수 있는 형태) */}
          <details>
            <summary style={{ 
              cursor: 'pointer', 
              padding: '0.5rem', 
              background: '#f0f0f0',
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              🔍 상세 측정 결과 보기 ({results.length}개 항목)
            </summary>
            <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '0.75rem'
              }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    <th style={{ border: '1px solid #ddd', padding: '0.25rem' }}>라이브러리</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.25rem' }}>차트</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.25rem' }}>회차</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.25rem' }}>데이터셋</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.25rem' }}>렌더링(ms)</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.25rem' }}>DOM</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.25rem' }}>번들(KB)</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.25rem' }}>데이터(ms)</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.25rem' }}>메모리(KB)</th>
                    <th style={{ border: '1px solid #ddd', padding: '0.25rem' }}>FPS</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index}>
                      <td style={{ border: '1px solid #ddd', padding: '0.25rem' }}>{result.library}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.25rem' }}>{result.chartType}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.25rem' }}>{result.iteration}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.25rem', fontSize: '0.6rem' }}>
                        {Object.entries(result.datasetParams).map(([key, value]) => 
                          `${key}:${value}`
                        ).join(' | ')}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '0.25rem' }}>{result.renderTime}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.25rem' }}>{result.domNodes}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.25rem' }}>{result.bundleSize}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.25rem' }}>{result.dataProcessingTime}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.25rem' }}>{result.memoryUsage}</td>
                      <td style={{ border: '1px solid #ddd', padding: '0.25rem' }}>{result.fps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
