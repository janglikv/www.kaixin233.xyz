import * as PIXI from 'pixi.js'

const TITLE_STYLE = {
  fill: 0xd62f3f,
  fontFamily: 'STKaiti, KaiTi, serif',
  fontSize: 62,
  fontWeight: '700',
  letterSpacing: 2,
  dropShadow: {
    alpha: 0.35,
    angle: Math.PI / 2,
    blur: 10,
    color: 0x220205,
    distance: 6,
  },
}

const SUBTITLE_STYLE = {
  fill: 0xd62f3f,
  fontFamily: 'Georgia, serif',
  fontSize: 18,
  fontWeight: '700',
  letterSpacing: 4,
  dropShadow: {
    alpha: 0.22,
    angle: Math.PI / 2,
    blur: 8,
    color: 0x140103,
    distance: 4,
  },
}

export class GameOverOverlayController {
  constructor({ parent, width, height, title = '撤离失败', subtitle = 'GAME OVER' }) {
    this.width = width
    this.height = height
    this.progress = 0

    this.container = new PIXI.Container()

    this.fadeOverlay = new PIXI.Graphics()
    this.fadeOverlay
      .rect(0, 0, width, height)
      .fill({ color: 0x000000, alpha: 1 })
    this.fadeOverlay.alpha = 0

    this.titleText = new PIXI.Text({
      text: title,
      style: TITLE_STYLE,
    })
    this.titleText.anchor.set(0.5)
    this.titleText.alpha = 0

    this.subtitleText = new PIXI.Text({
      text: subtitle,
      style: SUBTITLE_STYLE,
    })
    this.subtitleText.anchor.set(0.5)
    this.subtitleText.alpha = 0

    this.container.addChild(this.fadeOverlay)
    this.container.addChild(this.titleText)
    this.container.addChild(this.subtitleText)
    parent.addChild(this.container)

    this.update(0)
  }

  setProgress(progress) {
    this.progress = progress
    this.update(progress)
  }

  update(progress = this.progress) {
    this.progress = progress
    this.fadeOverlay.alpha = progress * 0.66
    this.titleText.alpha = Math.max(0, (progress - 0.22) / 0.5)
    this.subtitleText.alpha = Math.max(0, (progress - 0.38) / 0.38)
    this.titleText.position.set(
      this.width * 0.5,
      this.height * 0.475 + (1 - this.titleText.alpha) * 12,
    )
    this.subtitleText.position.set(
      this.width * 0.5,
      this.height * 0.535 + (1 - this.subtitleText.alpha) * 8,
    )
  }

  destroy() {
    this.container.destroy({ children: true })
  }
}
