import './styles/global.css'
import { gameManager } from '../src/utils/GameManager'
import { logger } from '../src/utils/logger'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('No se encontró el elemento #app')
}

app.innerHTML = `
  <div id="game-container"></div>
`

logger.info('Main', 'Inicializando cliente...')
gameManager.init()
logger.info('Main', 'Cliente inicializado correctamente')