import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
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
import { PlayCircleOutlined, PauseCircleOutlined, StopOutlined, DeleteOutlined, SettingOutlined, PlusOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

// Y轴频率范围 0-127 (对应 MIDI 编号)
const MIDI_RANGE = Array.from({ length: 128 }, (_, i) => 127 - i);

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

const DEFAULT_PRESET = {
  id: 'preset-1',
  name: '默认音色',
  color: RAINBOW_COLORS[0],
  duration: '16n',
  synthConfig: {
    oscillatorType: 'sine',
    envelope: {
      attack: 0.005,
      decay: 0.1,
      sustain: 0.3,
      release: 0.5,
    }
  }
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

const OSCILLATOR_TYPES = ['sine', 'square', 'triangle', 'sawtooth'];

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

// 将 MIDI 编号转换为音名或频率
const midiToNote = (midi) => Tone.Frequency(midi, "midi").toNote();

const AppContent = () => {
  const [nodes, setNodes] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [gridSteps, setGridSteps] = useState(64);
  const [cellHeight, setCellHeight] = useState(28);
  const [cellWidth, setCellWidth] = useState(60);

  const [presets, setPresets] = useState([DEFAULT_PRESET]);
  const [activePresetId, setActivePresetId] = useState(DEFAULT_PRESET.id);

  const synthRef = useRef(null);
  const partRef = useRef(null);
  const loopRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const maxStepRef = useRef(0);

  const activePreset = presets.find(p => p.id === activePresetId) || presets[0];

  const updatePreset = (id, updates) => {
    setPresets(prev => prev.map(p => {
      if (p.id !== id) return p;

      let newPreset = { ...p, ...updates };

      if (updates.synthConfig) {
        newPreset.synthConfig = { ...p.synthConfig, ...updates.synthConfig };

        if (updates.synthConfig.envelope) {
          newPreset.synthConfig.envelope = {
            ...p.synthConfig.envelope,
            ...updates.synthConfig.envelope
          };
        }
      }

      return newPreset;
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

  const stopPlay = useCallback(() => {
    Tone.getTransport().stop();
    setIsPlaying(false);
    setCurrentStep(-1);
  }, []);

  // 初始化合成器
  useEffect(() => {
    synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();

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
      synthRef.current?.dispose();
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
        velocity: 0.8,
        config: preset.synthConfig // Use preset's live synth config
      };
    });

    partRef.current = new Tone.Part((time, value) => {
      synthRef.current.set({
        oscillator: { type: value.config.oscillatorType },
        envelope: value.config.envelope
      });
      synthRef.current.triggerAttackRelease(value.note, value.duration, time, value.velocity);
    }, partData).start(0);

    partRef.current.loop = false;
  }, [nodes, presets]); // Depend on presets to update sound immediately

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
  };

  const addNode = useCallback((midi, step) => {
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

    setNodes(prev => {
      const filtered = prev.filter(n => !(n.midi === midi && n.step === step));
      return [...filtered, newNode];
    });
  }, [activePresetId, presets]);

  const handleRightClick = useCallback((e, midi, step) => {
    e.preventDefault();
    setNodes(prev => prev.filter(n => !(n.midi === midi && n.step === step)));
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex',
        flexShrink: 0,
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #262626',
        padding: 20,
      }}>
        <div>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>音频频率图表编辑器</Title>
          <Text style={{ color: '#555' }}>X: 时间轴 (Steps) | Y: 频率强度 (MIDI 0-127)</Text>
        </div>
        <Space>
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
          <Button
            type={isPlaying ? 'default' : 'primary'}
            icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={togglePlay}
          >
            {isPlaying ? '暂停' : '播放'}
          </Button>
          <Button icon={<StopOutlined />} onClick={stopPlay}>停止</Button>
          <Button danger onClick={() => setNodes([])} ghost>清空</Button>
        </Space>
      </div>

      {/* 音符画笔设置栏 */}
      <div style={{
        padding: '12px 20px',
        background: '#141414',
        borderBottom: '1px solid #262626',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        flexWrap: 'wrap'
      }}>
        <Space>
          <Text style={{ color: '#aaa' }}>音符预设:</Text>
          <Select
            value={activePresetId}
            onChange={setActivePresetId}
            options={presets.map(p => ({
              label: (
                <Space>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                  {p.name}
                </Space>
              ),
              value: p.id
            }))}
            style={{ width: 160 }}
          />
          <Button icon={<PlusOutlined />} onClick={addPreset} size="small" type="dashed">新建</Button>
        </Space>

        <Divider type="vertical" style={{ borderColor: '#333' }} />

        <Space>
          <Input
            value={activePreset.name}
            onChange={e => updatePreset(activePresetId, { name: e.target.value })}
            style={{ width: 100 }}
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
            style={{ width: 100 }}
            size="small"
          />
          <Select
            value={activePreset.synthConfig.oscillatorType}
            onChange={v => updatePreset(activePresetId, { synthConfig: { oscillatorType: v } })}
            options={OSCILLATOR_TYPES.map(t => ({ label: t, value: t }))}
            style={{ width: 80 }}
            size="small"
          />
        </Space>
        <Space size="small">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#aaa', fontSize: 10 }}>A:{activePreset.synthConfig.envelope.attack}</Text>
            <Slider
              min={0.001} max={1} step={0.01}
              value={activePreset.synthConfig.envelope.attack}
              onChange={v => updatePreset(activePresetId, { synthConfig: { envelope: { attack: v } } })}
              style={{ width: 60 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#aaa', fontSize: 10 }}>R:{activePreset.synthConfig.envelope.release}</Text>
            <Slider
              min={0.01} max={2} step={0.01}
              value={activePreset.synthConfig.envelope.release}
              onChange={v => updatePreset(activePresetId, { synthConfig: { envelope: { release: v } } })}
              style={{ width: 60 }}
            />
          </div>
        </Space>
      </div>

      {/* 坐标图表区域 */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="no-scrollbar"
        style={{
          border: '1px solid #262626',
          background: '#0d0d0d',
          position: 'relative',
          borderRadius: '4px',
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
              }}>
                <span>{midiToNote(midi)}</span>
                <span>{midi}</span>
              </div>
            ))}
            {/* X轴占位 */}
            <div style={{ height: '30px', background: '#141414' }}></div>
          </div>

          {/* 图表网格 */}
          <div style={{ flexGrow: 1 }}>
            {/* 绘图区 */}
            {MIDI_RANGE.map(midi => (
              <div key={midi} style={{ display: 'flex', height: cellHeight }}>
                {Array.from({ length: gridSteps }).map((_, step) => {
                  const nodeAtPos = nodes.find(n => n.midi === midi && n.step === step);
                  const nodePreset = nodeAtPos ? (presets.find(p => p.id === nodeAtPos.presetId) || presets[0]) : null;

                  return (
                    <div
                      key={step}
                      onClick={() => addNode(midi, step)}
                      onContextMenu={(e) => handleRightClick(e, midi, step)}
                      style={{
                        width: cellWidth,
                        flexShrink: 0,
                        borderRight: '1px solid #1a1a1a',
                        borderBottom: '1px solid #1a1a1a',
                        cursor: 'crosshair',
                        position: 'relative',
                        background: currentStep === step ? 'rgba(23, 125, 220, 0.05)' : (midi % 12 === 0 ? '#111' : 'transparent'),
                      }}
                    >
                      {nodeAtPos && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '1px',
                            left: '1px',
                            right: '1px',
                            bottom: '1px',
                            background: nodePreset ? nodePreset.color : '#177ddc',
                            borderRadius: '1px',
                            zIndex: 2,
                            boxShadow: `0 0 4px ${nodePreset ? nodePreset.color : '#177ddc'}`,
                            opacity: 0.8
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* X轴刻度 (Move to bottom) */}
            <div style={{ display: 'flex', position: 'sticky', bottom: 0, zIndex: 9, background: '#141414' }}>
              {Array.from({ length: gridSteps }).map((_, i) => (
                <div key={i} style={{
                  width: cellWidth,
                  textAlign: 'center',
                  height: '30px',
                  background: currentStep === i ? '#111' : 'transparent',
                  borderTop: '1px solid #262626',
                  borderRight: '1px solid #1a1a1a',
                  fontSize: '10px',
                  lineHeight: '30px',
                  color: i % 4 === 0 ? '#177ddc' : '#555',
                  transition: 'background 0.1s'
                }}>
                  {i}
                </div>
              ))}
            </div>
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