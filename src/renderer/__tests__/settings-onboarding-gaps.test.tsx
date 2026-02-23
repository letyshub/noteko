/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
const mockElectronAPI: Record<string, any> = {
  on: vi.fn(() => vi.fn()),
  off: vi.fn(),
  'settings:get-all': vi.fn().mockResolvedValue({ success: true, data: {} }),
  'settings:set': vi.fn().mockResolvedValue({ success: true }),
  'settings:get': vi.fn().mockResolvedValue({ success: true, data: null }),
  'db:projects:list': vi.fn().mockResolvedValue({
    success: true,
    data: [
      { id: 1, name: 'Project A', description: '', created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 2, name: 'Project B', description: '', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ],
  }),
  'ai:health-check': vi.fn().mockResolvedValue({
    success: true,
    data: { connected: true, models: [{ name: 'llama3.2' }] },
  }),
  'ai:list-models': vi.fn().mockResolvedValue({
    success: true,
    data: [
      { name: 'llama3.2', size: 2000000000, modified_at: '2026-01-01' },
      { name: 'mistral', size: 3000000000, modified_at: '2026-01-01' },
    ],
  }),
  'app:get-storage-path': vi.fn().mockResolvedValue({ success: true, data: 'C:\\Users\\test\\noteko-data' }),
  'app:clear-cache': vi.fn().mockResolvedValue({ success: true, data: { deletedCount: 5 } }),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// ---------------------------------------------------------------------------
// Mock Zustand stores
// ---------------------------------------------------------------------------
const mockSetTheme = vi.fn()
let mockTheme = 'dark'

vi.mock('@renderer/store/theme-store', () => ({
  useThemeStore: (selector: any) => {
    const state = { theme: mockTheme, setTheme: mockSetTheme }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

const mockFetchProjects = vi.fn()
vi.mock('@renderer/store/project-store', () => ({
  useProjectStore: Object.assign(
    (selector: any) => {
      const state = {
        projects: [
          { id: 1, name: 'Project A', description: '', created_at: '2026-01-01', updated_at: '2026-01-01' },
          { id: 2, name: 'Project B', description: '', created_at: '2026-01-01', updated_at: '2026-01-01' },
        ],
        selectedProjectId: null,
        loading: false,
        error: null,
        fetchProjects: mockFetchProjects,
      }
      return typeof selector === 'function' ? selector(state) : state
    },
    {
      getState: () => ({
        createProject: vi.fn().mockResolvedValue({ id: 1 }),
      }),
    },
  ),
}))

vi.mock('@renderer/store/ui-store', () => ({
  useUIStore: (selector: any) => {
    const state = { setCurrentPageTitle: vi.fn() }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

const mockSetShowWizard = vi.fn()
let mockShowWizard = false
vi.mock('@renderer/store/settings-store', () => ({
  useSettingsStore: Object.assign(
    (selector: any) => {
      const state = {
        settings: {},
        loaded: true,
        showWizard: mockShowWizard,
        setShowWizard: mockSetShowWizard,
      }
      return typeof selector === 'function' ? selector(state) : state
    },
    {
      getState: () => ({
        settings: {},
        loaded: true,
        showWizard: mockShowWizard,
        setShowWizard: mockSetShowWizard,
      }),
    },
  ),
}))

// ---------------------------------------------------------------------------
// Mock sonner toast
// ---------------------------------------------------------------------------
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Mock shadcn/ui components for jsdom
// ---------------------------------------------------------------------------
const TabsContext = React.createContext<{
  activeTab: string
  setActiveTab: (v: string) => void
}>({ activeTab: '', setActiveTab: () => {} })

vi.mock('@renderer/components/ui/tabs', () => ({
  Tabs: ({ children, defaultValue, value, onValueChange, ...props }: any) => {
    const [active, setActive] = React.useState(value ?? defaultValue ?? '')
    const handleChange = (val: string) => {
      setActive(val)
      onValueChange?.(val)
    }
    return (
      <TabsContext.Provider value={{ activeTab: active, setActiveTab: handleChange }}>
        <div data-testid="tabs" data-value={active} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    )
  },
  TabsList: ({ children, ...props }: any) => (
    <div data-testid="tabs-list" role="tablist" {...props}>
      {children}
    </div>
  ),
  TabsTrigger: ({ children, value, ...props }: any) => {
    const { activeTab, setActiveTab } = React.useContext(TabsContext)
    return (
      <button
        role="tab"
        data-testid={`tab-trigger-${value}`}
        data-state={activeTab === value ? 'active' : 'inactive'}
        onClick={() => setActiveTab(value)}
        {...props}
      >
        {children}
      </button>
    )
  },
  TabsContent: ({ children, value, ...props }: any) => {
    const { activeTab } = React.useContext(TabsContext)
    if (activeTab !== value) return null
    return (
      <div role="tabpanel" data-testid={`tab-content-${value}`} {...props}>
        {children}
      </div>
    )
  },
}))

const RadioGroupContext = React.createContext<{ onValueChange?: (v: string) => void; value?: string }>({})

vi.mock('@renderer/components/ui/radio-group', () => ({
  RadioGroup: ({ children, value, onValueChange, ...props }: any) => (
    <RadioGroupContext.Provider value={{ onValueChange, value }}>
      <div data-testid="radio-group" role="radiogroup" data-value={value} {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  ),
  RadioGroupItem: ({ value, ...props }: any) => {
    const ctx = React.useContext(RadioGroupContext)
    return (
      <button
        role="radio"
        data-testid={`radio-${value}`}
        aria-checked={ctx.value === value}
        data-state={ctx.value === value ? 'checked' : 'unchecked'}
        onClick={() => ctx.onValueChange?.(value)}
        {...props}
      />
    )
  },
}))

vi.mock('@renderer/components/ui/select', () => ({
  Select: ({ children, value, onValueChange, defaultValue, ...props }: any) => {
    const [selected, setSelected] = React.useState(value ?? defaultValue ?? '')
    React.useEffect(() => {
      if (value !== undefined) setSelected(value)
    }, [value])
    const handleChange = (val: string) => {
      setSelected(val)
      onValueChange?.(val)
    }
    return (
      <div data-testid="select" data-value={selected} {...props}>
        {React.Children.map(children, (child: any) =>
          child ? React.cloneElement(child, { __selectedValue: selected, __onSelect: handleChange }) : null,
        )}
      </div>
    )
  },
  SelectTrigger: ({ children, ...props }: any) => (
    <button data-testid="select-trigger" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder, __selectedValue, ...props }: any) => (
    <span data-testid="select-value" {...props}>
      {__selectedValue || placeholder || ''}
    </span>
  ),
  SelectContent: ({ children, __selectedValue, __onSelect, ...props }: any) => (
    <div data-testid="select-content" {...props}>
      {React.Children.map(children, (child: any) =>
        child ? React.cloneElement(child, { __selectedValue, __onSelect }) : null,
      )}
    </div>
  ),
  SelectItem: ({ children, value, __onSelect, __selectedValue, ...props }: any) => (
    <div
      role="option"
      data-testid={`select-item-${value}`}
      data-value={value}
      aria-selected={__selectedValue === value}
      onClick={() => __onSelect?.(value)}
      {...props}
    >
      {children}
    </div>
  ),
  SelectGroup: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectLabel: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectSeparator: () => <hr />,
}))

const AlertDialogContext = React.createContext<{
  isOpen: boolean
  setOpen: (v: boolean) => void
}>({ isOpen: false, setOpen: () => {} })

vi.mock('@renderer/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open, onOpenChange, ...props }: any) => {
    const [isOpen, setIsOpen] = React.useState(open ?? false)
    React.useEffect(() => {
      if (open !== undefined) setIsOpen(open)
    }, [open])
    const handleOpenChange = (val: boolean) => {
      setIsOpen(val)
      onOpenChange?.(val)
    }
    return (
      <AlertDialogContext.Provider value={{ isOpen, setOpen: handleOpenChange }}>
        <div data-testid="alert-dialog" data-open={isOpen} {...props}>
          {children}
        </div>
      </AlertDialogContext.Provider>
    )
  },
  AlertDialogTrigger: ({ children, ...props }: any) => {
    const { setOpen } = React.useContext(AlertDialogContext)
    return (
      <div data-testid="alert-dialog-trigger" onClick={() => setOpen(true)} {...props}>
        {children}
      </div>
    )
  },
  AlertDialogContent: ({ children, ...props }: any) => {
    const { isOpen } = React.useContext(AlertDialogContext)
    if (!isOpen) return null
    return (
      <div data-testid="alert-dialog-content" {...props}>
        {children}
      </div>
    )
  },
  AlertDialogHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AlertDialogFooter: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AlertDialogTitle: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
  AlertDialogDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  AlertDialogAction: ({ children, onClick, ...props }: any) => {
    const { setOpen } = React.useContext(AlertDialogContext)
    return (
      <button
        data-testid="alert-dialog-action"
        onClick={(e: any) => {
          onClick?.(e)
          setOpen(false)
        }}
        {...props}
      >
        {children}
      </button>
    )
  },
  AlertDialogCancel: ({ children, ...props }: any) => {
    const { setOpen } = React.useContext(AlertDialogContext)
    return (
      <button data-testid="alert-dialog-cancel" onClick={() => setOpen(false)} {...props}>
        {children}
      </button>
    )
  },
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

vi.mock('@renderer/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: any) => (
    <div data-testid="scroll-area" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@renderer/components/ui/separator', () => ({
  Separator: (props: any) => <hr {...props} />,
}))

vi.mock('@renderer/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) => (
    <button
      role="switch"
      aria-checked={checked}
      data-testid="switch"
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}))

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

vi.mock('@renderer/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}))

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  mockTheme = 'dark'
  mockShowWizard = false
})

// ===========================================================================
// Gap 1: Appearance tab initial RadioGroup value matches store theme
// ===========================================================================
describe('AppearanceSettings - initial value reflects store', () => {
  it('RadioGroup value matches the current theme from theme store', async () => {
    mockTheme = 'dark'

    const { AppearanceSettings } = await import('@renderer/components/settings/appearance-settings')
    render(<AppearanceSettings />)

    // The RadioGroup should have data-value="dark" matching the store
    const radioGroup = screen.getByTestId('radio-group')
    expect(radioGroup).toHaveAttribute('data-value', 'dark')

    // The dark radio item should be checked
    const darkRadio = screen.getByTestId('radio-dark')
    expect(darkRadio).toHaveAttribute('aria-checked', 'true')

    // The light radio item should not be checked
    const lightRadio = screen.getByTestId('radio-light')
    expect(lightRadio).toHaveAttribute('aria-checked', 'false')
  })
})

// ===========================================================================
// Gap 2: General tab default project calls settings:set on change
// ===========================================================================
describe('GeneralSettings - default project persistence', () => {
  it('selecting a project calls settings:set IPC to persist the choice', async () => {
    const { GeneralSettings } = await import('@renderer/components/settings/general-settings')
    const user = userEvent.setup()

    render(<GeneralSettings settings={{}} />)

    // Click on "Project A" option (id=1)
    const projectOption = screen.getByTestId('select-item-1')
    await user.click(projectOption)

    // Should call settings:set with the project ID
    await waitFor(() => {
      expect(mockElectronAPI['settings:set']).toHaveBeenCalledWith('general.defaultProject', '1')
    })
  })
})

// ===========================================================================
// Gap 3: "Open Setup Wizard" button calls setShowWizard(true)
// ===========================================================================
describe('GeneralSettings - re-open wizard', () => {
  it('"Open Setup Wizard" button calls setShowWizard(true) on settings store', async () => {
    const { GeneralSettings } = await import('@renderer/components/settings/general-settings')
    const user = userEvent.setup()

    render(<GeneralSettings settings={{}} />)

    const wizardBtn = screen.getByText(/open setup wizard/i)
    await user.click(wizardBtn)

    expect(mockSetShowWizard).toHaveBeenCalledWith(true)
  })
})

// ===========================================================================
// Gap 4: Clear cache confirmation triggers IPC and shows toast with count
// ===========================================================================
describe('StorageSettings - clear cache action', () => {
  it('confirming clear cache calls app:clear-cache IPC and shows success toast', async () => {
    const { StorageSettings } = await import('@renderer/components/settings/storage-settings')
    const { toast } = await import('sonner')
    const user = userEvent.setup()

    render(<StorageSettings />)

    // Wait for the path to load
    await screen.findByText('C:\\Users\\test\\noteko-data')

    // Open the AlertDialog
    const clearBtn = screen.getByText(/clear cache/i)
    await user.click(clearBtn)

    // Click confirm action
    const confirmBtn = screen.getByTestId('alert-dialog-action')
    await user.click(confirmBtn)

    // Should call app:clear-cache IPC
    await waitFor(() => {
      expect(mockElectronAPI['app:clear-cache']).toHaveBeenCalled()
    })

    // Should show success toast with deleted count
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Cache cleared: 5 items removed')
    })
  })
})

// ===========================================================================
// Gap 5: OllamaSettings model dropdown renders model names from IPC
// ===========================================================================
describe('OllamaSettings - model dropdown content', () => {
  it('renders model names from ai:list-models IPC in the Select dropdown', async () => {
    const { OllamaSettings } = await import('@renderer/components/settings/ollama-settings')

    render(<OllamaSettings settings={{ 'ollama.url': 'http://localhost:11434' }} />)

    // Wait for models to load (ai:list-models is called on mount)
    await waitFor(() => {
      expect(mockElectronAPI['ai:list-models']).toHaveBeenCalled()
    })

    // Model names should appear as SelectItems
    await waitFor(() => {
      expect(screen.getByTestId('select-item-llama3.2')).toBeInTheDocument()
      expect(screen.getByTestId('select-item-mistral')).toBeInTheDocument()
    })

    // Should show model names as text content
    expect(screen.getByText('llama3.2')).toBeInTheDocument()
    expect(screen.getByText('mistral')).toBeInTheDocument()
  })
})

// ===========================================================================
// Gap 6: Wizard X button (close) sets onboarding.completed and closes
// ===========================================================================
describe('OnboardingWizard - X button behavior', () => {
  it('closing the dialog via X button sets onboarding.completed to true', async () => {
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

    // Click the X/close button (dialog mock has a close trigger)
    const closeBtn = screen.getByTestId('dialog-close-trigger')
    await user.click(closeBtn)

    // Should have called settings:set to mark onboarding complete (same as Skip)
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
// Gap 7: Wizard color picker - selecting a color updates visual state
// ===========================================================================
describe('OnboardingWizard - color picker', () => {
  it('clicking a color swatch in Create Project step updates selection', async () => {
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

    // Navigate to Create Project step: Welcome -> Ollama -> Create Project
    await user.click(screen.getByRole('button', { name: /get started/i }))
    await waitFor(() => {
      expect(screen.getByText('Ollama Setup')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByText('Create Your First Project')).toBeInTheDocument()
    })

    // The color swatch buttons have style backgroundColor set to each color
    // Default is blue (#3b82f6 at index 4). Find all color buttons.
    const colorButtons = document.querySelectorAll('button[style]')
    const redButton = Array.from(colorButtons).find(
      (btn) => (btn as HTMLElement).style.backgroundColor === 'rgb(239, 68, 68)',
    )
    expect(redButton).toBeTruthy()

    // Click the red swatch
    await user.click(redButton!)

    // After clicking red, it should now have the border indicating selected state
    // (border-foreground class). The red button should now have border-2 + border-foreground
    expect(redButton!.className).toContain('border-foreground')
  })
})

// ===========================================================================
// Gap 8: Wizard does not open when IPC throws an error
// ===========================================================================
describe('OnboardingWizard - IPC error during first-run check', () => {
  it('wizard does not open when settings:get IPC rejects', async () => {
    mockElectronAPI['settings:get'].mockRejectedValue(new Error('IPC failure'))
    mockElectronAPI['db:projects:list'].mockResolvedValue({ success: true, data: [] })

    const mod = await import('@renderer/components/onboarding/onboarding-wizard')
    const OnboardingWizard = mod.OnboardingWizard

    await act(async () => {
      render(<OnboardingWizard />)
    })

    // Allow async effects to settle
    await new Promise((r) => setTimeout(r, 50))

    // Wizard should NOT open since the IPC call failed
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
  })
})
