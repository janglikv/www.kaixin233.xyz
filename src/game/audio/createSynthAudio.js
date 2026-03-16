const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const TAU = Math.PI * 2

const createDeterministicRandom = (seed) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

const mixIn = (target, sampleIndex, value) => {
  if (sampleIndex < 0 || sampleIndex >= target.length) return
  target[sampleIndex] += value
}

const createBuffer = (context, durationSeconds, renderer) => {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * durationSeconds))
  const audioBuffer = context.createBuffer(2, frameCount, context.sampleRate)
  const left = audioBuffer.getChannelData(0)
  const right = audioBuffer.getChannelData(1)
  renderer({
    left,
    right,
    frameCount,
    sampleRate: context.sampleRate,
  })
  return audioBuffer
}

const addTone = ({
  left,
  right,
  sampleRate,
  start = 0,
  duration,
  frequencyStart,
  frequencyEnd = frequencyStart,
  attack = 0.005,
  decay = 0.08,
  sustain = 0,
  release = 0.05,
  gain = 0.5,
  pan = 0,
  wave = 'sine',
  vibratoDepth = 0,
  vibratoRate = 0,
}) => {
  const startIndex = Math.floor(start * sampleRate)
  const totalSamples = Math.max(1, Math.floor(duration * sampleRate))
  let phase = 0

  for (let offset = 0; offset < totalSamples; offset += 1) {
    const progress = offset / totalSamples
    const t = offset / sampleRate
    let envelope = 1

    if (t < attack) {
      envelope = attack > 0 ? t / attack : 1
    } else if (t < attack + decay) {
      const decayProgress = decay > 0 ? (t - attack) / decay : 1
      envelope = 1 - (1 - sustain) * decayProgress
    } else if (t < duration - release) {
      envelope = sustain
    } else {
      const releaseProgress = release > 0 ? (t - (duration - release)) / release : 1
      envelope = sustain * Math.max(0, 1 - releaseProgress)
    }

    const vibrato = vibratoDepth * Math.sin(TAU * vibratoRate * t)
    const frequency =
      frequencyStart + (frequencyEnd - frequencyStart) * progress + vibrato
    phase += TAU * frequency / sampleRate

    let waveform = Math.sin(phase)
    if (wave === 'square') {
      waveform = Math.sign(waveform || 1)
    } else if (wave === 'triangle') {
      waveform = (2 / Math.PI) * Math.asin(Math.sin(phase))
    } else if (wave === 'saw') {
      waveform = 2 * ((phase / TAU) % 1) - 1
    }

    const sample = waveform * envelope * gain
    const sampleIndex = startIndex + offset
    mixIn(left, sampleIndex, sample * (1 - pan) * 0.5)
    mixIn(right, sampleIndex, sample * (1 + pan) * 0.5)
  }
}

const addNoise = ({
  left,
  right,
  sampleRate,
  random,
  start = 0,
  duration,
  attack = 0.001,
  decay = 0.08,
  gain = 0.4,
  pan = 0,
  lowpass = 0.86,
}) => {
  const startIndex = Math.floor(start * sampleRate)
  const totalSamples = Math.max(1, Math.floor(duration * sampleRate))
  let filtered = 0

  for (let offset = 0; offset < totalSamples; offset += 1) {
    const t = offset / sampleRate
    const envelope =
      t < attack
        ? attack > 0
          ? t / attack
          : 1
        : Math.max(0, 1 - (t - attack) / Math.max(0.001, decay))
    filtered = filtered * lowpass + (random() * 2 - 1) * (1 - lowpass)
    const sample = filtered * envelope * gain
    const sampleIndex = startIndex + offset
    mixIn(left, sampleIndex, sample * (1 - pan) * 0.5)
    mixIn(right, sampleIndex, sample * (1 + pan) * 0.5)
  }
}

const softClip = (channel) => {
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = Math.tanh(channel[index] * 1.4)
  }
}

const createPlayerShotBuffer = (context) =>
  createBuffer(context, 0.12, ({ left, right, sampleRate }) => {
    addTone({
      left,
      right,
      sampleRate,
      duration: 0.08,
      frequencyStart: 1480,
      frequencyEnd: 720,
      attack: 0.001,
      decay: 0.03,
      sustain: 0.18,
      release: 0.03,
      gain: 0.22,
      pan: -0.05,
      wave: 'square',
    })
    addTone({
      left,
      right,
      sampleRate,
      start: 0.012,
      duration: 0.05,
      frequencyStart: 980,
      frequencyEnd: 520,
      attack: 0.001,
      decay: 0.02,
      sustain: 0.12,
      release: 0.02,
      gain: 0.16,
      pan: 0.08,
      wave: 'triangle',
    })
    softClip(left)
    softClip(right)
  })

