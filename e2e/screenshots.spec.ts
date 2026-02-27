/**
 * Documentation screenshot generator.
 * Run with: npm run pretest:e2e && npx playwright test e2e/screenshots.spec.ts
 * Output: docs/screenshots/*.png
 */
import path from 'path'
import fs from 'fs'
import { test, _electron as electron } from '@playwright/test'
import type { Page, ElectronApplication } from '@playwright/test'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const electronPath: string = require('electron')

const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'docs', 'screenshots')
const PROJECT_NAME = 'Machine Learning'

const DEMO_FILES = [
  {
    name: 'AI as a Service',
    file_path: path.resolve(process.cwd(), 'example-books/AI as a Service.pdf'),
    file_type: 'pdf',
    file_size: 30637082,
  },
  {
    name: 'Deep Learning for Vision Systems',
    file_path: path.resolve(process.cwd(), 'example-books/Deep Learning for Vision Systems.pdf'),
    file_type: 'pdf',
    file_size: 15537417,
  },
  {
    name: 'Deep Learning with PyTorch',
    file_path: path.resolve(process.cwd(), 'example-books/Deep Learning with PyTorch.pdf'),
    file_type: 'pdf',
    file_size: 46975122,
  },
  {
    name: 'Machine Learning for Business',
    file_path: path.resolve(process.cwd(), 'example-books/Machine Learning for Business.pdf'),
    file_type: 'pdf',
    file_size: 16486687,
  },
]

test.setTimeout(120_000)

test('capture documentation screenshots', async () => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k, v]) => k !== 'ELECTRON_RUN_AS_NODE' && v !== undefined),
  ) as Record<string, string>

  const args = process.platform === 'linux' ? ['--no-sandbox', '.'] : ['.']

  const app: ElectronApplication = await electron.launch({ executablePath: electronPath, args, env })

  app.process().stderr?.on('data', (data: Buffer) => {
    process.stderr.write(`[electron] ${data.toString()}`)
  })

  // Get main renderer window (not DevTools)
  const page = await new Promise<Page>((resolve) => {
    const check = (win: Page) => {
      if (!win.url().startsWith('devtools://')) resolve(win)
    }
    for (const win of app.windows()) check(win)
    app.on('window', check)
  })

  // Close DevTools if open
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.closeDevTools())
  })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(2500)

  // Dismiss onboarding wizard if present
  const skipBtn = page.getByRole('button', { name: 'Skip' })
  if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click()
    await page.waitForTimeout(600)
  }

  // ── Seed demo data (always fresh) ────────────────────────────────────────
  type EA = Record<string, (...a: unknown[]) => Promise<{ success: boolean; data: unknown }>>

  // Delete any existing "Machine Learning" project for a clean state
  const allProjects = await page.evaluate(async () => {
    const r = await (window as unknown as { electronAPI: EA }).electronAPI['db:projects:list']()
    return r.success ? (r.data as Array<{ id: number; name: string }>) : []
  })

  for (const p of allProjects.filter((p) => p.name === PROJECT_NAME)) {
    await page.evaluate(async (pid: number) => {
      await (window as unknown as { electronAPI: EA }).electronAPI['db:projects:delete'](pid)
    }, p.id)
    console.log(`  → Deleted stale project "${p.name}" id=${p.id}`)
  }

  // Create fresh project
  const created = await page.evaluate(async (name: string) => {
    const res = await (window as unknown as { electronAPI: EA }).electronAPI['db:projects:create']({
      name,
      description: 'AI and machine learning study books',
      color: '#3b82f6',
    })
    return res.success ? (res.data as { id: number }) : null
  }, PROJECT_NAME)
  if (!created) throw new Error('Failed to create project')
  const projectId = created.id
  console.log(`  → Created project "${PROJECT_NAME}" id=${projectId}`)

  await page.waitForTimeout(400)

  // Create a folder
  const folderResult = await page.evaluate(async (pid: number) => {
    const res = await (window as unknown as { electronAPI: EA }).electronAPI['db:folders:create']({
      name: 'Deep Learning',
      project_id: pid,
    })
    return res.success ? (res.data as { id: number }) : null
  }, projectId)
  if (!folderResult) throw new Error('Failed to create folder')
  const folderId = folderResult.id
  console.log(`  → Created folder "Deep Learning" id=${folderId}`)

  // Create documents from example books
  const docIds: number[] = []
  for (const demo of DEMO_FILES) {
    if (!fs.existsSync(demo.file_path)) {
      console.log(`  → Skipping "${demo.name}" (file not found)`)
      continue
    }
    const input = { ...demo, folder_id: folderId, project_id: projectId }
    const r = await page.evaluate(async (inp) => {
      const res = await (window as unknown as { electronAPI: EA }).electronAPI['db:documents:create'](inp)
      return res.success ? (res.data as { id: number }) : null
    }, input)
    if (r) {
      docIds.push(r.id)
      console.log(`  → Created document "${demo.name}" id=${r.id}`)
    }
  }

  // Reload so all Zustand stores re-initialize from the DB —
  // ensures sidebar fetchProjects() picks up the newly created project.
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(2500)

  // Dismiss wizard again after reload (best-effort)
  const skipBtn2 = page.getByRole('button', { name: 'Skip' })
  if (await skipBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn2.click()
    await page.waitForTimeout(600)
  }

  // ── Helper functions ──────────────────────────────────────────────────────
  const goto = async (hash: string, wait = 1200) => {
    await page.evaluate((h) => {
      window.location.hash = h
    }, hash)
    await page.waitForTimeout(wait)
  }

  const shot = async (name: string) => {
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, name), fullPage: false })
    console.log(`  ✓ ${name}`)
  }

  // ── 1. Dashboard ──────────────────────────────────────────────────────────
  await goto('/')
  await shot('01-dashboard.png')

  // ── 2. Project page ───────────────────────────────────────────────────────
  await goto(`/projects/${projectId}`, 2000)
  await shot('02-project.png')

  // ── 3. Document – Analysis tab ────────────────────────────────────────────
  if (docIds.length > 0) {
    await goto(`/documents/${docIds[0]}`, 1500)
    await shot('03-document-analysis.png')

    // Switch to Chat tab
    const chatTab = page.getByRole('tab', { name: /chat/i })
    if (await chatTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await chatTab.click()
      await page.waitForTimeout(600)
      await shot('04-document-chat.png')
    }
  }

  // ── 4. Quiz history ───────────────────────────────────────────────────────
  await goto('/quiz-history')
  await shot('05-quiz-history.png')

  // ── 5. Logs ───────────────────────────────────────────────────────────────
  await goto('/logs')
  await shot('06-logs.png')

  // ── 6. Settings – Ollama tab ──────────────────────────────────────────────
  await goto('/settings')
  const ollamaTab = page.getByRole('tab', { name: /ollama/i })
  if (await ollamaTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ollamaTab.click()
    await page.waitForTimeout(600)
  }
  await shot('07-settings.png')

  // ── 7. Search dialog ──────────────────────────────────────────────────────
  await goto('/')
  await page.waitForTimeout(600)
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(700)
  await shot('08-search.png')
  await page.keyboard.press('Escape')

  await app.close()
})
