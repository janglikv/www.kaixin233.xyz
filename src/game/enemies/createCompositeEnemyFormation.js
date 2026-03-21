const sortTimelineEvents = (timeline) =>
  [...timeline]
    .map((event, index) => ({
      at: 0,
      id: event.id ?? `timeline-event-${index + 1}`,
      ...event,
    }))
    .sort((left, right) => left.at - right.at)

export const createCompositeEnemyFormation = ({
  timeline = [],
  createFormation,
  initialElapsedSeconds = 0,
}) => {
  const pendingEvents = sortTimelineEvents(timeline)
  const activeEntries = []
  const activeHitboxes = []
  const activeShooters = []
  let elapsedSeconds = initialElapsedSeconds
  let nextEventIndex = pendingEvents.findIndex((event) => event.at >= initialElapsedSeconds)
  if (nextEventIndex < 0) {
    nextEventIndex = pendingEvents.length
  }

  const spawnReadyFormations = () => {
    while (nextEventIndex < pendingEvents.length) {
      const event = pendingEvents[nextEventIndex]
      if (elapsedSeconds < event.at) break

      nextEventIndex += 1
      const formation = createFormation(event)
      if (!formation) continue
      activeEntries.push({
        id: event.id,
        formation,
      })
    }
  }

  const pruneFinishedFormations = () => {
    for (let index = activeEntries.length - 1; index >= 0; index -= 1) {
      const entry = activeEntries[index]
      if (entry.formation.isFinished?.() !== true) continue
      entry.formation.destroy?.()
      activeEntries.splice(index, 1)
    }
  }

  return {
    getHitboxes() {
      activeHitboxes.length = 0
      activeEntries.forEach(({ formation }) => {
        const hitboxes = formation.getHitboxes?.() ?? []
        if (hitboxes.length > 0) {
          activeHitboxes.push(...hitboxes)
        }
      })
      return activeHitboxes
    },
    getShooters() {
      activeShooters.length = 0
      activeEntries.forEach(({ formation }) => {
        const shooters = formation.getShooters?.() ?? []
        if (shooters.length > 0) {
          activeShooters.push(...shooters)
        }
      })
      return activeShooters
    },
    applyDamage(enemyId, damage) {
      for (let index = 0; index < activeEntries.length; index += 1) {
        const result = activeEntries[index].formation.applyDamage?.(enemyId, damage)
        if (result) {
          return result
        }
      }
      return null
    },
    update(deltaSeconds, seekTarget = null, onPlayerCollision = () => {}) {
      elapsedSeconds += deltaSeconds
      spawnReadyFormations()
      activeEntries.forEach(({ formation }) => {
        formation.update?.(deltaSeconds, seekTarget, onPlayerCollision)
      })
      pruneFinishedFormations()
    },
    destroy() {
      activeEntries.forEach(({ formation }) => {
        formation.destroy?.()
      })
      activeEntries.length = 0
      activeHitboxes.length = 0
      activeShooters.length = 0
    },
  }
}
