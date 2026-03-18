import { SHIP_CATALOG } from './shipCatalog'

const VOID_BASE_SERIAL = SHIP_CATALOG.length

const createVoidEntry = (index, name, silhouette, accent, summary) => ({
  serial: VOID_BASE_SERIAL + index + 1,
  code: `#${VOID_BASE_SERIAL + index + 1}`,
  id: `void-${index + 1}`,
  name,
  role: 'void-creature',
  previewKind: 'void-creature',
  silhouette,
  accent,
  summary,
})

export const VOID_CREATURE_CATALOG = [
  createVoidEntry(0, '裂隙侍者', 'rift-servitor', 0x8f5bff, '裂口拟态，短促突进。'),
  createVoidEntry(1, '空壳朝圣者', 'hollow-pilgrim', 0xa56dff, '空心重躯，缓慢牵引。'),
  createVoidEntry(2, '盲目注视体', 'blind-gazer', 0xc78bff, '闭眼漂浮，远程压制。'),
  createVoidEntry(3, '折叠猎犬', 'fold-hound', 0x7a4cff, '折骨奔袭，侧翼扑杀。'),
  createVoidEntry(4, '回声寄生体', 'echo-parasite', 0xd06bff, '复制轮廓，延迟回响。'),
  createVoidEntry(5, '虚空编钟', 'void-bell', 0x6d56ff, '悬浮重器，改写区域规则。'),
]

export const CATALOG_ENTRIES = [...SHIP_CATALOG, ...VOID_CREATURE_CATALOG]
