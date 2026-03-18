export const createEcsWorld = () => ({
  nextEntityId: 1,
  entities: new Set(),
  components: {
    position: new Map(),
    velocity: new Map(),
    bounds: new Map(),
    playerControlled: new Map(),
    enemy: new Map(),
    health: new Map(),
    recycle: new Map(),
    hitbox: new Map(),
  },
  links: {
    shipScene: new Map(),
    sprite: new Map(),
    runtime: new Map(),
  },
})

export const createEntity = (world) => {
  const entityId = world.nextEntityId
  world.nextEntityId += 1
  world.entities.add(entityId)
  return entityId
}

export const queryEntities = (world, componentNames) => {
  const matches = []

  world.entities.forEach((entityId) => {
    const hasAllComponents = componentNames.every((componentName) =>
      world.components[componentName]?.has(entityId),
    )

    if (hasAllComponents) {
      matches.push(entityId)
    }
  })

  return matches
}
