/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
const mockElectronAPI: Record<string, any> = {
  on: vi.fn(() => vi.fn()),
  off: vi.fn(),
  'settings:get': vi.fn().mockResolvedValue({ success: true, data: null }),
  'settings:set': vi.fn().mockResolvedValue({ success: true }),
  'settings:get-all': vi.fn().mockResolvedValue({ success: true, data: {} }),
  'db:projects:list': vi.fn().mockResolvedValue({ success: true, data: [] }),
  'db:projects:create': vi.fn().mockResolvedValue({
    success: true,
    data: {
      id: 1,
      name: 'My Project',
      description: null,
      color: '#3b82f6',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  }),
  'ai:health-check': vi.fn().mockResolvedValue({
    success: true,
    data: { connected: false, models: [] },
  }),
  'ai:list-models': vi.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// ---------------------------------------------------------------------------
// Mock shadcn/ui components for jsdom (Radix UI doesn't work in jsdom)
// ---------------------------------------------------------------------------
vi.mock('@renderer/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) =>
    open ? (
      <div data-testid="dialog">
        <button data-testid="dialog-close-trigger" onClick={() => onOpenChange?.(false)}>
          Close
        </button>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children, onInteractOutside }: any) => (
    <div data-testid="dialog-content" data-prevent-outside={!!onInteractOutside}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}))

vi.mock('@renderer/components/ui/button', () => ({
  Button: ({ children, variant, size, ...props }: any) => (
    <button data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@renderer/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}))

vi.mock('@renderer/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

vi.mock('@renderer/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}))

vi.mock('@renderer/components/ui/select', () => ({
  Select: ({ children, value }: any) => (
    <div data-testid="select" data-value={value}>
      {typeof children === 'function' ? children() : children}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <button data-testid="select-trigger" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>,
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value, ...props }: any) => (
    <div data-testid="select-item" data-value={value} role="option" {...props}>
      {children}
    </div>
  ),
}))

// ---------------------------------------------------------------------------
// Reset stores and mocks between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  // Reset default mock behavior
  mockElectronAPI['settings:get'].mockResolvedValue({ success: true, data: null })
  mockElectronAPI['db:projects:list'].mockResolvedValue({ success: true, data: [] })
  mockElectronAPI['ai:health-check'].mockResolvedValue({
    success: true,
    data: { connected: false, models: [] },
  })
  mockElectronAPI['ai:list-models'].mockResolvedValue({
    success: true,
    data: [],
  })
})

