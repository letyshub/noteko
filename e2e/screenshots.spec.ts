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

// Existing PDF files already on disk from previous uploads
const DEMO_FILES = [
  {
    name: 'AI as a Service',
    file_path: path.resolve(process.cwd(), 'files/7/1771832896744-AI as a Service.pdf'),
    file_type: 'pdf',
    file_size: 30076005,
  },
  {
    name: 'Automatyka - Podzespoły i Aplikacje 9/2025',
    file_path: path.resolve(process.cwd(), 'files/7/1771827288425-Automatyka-Podzespoly-Aplikacje_9-2025.pdf'),
    file_type: 'pdf',
    file_size: 16905423,
  },
  {
    name: 'Automatyka - Podzespoły i Aplikacje 10/2023',
    file_path: path.resolve(process.cwd(), 'files/9/1771798834620-Automatyka-Podzespoly-Aplikacje_10-2023.pdf'),
    file_type: 'pdf',
    file_size: 15990049,
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

  // ── Seed demo data ────────────────────────────────────────────────────────
  type EA = Record<string, (...a: unknown[]) => Promise<{ success: boolean; data: unknown }>>
  const ea = () => (window as unknown as { electronAPI: EA }).electronAPI

  // Use existing project or create one
  const existingProjects = await page.evaluate(async () => {
    const r = await (window as unknown as { electronAPI: EA }).electronAPI['db:projects:list']()
    return r.success ? (r.data as Array<{ id: number; name: string }>) : []
  })

  let projectId: number
  if (existingProjects.length > 0) {
    projectId = existingProjects[0].id
    console.log(`  → Using existing project id=${projectId}`)
  } else {
    const r = await page.evaluate(async () => {
      const res = await (window as unknown as { electronAPI: EA }).electronAPI['db:projects:create']({
        name: 'Machine Learning Fundamentals',
        description: 'Study materials for machine learning and AI',
        color: '#3b82f6',
      })
      return res.success ? (res.data as { id: number }) : null
    })
    if (!r) throw new Error('Failed to create demo project')
    projectId = r.id
    console.log(`  → Created demo project id=${projectId}`)
  }

  await page.waitForTimeout(600)

  // Use existing folder or create one
  const existingFolders = await page.evaluate(async (pid: number) => {
    const r = await (window as unknown as { electronAPI: EA }).electronAPI['db:folders:list'](pid)
    return r.success ? (r.data as Array<{ id: number }>) : []
  }, projectId)

  let folderId: number
  if (existingFolders.length > 0) {
    folderId = existingFolders[0].id
  } else {
    const r = await page.evaluate(async (pid: number) => {
      const res = await (window as unknown as { electronAPI: EA }).electronAPI['db:folders:create']({
        name: 'Study Materials',
        project_id: pid,
      })
      return res.success ? (res.data as { id: number }) : null
    }, projectId)
    if (!r) throw new Error('Failed to create demo folder')
    folderId = r.id
    console.log(`  → Created demo folder id=${folderId}`)
  }

  // Use existing docs or create from real files on disk
  const existingDocs = await page.evaluate(async (pid: number) => {
    const r = await (window as unknown as { electronAPI: EA }).electronAPI['db:documents:list'](pid)
    return r.success ? (r.data as Array<{ id: number }>) : []
  }, projectId)

  const docIds: number[] = existingDocs.map((d) => d.id)

  if (docIds.length === 0) {
    for (const demo of DEMO_FILES) {
      if (!fs.existsSync(demo.file_path)) continue
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
  } else {
    console.log(`  → Using ${docIds.length} existing documents`)
  }

   
  void ea // suppress unused warning

  await page.waitForTimeout(800)

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
  // Trigger project store refresh so the page can find the project
  await page
    .evaluate(async () => {
      const { useProjectStore } = await import('/src/renderer/store/project-store')
      await useProjectStore.getState().fetchProjects()
    })
    .catch(() => {
      /* store refresh best-effort */
    })
  await goto(`/projects/${projectId}`, 2000)
  await shot('02-project.png')

  // ── 3. Document – Analysis tab ────────────────────────────────────────────
  if (docIds.length > 0) {
    await goto(`/documents/${docIds[0]}`, 1500)
    await shot('03-document-analysis.png')

    // Switch to Chat tab if present
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