const createEnemyShotBuffer = (context) =>
  createBuffer(context, 0.18, ({ left, right, sampleRate }) => {
    addTone({
      left,
      right,
      sampleRate,
      duration: 0.14,
      frequencyStart: 180,
      frequencyEnd: 80,
      attack: 0.001,
      decay: 0.06,
      sustain: 0.08,
      release: 0.04,
      gain: 0.32,
      wave: 'triangle',
    })
    softClip(left)
    softClip(right)
  })

const createHitBuffer = (context, { crit = false } = {}) =>
  createBuffer(context, crit ? 0.14 : 0.1, ({ left, right, sampleRate }) => {
    const random = createDeterministicRandom(crit ? 991 : 421)
    addNoise({
      left,
      right,
      sampleRate,
      random,
      duration: crit ? 0.09 : 0.06,
      gain: crit ? 0.26 : 0.18,
      lowpass: crit ? 0.7 : 0.82,
    })
    addTone({
      left,
      right,
      sampleRate,
      duration: crit ? 0.12 : 0.07,
      frequencyStart: crit ? 1320 : 920,
      frequencyEnd: crit ? 620 : 460,
      attack: 0.001,
      decay: 0.03,
      sustain: 0.05,
      release: 0.03,
      gain: crit ? 0.24 : 0.16,
      wave: 'triangle',
    })
    softClip(left)
    softClip(right)
  })

const createExplosionBuffer = (context, { large = false } = {}) =>
  createBuffer(context, large ? 0.75 : 0.38, ({ left, right, sampleRate }) => {
    const random = createDeterministicRandom(large ? 7001 : 3001)
    addNoise({
      left,
      right,
      sampleRate,
      random,
      duration: large ? 0.62 : 0.28,
      attack: 0.001,
      decay: large ? 0.58 : 0.24,
      gain: large ? 0.52 : 0.28,
      lowpass: large ? 0.86 : 0.82,
    })
    addTone({
      left,
      right,
      sampleRate,
      duration: large ? 0.42 : 0.18,
      frequencyStart: large ? 96 : 140,
      frequencyEnd: large ? 42 : 60,
      attack: 0.001,
      decay: large ? 0.14 : 0.08,
      sustain: 0.22,
      release: large ? 0.18 : 0.06,
      gain: large ? 0.44 : 0.2,
      wave: 'triangle',
    })
    softClip(left)
    softClip(right)
  })

const createHomingBuffer = (context) =>
  createBuffer(context, 0.24, ({ left, right, sampleRate }) => {
    addTone({
      left,
      right,
      sampleRate,
      duration: 0.2,
      frequencyStart: 520,
      frequencyEnd: 1180,
      attack: 0.002,
      decay: 0.05,
      sustain: 0.26,
      release: 0.05,
      gain: 0.22,
      pan: -0.06,
      wave: 'sine',
      vibratoDepth: 14,
      vibratoRate: 22,
    })
    addTone({
      left,
      right,
      sampleRate,
      start: 0.01,
      duration: 0.16,
      frequencyStart: 780,
      frequencyEnd: 1560,
      attack: 0.001,
      decay: 0.04,
      sustain: 0.18,
      release: 0.03,
      gain: 0.14,
      pan: 0.12,
      wave: 'triangle',
    })
    softClip(left)
    softClip(right)
  })

const createUiBuffer = (context, { high = false } = {}) =>
  createBuffer(context, 0.12, ({ left, right, sampleRate }) => {
    addTone({
      left,
      right,
      sampleRate,
      duration: 0.09,
      frequencyStart: high ? 1200 : 880,
      frequencyEnd: high ? 860 : 620,
      attack: 0.001,
      decay: 0.03,
      sustain: 0.08,
      release: 0.025,
      gain: 0.14,
      wave: 'triangle',
    })
    softClip(left)
    softClip(right)
  })

const createGameOverBuffer = (context) =>
  createBuffer(context, 2.8, ({ left, right, sampleRate }) => {
    const chordA = [146.83, 174.61, 220]
    const chordB = [130.81, 155.56, 196]
    chordA.forEach((frequency, index) => {
      addTone({
        left,
        right,
        sampleRate,
        start: 0,
        duration: 1.6,
        frequencyStart: frequency,
        frequencyEnd: frequency * 0.96,
        attack: 0.02,
        decay: 0.3,
        sustain: 0.42,
        release: 0.44,
        gain: 0.1,
        pan: (index - 1) * 0.22,
        wave: 'triangle',
      })
    })
    chordB.forEach((frequency, index) => {
      addTone({
        left,
        right,
        sampleRate,
        start: 0.48,
        duration: 2.1,
        frequencyStart: frequency,
        frequencyEnd: frequency * 0.94,
        attack: 0.04,
        decay: 0.34,
        sustain: 0.45,
        release: 0.7,
        gain: 0.12,
        pan: (index - 1) * 0.18,
        wave: 'triangle',
      })
    })
    softClip(left)
    softClip(right)
  })

