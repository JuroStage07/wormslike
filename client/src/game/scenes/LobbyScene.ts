import Phaser from 'phaser'
import { SCENE_KEYS } from '../../constants/game'
import { colyseusService } from '../utils/ColyseusService'
import { PlayerManager } from '../utils/PlayerManager'
import type { PlayerData } from '../types/player'
import { logger } from '../../utils/logger'
import { FIXED_MAPS, MAP_IDS, type FixedMapId } from '../constants/fixedMaps'

interface LobbyData {
  mode: 'quick' | 'create' | 'join'
  roomCode?: string
}

export class LobbyScene extends Phaser.Scene {
  private mode!: 'quick' | 'create' | 'join'
  private roomCode: string = ''
  private playerManager: PlayerManager = new PlayerManager()
  private isHost: boolean = false
  private isReady: boolean = false
  private selectedMapId: FixedMapId = 'classic'
  private mapSelectorContainer!: Phaser.GameObjects.Container

  // UI Elements
  private roomCodeText!: Phaser.GameObjects.Text
  private playersList!: Phaser.GameObjects.Container
  private chatContainer!: Phaser.GameObjects.Container
  private chatMessages: Phaser.GameObjects.Text[] = []
  private readyButton!: Phaser.GameObjects.Text
  private startButton!: Phaser.GameObjects.Text
  private backButton!: Phaser.GameObjects.Text
  private addBotButton!: Phaser.GameObjects.Text
  private removeBotButton!: Phaser.GameObjects.Text

  constructor() {
    super(SCENE_KEYS.LOBBY)
  }

  init(data: LobbyData): void {
    this.mode = data.mode
    this.roomCode = data.roomCode || ''
  }

  create(): void {
    this.createBackground()
    this.createUI()
    this.setupNetworking()
    
    logger.info('LobbyScene', `Lobby inicializado en modo: ${this.mode}`)
  }

  private async setupNetworking(): Promise<void> {
    try {
      switch (this.mode) {
        case 'quick':
          await this.joinQuickMatch()
          break
        case 'create':
          await this.createPrivateRoom()
          break
        case 'join':
          await this.joinPrivateRoom()
          break
      }
    } catch (error) {
      logger.error('LobbyScene', `Error en networking: ${error}`)
      this.showError('Error de conexión - usando modo offline')
      this.setupOfflineMode()
    }
  }

  private async createPrivateRoom(): Promise<void> {
    try {
      // Intentar crear sala real
      const room = await colyseusService.createPrivateRoom({
        playerName: this.playerManager.getLocalPlayerName()
      })
      
      this.roomCode = room.roomId
      this.isHost = true
      
      if (this.roomCodeText) {
        this.roomCodeText.setText(`Código: ${this.roomCode}`)
      }
      
      // Recrear la sección del código con el botón de copiar
      this.time.delayedCall(100, () => {
        this.createRoomCodeSection()
      })
      
      logger.info('LobbyScene', `Sala privada creada: ${this.roomCode}`)
      
      // Configurar eventos de red reales
      this.setupRealNetworkEvents()
      
    } catch (error) {
      logger.error('LobbyScene', `Error creando sala real: ${error}`)
      
      // Fallback a modo offline
      this.setupOfflineMode()
    }
  }

  private async joinQuickMatch(): Promise<void> {
    try {
      // Intentar partida rápida real
      const room = await colyseusService.joinQuickMatch()
      this.roomCode = room.roomId
      this.isHost = false
      
      logger.info('LobbyScene', 'Conectado a partida rápida')
      
      // Configurar eventos de red reales
      this.setupRealNetworkEvents()
      
    } catch (error) {
      logger.error('LobbyScene', `Error en partida rápida: ${error}`)
      
      // Fallback a modo offline
      this.setupOfflineMode()
    }
  }