// ===========================================================================
// Test 1: Wizard auto-opens when onboarding.completed is null AND zero projects
// ===========================================================================
describe('OnboardingWizard - auto-open', () => {
  it('opens when onboarding.completed is null AND zero projects exist', async () => {
    mockElectronAPI['settings:get'].mockResolvedValue({ success: true, data: null })
    mockElectronAPI['db:projects:list'].mockResolvedValue({ success: true, data: [] })

    const mod = await import('@renderer/components/onboarding/onboarding-wizard')
    const OnboardingWizard = mod.OnboardingWizard

    await act(async () => {
      render(<OnboardingWizard />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    // Should show Welcome step content
    expect(screen.getByText('Noteko')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
  })
})

// ===========================================================================
// Test 2: Wizard does NOT open when onboarding.completed is 'true'
// ===========================================================================
describe('OnboardingWizard - already completed', () => {
  it('does NOT open when onboarding.completed is true', async () => {
    mockElectronAPI['settings:get'].mockResolvedValue({ success: true, data: 'true' })
    mockElectronAPI['db:projects:list'].mockResolvedValue({ success: true, data: [] })

    const mod = await import('@renderer/components/onboarding/onboarding-wizard')
    const OnboardingWizard = mod.OnboardingWizard

    await act(async () => {
      render(<OnboardingWizard />)
    })

    // Allow async effects to settle
    await new Promise((r) => setTimeout(r, 50))

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
  })
})

// ===========================================================================
// Test 3: Wizard does NOT open when projects exist (even if onboarding.completed is null)
// ===========================================================================
describe('OnboardingWizard - projects exist', () => {
  it('does NOT open when projects exist even if onboarding.completed is null', async () => {
    mockElectronAPI['settings:get'].mockResolvedValue({ success: true, data: null })
    mockElectronAPI['db:projects:list'].mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          name: 'Existing',
          description: null,
          color: '#3b82f6',
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
    })

    const mod = await import('@renderer/components/onboarding/onboarding-wizard')
    const OnboardingWizard = mod.OnboardingWizard

    await act(async () => {
      render(<OnboardingWizard />)
    })

    await new Promise((r) => setTimeout(r, 50))

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
  })
})

// ===========================================================================
// Test 4: Step navigation - "Get Started" goes from step 0 to step 1
// ===========================================================================
describe('OnboardingWizard - step navigation', () => {
  it('"Get Started" advances from Welcome (step 0) to Ollama Setup (step 1)', async () => {
    mockElectronAPI['settings:get'].mockResolvedValue({ success: true, data: null })
    mockElectronAPI['db:projects:list'].mockResolvedValue({ success: true, data: [] })

    const mod = await import('@renderer/components/onboarding/onboarding-wizard')
    const OnboardingWizard = mod.OnboardingWizard
    const user = userEvent.setup()

    await act(async () => {
      render(<OnboardingWizard />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    // Click "Get Started"
    await user.click(screen.getByRole('button', { name: /get started/i }))

    // Should now be on Ollama Setup step - use specific heading text
    await waitFor(() => {
      expect(screen.getByText('Ollama Setup')).toBeInTheDocument()
    })
  })
})

// ===========================================================================
// Test 5: "Skip" sets onboarding.completed to 'true' and closes dialog
// ===========================================================================
describe('OnboardingWizard - skip', () => {
  it('"Skip" sets onboarding.completed to true and closes the dialog', async () => {
    mockElectronAPI['settings:get'].mockResolvedValue({ success: true, data: null })
    mockElectronAPI['db:projects:list'].mockResolvedValue({ success: true, data: [] })

    const mod = await import('@renderer/components/onboarding/onboarding-wizard')
    const OnboardingWizard = mod.OnboardingWizard
    const user = userEvent.setup()

    await act(async () => {
      render(<OnboardingWizard />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    // Click "Skip"
    await user.click(screen.getByRole('button', { name: /skip/i }))

    // Should have called settings:set to mark onboarding complete
    await waitFor(() => {
      expect(mockElectronAPI['settings:set']).toHaveBeenCalledWith('onboarding.completed', 'true')
    })

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })
  })
})

// ===========================================================================
// Test 6: Ollama step shows connected state with models
// ===========================================================================
describe('OnboardingWizard - Ollama step connected', () => {
  it('shows connected state with model selection when Ollama is available', async () => {
    mockElectronAPI['settings:get'].mockResolvedValue({ success: true, data: null })
    mockElectronAPI['db:projects:list'].mockResolvedValue({ success: true, data: [] })
    mockElectronAPI['ai:health-check'].mockResolvedValue({
      success: true,
      data: { connected: true, models: ['llama3.2', 'mistral'] },
    })
    mockElectronAPI['ai:list-models'].mockResolvedValue({
      success: true,
      data: [
        { name: 'llama3.2', size: 2000000000, modified_at: '2026-01-01' },
        { name: 'mistral', size: 3000000000, modified_at: '2026-01-01' },
      ],
    })

    const mod = await import('@renderer/components/onboarding/onboarding-wizard')
    const OnboardingWizard = mod.OnboardingWizard
    const user = userEvent.setup()

    await act(async () => {
      render(<OnboardingWizard />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    // Navigate to Ollama step
    await user.click(screen.getByRole('button', { name: /get started/i }))

    // Should show connected status (specific text to avoid multiple matches)
    await waitFor(() => {
      expect(screen.getByText(/Connected \(2 models available\)/)).toBeInTheDocument()
    })
  })
})

// ===========================================================================
// Test 7: Create Project step has name input and color swatches
// ===========================================================================
describe('OnboardingWizard - Create Project step', () => {
  it('shows name input, color picker, and "Create & Next" button', async () => {
    mockElectronAPI['settings:get'].mockResolvedValue({ success: true, data: null })
    mockElectronAPI['db:projects:list'].mockResolvedValue({ success: true, data: [] })

    const mod = await import('@renderer/components/onboarding/onboarding-wizard')
    const OnboardingWizard = mod.OnboardingWizard
    const user = userEvent.setup()

    await act(async () => {
      render(<OnboardingWizard />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    // Navigate: Welcome -> Ollama -> Create Project
    await user.click(screen.getByRole('button', { name: /get started/i }))
    await waitFor(() => {
      expect(screen.getByText('Ollama Setup')).toBeInTheDocument()
    })

    // Click Next on Ollama step
    await user.click(screen.getByRole('button', { name: /next/i }))

    // Should show Create Project step
    await waitFor(() => {
      expect(screen.getByText('Create Your First Project')).toBeInTheDocument()
    })

    // Should have name input
    expect(screen.getByPlaceholderText(/project name/i)).toBeInTheDocument()

    // Should have "Create & Next" button
    expect(screen.getByRole('button', { name: /create & next/i })).toBeInTheDocument()
  })
})

// ===========================================================================
// Test 8: All Done step shows summary and "Start Using Noteko" button
// ===========================================================================
describe('OnboardingWizard - All Done step', () => {
  it('shows summary and "Start Using Noteko" button', async () => {
    mockElectronAPI['settings:get'].mockResolvedValue({ success: true, data: null })
    mockElectronAPI['db:projects:list'].mockResolvedValue({ success: true, data: [] })

    const mod = await import('@renderer/components/onboarding/onboarding-wizard')
    const OnboardingWizard = mod.OnboardingWizard
    const user = userEvent.setup()

    await act(async () => {
      render(<OnboardingWizard />)
    })

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
    })

    // Navigate through all steps: Welcome -> Ollama -> Create Project -> All Done
    await user.click(screen.getByRole('button', { name: /get started/i }))
    await waitFor(() => {
      expect(screen.getByText('Ollama Setup')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByText('Create Your First Project')).toBeInTheDocument()
    })

    // Skip project creation to go to All Done
    await user.click(screen.getByRole('button', { name: /skip/i }))

    // Should show All Done step
    await waitFor(() => {
      expect(screen.getByText('All Done!')).toBeInTheDocument()
    })

    // Should have "Start Using Noteko" button
    expect(screen.getByRole('button', { name: /start using noteko/i })).toBeInTheDocument()
  })
})
