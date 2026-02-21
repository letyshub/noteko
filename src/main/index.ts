import { app, BrowserWindow, dialog } from 'electron'
import path from 'node:path'
import started from 'electron-squirrel-startup'
import log from 'electron-log'
import { initializeDatabase, closeDatabase } from '@main/database'
import { registerIpcHandlers } from '@main/ipc-handlers'
import { setMainWindow } from '@main/main-window'
import { resetStaleProcessingStatus, checkHealth } from '@main/services'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit()
}

registerIpcHandlers()

const createWindow = (): void => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Store reference for push events from services (e.g. parsing progress)
  setMainWindow(mainWindow)
  mainWindow.on('closed', () => setMainWindow(null))

  // Load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  // Open DevTools when not packaged.
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools()
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', async () => {
  try {
    initializeDatabase()
    resetStaleProcessingStatus()

    // Fire-and-forget Ollama health check on startup (non-blocking)
    checkHealth()
      .then((result) => {
        if (result.connected) {
          log.info(`[startup] Ollama is available with ${result.models.length} model(s)`)
        } else {
          log.info('[startup] Ollama is not available')
        }
      })
      .catch((err) => {
        log.warn('[startup] Ollama health check failed:', err instanceof Error ? err.message : err)
      })

    createWindow()
  } catch (error) {
    log.error('Failed to start application:', error)
    dialog.showErrorBox('Startup Error', 'Failed to initialize the database. The application will now exit.')
    app.quit()
  }
})

app.on('will-quit', () => {
  closeDatabase()
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