  private async joinPrivateRoom(): Promise<void> {
    const roomCode = this.roomCode || prompt('Ingresa el código de la sala (4 dígitos):')
    if (!roomCode) {
      this.scene.start(SCENE_KEYS.MAIN_MENU)
      return
    }
    this.roomCode = roomCode
    
    try {
      // Intentar unirse a sala real
      await colyseusService.joinPrivateRoom(roomCode, this.playerManager.getLocalPlayerName())
      this.roomCode = roomCode
      this.isHost = false
      
      if (this.roomCodeText) {
        this.roomCodeText.setText(`Código de Sala: ${this.roomCode}`)
      }
      
      logger.info('LobbyScene', `Conectado a sala: ${roomCode}`)
      
      // Configurar eventos de red reales
      this.setupRealNetworkEvents()
      
    } catch (error) {
      logger.error('LobbyScene', `Error uniéndose a sala: ${error}`)
      
      // Fallback a modo offline con el código ingresado
      this.roomCode = roomCode
      this.isHost = false
      
      if (this.roomCodeText) {
        this.roomCodeText.setText(`Código de Sala: ${this.roomCode} (Offline)`)
      }
      
      this.setupOfflineMode()
    }
  }

  private setupRealNetworkEvents(): void {
    const room = colyseusService.getRoom()
    if (!room) {
      logger.error('LobbyScene', 'No hay room activa para configurar eventos')
      this.setupOfflineMode()
      return
    }

    // Actualizar el ID del jugador local para que coincida con el sessionId del servidor
    this.playerManager.setLocalPlayerId(room.sessionId)

    // Configurar eventos de chat
    colyseusService.onChatMessage((data) => {
      this.addChatMessage(data.sender, data.message)
    })

    // Configurar eventos de cambio de estado de jugadores
    colyseusService.onPlayerStateChange((data) => {
      logger.info('LobbyScene', `Recibida actualización de jugadores: ${JSON.stringify(data)}`)
      
      // Actualizar lista de jugadores con datos reales
      this.playerManager.clear()
      
      if (data.players && Array.isArray(data.players)) {
        data.players.forEach((playerState: any) => {
          const playerData: PlayerData = {
            id: playerState.id,
            name: playerState.name,
            isReady: playerState.isReady,
            isHost: playerState.isHost,
            isConnected: playerState.isConnected,
            color: this.playerManager.generatePlayerColor()
          }
          this.playerManager.addPlayer(playerData)
          
          // Actualizar el estado del host local
          if (playerState.isHost && playerState.id === room.sessionId) {
            this.isHost = true
          }
        })
      }
      
      this.updatePlayersList()
      this.updateButtonStates()
    })

    // Configurar evento de inicio de juego - CRÍTICO: debe estar aquí para todos los jugadores
    colyseusService.onGameStart((data) => {
      logger.info('LobbyScene', `Recibido evento game_started del servidor con mapa: ${data.mapId}`)
      this.selectedMapId = (data.mapId as FixedMapId) || 'classic'
      this.startGameLocally(this.selectedMapId)
    })

    // Configurar evento de información de sala
    room.onMessage('room_info', (data: any) => {
      logger.info('LobbyScene', `Información de sala recibida: ${JSON.stringify(data)}`)
      this.isHost = data.isHost
      this.updateButtonStates()
    })
    
    logger.info('LobbyScene', 'Eventos de red reales configurados')
  }

  private createBackground(): void {
    // Fondo degradado mejorado
    const graphics = this.add.graphics()
    graphics.fillGradientStyle(0x0f0f23, 0x1a1a2e, 0x16213e, 0x2a3a5a, 1)
    graphics.fillRect(0, 0, this.scale.width, this.scale.height)
    
    // Partículas de fondo animadas
    this.createBackgroundParticles()
    
    // Patrón de puntos decorativo
    this.createDotPattern()
  }

