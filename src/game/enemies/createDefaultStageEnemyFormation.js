import { LOGICAL_WIDTH } from '../runtime/gameConfig'
import { RiftServitorSwarm } from './RiftServitorSwarm'
import { createCompositeEnemyFormation } from './createCompositeEnemyFormation'

const CENTER_LANE_X = LOGICAL_WIDTH * 0.5
const LEFT_LANE_X = LOGICAL_WIDTH * 0.1
const RIGHT_LANE_X = LOGICAL_WIDTH * 0.9

const createSwoopPath = ({ fromLeft, height }) => {
  const startLaneX = fromLeft ? LEFT_LANE_X : RIGHT_LANE_X
  const centerDiveX = fromLeft ? LOGICAL_WIDTH * 0.52 : LOGICAL_WIDTH * 0.48

  return [
    { x: startLaneX, y: height * 0.8 },
    { x: CENTER_LANE_X, y: height * 0.2 },
    { x: centerDiveX, y: height + 180 },
  ]
}

const DEFAULT_STAGE_TIMELINE = [
  {
    at: 0.4,
    type: 'rift-swarm',
    args: {
      columns: 1,
      rows: 14,
      spawnX: CENTER_LANE_X,
      spawnY: -92,
      spawnInterval: 0.4,
      trackPlayer: false,
    },
  },
  {
    at: 1,
    type: 'rift-swarm',
    args: {
      columns: 1,
      rows: 6,
      spawnX: LEFT_LANE_X,
      spawnY: -92,
      spawnInterval: 0.6,
      flightPathName: 'left-swoop',
      trackPlayer: false,
    },
  },
  {
    at: 1.3,
    type: 'rift-swarm',
    args: {
      columns: 1,
      rows: 6,
      spawnX: RIGHT_LANE_X,
      spawnY: -92,
      spawnInterval: 0.6,
      flightPathName: 'right-swoop',
      trackPlayer: false,
    },
  },
  {
    at: 10,
    type: 'rift-swarm',
    args: {
      columns: 1,
      rows: 2,
      spawnX: LOGICAL_WIDTH * 0.33,
      spawnY: -92,
      spawnInterval: 1.2,
      trackPlayer: true,
      trackDistance: 800,
      commitDistance: 800,
      commitSpeedMultiplier: 1.0,
    },
  },
  {
    at: 10.6,
    type: 'rift-swarm',
    args: {
      columns: 1,
      rows: 2,
      spawnX: LOGICAL_WIDTH * 0.66,
      spawnY: -92,
      spawnInterval: 1.2,
      trackPlayer: true,
      trackDistance: 800,
      commitDistance: 800,
      commitSpeedMultiplier: 1.0,
    },
  },
]

const createFormationByEvent = (event, sharedOptions) => {
  if (event.type === 'rift-swarm') {
    const flightPath =
      event.args.flightPathName === 'left-swoop'
        ? createSwoopPath({ fromLeft: true, height: sharedOptions.height })
        : event.args.flightPathName === 'right-swoop'
          ? createSwoopPath({ fromLeft: false, height: sharedOptions.height })
          : undefined

    return new RiftServitorSwarm({
      parent: sharedOptions.parent,
      worldWidth: sharedOptions.width,
      worldHeight: sharedOptions.height,
      onEnemyDeath: sharedOptions.onEnemyDeath,
      ...event.args,
      flightPath,
    })
  }

  return null
}

export const createDefaultStageEnemyFormation = (sharedOptions) =>
  createCompositeEnemyFormation({
    timeline: DEFAULT_STAGE_TIMELINE,
    createFormation: (event) => createFormationByEvent(event, sharedOptions),
    initialElapsedSeconds: sharedOptions.initialElapsedSeconds ?? 0,
  })
