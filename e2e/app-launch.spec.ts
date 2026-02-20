import { test, expect, _electron as electron } from '@playwright/test'

test('app launches and shows main window', async () => {
  const electronApp = await electron.launch({
    args: ['.'],
  })

  const window = await electronApp.firstWindow()

  // Verify the window is visible (evaluate in main process context)
  const isVisible = await electronApp.evaluate(({ BrowserWindow }) => {
    const windows = BrowserWindow.getAllWindows()
    return windows.length > 0 && windows[0].isVisible()
  })
  expect(isVisible).toBe(true)

  // Verify the window title contains "Noteko"
  const title = await window.title()
  expect(title).toContain('Noteko')

  // Close app cleanly
  await electronApp.close()
})
