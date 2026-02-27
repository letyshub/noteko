import { test, expect, _electron as electron } from '@playwright/test'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const electronPath: string = require('electron')

test('app launches and shows main window', async () => {
  // Remove ELECTRON_RUN_AS_NODE so Electron runs as an app, not a Node.js runtime.
  // This env var is set by electron-forge tooling for running scripts, but must be
  // absent when launching Electron as an actual application.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k, v]) => k !== 'ELECTRON_RUN_AS_NODE' && v !== undefined),
  ) as Record<string, string>

  // On Linux, Electron requires a display. Ensure DISPLAY is set when Xvfb is
  // running but the env var was not exported before the test process started.
  if (process.platform === 'linux' && !env.DISPLAY) {
    env.DISPLAY = ':99'
  }

  // On Linux (including CI), Electron's Chromium sandbox requires kernel
  // namespaces that are often disabled. --no-sandbox bypasses this restriction.
  const args = process.platform === 'linux' ? ['--no-sandbox', '.'] : ['.']

  const electronApp = await electron.launch({
    executablePath: electronPath,
    args,
    env,
  })

  // Forward Electron's main-process stderr so CI logs show startup errors
  electronApp.process().stderr?.on('data', (data: Buffer) => {
    process.stderr.write(`[electron] ${data.toString()}`)
  })

  // Wait for the main app window. In dev mode Electron opens DevTools as a
  // separate BrowserWindow, so firstWindow() may return the DevTools window.
  // We listen for window events and resolve on the first non-DevTools window.
  const window = await new Promise<import('@playwright/test').Page>((resolve) => {
    const check = (win: import('@playwright/test').Page) => {
      // DevTools windows have a devtools:// URL; the renderer loads localhost:5173
      const url = win.url()
      if (!url.startsWith('devtools://')) {
        resolve(win)
      }
    }
    // Check any windows already open
    for (const win of electronApp.windows()) {
      check(win)
    }
    // Also listen for future windows
    electronApp.on('window', check)
  })

  // Verify the window is visible
  const isVisible = await electronApp.evaluate(({ BrowserWindow }) => {
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.webContents.getURL().startsWith('devtools://'))
    return wins.length > 0 && wins[0].isVisible()
  })
  expect(isVisible).toBe(true)

  // Verify the window title contains "Noteko"
  await window.waitForLoadState('domcontentloaded')
  const title = await window.title()
  expect(title).toContain('Noteko')

  // Close app cleanly
  await electronApp.close()
})
