import { useState, useRef, useEffect } from 'react'
import { Button, Card, Typography, Space, Slider, Modal, InputNumber, Checkbox } from 'antd'
import { PlayCircleOutlined, PlusOutlined, ExclamationCircleOutlined } from '@ant-design/icons'

const { Text } = Typography

// 音符颜色映射 - 正确的 CDEFGAB 顺序
const NOTE_COLORS = {
  C: '#ff4d4f',
  D: '#faad14',
  E: '#52c41a',
  F: '#13c2c2',
  G: '#1890ff',
  A: '#722ed1',
  B: '#eb2f96'
}

const NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const STORAGE_KEY = 'tonejs-notes'

// 音符块组件
function NoteBlock({ noteIndex, octave, duration, onDoubleClick, onHover }) {
  const getNoteColor = () => {
    const baseColor = NOTE_COLORS[NOTES[noteIndex]];
    const opacity = 1 - (octave * 0.08);
    return { backgroundColor: baseColor, opacity: Math.max(0.2, opacity) };
  };

  const getNoteWidth = () => `${duration * 100}px`;

  // 修复后的处理函数
  const handleMouseEnter = (e) => {
    e.currentTarget.style.transform = 'scale(1.05)';
    // ✅ 触发悬停播放逻辑
    if (onHover) onHover();
  };

  const handleMouseLeave = (e) => {
    e.currentTarget.style.transform = 'scale(1)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div
        // 1. 样式归样式
        style={{
          ...getNoteColor(),
          height: 20,
          width: getNoteWidth(),
          borderRadius: 4,
          cursor: onDoubleClick ? 'pointer' : 'default',
          transition: 'transform 0.2s',
        }}
        // 2. 事件绑定归事件绑定
        onDoubleClick={onDoubleClick}
        onMouseEnter={onHover || onDoubleClick ? handleMouseEnter : undefined}
        onMouseLeave={onHover || onDoubleClick ? handleMouseLeave : undefined}
      />
    </div>
  );
}