const createMusicBuffer = (context) =>
  createBuffer(context, 8, ({ left, right, sampleRate }) => {
    const random = createDeterministicRandom(7719)
    const beat = 60 / 152
    const bar = beat * 4
    const progression = [
      [73.42, 146.83, [293.66, 349.23, 440]],
      [58.27, 116.54, [233.08, 293.66, 349.23]],
      [87.31, 174.61, [349.23, 440, 523.25]],
      [65.41, 130.81, [261.63, 311.13, 392]],
    ]

    for (let barIndex = 0; barIndex < progression.length; barIndex += 1) {
      const [bassRoot, kickRoot, chord] = progression[barIndex]
      const barStart = barIndex * bar

      for (let step = 0; step < 4; step += 1) {
        addTone({
          left,
          right,
          sampleRate,
          start: barStart + step * beat,
          duration: 0.22,
          frequencyStart: bassRoot,
          frequencyEnd: bassRoot * 0.92,
          attack: 0.004,
          decay: 0.05,
          sustain: 0.22,
          release: 0.04,
          gain: 0.16,
          pan: step % 2 === 0 ? -0.04 : 0.04,
          wave: 'saw',
        })
      }

      for (let kickIndex = 0; kickIndex < 4; kickIndex += 1) {
        addTone({
          left,
          right,
          sampleRate,
          start: barStart + kickIndex * beat,
          duration: 0.16,
          frequencyStart: kickRoot,
          frequencyEnd: kickRoot * 0.4,
          attack: 0.001,
          decay: 0.06,
          sustain: 0.14,
          release: 0.04,
          gain: 0.22,
          wave: 'triangle',
        })
      }

      for (let arpIndex = 0; arpIndex < 8; arpIndex += 1) {
        const note = chord[arpIndex % chord.length]
        addTone({
          left,
          right,
          sampleRate,
          start: barStart + arpIndex * (beat / 2),
          duration: 0.12,
          frequencyStart: note,
          frequencyEnd: note * 1.01,
          attack: 0.002,
          decay: 0.05,
          sustain: 0.04,
          release: 0.03,
          gain: 0.07,
          pan: arpIndex % 2 === 0 ? -0.18 : 0.18,
          wave: 'square',
        })
      }

      for (let hatIndex = 0; hatIndex < 8; hatIndex += 1) {
        addNoise({
          left,
          right,
          sampleRate,
          random,
          start: barStart + hatIndex * (beat / 2) + 0.01,
          duration: 0.04,
          attack: 0.001,
          decay: 0.03,
          gain: 0.05,
          lowpass: 0.55,
        })
      }
    }

    const leadNotes = [880, 1174.66, 1046.5, 698.46, 987.77, 783.99, 659.25, 523.25]
    leadNotes.forEach((frequency, index) => {
      addTone({
        left,
        right,
        sampleRate,
        start: 1 + index * beat * 0.5,
        duration: 0.22,
        frequencyStart: frequency,
        frequencyEnd: frequency * 0.97,
        attack: 0.004,
        decay: 0.06,
        sustain: 0.1,
        release: 0.04,
        gain: 0.06,
        pan: index % 2 === 0 ? 0.12 : -0.12,
        wave: 'triangle',
      })
    })

    softClip(left)
    softClip(right)
  })

