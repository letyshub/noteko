import { useState, useEffect, useCallback } from 'react'
import { Loader2, ExternalLink, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Textarea } from '@renderer/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { useSettingsStore } from '@renderer/store/settings-store'
import { useProjectStore } from '@renderer/store/project-store'
import { PROJECT_COLORS } from '@renderer/lib/constants'
import type { OllamaModel } from '@shared/types'

const TOTAL_STEPS = 4

/** Step indicator dots showing progress through the wizard. */
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full transition-colors ${i <= current ? 'bg-primary' : 'bg-muted-foreground/30'}`}
        />
      ))}
    </div>
  )
}

export function OnboardingWizard() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  // Track what was configured for the summary
  const [ollamaConfigured, setOllamaConfigured] = useState(false)
  const [projectCreated, setProjectCreated] = useState(false)
  const [selectedModelName, setSelectedModelName] = useState('')

  // Subscribe to settings store showWizard for re-open from General tab
  const showWizard = useSettingsStore((s) => s.showWizard)
  const setShowWizard = useSettingsStore((s) => s.setShowWizard)

  // First-run detection: direct IPC calls (store may not be populated yet)
  useEffect(() => {
    let cancelled = false
    async function checkFirstRun() {
      try {
        const settingResult = await window.electronAPI['settings:get']('onboarding.completed')
        if (cancelled) return
        if (settingResult.success && settingResult.data === 'true') return

        const projectsResult = await window.electronAPI['db:projects:list']()
        if (cancelled) return
        if (projectsResult.success && projectsResult.data.length > 0) return

        // Both conditions met: not completed and zero projects
        setOpen(true)
      } catch {
        // Silently fail — don't block the app
      }
    }
    checkFirstRun()
    return () => {
      cancelled = true
    }
  }, [])

  // Re-open from settings store — schedule async to satisfy react-hooks lint rules
  useEffect(() => {
    if (!showWizard) return
    const id = requestAnimationFrame(() => {
      setStep(0)
      setOllamaConfigured(false)
      setProjectCreated(false)
      setSelectedModelName('')
      setOpen(true)
      setShowWizard(false)
    })
    return () => cancelAnimationFrame(id)
  }, [showWizard, setShowWizard])

  const completeOnboarding = useCallback(async () => {
    try {
      await window.electronAPI['settings:set']('onboarding.completed', 'true')
    } catch {
      // Best-effort
    }
    setOpen(false)
  }, [])

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        // Closing via X or escape = same as Skip
        completeOnboarding()
      }
    },
    [completeOnboarding],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        {step === 0 && <WelcomeStep onGetStarted={() => setStep(1)} onSkip={completeOnboarding} step={step} />}
        {step === 1 && (
          <OllamaStep
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
            onSkip={() => setStep(2)}
            step={step}
            onConfigured={(modelName) => {
              setOllamaConfigured(true)
              setSelectedModelName(modelName)
            }}
          />
        )}
        {step === 2 && (
          <CreateProjectStep
            onNext={() => {
              setProjectCreated(true)
              setStep(3)
            }}
            onBack={() => setStep(1)}
            onSkip={() => setStep(3)}
            step={step}
          />
        )}
        {step === 3 && (
          <AllDoneStep
            onFinish={completeOnboarding}
            step={step}
            ollamaConfigured={ollamaConfigured}
            projectCreated={projectCreated}
            selectedModelName={selectedModelName}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Step 0: Welcome
// ---------------------------------------------------------------------------

function WelcomeStep({ onGetStarted, onSkip, step }: { onGetStarted: () => void; onSkip: () => void; step: number }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-center text-2xl">Noteko</DialogTitle>
        <DialogDescription className="text-center">
          Your personal study companion. Organize documents, generate AI-powered summaries, and test your knowledge with
          auto-generated quizzes.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <p className="text-center text-sm text-muted-foreground">Let&apos;s get you set up in just a few steps.</p>
        <StepIndicator current={step} total={TOTAL_STEPS} />
      </div>
      <DialogFooter className="sm:justify-between">
        <Button variant="ghost" onClick={onSkip}>
          Skip
        </Button>
        <Button onClick={onGetStarted}>Get Started</Button>
      </DialogFooter>
    </>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Ollama Setup
// ---------------------------------------------------------------------------

function OllamaStep({
  onNext,
  onBack,
  onSkip,
  step,
  onConfigured,
}: {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  step: number
  onConfigured: (modelName: string) => void
}) {
  const [checking, setChecking] = useState(true)
  const [connected, setConnected] = useState(false)
  const [models, setModels] = useState<OllamaModel[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [testing, setTesting] = useState(false)

  // Auto-check connection on entering this step
  useEffect(() => {
    let cancelled = false
    async function check() {
      setChecking(true)
      try {
        const result = await window.electronAPI['ai:health-check']()
        if (cancelled) return
        if (result.success && result.data.connected) {
          setConnected(true)
          // Fetch models
          const modelsResult = await window.electronAPI['ai:list-models']()
          if (!cancelled && modelsResult.success) {
            setModels(modelsResult.data)
          }
        }
      } catch {
        // Not connected
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [])

  const handleTestConnection = useCallback(async () => {
    setTesting(true)
    try {
      const result = await window.electronAPI['ai:health-check']()
      if (result.success && result.data.connected) {
        setConnected(true)
        const modelsResult = await window.electronAPI['ai:list-models']()
        if (modelsResult.success) {
          setModels(modelsResult.data)
        }
      } else {
        setConnected(false)
      }
    } catch {
      setConnected(false)
    } finally {
      setTesting(false)
    }
  }, [])

  const handleNext = useCallback(async () => {
    if (selectedModel) {
      try {
        await window.electronAPI['settings:set']('ollama.model', selectedModel)
        onConfigured(selectedModel)
      } catch {
        // Best-effort save
      }
    }
    onNext()
  }, [selectedModel, onNext, onConfigured])

  return (
    <>
      <DialogHeader>
        <DialogTitle>Ollama Setup</DialogTitle>
        <DialogDescription>
          Connect to a local Ollama instance for AI-powered features like document summarization and quiz generation.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <StepIndicator current={step} total={TOTAL_STEPS} />

        {/* Sub-state (a): Checking */}
        {checking && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking Ollama connection...
          </div>
        )}

        {/* Sub-state (b): Connected + models */}
        {!checking && connected && models.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
              <span className="text-sm text-green-600 dark:text-green-400">
                Connected ({models.length} model{models.length !== 1 ? 's' : ''} available)
              </span>
            </div>
            <div className="space-y-2">
              <Label>Select a model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Sub-state (c): Connected + no models */}
        {!checking && connected && models.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
              <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
            </div>
            <p className="text-sm text-muted-foreground">No models found. Pull a model by running:</p>
            <code className="block rounded bg-muted px-3 py-2 text-sm">ollama pull llama3.2</code>
          </div>
        )}

        {/* Sub-state (d): Not connected */}
        {!checking && !connected && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="text-sm text-red-600 dark:text-red-400">Not connected</span>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
              <h4 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-200">Setup Guide</h4>
              <ol className="list-inside list-decimal space-y-1 text-sm text-amber-700 dark:text-amber-300">
                <li>
                  Download Ollama from{' '}
                  <a
                    href="https://ollama.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline"
                  >
                    ollama.ai
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  Pull a model:{' '}
                  <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">ollama pull llama3.2</code>
                </li>
                <li>Start the Ollama server</li>
              </ol>
            </div>
            <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testing}>
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test Connection
            </Button>
          </div>
        )}
      </div>

      <DialogFooter className="sm:justify-between">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button variant="ghost" onClick={onSkip}>
            Skip
          </Button>
        </div>
        <Button onClick={handleNext}>Next</Button>
      </DialogFooter>
    </>
  )
}

// ---------------------------------------------------------------------------
// Step 2: Create First Project
// ---------------------------------------------------------------------------

function CreateProjectStep({
  onNext,
  onBack,
  onSkip,
  step,
}: {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  step: number
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<string>(PROJECT_COLORS[4]) // default blue
  const [creating, setCreating] = useState(false)

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      await useProjectStore.getState().createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      })
      onNext()
    } catch {
      // Error handled by store
      setCreating(false)
    }
  }, [name, description, color, onNext])

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create Your First Project</DialogTitle>
        <DialogDescription>Projects help you organize your documents and study materials.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <StepIndicator current={step} total={TOTAL_STEPS} />

        <div className="space-y-2">
          <Label htmlFor="wizard-project-name">Project Name</Label>
          <Input
            id="wizard-project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wizard-project-description">Description (optional)</Label>
          <Textarea
            id="wizard-project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                  color === c ? 'border-foreground' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              >
                {color === c && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter className="sm:justify-between">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button variant="ghost" onClick={onSkip}>
            Skip
          </Button>
        </div>
        <Button onClick={handleCreate} disabled={!name.trim() || creating}>
          {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create & Next
        </Button>
      </DialogFooter>
    </>
  )
}

// ---------------------------------------------------------------------------
// Step 3: All Done
// ---------------------------------------------------------------------------

function AllDoneStep({
  onFinish,
  step,
  ollamaConfigured,
  projectCreated,
  selectedModelName,
}: {
  onFinish: () => void
  step: number
  ollamaConfigured: boolean
  projectCreated: boolean
  selectedModelName: string
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-center text-2xl">All Done!</DialogTitle>
        <DialogDescription className="text-center">You&apos;re all set to start using Noteko.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <StepIndicator current={step} total={TOTAL_STEPS} />

        <div className="space-y-2 rounded-lg border p-4">
          <h4 className="text-sm font-semibold">Setup Summary</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              {ollamaConfigured ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  Ollama configured{selectedModelName ? ` (${selectedModelName})` : ''}
                </>
              ) : (
                <>
                  <span className="h-4 w-4 text-center text-muted-foreground/50">-</span>
                  Ollama setup skipped
                </>
              )}
            </li>
            <li className="flex items-center gap-2">
              {projectCreated ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  First project created
                </>
              ) : (
                <>
                  <span className="h-4 w-4 text-center text-muted-foreground/50">-</span>
                  Project creation skipped
                </>
              )}
            </li>
          </ul>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          You can always change these settings later in the Settings page.
        </p>
      </div>

      <DialogFooter className="sm:justify-center">
        <Button onClick={onFinish}>Start Using Noteko</Button>
      </DialogFooter>
    </>
  )
}
