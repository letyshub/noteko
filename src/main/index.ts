import { app, BrowserWindow, dialog, protocol, net } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
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

// ---------------------------------------------------------------------------
// Custom protocol: noteko-file://
// ---------------------------------------------------------------------------

/** MIME type map for supported file extensions. */
const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  txt: 'text/plain',
  md: 'text/plain',
  csv: 'text/plain',
  doc: 'application/octet-stream',
  docx: 'application/octet-stream',
}

/**
 * Resolve the base storage directory for uploaded files.
 * Matches the logic in file-service.ts.
 */
const getStorageBase = (): string => {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'files')
  }
  return path.join(process.cwd(), 'files')
}

// Register the custom scheme as privileged before app is ready.
// This must happen synchronously at module load time.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'noteko-file',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
])

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
    // Register noteko-file:// protocol handler for secure file access
    protocol.handle('noteko-file', (request) => {
      try {
        // Decode the URL path (strip scheme + host)
        const url = new URL(request.url)
        const filePath = decodeURIComponent(url.pathname)

        // Normalize: on Windows, pathname starts with /C:/... so strip leading slash
        const normalizedPath = process.platform === 'win32' ? filePath.replace(/^\//, '') : filePath

        // Security: validate the file is within the storage directory
        const storageBase = getStorageBase()
        const resolvedPath = path.resolve(normalizedPath)
        const resolvedBase = path.resolve(storageBase)

        if (!resolvedPath.startsWith(resolvedBase)) {
          log.warn(`[noteko-file] Blocked access outside storage dir: ${resolvedPath}`)
          return new Response('Forbidden', { status: 403 })
        }

        // Check file exists
        if (!fs.existsSync(resolvedPath)) {
          log.warn(`[noteko-file] File not found: ${resolvedPath}`)
          return new Response('Not Found', { status: 404 })
        }

        // Determine MIME type from extension
        const ext = path.extname(resolvedPath).replace('.', '').toLowerCase()
        const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream'

        // Return the file using Electron's net.fetch for file:// URLs
        return net.fetch(`file://${resolvedPath}`, {
          headers: { 'Content-Type': mimeType },
        })
      } catch (error) {
        log.error('[noteko-file] Protocol handler error:', error)
        return new Response('Internal Server Error', { status: 500 })
      }
    })

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
