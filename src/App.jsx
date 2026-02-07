import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import Soundfont from 'soundfont-player';
import {
  Button,
  Space,
  Card,
  Typography,
  Divider,
  Select,
  Slider,
  Drawer,
  Form,
  ConfigProvider,
  theme,
  InputNumber,
  Popover,
  Row,
  Col,
  Input,
} from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, StopOutlined, DeleteOutlined, SettingOutlined, PlusOutlined, SoundOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

// Y轴频率范围 21-108 (对应标准 88 键钢琴: A0 - C8)
// 之前是 0-127，但大多数采样音色在超低/超高音区没有声音
const MIDI_RANGE = Array.from({ length: 88 }, (_, i) => 108 - i);

const RAINBOW_COLORS = [
  '#ff4d4f', // Red
  '#ff7a45', // Orange
  '#ffc53d', // Yellow
  '#73d13d', // Green
  '#36cfc9', // Cyan
  '#4096ff', // Blue
  '#9254de', // Purple
  '#f759ab', // Magenta
];

const INSTRUMENTS = [
  { label: '大钢琴 (Grand Piano)', value: 'acoustic_grand_piano' },
  { label: '电钢琴 (Electric Piano)', value: 'electric_piano_1' },
  { label: '小提琴 (Violin)', value: 'violin' },
  { label: '大提琴 (Cello)', value: 'cello' },
  { label: '长笛 (Flute)', value: 'flute' },
  { label: '小号 (Trumpet)', value: 'trumpet' },
  { label: '合成贝司 (Synth Bass)', value: 'synth_bass_1' },
  { label: '马林巴 (Marimba)', value: 'marimba' },
  { label: '木琴 (Xylophone)', value: 'xylophone' },
  { label: '吉他 (Acoustic Guitar)', value: 'acoustic_guitar_nylon' },
];

const DEFAULT_PRESET = {
  id: 'preset-1',
  name: '大钢琴 (Grand Piano)',
  color: RAINBOW_COLORS[0],
  duration: '8n',
  instrument: 'acoustic_grand_piano',
  volume: 1, // 默认音量 100%
};

const DURATIONS = [
  { label: '全音符 (1n)', value: '1n' },
  { label: '二分音符 (2n)', value: '2n' },
  { label: '四分音符 (4n)', value: '4n' },
  { label: '八分音符 (8n)', value: '8n' },
  { label: '十六分音符 (16n)', value: '16n' },
];

