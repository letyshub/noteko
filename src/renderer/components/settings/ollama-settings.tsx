import { useState, useEffect, useCallback } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import type { OllamaModel } from '@shared/types'

interface OllamaSettingsProps {
  settings: Record<string, string>
}

export function OllamaSettings({ settings }: OllamaSettingsProps) {
  const [url, setUrl] = useState(settings['ollama.url'] || 'http://localhost:11434')
  const [selectedModel, setSelectedModel] = useState(settings['ollama.model'] || '')
  const [models, setModels] = useState<OllamaModel[]>([])
  const [connected, setConnected] = useState<boolean | null>(null)
  const [modelCount, setModelCount] = useState(0)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

  // Fetch models and check health on mount
  useEffect(() => {
    fetchModels()
    checkHealthOnMount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkHealthOnMount = useCallback(async () => {
    try {
      const result = await window.electronAPI['ai:health-check']()
      if (result.success) {
        setConnected(result.data.connected)
        setModelCount(result.data.models.length)
      }
    } catch {
      // Health check failed silently on mount
    }
  }, [])

  const fetchModels = useCallback(async () => {
    setLoadingModels(true)
    try {
      const result = await window.electronAPI['ai:list-models']()
      if (result.success) {
        setModels(result.data)
        setModelCount(result.data.length)
      }
    } catch {
      // Models not available
    } finally {
      setLoadingModels(false)
    }
  }, [])

  const handleTestConnection = useCallback(async () => {
    setTesting(true)
    try {
      const result = await window.electronAPI['ai:health-check']()
      if (result.success) {
        setConnected(result.data.connected)
        setModelCount(result.data.models.length)
        if (result.data.connected) {
          // Refresh model list after successful connection
          await fetchModels()
        }
      } else {
        setConnected(false)
      }
    } catch {
      setConnected(false)
    } finally {
      setTesting(false)
    }
  }, [fetchModels])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await window.electronAPI['settings:set']('ollama.url', url)
      if (selectedModel) {
        await window.electronAPI['settings:set']('ollama.model', selectedModel)
      }
    } finally {
      setSaving(false)
    }
  }, [url, selectedModel])

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        <div
          className={`h-2.5 w-2.5 rounded-full ${
            connected === true ? 'bg-green-500' : connected === false ? 'bg-red-500' : 'bg-gray-400'
          }`}
        />
        <span className="text-sm text-muted-foreground">
          {connected === true
            ? `Connected (${modelCount} model${modelCount !== 1 ? 's' : ''})`
            : connected === false
              ? 'Disconnected'
              : 'Not checked'}
        </span>
      </div>

      {/* Ollama URL */}
      <div className="space-y-2">
        <Label htmlFor="ollama-url">Ollama Server URL</Label>
        <Input
          id="ollama-url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://localhost:11434"
        />
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <Label htmlFor="ollama-model">Model</Label>
        <select
          id="ollama-model"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          disabled={loadingModels || models.length === 0}
        >
          <option value="">
            {loadingModels ? 'Loading models...' : models.length === 0 ? 'No models available' : 'Select a model'}
          </option>
          {models.map((model) => (
            <option key={model.name} value={model.name}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button onClick={handleTestConnection} variant="outline" disabled={testing}>
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Test Connection
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>

      {/* Setup Guide - shown when disconnected */}
      {connected === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <h4 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-200">Ollama Setup Guide</h4>
          <ol className="list-inside list-decimal space-y-1 text-sm text-amber-700 dark:text-amber-300">
            <li>
              Download and install Ollama from{' '}
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
              Pull a model: <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">ollama pull llama3.2</code>
            </li>
            <li>Start the Ollama server and click &ldquo;Test Connection&rdquo; above</li>
          </ol>
        </div>
      )}
    </div>
  )
}