function App() {
  const [notes, setNotes] = useState(() => {
    const savedNotes = localStorage.getItem(STORAGE_KEY);
    if (savedNotes) {
      try {
        return JSON.parse(savedNotes);
      } catch {
        return [];
      }
    }
    return [];
  });
  const synthRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [formData, setFormData] = useState({ noteIndex: 0, octave: 4, duration: 0.2 });

  const [hoverPlay, setHoverPlay] = useState(false);

  // 保存数据到本地存储
  useEffect(() => {
    if (notes.length > 0 || localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }
  }, [notes]);

  const initSynth = async () => {
    if (!window.Tone) {
      const Tone = await import('tone');
      window.Tone = Tone;
    }
    if (window.Tone.getContext().state !== 'running') {
      await window.Tone.start();
    }
    if (!synthRef.current) {
      synthRef.current = new window.Tone.Synth().toDestination();
    }
  };

  const playSingleNote = async (note) => {
    await initSynth();
    synthRef.current.triggerAttackRelease(`${NOTES[note.noteIndex]}${note.octave}`, note.duration);
  };

  const addNote = () => {
    setEditingNote(null);
    setIsModalOpen(true);
  };

  const editNote = (note) => {
    setEditingNote(note);
    setFormData({ noteIndex: note.noteIndex, octave: note.octave, duration: note.duration });
    setIsModalOpen(true);
  };

  const handleModalOk = () => {
    if (editingNote) {
      setNotes(notes.map(n => n.id === editingNote.id ? { ...n, ...formData } : n));
    } else {
      setNotes([...notes, { id: Date.now(), ...formData }]);
    }
    setIsModalOpen(false);
  };

  const handleModalCancel = () => {
    setIsModalOpen(false);
    setEditingNote(null);
  };

  const confirmDeleteNote = (id) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这个音符吗？',
      okText: '确定',
      cancelText: '取消',
      onOk() {
        setNotes(notes.filter(n => n.id !== id));
        handleModalCancel();
      }
    });
  };



  const playPreviewNote = async () => {
    await initSynth();
    synthRef.current.triggerAttackRelease(`${NOTES[formData.noteIndex]}${formData.octave}`, formData.duration);
  };

  const handleNoteChange = async (value) => {
    const newFormData = { ...formData, noteIndex: value };
    setFormData(newFormData);
    await initSynth();
    synthRef.current.triggerAttackRelease(`${NOTES[value]}${formData.octave}`, formData.duration);
  };

  const handleOctaveChange = async (value) => {
    const newFormData = { ...formData, octave: value };
    setFormData(newFormData);
    await initSynth();
    synthRef.current.triggerAttackRelease(`${NOTES[formData.noteIndex]}${value}`, formData.duration);
  };



  return (
    <div style={{
      padding: '20px',
    }}>
      <Card
        style={{ width: '100%' }}
        variant="borderless"
      >
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              type="primary"
              onClick={addNote}
              icon={<PlusOutlined />}
            >
              添加音符
            </Button>
            <Checkbox
              checked={hoverPlay}
              onChange={(e) => setHoverPlay(e.target.checked)}
            >
              悬停播放
            </Checkbox>
          </div>

          <div style={{
            display: 'flex',
            gap: 6,
            width: '100%'
          }}>
            {notes.map(note => (
              <NoteBlock
                key={note.id}
                noteIndex={note.noteIndex}
                octave={note.octave}
                duration={note.duration}
                onDoubleClick={() => editNote(note)}
                onHover={hoverPlay ? () => playSingleNote(note) : null}
              />
            ))}
          </div>

          {notes.length === 0 && (
            <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
              点击"添加音符"开始创作
            </Text>
          )}

          <Modal
            title={editingNote ? '编辑音符' : '添加音符'}
            open={isModalOpen}
            onOk={handleModalOk}
            onCancel={handleModalCancel}
            okText="确定"
            cancelText="取消"
            footer={editingNote ? [
              <Button key="delete" danger onClick={() => confirmDeleteNote(editingNote.id)}>
                删除
              </Button>,
              <Button key="play" icon={<PlayCircleOutlined />} onClick={playPreviewNote}>
                播放
              </Button>,
              <Button key="cancel" onClick={handleModalCancel}>
                取消
              </Button>,
              <Button key="ok" type="primary" onClick={handleModalOk}>
                确定
              </Button>
            ] : [
              <Button key="play" icon={<PlayCircleOutlined />} onClick={playPreviewNote}>
                播放
              </Button>,
              <Button key="cancel" onClick={handleModalCancel}>
                取消
              </Button>,
              <Button key="ok" type="primary" onClick={handleModalOk}>
                确定
              </Button>
            ]}
          >
            <Space orientation="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
                  音符: {NOTES[formData.noteIndex]}
                </Text>
                <Slider
                  min={0}
                  max={6}
                  value={formData.noteIndex}
                  onChange={handleNoteChange}
                  marks={NOTES.reduce((acc, n, i) => ({ ...acc, [i]: n }), {})}
                  step={1}
                  tooltip={{ formatter: (value) => NOTES[value] }}
                />
              </div>

              <div>
                <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
                  音阶: {formData.octave}
                </Text>
                <Slider
                  min={0}
                  max={9}
                  value={formData.octave}
                  onChange={handleOctaveChange}
                  marks={{ 0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9' }}
                  step={1}
                />
              </div>

              <div>
                <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
                  时长: {formData.duration}s
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Slider
                    min={0.1}
                    max={3}
                    step={0.1}
                    value={formData.duration}
                    onChange={(value) => setFormData({ ...formData, duration: value })}
                    style={{ flex: 1 }}
                  />
                  <InputNumber
                    min={0.1}
                    value={formData.duration}
                    onChange={(value) => setFormData({ ...formData, duration: value })}
                    step={0.1}
                    style={{ width: 80 }}
                  />
                </div>
              </div>

              <div>
                <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>预览:</Text>
                <NoteBlock
                  noteIndex={formData.noteIndex}
                  octave={formData.octave}
                  duration={formData.duration}
                />
              </div>
            </Space>
          </Modal>
        </Space>
      </Card>
    </div>
  );
}

export default App;