const DURATION_STEPS = {
  '1n': 16,
  '2n': 8,
  '4n': 4,
  '8n': 2,
  '16n': 1,
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

// 将 MIDI 编号转换为音名或频率
const midiToNote = (midi) => Tone.Frequency(midi, "midi").toNote();

const AppContent = () => {
  const [nodes, setNodes] = useState(() => {
    const saved = localStorage.getItem('nodes');
    return saved ? JSON.parse(saved) : [];
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [gridSteps, setGridSteps] = useState(64);
  const [cellHeight, setCellHeight] = useState(28);
  const [cellWidth, setCellWidth] = useState(60);

  // 从 localStorage 读取初始值
  const [masterVolume, setMasterVolume] = useState(() => {
    const saved = localStorage.getItem('masterVolume');
    return saved !== null ? parseFloat(saved) : 1.5;
  });

  const [bpm, setBpm] = useState(() => {
    const saved = localStorage.getItem('bpm');
    return saved !== null ? parseInt(saved) : 120;
  });

  const [presets, setPresets] = useState(() => {
    const saved = localStorage.getItem('presets');
    return saved ? JSON.parse(saved) : [DEFAULT_PRESET];
  });

  const [activePresetId, setActivePresetId] = useState(() => {
    const saved = localStorage.getItem('activePresetId');
    // 确保读取的 ID 确实存在于预设列表中，否则回退到默认
    const savedPresets = localStorage.getItem('presets');
    const parsedPresets = savedPresets ? JSON.parse(savedPresets) : [DEFAULT_PRESET];
    return (saved && parsedPresets.some(p => p.id === saved)) ? saved : parsedPresets[0].id;
  });

  // 撤销/重做历史栈
  const [, setHistory] = useState([]);
  const [, setRedoStack] = useState([]);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());

  // 保存设置到 localStorage
  useEffect(() => {
    localStorage.setItem('masterVolume', masterVolume);
    localStorage.setItem('bpm', bpm);
    localStorage.setItem('presets', JSON.stringify(presets));
    localStorage.setItem('activePresetId', activePresetId);
    localStorage.setItem('nodes', JSON.stringify(nodes));
  }, [masterVolume, bpm, presets, activePresetId, nodes]);

  const instrumentsRef = useRef({});
  const partRef = useRef(null);
  const loopRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const xAxisScrollRef = useRef(null);
  const maxStepRef = useRef(0);
  const nodesRef = useRef(nodes);
  const hoveredCellRef = useRef(null);
  const selectedNodeIdsRef = useRef(selectedNodeIds);

  const activePreset = presets.find(p => p.id === activePresetId) || presets[0];

  // Update BPM
  useEffect(() => {
    Tone.Transport.bpm.value = bpm;
  }, [bpm]);

  // 使用 ref 追踪 nodes
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Sync selectedNodeIdsRef
  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

  // 记录历史辅助函数
  const pushToHistory = useCallback(() => {
    setHistory(prev => [...prev, nodesRef.current]);
    setRedoStack([]); // 新的操作清空重做栈
  }, []);

  const performUndo = useCallback(() => {
    setHistory(prevHistory => {
      if (prevHistory.length === 0) return prevHistory;
      const previousNodes = prevHistory[prevHistory.length - 1];
      const newHistory = prevHistory.slice(0, -1);

      setRedoStack(prevRedo => [...prevRedo, nodesRef.current]);
      setNodes(previousNodes);

      return newHistory;
    });
  }, []);

  const performRedo = useCallback(() => {
    setRedoStack(prevRedo => {
      if (prevRedo.length === 0) return prevRedo;
      const nextNodes = prevRedo[prevRedo.length - 1];
      const newRedo = prevRedo.slice(0, -1);

      setHistory(prevHistory => [...prevHistory, nodesRef.current]);
      setNodes(nextNodes);

      return newRedo;
    });
  }, []);

  // 键盘监听
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          performRedo();
        } else {
          performUndo();
        }
      }
      
      // Delete node on Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Prevent back navigation if focus is not in an input
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }

        const currentSelected = selectedNodeIdsRef.current;
        const currentNodes = nodesRef.current;

        // 1. 优先删除选中的节点
        if (currentSelected.size > 0) {
          pushToHistory();
          setNodes(currentNodes.filter(n => !currentSelected.has(n.id)));
          setSelectedNodeIds(new Set()); // 清空选中
          return;
        }

        // 2. 如果没有选中，删除鼠标悬停的节点
        if (hoveredCellRef.current) {
          const { midi, step } = hoveredCellRef.current;
          const existingNode = currentNodes.find(n => n.midi === midi && n.step === step);
          
          if (existingNode) {
            pushToHistory();
            setNodes(currentNodes.filter(n => n.id !== existingNode.id));
          }
        }
      }

      // Adjust duration: Cmd + Left/Right
      if ((e.metaKey || e.ctrlKey) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const currentSelected = selectedNodeIdsRef.current;
        if (currentSelected.size > 0) {
            pushToHistory();
            const currentNodes = nodesRef.current;
            const isLengthen = e.key === 'ArrowRight';
            
            // DURATIONS is ordered 1n, 2n, 4n, 8n, 16n
            // Index 0 is Longest. Index 4 is Shortest.
            // Right (Lengthen) -> Decrease Index
            // Left (Shorten) -> Increase Index
            
            const newNodes = currentNodes.map(node => {
                if (!currentSelected.has(node.id)) return node;
                
                const currentIndex = DURATIONS.findIndex(d => d.value === node.duration);
                if (currentIndex === -1) return node;

                let newIndex;
                if (isLengthen) {
                    newIndex = Math.max(0, currentIndex - 1);
                } else {
                    newIndex = Math.min(DURATIONS.length - 1, currentIndex + 1);
                }

                return { ...node, duration: DURATIONS[newIndex].value };
            });
            
            setNodes(newNodes);
            
            // Handle grid expansion if lengthened
            if (isLengthen) {
                // Calculate max end
                const maxEnd = Math.max(...newNodes.map(n => n.step + (DURATION_STEPS[n.duration] || 1)), 0);
                 setGridSteps(prev => {
                    if (maxEnd > prev) {
                         return Math.ceil(maxEnd / 32) * 32 + 32;
                    }
                    return prev;
                 });
            }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performUndo, performRedo, pushToHistory]);

  // 初始滚动到 C4 (MIDI 60)
  useEffect(() => {
    if (scrollContainerRef.current) {
      const c4Index = MIDI_RANGE.indexOf(60);
      const containerHeight = scrollContainerRef.current.clientHeight;
      const targetScrollTop = c4Index * cellHeight - containerHeight / 2 + cellHeight / 2;
      scrollContainerRef.current.scrollTop = targetScrollTop;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅在挂载时运行一次

  const updatePreset = (id, updates) => {
    setPresets(prev => prev.map(p => {
      if (p.id !== id) return p;
      return { ...p, ...updates };
    }));
  };

  const addPreset = () => {
    const newId = generateId();
    // Cycle colors
    const nextColorIndex = presets.length % RAINBOW_COLORS.length;
    const newPreset = {
      ...DEFAULT_PRESET,
      id: newId,
      name: `预设 ${presets.length + 1}`,
      color: RAINBOW_COLORS[nextColorIndex],
    };
    setPresets(prev => [...prev, newPreset]);
    setActivePresetId(newId);
  };

  // 更新 maxStepRef
  useEffect(() => {
    const max = Math.max(...nodes.map(n => n.step + (DURATION_STEPS[n.duration] || 1)), 0);
    maxStepRef.current = max;
  }, [nodes]);

  const loadInstrument = useCallback(async (instrumentName) => {
    if (instrumentsRef.current[instrumentName]) return instrumentsRef.current[instrumentName];

    try {
      const instrument = await Soundfont.instrument(Tone.context.rawContext, instrumentName);
      instrumentsRef.current[instrumentName] = instrument;
      return instrument;
    } catch (e) {
      console.error('Failed to load instrument', instrumentName, e);
      return null;
    }
  }, []);

  // Preload instruments when presets change
  useEffect(() => {
    presets.forEach(p => {
      if (p.instrument) loadInstrument(p.instrument);
    });
  }, [presets, loadInstrument]);

  const stopPlay = useCallback(() => {
    Tone.getTransport().stop();
    setIsPlaying(false);
    setCurrentStep(-1);
  }, []);

  // 初始化合成器
  useEffect(() => {
    // synthRef removed

    loopRef.current = new Tone.Loop((time) => {
      Tone.Draw.schedule(() => {
        const seconds = Tone.Transport.seconds;
        const bpm = Tone.Transport.bpm.value;
        const bps = bpm / 60;
        const beat = Math.floor(seconds * bps * 4);

        if (maxStepRef.current > 0 && beat >= maxStepRef.current) {
          stopPlay();
        } else {
          setCurrentStep(beat);
        }
      }, time);
    }, '16n').start(0);

    return () => {
      // synthRef removed
      partRef.current?.dispose();
      loopRef.current?.dispose();
    };
  }, [stopPlay]);

  // 更新调度任务
  useEffect(() => {
    if (partRef.current) {
      partRef.current.dispose();
    }

    const partData = nodes.map(node => {
      // Find preset for config
      const preset = presets.find(p => p.id === node.presetId) || presets[0];
      return {
        time: node.time,
        note: midiToNote(node.midi),
        duration: node.duration, // Use node's duration (which was copied from preset at creation)
        velocity: (preset.volume ?? 1) * masterVolume, // 使用预设音量 * 总音量
        instrument: preset.instrument
      };
    });

    partRef.current = new Tone.Part((time, value) => {
      const inst = instrumentsRef.current[value.instrument];
      if (inst) {
        try {
          const durationSec = Tone.Time(value.duration).toSeconds();
          inst.play(value.note, time, { duration: durationSec, gain: value.velocity });
        } catch (e) {
          console.error(e);
        }
      }
    }, partData).start(0);

    partRef.current.loop = false;
  }, [nodes, presets, masterVolume]); // Depend on presets and masterVolume to update sound immediately

  const togglePlay = async () => {
    if (Tone.getTransport().state !== 'started') {
      await Tone.start();
      Tone.getTransport().position = 0;
      Tone.getTransport().start();
      setIsPlaying(true);
    } else {
      Tone.getTransport().pause();
      setIsPlaying(false);
    }
  };

  const handleScroll = (e) => {
    const { scrollLeft, clientWidth, scrollWidth } = e.target;
    if (scrollWidth - (scrollLeft + clientWidth) < 100) {
      setGridSteps(prev => prev + 32);
    }
    if (xAxisScrollRef.current) {
      xAxisScrollRef.current.scrollLeft = scrollLeft;
    }
  };

  const toggleNode = useCallback((midi, step) => {
    // 检查是否已存在
    const currentNodes = nodesRef.current;
    const existingNode = currentNodes.find(n => n.midi === midi && n.step === step);

    if (existingNode) {
      // 存在 -> 什么都不做 (点击只负责添加，删除改为 Delete 键)
      return;
    } 
    
    // 不存在 -> 添加
    pushToHistory(); // 记录历史
    
    const time = `0:0:${step}`;
    // Find active preset to get duration default
    const currentPreset = presets.find(p => p.id === activePresetId) || presets[0];

    const newNode = {
      id: generateId(),
      midi,
      time,
      step,
      presetId: activePresetId, // Link to preset
      duration: currentPreset.duration, // Copy duration as default
    };

    // 自动扩展网格
    setGridSteps(prev => {
      const nodeEnd = step + (DURATION_STEPS[newNode.duration] || 1);
      if (nodeEnd > prev) {
        return Math.ceil(nodeEnd / 32) * 32 + 32;
      }
      return prev;
    });

    setNodes([...currentNodes, newNode]);
    return newNode.id;
  }, [activePresetId, presets, pushToHistory]);

  const handleRightClick = useCallback((e, midi, step) => {
    e.preventDefault();
    pushToHistory();
    setNodes(prev => prev.filter(n => !(n.midi === midi && n.step === step)));
  }, [pushToHistory]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部工具栏：预设列表(左) + 播放控制(右) + 预设设置(下) */}
      <div style={{
        background: '#141414',
        borderBottom: '1px solid #262626',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* 第一行：左右布局 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '14px 20px 14px 20px',
        }}>

          {/* 左侧：预设列表 */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', alignItems: 'center', overflowX: 'auto', flex: 1 }}>
            {presets.map(p => (
              <div
                key={p.id}
                onClick={() => setActivePresetId(p.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  background: activePresetId === p.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: `1px solid ${activePresetId === p.id ? p.color : '#424242'}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  userSelect: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, marginRight: 8 }} />
                <span style={{ color: activePresetId === p.id ? '#fff' : '#aaa', fontSize: 13 }}>{p.name}</span>
              </div>
            ))}
            <Button icon={<PlusOutlined />} onClick={addPreset} type="dashed">新建</Button>
          </div>

          {/* 右侧：操作按钮组 */}
          <Space>
            <div style={{ display: 'flex', alignItems: 'center', width: 140, marginRight: 8 }}>
              <SoundOutlined style={{ color: '#aaa', marginRight: 8 }} />
              <Slider
                min={0}
                max={4}
                step={0.1}
                value={masterVolume}
                onChange={setMasterVolume}
                style={{ flex: 1 }}
                tooltip={{ formatter: v => `总音量: ${Math.round(v * 100)}%` }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginRight: 16 }}>
              <Text style={{ color: '#aaa', fontSize: 12, marginRight: 8, userSelect: 'none' }}>BPM</Text>
              <InputNumber
                min={40}
                max={300}
                value={bpm}
                onChange={setBpm}
                size="small"
                style={{ width: 60 }}
              />
            </div>
            <Popover
              content={
                <div style={{ width: 300 }}>
                  <div style={{ marginBottom: 10 }}>
                    <Text>X轴缩放 (宽度)</Text>
                    <Row gutter={8}>
                      <Col span={16}>
                        <Slider min={10} max={100} value={cellWidth} onChange={setCellWidth} />
                      </Col>
                      <Col span={8}>
                        <InputNumber min={10} max={100} style={{ width: '100%' }} value={cellWidth} onChange={setCellWidth} />
                      </Col>
                    </Row>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <Text>Y轴缩放 (高度)</Text>
                    <Row gutter={8}>
                      <Col span={16}>
                        <Slider min={4} max={50} value={cellHeight} onChange={setCellHeight} />
                      </Col>
                      <Col span={8}>
                        <InputNumber min={4} max={50} style={{ width: '100%' }} value={cellHeight} onChange={setCellHeight} />
                      </Col>
                    </Row>
                  </div>
                  <Divider style={{ margin: '10px 0' }} />
                  <div>
                    <Text>整体缩放 (基准倍率)</Text>
                    <Slider
                      min={0.5}
                      max={2}
                      step={0.1}
                      defaultValue={1}
                      tooltip={{ formatter: (v) => `${Math.round(v * 100)}%` }}
                      onChange={(v) => {
                        setCellWidth(60 * v);
                        setCellHeight(28 * v);
                      }}
                    />
                  </div>
                </div>
              }
              title="视图设置"
              trigger="click"
            >
              <Button icon={<SettingOutlined />}>视图设置</Button>
            </Popover>
            <Divider type="vertical" style={{ borderColor: '#424242' }} />
            <Button
              type={isPlaying ? 'default' : 'primary'}
              icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={togglePlay}
            >
              {isPlaying ? '暂停' : '播放'}
            </Button>
            <Button icon={<StopOutlined />} onClick={stopPlay}>停止</Button>
            <Button icon={<DeleteOutlined />} onClick={() => {
              pushToHistory();
              setNodes([]);
            }} danger ghost>清空</Button>
          </Space>
        </div>

        <Divider style={{ margin: 0, borderColor: '#262626' }} />

        {/* 第二行：预设详细设置 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          flexWrap: 'wrap',
          padding: '6px 20px 10px 20px',
          // background: '#191919',
        }}>
          <Space>
            <Input
              value={activePreset.name}
              onChange={e => updatePreset(activePresetId, { name: e.target.value })}
              style={{ width: 120 }}
              placeholder="预设名称"
              size="small"
            />
            {/* 颜色选择器 (简化版) */}
            <div style={{ display: 'flex', gap: 4 }}>
              {RAINBOW_COLORS.map(c => (
                <div
                  key={c}
                  onClick={() => updatePreset(activePresetId, { color: c })}
                  style={{
                    width: 16, height: 16, borderRadius: 2, background: c, cursor: 'pointer',
                    border: activePreset.color === c ? '2px solid #fff' : '1px solid transparent'
                  }}
                />
              ))}
            </div>
          </Space>

          <Divider type="vertical" style={{ borderColor: '#333' }} />

          <Space>
            <Select
              value={activePreset.duration}
              onChange={v => updatePreset(activePresetId, { duration: v })}
              options={DURATIONS}
              style={{ minWidth: 100 }}
              size="small"
              popupMatchSelectWidth={false}
            />
            <Select
              value={activePreset.instrument}
              onChange={v => updatePreset(activePresetId, { instrument: v })}
              options={INSTRUMENTS}
              style={{ width: 180 }}
              size="small"
              placeholder="选择乐器"
            />
            <div style={{ display: 'flex', alignItems: 'center', marginLeft: 8, width: 120 }}>
              <Text style={{ color: '#aaa', fontSize: 12, marginRight: 4 }}>音量</Text>
              <Slider
                min={0}
                max={4}
                step={0.1}
                value={activePreset.volume ?? 1}
                onChange={v => updatePreset(activePresetId, { volume: v })}
                style={{ flex: 1 }}
                tooltip={{ formatter: v => `${Math.round(v * 100)}%` }}
              />
            </div>
          </Space>
        </div>
      </div>

      {/* 坐标图表区域 + 底部 X 轴 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #262626', borderRadius: '4px', background: '#0d0d0d' }}>
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="no-scrollbar"
          style={{
            position: 'relative',
            overflow: 'auto',
            flex: 1
          }}
        >
          <div style={{ display: 'flex', width: `${gridSteps * cellWidth + 80}px` }}>
            {/* Y轴刻度 */}
            <div style={{
              width: '80px',
              flexShrink: 0,
              position: 'sticky',
              left: 0,
              zIndex: 10,
              background: '#141414',
              borderRight: '1px solid #262626'
            }}>
              {MIDI_RANGE.map(midi => (
                <div key={midi} style={{
                  height: cellHeight,
                  padding: '0 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '9px',
                  color: midi % 12 === 0 ? '#177ddc' : '#888',
                  fontWeight: midi % 12 === 0 ? 'bold' : 'normal',
                  borderBottom: '1px solid #1a1a1a',
                  borderRight: `2px solid ${hoveredCell?.midi === midi ? '#177ddc' : 'transparent'}`,
                  transition: 'border-color 0.1s'
                }}>
                  <span>{midiToNote(midi)}</span>
                  <span>{midi}</span>
                </div>
              ))}
            </div>

            {/* 图表网格 */}
            <div 
              style={{ 
                flexGrow: 1, 
                position: 'relative',
                height: MIDI_RANGE.length * cellHeight,
                backgroundImage: `
                  linear-gradient(to right, #1a1a1a 1px, transparent 1px),
                  linear-gradient(to bottom, #1a1a1a 1px, transparent 1px),
                  linear-gradient(to bottom, #111 ${cellHeight}px, transparent ${cellHeight}px)
                `,
                backgroundSize: `
                  ${cellWidth}px ${cellHeight}px,
                  ${cellWidth}px ${cellHeight}px,
                  100% ${cellHeight * 12}px
                `,
                backgroundAttachment: 'local',
                cursor: 'crosshair',
              }}
              onClick={(e) => {
                // const x = e.clientX - rect.left; 
                const offsetX = e.nativeEvent.offsetX;
                const offsetY = e.nativeEvent.offsetY;
                
                const step = Math.floor(offsetX / cellWidth);
                const midiIndex = Math.floor(offsetY / cellHeight);
                const midi = MIDI_RANGE[midiIndex];

                if (step >= 0 && step < gridSteps && midi !== undefined) {
                  const existingNode = nodes.find(n => n.midi === midi && n.step === step);
                  
                  if (existingNode) {
                    const isSelected = selectedNodeIds.has(existingNode.id);
                    if (isSelected) {
                      // 已选中 -> 取消选中
                      setSelectedNodeIds(prev => {
                        const next = new Set(prev);
                        next.delete(existingNode.id);
                        return next;
                      });
                    } else {
                      // 未选中 -> 处理选中逻辑
                      if (e.metaKey || e.ctrlKey) {
                        setSelectedNodeIds(prev => new Set(prev).add(existingNode.id));
                      } else {
                        setSelectedNodeIds(new Set([existingNode.id]));
                      }
                    }
                  } else {
                    // Add node
                    const newNodeId = toggleNode(midi, step);
                    if (newNodeId) {
                      if (e.metaKey || e.ctrlKey) {
                        setSelectedNodeIds(prev => new Set(prev).add(newNodeId));
                      } else {
                        setSelectedNodeIds(new Set([newNodeId]));
                      }
                    }
                  }
                }
              }}
              onMouseMove={(e) => {
                const offsetX = e.nativeEvent.offsetX;
                const offsetY = e.nativeEvent.offsetY;
                
                const step = Math.floor(offsetX / cellWidth);
                const midiIndex = Math.floor(offsetY / cellHeight);
                const midi = MIDI_RANGE[midiIndex];

                if (step >= 0 && step < gridSteps && midi !== undefined) {
                  const cell = { midi, step };
                  setHoveredCell(cell);
                  hoveredCellRef.current = cell;
                } else {
                  setHoveredCell(null);
                  hoveredCellRef.current = null;
                }
              }}
              onMouseLeave={() => {
                setHoveredCell(null);
                hoveredCellRef.current = null;
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                const offsetX = e.nativeEvent.offsetX;
                const offsetY = e.nativeEvent.offsetY;
                
                const step = Math.floor(offsetX / cellWidth);
                const midiIndex = Math.floor(offsetY / cellHeight);
                const midi = MIDI_RANGE[midiIndex];
                
                if (step >= 0 && step < gridSteps && midi !== undefined) {
                  handleRightClick(e, midi, step);
                }
              }}
            >
              {/* 播放头高亮列 */}
              {currentStep >= 0 && (
                <div
                  style={{
                    position: 'absolute',
                    left: currentStep * cellWidth,
                    top: 0,
                    bottom: 0,
                    width: cellWidth,
                    background: 'rgba(23, 125, 220, 0.15)',
                    pointerEvents: 'none',
                    zIndex: 1
                  }}
                />
              )}

              {/* Hover 高亮 */}
              {hoveredCell && (
                 <div
                  style={{
                    position: 'absolute',
                    left: hoveredCell.step * cellWidth,
                    top: MIDI_RANGE.indexOf(hoveredCell.midi) * cellHeight,
                    width: cellWidth,
                    height: cellHeight,
                    border: '1px solid #fff',
                    pointerEvents: 'none',
                    zIndex: 3,
                  }}
                />
              )}

              {/* 音符节点 */}
              {nodes.map(node => {
                const nodePreset = presets.find(p => p.id === node.presetId) || presets[0];
                const midiIndex = MIDI_RANGE.indexOf(node.midi);
                if (midiIndex === -1) return null;
                const durationSteps = DURATION_STEPS[node.duration] || 1;
                const isSelected = selectedNodeIds.has(node.id);

                return (
                  <div
                    key={node.id}
                    style={{
                      position: 'absolute',
                      left: node.step * cellWidth + 1,
                      top: midiIndex * cellHeight + 1,
                      width: cellWidth - 2, // 恢复为单个单元格宽度
                      height: cellHeight - 1,
                      background: nodePreset.color,
                      borderRadius: '2px',
                      zIndex: 2,
                      opacity: 1,
                      pointerEvents: 'none',
                      boxShadow: 'none',
                    }}
                  >
                    {/* 选中标识：小白点 */}
                    {isSelected && (
                      <div 
                        style={{
                          position: 'absolute',
                          left: '6px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: '6px',
                          height: '6px',
                          background: '#fff',
                          borderRadius: '50%',
                          boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                          zIndex: 3
                        }}
                      />
                    )}
                    {/* 扩展下划线：显示音长 */}
                    <div 
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: durationSteps * cellWidth - 2,
                        height: '3px',
                        background: nodePreset.color,
                        borderRadius: '1px',
                        boxShadow: 'none',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* 固定底部的 X 轴容器 */}
        <div 
           ref={xAxisScrollRef}
           className="no-scrollbar"
           style={{ 
             height: '30px', 
             background: '#141414',
             borderTop: '1px solid #262626',
             display: 'flex',
             overflow: 'hidden', // Hide scrollbar, controlled by JS
             flexShrink: 0
           }}
        >
          {/* 左下角空块 (对应 YAxis 宽度) */}
          <div style={{ width: 80, flexShrink: 0, background: '#141414', borderRight: '1px solid #262626' }} />
           
          {/* X轴刻度 */}
          <div style={{ display: 'flex' }}> 
             {Array.from({ length: gridSteps }).map((_, i) => (
                <div key={i} style={{
                  width: cellWidth,
                  flexShrink: 0,
                  textAlign: 'center',
                  height: '30px',
                  background: currentStep === i ? '#111' : 'transparent',
                  borderRight: '1px solid #1a1a1a',
                  borderTop: `2px solid ${hoveredCell?.step === i ? '#177ddc' : 'transparent'}`,
                  fontSize: '10px',
                  lineHeight: '30px',
                  color: i % 4 === 0 ? '#177ddc' : '#555',
                  transition: 'all 0.1s'
                }}>
                  {i}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const App = () => (
  <ConfigProvider
    theme={{
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#177ddc',
        borderRadius: 4,
      },
    }}
  >
    <AppContent />
  </ConfigProvider>
);

export default App;