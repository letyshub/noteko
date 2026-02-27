/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
const mockElectronAPI: Record<string, any> = {
  on: vi.fn(() => vi.fn()),
  off: vi.fn(),
  'settings:get-all': vi.fn().mockResolvedValue({ success: true, data: {} }),
  'settings:set': vi.fn().mockResolvedValue({ success: true }),
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
      { name: 'llama3.2', size: '2B' },
      { name: 'mistral', size: '7B' },
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
let mockTheme = 'system'

vi.mock('@renderer/store/theme-store', () => ({
  useThemeStore: (selector: any) => {
    const state = { theme: mockTheme, setTheme: mockSetTheme }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

const mockFetchProjects = vi.fn()
vi.mock('@renderer/store/project-store', () => ({
  useProjectStore: (selector: any) => {
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
}))

vi.mock('@renderer/store/ui-store', () => ({
  useUIStore: (selector: any) => {
    const state = { setCurrentPageTitle: vi.fn() }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

const mockSetShowWizard = vi.fn()
vi.mock('@renderer/store/settings-store', () => ({
  useSettingsStore: Object.assign(
    (selector: any) => {
      const state = {
        settings: {},
        loaded: true,
        showWizard: false,
        setShowWizard: mockSetShowWizard,
      }
      return typeof selector === 'function' ? selector(state) : state
    },
    {
      getState: () => ({
        settings: {},
        loaded: true,
        showWizard: false,
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
// Mock shadcn/ui components for jsdom (Radix UI requires browser APIs)
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

// For RadioGroup, we use a React Context to pass onValueChange down
// since the RadioGroupItem is nested inside Label > div structures
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

// AlertDialog: Use React Context to pass open state down to nested children
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

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  mockTheme = 'system'
})

// ===========================================================================
// Test 1: Settings page renders all 4 tab triggers
// ===========================================================================
describe('SettingsPage - Tab layout', () => {
  it('renders all 4 tab triggers: Appearance, General, Ollama, Storage', async () => {
    const { SettingsPage } = await import('@renderer/pages/settings-page')
    render(<SettingsPage />)

    // Wait for settings to load (useIpc resolves async)
    await waitFor(() => {
      expect(screen.getByTestId('tabs')).toBeInTheDocument()
    })

    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('Ollama')).toBeInTheDocument()
    expect(screen.getByText('Storage')).toBeInTheDocument()
  })

  it('clicking a tab switches the visible content', async () => {
    const { SettingsPage } = await import('@renderer/pages/settings-page')
    const user = userEvent.setup()
    render(<SettingsPage />)

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.getByTestId('tabs')).toBeInTheDocument()
    })

    // Default tab is appearance - should show theme options
    expect(screen.getByTestId('tab-content-appearance')).toBeInTheDocument()

    // Click General tab
    await user.click(screen.getByTestId('tab-trigger-general'))
    expect(screen.getByTestId('tab-content-general')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-content-appearance')).not.toBeInTheDocument()

    // Click Storage tab
    await user.click(screen.getByTestId('tab-trigger-storage'))
    expect(screen.getByTestId('tab-content-storage')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-content-general')).not.toBeInTheDocument()
  })
})

// ===========================================================================
// Test 2: Appearance tab renders 3 theme options
// ===========================================================================
describe('AppearanceSettings - theme selection', () => {
  it('renders 3 theme options (Light, Dark, System) and clicking one calls setTheme', async () => {
    const { AppearanceSettings } = await import('@renderer/components/settings/appearance-settings')
    const user = userEvent.setup()

    render(<AppearanceSettings />)

    // Should have 3 radio options
    expect(screen.getByTestId('radio-light')).toBeInTheDocument()
    expect(screen.getByTestId('radio-dark')).toBeInTheDocument()
    expect(screen.getByTestId('radio-system')).toBeInTheDocument()

    // Should show theme labels
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()

    // Click Dark theme
    await user.click(screen.getByTestId('radio-dark'))
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })
})

// ===========================================================================
// Test 3: General tab renders project selector and setup wizard button
// ===========================================================================
describe('GeneralSettings', () => {
  it('renders a project selector dropdown and "Open Setup Wizard" button', async () => {
    const { GeneralSettings } = await import('@renderer/components/settings/general-settings')

    render(<GeneralSettings settings={{}} />)

    // Should have a project selector (Select component)
    expect(screen.getByTestId('select')).toBeInTheDocument()

    // Should have Open Setup Wizard button
    expect(screen.getByText(/open setup wizard/i)).toBeInTheDocument()
  })
})

// ===========================================================================
// Test 4: Storage tab displays path and Clear Cache button
// ===========================================================================
describe('StorageSettings', () => {
  it('displays a path string and a "Clear Cache" button', async () => {
    const { StorageSettings } = await import('@renderer/components/settings/storage-settings')

    render(<StorageSettings />)

    // Wait for the path to load
    await screen.findByText('C:\\Users\\test\\noteko-data')

    // Should have Clear Cache button
    expect(screen.getByText(/clear cache/i)).toBeInTheDocument()
  })

  it('clicking "Clear Cache" shows an AlertDialog confirmation', async () => {
    const { StorageSettings } = await import('@renderer/components/settings/storage-settings')
    const user = userEvent.setup()

    render(<StorageSettings />)

    // Wait for load
    await screen.findByText('C:\\Users\\test\\noteko-data')

    // Click Clear Cache button (inside AlertDialogTrigger)
    const clearBtn = screen.getByText(/clear cache/i)
    await user.click(clearBtn)

    // AlertDialog content should appear with title and action button
    expect(screen.getByTestId('alert-dialog-content')).toBeInTheDocument()
    expect(screen.getByTestId('alert-dialog-action')).toBeInTheDocument()
    expect(screen.getByText('Confirm Clear Cache')).toBeInTheDocument()
  })
})

// ===========================================================================
// Test 5: OllamaSettings model dropdown uses shadcn Select
// ===========================================================================
describe('OllamaSettings - shadcn Select', () => {
  it('model dropdown uses shadcn Select component (not native <select>)', async () => {
    const { OllamaSettings } = await import('@renderer/components/settings/ollama-settings')

    render(<OllamaSettings settings={{ 'ollama.url': 'http://localhost:11434' }} />)

    // Should use shadcn Select, not native <select>
    const nativeSelects = document.querySelectorAll('select')
    expect(nativeSelects.length).toBe(0)

    // Should find the shadcn Select test id
    expect(screen.getByTestId('select')).toBeInTheDocument()
  })
})

// ===========================================================================
// Test 6: OllamaSettings save triggers toast
// ===========================================================================
describe('OllamaSettings - save toast', () => {
  it('save triggers a toast notification', async () => {
    const { OllamaSettings } = await import('@renderer/components/settings/ollama-settings')
    const { toast } = await import('sonner')
    const user = userEvent.setup()

    render(<OllamaSettings settings={{ 'ollama.url': 'http://localhost:11434' }} />)

    // Click Save button
    const saveBtn = screen.getByText('Save')
    await user.click(saveBtn)

    // Should trigger settings save IPC
    expect(mockElectronAPI['settings:set']).toHaveBeenCalled()

    // Wait for async save to complete, then check toast
    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Settings saved')
    })
  })
})