  private createBackgroundParticles(): void {
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * this.scale.width
      const y = Math.random() * this.scale.height
      const size = 1 + Math.random() * 3
      
      const particle = this.add.circle(x, y, size, 0x4a90e2, 0.3)
      
      this.tweens.add({
        targets: particle,
        y: y - 150,
        alpha: 0,
        duration: 4000 + Math.random() * 3000,
        repeat: -1,
        delay: Math.random() * 3000,
        ease: 'Sine.easeInOut',
        onRepeat: () => {
          particle.y = this.scale.height + 50
          particle.alpha = 0.3
          particle.x = Math.random() * this.scale.width
        }
      })
    }
  }

  private createDotPattern(): void {
    const dotSize = 2
    const spacing = 50
    
    for (let x = spacing; x < this.scale.width; x += spacing) {
      for (let y = spacing; y < this.scale.height; y += spacing) {
        const dot = this.add.circle(x, y, dotSize, 0x4a90e2, 0.1)
        
        // Animación sutil de pulsación
        this.tweens.add({
          targets: dot,
          alpha: 0.3,
          duration: 2000 + Math.random() * 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        })
      }
    }
  }

  private createUI(): void {
    // Título principal con mejor estilo
    this.add.text(
      this.scale.width / 2,
      40,
      this.getTitleText(),
      {
        fontFamily: 'Arial Black',
        fontSize: '42px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
        shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 4, fill: true }
      }
    ).setOrigin(0.5)

    // Name input
    this.createNameInput()

    // Código de sala mejorado con botón de copiar
    if (this.mode !== 'quick') {
      this.createRoomCodeSection()
    }

    this.createPlayersPanel()
    this.createChatPanel()
    this.createMapSelector()
    this.createButtons()
  }

  private createNameInput(): void {
    const cx = this.scale.width / 2
    const y = 130

    this.add.text(cx - 160, y, '👤 Tu nombre:', {
      fontFamily: 'Arial Bold', fontSize: '15px', color: '#cccccc'
    }).setOrigin(0, 0.5)

    const inputEl = document.createElement('input')
    inputEl.type = 'text'
    inputEl.maxLength = 16
    inputEl.placeholder = this.playerManager.generatePlayerName()
    inputEl.value = this.playerManager.getLocalPlayerName()
    inputEl.style.cssText = `
      width: 180px; height: 32px; font-size: 15px; padding: 4px 10px;
      border: 2px solid #4a90e2; border-radius: 8px;
      background: #1a2a3a; color: #ffffff; outline: none;
    `
    inputEl.addEventListener('input', () => {
      this.playerManager.setLocalPlayerName(inputEl.value)
    })
    inputEl.addEventListener('focus', () => { inputEl.style.borderColor = '#7ab0f2' })
    inputEl.addEventListener('blur', () => { inputEl.style.borderColor = '#4a90e2' })

    this.add.dom(cx + 30, y, inputEl)
  }

  private createRoomCodeSection(): void {
    const centerX = this.scale.width / 2
    const y = 90

    // Contenedor del código de sala
    const codeContainer = this.add.graphics()
    codeContainer.fillStyle(0x2a3a5a, 0.9)
    codeContainer.lineStyle(2, 0x4a90e2, 1)
    codeContainer.fillRoundedRect(centerX - 200, y - 15, 400, 50, 10)
    codeContainer.strokeRoundedRect(centerX - 200, y - 15, 400, 50, 10)

    // Texto del código
    this.roomCodeText = this.add.text(
      centerX - 80,
      y + 10,
      this.roomCode ? `Código: ${this.roomCode}` : 'Generando código...',
      {
        fontFamily: 'Arial Bold',
        fontSize: '20px',
        color: '#ffdd44',
      }
    ).setOrigin(0.5)

    // Botón de copiar
    if (this.roomCode) {
      const copyButton = this.add.text(
        centerX + 80,
        y + 10,
        '📋 Copiar',
        {
          fontFamily: 'Arial',
          fontSize: '16px',
          color: '#ffffff',
          backgroundColor: '#28a745',
          padding: { x: 12, y: 6 },
        }
      ).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

      // Efectos hover del botón copiar
      copyButton.on('pointerover', () => {
        copyButton.setScale(1.1)
        copyButton.setStyle({ backgroundColor: '#34ce57' })
      })
      
      copyButton.on('pointerout', () => {
        copyButton.setScale(1)
        copyButton.setStyle({ backgroundColor: '#28a745' })
      })

      // Funcionalidad de copiar
      copyButton.on('pointerdown', () => {
        this.copyRoomCode()
      })
    }

    // Instrucciones
    this.add.text(
      centerX,
      y + 40,
      'Comparte este código con tus amigos para que se unan',
      {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#cccccc'
      }
    ).setOrigin(0.5)
  }

  private getTitleText(): string {
    switch (this.mode) {
      case 'quick': return 'Buscando Partida...'
      case 'create': return 'Sala Privada'
      case 'join': return 'Unirse a Sala'
      default: return 'Lobby'
    }
  }

  private createPlayersPanel(): void {
    // Panel de jugadores mejorado
    const panelX = 50
    const panelY = 180
    const panelWidth = 320
    const panelHeight = 380

    // Fondo del panel con gradiente
    const panelBg = this.add.graphics()
    panelBg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1)
    panelBg.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15)
    panelBg.lineStyle(3, 0x4a90e2, 1)
    panelBg.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15)

    // Título del panel con icono
    this.add.text(panelX + 20, panelY + 20, '👥 Jugadores', {
      fontFamily: 'Arial Bold',
      fontSize: '22px',
      color: '#ffffff',
    })

    // Línea separadora
    const separator = this.add.graphics()
    separator.lineStyle(2, 0x4a90e2, 0.5)
    separator.lineBetween(panelX + 20, panelY + 55, panelX + panelWidth - 20, panelY + 55)

    // Contenedor de lista de jugadores
    this.playersList = this.add.container(panelX + 20, panelY + 70)

    // Información adicional
    this.add.text(panelX + 20, panelY + panelHeight - 40, 'Estado: ✓ Listo | ⏳ Esperando', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#888888'
    })
  }

  private createChatPanel(): void {
    // Panel de chat mejorado
    const panelX = this.scale.width - 370
    const panelY = 180
    const panelWidth = 320
    const panelHeight = 380

    // Fondo del panel con gradiente
    const panelBg = this.add.graphics()
    panelBg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1)
    panelBg.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 15)
    panelBg.lineStyle(3, 0x4a90e2, 1)
    panelBg.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 15)

    // Título del panel con icono
    this.add.text(panelX + 20, panelY + 20, '💬 Chat', {
      fontFamily: 'Arial Bold',
      fontSize: '22px',
      color: '#ffffff',
    })

    // Línea separadora
    const separator = this.add.graphics()
    separator.lineStyle(2, 0x4a90e2, 0.5)
    separator.lineBetween(panelX + 20, panelY + 55, panelX + panelWidth - 20, panelY + 55)

    // Área de mensajes con fondo
    const chatArea = this.add.graphics()
    chatArea.fillStyle(0x0f0f23, 0.8)
    chatArea.fillRoundedRect(panelX + 15, panelY + 65, panelWidth - 30, panelHeight - 130, 8)

    // Contenedor de mensajes
    this.chatContainer = this.add.container(panelX + 25, panelY + 75)

    // Input de chat mejorado
    this.createChatInput(panelX + 15, panelY + panelHeight - 50, panelWidth - 30)

    // Mensaje de bienvenida
    this.addChatMessage('Sistema', '¡Bienvenido al lobby! Escribe para chatear.')
  }

  private createChatInput(x: number, y: number, width: number): void {
    const inputElement = document.createElement('input')
    inputElement.type = 'text'
    inputElement.placeholder = '💬 Escribe un mensaje...'
    inputElement.maxLength = 100
    inputElement.style.width = `${width}px`
    inputElement.style.height = '35px'
    inputElement.style.fontSize = '14px'
    inputElement.style.padding = '8px 12px'
    inputElement.style.border = '2px solid #4a90e2'
    inputElement.style.borderRadius = '8px'
    inputElement.style.backgroundColor = '#2a3a5a'
    inputElement.style.color = '#ffffff'
    inputElement.style.outline = 'none'
    inputElement.style.transition = 'border-color 0.3s ease'

    // Efectos de focus
    inputElement.addEventListener('focus', () => {
      inputElement.style.borderColor = '#5ba0f2'
      inputElement.style.backgroundColor = '#3a4a6a'
    })

    inputElement.addEventListener('blur', () => {
      inputElement.style.borderColor = '#4a90e2'
      inputElement.style.backgroundColor = '#2a3a5a'
    })

    this.add.dom(x + width/2, y + 18, inputElement)

    inputElement.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const message = inputElement.value.trim()
        if (message) {
          this.sendChatMessage(message)
          inputElement.value = ''
        }
      }
    })
  }

  private createMapSelector(): void {
    const centerX = this.scale.width / 2
    const y = 580
    const cardW = 120
    const cardH = 70
    const gap = 14
    const totalW = MAP_IDS.length * (cardW + gap) - gap
    const startX = centerX - totalW / 2

    this.mapSelectorContainer = this.add.container(0, 0)

    // Label
    const label = this.add.text(centerX, y - 20, '🗺️ Seleccionar Mapa', {
      fontFamily: 'Arial Bold',
      fontSize: '16px',
      color: '#cccccc'
    }).setOrigin(0.5)
    this.mapSelectorContainer.add(label)

    MAP_IDS.forEach((mapId, i) => {
      const map = FIXED_MAPS[mapId]
      const cx = startX + i * (cardW + gap) + cardW / 2
      const cy = y + cardH / 2

      const bg = this.add.graphics()
      const drawCard = (selected: boolean) => {
        bg.clear()
        bg.fillStyle(selected ? 0x2a6a4a : 0x1a2a3a, selected ? 1 : 0.8)
        bg.lineStyle(2, selected ? 0x4ade80 : 0x4a90e2, 1)
        bg.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8)
        bg.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8)
      }
      drawCard(mapId === this.selectedMapId)

      const emoji = this.add.text(cx, cy - 14, map.emoji, { fontSize: '22px' }).setOrigin(0.5)
      const name = this.add.text(cx, cy + 10, map.name, {
        fontFamily: 'Arial Bold', fontSize: '13px', color: '#ffffff'
      }).setOrigin(0.5)

      // Invisible hit area
      const hit = this.add.rectangle(cx, cy, cardW, cardH, 0x000000, 0)
        .setInteractive({ useHandCursor: true })

      hit.on('pointerover', () => {
        if (mapId !== this.selectedMapId) {
          bg.clear()
          bg.fillStyle(0x2a3a5a, 1)
          bg.lineStyle(2, 0x7ab0f2, 1)
          bg.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8)
          bg.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8)
        }
      })
      hit.on('pointerout', () => drawCard(mapId === this.selectedMapId))
      hit.on('pointerdown', () => {
        if (!this.isHost) return
        this.selectedMapId = mapId as FixedMapId
        // Redraw all cards
        this.mapSelectorContainer.destroy()
        this.createMapSelector()
      })

      this.mapSelectorContainer.add([bg, emoji, name, hit])
    })

    // Show "only host can select" hint for non-hosts
    if (!this.isHost) {
      const hint = this.add.text(centerX, y + cardH + 10, 'Solo el host puede elegir el mapa', {
        fontFamily: 'Arial', fontSize: '12px', color: '#888888'
      }).setOrigin(0.5)
      this.mapSelectorContainer.add(hint)
    }
  }

  private createButtons(): void {
    const centerX = this.scale.width / 2
    const buttonY = this.scale.height - 80

    // Estilo base para botones
    const baseButtonStyle = {
      fontFamily: 'Arial Bold',
      fontSize: '20px',
      color: '#ffffff',
      padding: { x: 25, y: 12 },
    }

    // Botón Listo/No Listo
    this.readyButton = this.add.text(
      centerX - 180,
      buttonY,
      '⏳ Listo',
      { ...baseButtonStyle, backgroundColor: '#4a90e2' }
    ).setOrigin(0.5).setInteractive({ useHandCursor: true })

    // Botón Iniciar (solo para host)
    this.startButton = this.add.text(
      centerX + 180,
      buttonY,
      '🚀 Iniciar Partida',
      { ...baseButtonStyle, backgroundColor: '#28a745' }
    ).setOrigin(0.5).setInteractive({ useHandCursor: true })

    // Botones de Bots (solo para host)
    this.addBotButton = this.add.text(
      centerX - 60,
      buttonY,
      '🤖 + Bot',
      { ...baseButtonStyle, backgroundColor: '#6f42c1', fontSize: '16px' }
    ).setOrigin(0.5).setInteractive({ useHandCursor: true })

    this.removeBotButton = this.add.text(
      centerX + 60,
      buttonY,
      '🗑️ - Bot',
      { ...baseButtonStyle, backgroundColor: '#dc3545', fontSize: '16px' }
    ).setOrigin(0.5).setInteractive({ useHandCursor: true })

    // Botón Volver
    this.backButton = this.add.text(
      80,
      this.scale.height - 40,
      '← Volver',
      { 
        ...baseButtonStyle, 
        backgroundColor: '#dc3545',
        fontSize: '16px',
        padding: { x: 15, y: 8 }
      }
    ).setOrigin(0.5).setInteractive({ useHandCursor: true })

    this.setupButtonEvents()
    this.updateButtonStates()
  }

  private setupButtonEvents(): void {
    this.readyButton.on('pointerdown', () => {
      this.toggleReady()
    })

    this.startButton.on('pointerdown', () => {
      if (this.isHost && this.canStartGame()) {
        // Si estamos conectados al servidor, enviar mensaje start_game
        if (colyseusService.isConnected()) {
          logger.info('LobbyScene', `Host enviando start_game con mapa: ${this.selectedMapId}`)
          colyseusService.startGame(this.selectedMapId)
        } else {
          // Modo offline - iniciar directamente
          this.startGameLocally(this.selectedMapId)
        }
      }
    })

    this.addBotButton.on('pointerdown', () => {
      if (this.isHost) {
        this.playerManager.addBot()
        this.updatePlayersList()
        this.updateButtonStates()
        logger.info('LobbyScene', 'Bot agregado por el host')
      }
    })

    this.removeBotButton.on('pointerdown', () => {
      if (this.isHost) {
        this.playerManager.removeBot()
        this.updatePlayersList()
        this.updateButtonStates()
        logger.info('LobbyScene', 'Bot eliminado por el host')
      }
    })

    this.backButton.on('pointerdown', () => {
      this.leaveRoom()
    })

    // Efectos hover mejorados
    const buttons = [
      { button: this.readyButton, normalColor: '#4a90e2', hoverColor: '#5ba0f2' },
      { button: this.startButton, normalColor: '#28a745', hoverColor: '#34ce57' },
      { button: this.addBotButton, normalColor: '#6f42c1', hoverColor: '#8a5cf5' },
      { button: this.removeBotButton, normalColor: '#dc3545', hoverColor: '#e55a5a' },
      { button: this.backButton, normalColor: '#dc3545', hoverColor: '#e55a5a' }
    ]
    
    buttons.forEach(({ button, normalColor, hoverColor }) => {
      button.on('pointerover', () => {
        button.setScale(1.05)
        button.setStyle({ backgroundColor: hoverColor })
      })
      
      button.on('pointerout', () => {
        button.setScale(1)
        button.setStyle({ backgroundColor: normalColor })
      })

      button.on('pointerdown', () => {
        button.setScale(0.95)
      })

      button.on('pointerup', () => {
        button.setScale(1.05)
      })
    })
  }

  private generateRoomCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString()
  }

  private setupOfflineMode(): void {
    // Generar código de sala si es necesario
    if (this.mode === 'create') {
      this.roomCode = this.generateRoomCode()
      if (this.roomCodeText) {
        this.roomCodeText.setText(`Código: ${this.roomCode}`)
      }
      // Recrear la sección del código con el botón de copiar
      this.time.delayedCall(100, () => {
        this.createRoomCodeSection()
      })
    } else if (this.mode === 'join' && !this.roomCode) {
      const roomCode = prompt('Ingresa el código de la sala:')
      if (!roomCode) {
        this.scene.start(SCENE_KEYS.MAIN_MENU)
        return
      }
      this.roomCode = roomCode
      if (this.roomCodeText) {
        this.roomCodeText.setText(`Código de Sala: ${this.roomCode} (Offline)`)
      }
    }

    // Añadir jugador local
    const localPlayer: PlayerData = {
      id: this.playerManager.getLocalPlayerId(),
      name: this.playerManager.getLocalPlayerName(),
      isReady: false,
      isHost: this.mode === 'create',
      isConnected: true,
      color: this.playerManager.generatePlayerColor()
    }
    
    this.playerManager.addPlayer(localPlayer)
    this.isHost = localPlayer.isHost
    
    // Solo añadir bots en modo quick match, NO en salas privadas
    if (this.mode === 'quick') {
      this.addMockPlayers()
    }
    
    this.updatePlayersList()
    this.updateButtonStates()
    
    logger.info('LobbyScene', 'Modo offline activado')
  }

  private addMockPlayers(): void {
    // Añadir 1-2 jugadores bot para demostración
    const botCount = Math.floor(Math.random() * 2) + 1
    
    for (let i = 0; i < botCount; i++) {
      const botPlayer: PlayerData = {
        id: `bot_${i}`,
        name: `Bot${i + 1}`,
        isReady: Math.random() > 0.5,
        isHost: false,
        isConnected: true,
        color: this.playerManager.generatePlayerColor()
      }
      
      this.playerManager.addPlayer(botPlayer)
    }
  }

  private updatePlayersList(): void {
    // Limpiar lista actual
    this.playersList.removeAll(true)

    const players = this.playerManager.getAllPlayers()
    let yOffset = 0
    
    players.forEach((player) => {
      // Contenedor para cada jugador
      const playerContainer = this.add.container(0, yOffset)

      // Fondo del jugador
      const playerBg = this.add.graphics()
      const bgColor = player.isReady ? 0x1e4d3e : 0x2a2a3e
      playerBg.fillStyle(bgColor, 0.6)
      playerBg.fillRoundedRect(-5, -12, 280, 35, 8)
      playerContainer.add(playerBg)

      // Indicador de color del jugador (más grande)
      const colorIndicator = this.add.circle(-15, 5, 8, player.color)
      colorIndicator.setStrokeStyle(2, 0xffffff)
      playerContainer.add(colorIndicator)

      // Texto del jugador con mejor formato
      const playerText = this.add.text(10, 5, this.getPlayerDisplayText(player), {
        fontFamily: 'Arial Bold',
        fontSize: '16px',
        color: player.isReady ? '#4ade80' : '#ffffff',
      })
      playerContainer.add(playerText)

      // Icono de estado
      const statusIcon = this.add.text(250, 5, player.isReady ? '✅' : '⏳', {
        fontSize: '16px'
      })
      playerContainer.add(statusIcon)

      // Indicador de host
      if (player.isHost) {
        const crownIcon = this.add.text(220, 5, '👑', {
          fontSize: '16px'
        })
        playerContainer.add(crownIcon)
      }

      this.playersList.add(playerContainer)
      yOffset += 40
    })

    // Mostrar contador de jugadores
    const playerCount = this.add.text(0, yOffset + 10, `${players.length}/8 jugadores`, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#888888'
    })
    this.playersList.add(playerCount)
  }

  private getPlayerDisplayText(player: PlayerData): string {
    let text = player.name
    if (player.isHost) text += ' (Host)'
    if (player.isReady) text += ' ✓'
    if (!player.isConnected) text += ' (Desconectado)'
    return text
  }

  private toggleReady(): void {
    this.isReady = !this.isReady
    this.readyButton.setText(this.isReady ? '✅ No Listo' : '⏳ Listo')
    this.readyButton.setStyle({ 
      backgroundColor: this.isReady ? '#ffc107' : '#4a90e2' 
    })

    // Actualizar estado local
    this.playerManager.setPlayerReady(this.playerManager.getLocalPlayerId(), this.isReady)
    
    // Enviar al servidor si estamos conectados
    if (colyseusService.isConnected()) {
      try {
        colyseusService.setReady(this.isReady)
      } catch (error) {
        logger.error('LobbyScene', `Error enviando estado ready: ${error}`)
      }
    }
    
    this.updatePlayersList()
    this.updateButtonStates()
    
    logger.info('LobbyScene', `Estado cambiado a: ${this.isReady ? 'Listo' : 'No Listo'}`)
  }

  private canStartGame(): boolean {
    return this.playerManager.canStartGame()
  }

  private updateButtonStates(): void {
    const localPlayerId = this.playerManager.getLocalPlayerId()
    const isLocalHost = this.playerManager.isLocalPlayerHost()
    const canStart = this.playerManager.canStartGame()
    const botCount = this.playerManager.getBotCount()
    const playerCount = this.playerManager.getPlayerCount()
    
    logger.info('LobbyScene', `Actualizando botones - LocalID: ${localPlayerId}, IsHost: ${isLocalHost}, CanStart: ${canStart}`)
    
    // Mostrar botón de iniciar solo si es host
    this.startButton.setVisible(isLocalHost)
    this.startButton.setAlpha(canStart ? 1 : 0.5)
    
    // Mostrar botones de bots solo si es host
    this.addBotButton.setVisible(isLocalHost)
    this.removeBotButton.setVisible(isLocalHost)
    
    // Habilitar/deshabilitar botones de bots
    this.addBotButton.setAlpha(playerCount < 8 ? 1 : 0.5) // Máximo 8 jugadores
    this.removeBotButton.setAlpha(botCount > 0 ? 1 : 0.5) // Solo si hay bots
    
    // Debug: mostrar información de todos los jugadores
    const allPlayers = this.playerManager.getAllPlayers()
    allPlayers.forEach(player => {
      logger.info('LobbyScene', `Jugador: ${player.name} (${player.id}) - Host: ${player.isHost}, Ready: ${player.isReady}`)
    })
  }

  private startGameLocally(mapId: string = this.selectedMapId): void {
    const localPlayerId = this.playerManager.getLocalPlayerId()
    const allPlayers = this.playerManager.exportPlayersForGame()
    
    logger.info('LobbyScene', `Iniciando partida localmente... LocalPlayer: ${localPlayerId}, Mapa: ${mapId}`)
    
    this.scene.start(SCENE_KEYS.LOADING, { 
      gameData: {
        roomCode: this.roomCode,
        players: allPlayers,
        mapId
      },
      localPlayerId: localPlayerId,
      isMultiplayer: colyseusService.isConnected()
    })
  }

  private leaveRoom(): void {
    this.scene.start(SCENE_KEYS.MAIN_MENU)
  }

  private sendChatMessage(message: string): void {
    const playerName = this.playerManager.getPlayer(this.playerManager.getLocalPlayerId())?.name || 'Tú'
    
    // Enviar al servidor si estamos conectados
    if (colyseusService.isConnected()) {
      try {
        colyseusService.sendChatMessage(message)
      } catch (error) {
        logger.error('LobbyScene', `Error enviando mensaje: ${error}`)
        // Mostrar localmente si falla el envío
        this.addChatMessage(playerName, message)
      }
    } else {
      // Modo offline - mostrar solo localmente
      this.addChatMessage(playerName, message)
    }
    
    logger.info('LobbyScene', `Mensaje enviado: ${message}`)
  }

  private addChatMessage(sender: string, message: string): void {
    const timestamp = new Date().toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })

    // Diferentes colores para diferentes tipos de mensajes
    let senderColor = '#4a90e2'
    if (sender === 'Sistema') senderColor = '#ffc107'
    else if (sender === 'Tú') senderColor = '#28a745'

    const messageContainer = this.add.container(0, this.chatMessages.length * 25)

    // Timestamp
    const timeText = this.add.text(0, 0, `[${timestamp}]`, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: '#888888'
    })
    messageContainer.add(timeText)

    // Sender
    const senderText = this.add.text(50, 0, `${sender}:`, {
      fontFamily: 'Arial Bold',
      fontSize: '12px',
      color: senderColor
    })
    messageContainer.add(senderText)

    // Message
    const messageText = this.add.text(0, 12, message, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#ffffff',
      wordWrap: { width: 260 }
    })
    messageContainer.add(messageText)

    this.chatContainer.add(messageContainer)
    this.chatMessages.push(messageContainer as any)

    // Limitar mensajes mostrados
    if (this.chatMessages.length > 12) {
      const oldMessage = this.chatMessages.shift()
      oldMessage?.destroy()
      
      // Reposicionar mensajes restantes
      this.chatMessages.forEach((msg, index) => {
        msg.setY(index * 25)
      })
    }

    // Auto-scroll hacia abajo
    if (this.chatMessages.length > 8) {
      const scrollOffset = (this.chatMessages.length - 8) * 25
      this.chatContainer.setY(this.chatContainer.y - scrollOffset)
    }
  }

  private copyRoomCode(): void {
    if (!this.roomCode) {
      this.showNotification('No hay código para copiar', '#dc3545')
      return
    }

    // Usar la API del navegador para copiar al portapapeles
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(this.roomCode).then(() => {
        this.showNotification('¡Código copiado al portapapeles!', '#28a745')
      }).catch(() => {
        this.fallbackCopyToClipboard(this.roomCode)
      })
    } else {
      this.fallbackCopyToClipboard(this.roomCode)
    }
  }

  private fallbackCopyToClipboard(text: string): void {
    // Método alternativo para navegadores más antiguos
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    try {
      document.execCommand('copy')
      this.showNotification('¡Código copiado!', '#28a745')
    } catch (err) {
      this.showNotification('Error al copiar. Código: ' + text, '#dc3545')
    }
    
    document.body.removeChild(textArea)
  }

  private showNotification(message: string, color: string): void {
    const notification = this.add.text(
      this.scale.width / 2,
      150,
      message,
      {
        fontFamily: 'Arial Bold',
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: color,
        padding: { x: 20, y: 10 },
      }
    ).setOrigin(0.5)

    // Animación de aparición
    notification.setAlpha(0)
    this.tweens.add({
      targets: notification,
      alpha: 1,
      duration: 300,
      ease: 'Power2'
    })

    // Desaparecer después de 3 segundos
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: notification,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
          notification.destroy()
        }
      })
    })
  }

  private showError(message: string): void {
    const errorText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      message,
      {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ff0000',
        backgroundColor: '#000000',
        padding: { x: 20, y: 10 }
      }
    ).setOrigin(0.5)

    this.time.delayedCall(3000, () => {
      errorText.destroy()
    })
  }
}