export const createSynthAudio = () => {
  let context = null
  let masterGain = null
  let musicGain = null
  let bufferBank = null
  let musicSource = null
  let unlocked = false
  let building = null
  let gameOverPlayed = false
  let playerShotCooldown = 0
  let enemyShotCooldown = 0
  let hitCooldown = 0
  let explosionCooldown = 0
  let homingCooldown = 0

  const throttle = (lastTime, interval) => {
    const now = performance.now()
    if (now - lastTime < interval) {
      return { allowed: false, now }
    }
    return { allowed: true, now }
  }

  const ensureContext = async () => {
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      context = new AudioContextClass({ latencyHint: 'interactive' })
      masterGain = context.createGain()
      masterGain.gain.value = 0.64
      masterGain.connect(context.destination)

      musicGain = context.createGain()
      musicGain.gain.value = 0.66
      musicGain.connect(masterGain)
    }

    if (context.state !== 'running') {
      await context.resume()
    }

    if (!bufferBank) {
      if (!building) {
        building = Promise.resolve().then(() => {
          bufferBank = {
            playerShot: createPlayerShotBuffer(context),
            enemyShot: createEnemyShotBuffer(context),
            hit: createHitBuffer(context),
            critHit: createHitBuffer(context, { crit: true }),
            explosion: createExplosionBuffer(context),
            largeExplosion: createExplosionBuffer(context, { large: true }),
            homing: createHomingBuffer(context),
            ui: createUiBuffer(context),
            uiHigh: createUiBuffer(context, { high: true }),
            gameOver: createGameOverBuffer(context),
            musicLoop: createMusicBuffer(context),
          }
          building = null
        })
      }
      await building
    }

    unlocked = true
    return true
  }

  const ready = () => unlocked && context && bufferBank

  const stopMusic = () => {
    if (!musicSource) return
    try {
      musicSource.stop()
    } catch {
      // no-op
    }
    musicSource.disconnect()
    musicSource = null
  }

  const ensureMusic = () => {
    if (!ready() || musicSource) return
    musicSource = context.createBufferSource()
    musicSource.buffer = bufferBank.musicLoop
    musicSource.loop = true
    musicSource.connect(musicGain)
    musicSource.start()
  }

  const playBuffer = (buffer, { gain = 1, destination = masterGain, playbackRate = 1 } = {}) => {
    if (!ready() || !buffer) return

    const source = context.createBufferSource()
    const gainNode = context.createGain()
    source.buffer = buffer
    source.playbackRate.value = playbackRate
    gainNode.gain.value = gain
    source.connect(gainNode)
    gainNode.connect(destination)
    source.onended = () => {
      source.disconnect()
      gainNode.disconnect()
    }
    source.start()
  }

  return {
    unlock() {
      void ensureContext().then(() => {
        ensureMusic()
      })
    },
    playPlayerShot() {
      const { allowed, now } = throttle(playerShotCooldown, 28)
      if (!allowed || !ready()) return
      playerShotCooldown = now
      playBuffer(bufferBank.playerShot, { gain: 0.9 })
    },
    playEnemyShot() {
      const { allowed, now } = throttle(enemyShotCooldown, 56)
      if (!allowed || !ready()) return
      enemyShotCooldown = now
      playBuffer(bufferBank.enemyShot, { gain: 0.55 })
    },
    playHit({ crit = false } = {}) {
      const { allowed, now } = throttle(hitCooldown, 18)
      if (!allowed || !ready()) return
      hitCooldown = now
      playBuffer(crit ? bufferBank.critHit : bufferBank.hit, { gain: crit ? 0.88 : 0.58 })
    },
    playExplosion({ large = false } = {}) {
      const { allowed, now } = throttle(explosionCooldown, large ? 64 : 28)
      if (!allowed || !ready()) return
      explosionCooldown = now
      playBuffer(large ? bufferBank.largeExplosion : bufferBank.explosion, {
        gain: large ? 0.92 : 0.62,
      })
    },
    playHomingLaunch() {
      const { allowed, now } = throttle(homingCooldown, 40)
      if (!allowed || !ready()) return
      homingCooldown = now
      playBuffer(bufferBank.homing, { gain: 0.75 })
    },
    playUiClick({ high = false } = {}) {
      if (!ready()) return
      playBuffer(high ? bufferBank.uiHigh : bufferBank.ui, { gain: 0.46 })
    },
    playGameOver() {
      if (!ready() || gameOverPlayed) return
      gameOverPlayed = true
      musicGain.gain.cancelScheduledValues(context.currentTime)
      musicGain.gain.setValueAtTime(musicGain.gain.value, context.currentTime)
      musicGain.gain.linearRampToValueAtTime(0.1, context.currentTime + 0.24)
      playBuffer(bufferBank.gameOver, { gain: 0.92 })
    },
    resetRunState() {
      gameOverPlayed = false
      if (!ready()) return
      ensureMusic()
      musicGain.gain.cancelScheduledValues(context.currentTime)
      musicGain.gain.setValueAtTime(musicGain.gain.value, context.currentTime)
      musicGain.gain.linearRampToValueAtTime(0.36, context.currentTime + 0.16)
    },
    setMasterVolume(value) {
      if (!masterGain) return
      masterGain.gain.value = clamp(value, 0, 1)
    },
    destroy() {
      stopMusic()
      if (context) {
        void context.close()
      }
      context = null
      masterGain = null
      musicGain = null
      bufferBank = null
      building = null
      unlocked = false
      gameOverPlayed = false
    },
  }
}
