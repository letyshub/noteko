/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ProjectDto, FolderDto, DocumentDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Mock react-router
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn()
const mockUseParams = vi.fn(() => ({ id: '1' }))
const mockUseLocation = vi.fn(() => ({ pathname: '/projects/1' }))

vi.mock('react-router', () => ({
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
  useLocation: () => mockUseLocation(),
}))

// ---------------------------------------------------------------------------
// Mock Zustand stores — each mock tracks its calls
// ---------------------------------------------------------------------------
const mockFetchProjects = vi.fn()
const mockSelectProject = vi.fn()
const mockFetchFolders = vi.fn()
const mockFetchDocumentsByProject = vi.fn()
const mockFetchDocumentsByFolder = vi.fn()
const mockDeleteDocument = vi.fn()
const mockSetCurrentPageTitle = vi.fn()

const sampleProject: ProjectDto = {
  id: 1,
  name: 'Test Project',
  description: 'A test project description',
  color: '#3b82f6',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const sampleProject2: ProjectDto = {
  id: 2,
  name: 'Second Project',
  description: null,
  color: '#ef4444',
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const rootFolder: FolderDto = {
  id: 1,
  name: 'Root Folder',
  project_id: 1,
  parent_folder_id: null,
  created_at: '2026-01-01T00:00:00Z',
}

const childFolder: FolderDto = {
  id: 2,
  name: 'Child Folder',
  project_id: 1,
  parent_folder_id: 1,
  created_at: '2026-01-02T00:00:00Z',
}

const anotherRootFolder: FolderDto = {
  id: 3,
  name: 'Another Root',
  project_id: 1,
  parent_folder_id: null,
  created_at: '2026-01-03T00:00:00Z',
}

const sampleDocument: DocumentDto = {
  id: 1,
  name: 'notes.pdf',
  file_path: '/files/notes.pdf',
  file_type: 'application/pdf',
  file_size: 2457600, // ~2.4 MB
  folder_id: 1,
  project_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const sampleDocument2: DocumentDto = {
  id: 2,
  name: 'photo.png',
  file_path: '/files/photo.png',
  file_type: 'image/png',
  file_size: 156000, // ~156 KB
  folder_id: 1,
  project_id: 1,
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const sampleDocument3: DocumentDto = {
  id: 3,
  name: 'data.csv',
  file_path: '/files/data.csv',
  file_type: 'text/csv',
  file_size: 512,
  folder_id: 1,
  project_id: 1,
  created_at: '2026-01-03T00:00:00Z',
  updated_at: '2026-01-03T00:00:00Z',
}

// Store state containers — tests can override before render
let projectStoreState = {
  projects: [sampleProject, sampleProject2] as ProjectDto[],
  selectedProjectId: null as number | null,
  loading: false,
  error: null as string | null,
  fetchProjects: mockFetchProjects,
  selectProject: mockSelectProject,
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}

let folderStoreState = {
  folders: [rootFolder, childFolder, anotherRootFolder] as FolderDto[],
  loading: false,
  error: null as string | null,
  fetchFolders: mockFetchFolders,
  createFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
}

let documentStoreState = {
  documents: [sampleDocument, sampleDocument2, sampleDocument3] as DocumentDto[],
  loading: false,
  error: null as string | null,
  fetchDocumentsByProject: mockFetchDocumentsByProject,
  fetchDocumentsByFolder: mockFetchDocumentsByFolder,
  addDocument: vi.fn(),
  removeDocument: vi.fn(),
  deleteDocument: mockDeleteDocument,
  clear: vi.fn(),
}

let uiStoreState = {
  sidebarOpen: true,
  currentPageTitle: '',
  setSidebarOpen: vi.fn(),
  setCurrentPageTitle: mockSetCurrentPageTitle,
}

vi.mock('@renderer/store', () => ({
  useProjectStore: (selector: any) => selector(projectStoreState),
  useFolderStore: (selector: any) => selector(folderStoreState),
  useDocumentStore: (selector: any) => selector(documentStoreState),
  useUIStore: (selector: any) => selector(uiStoreState),
}))

vi.mock('@renderer/store/project-store', () => ({
  useProjectStore: (selector: any) => selector(projectStoreState),
}))

vi.mock('@renderer/store/folder-store', () => ({
  useFolderStore: (selector: any) => selector(folderStoreState),
}))

vi.mock('@renderer/store/document-store', () => ({
  useDocumentStore: (selector: any) => selector(documentStoreState),
}))

vi.mock('@renderer/store/ui-store', () => ({
  useUIStore: (selector: any) => selector(uiStoreState),
}))

// ---------------------------------------------------------------------------
// Mock sidebar context to avoid provider requirement
// ---------------------------------------------------------------------------
vi.mock('@renderer/components/ui/sidebar', () => ({
  Sidebar: ({ children, ...props }: any) => (
    <div data-testid="sidebar" {...props}>
      {children}
    </div>
  ),
  SidebarContent: ({ children }: any) => <div>{children}</div>,
  SidebarFooter: ({ children }: any) => <div>{children}</div>,
  SidebarGroup: ({ children }: any) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: any) => <div>{children}</div>,
  SidebarGroupAction: ({ children, asChild, ...props }: any) => <button {...props}>{children}</button>,
  SidebarHeader: ({ children }: any) => <div>{children}</div>,
  SidebarMenu: ({ children }: any) => <ul>{children}</ul>,
  SidebarMenuButton: ({ children, asChild, isActive, tooltip, ...props }: any) => (
    <button data-active={isActive} {...props}>
      {children}
    </button>
  ),
  SidebarMenuItem: ({ children }: any) => <li>{children}</li>,
  SidebarMenuAction: ({ children, asChild, showOnHover, ...props }: any) => <button {...props}>{children}</button>,
  SidebarMenuSub: ({ children }: any) => <ul>{children}</ul>,
  SidebarMenuSubItem: ({ children }: any) => <li>{children}</li>,
  SidebarMenuSubButton: ({ children, asChild, ...props }: any) => <button {...props}>{children}</button>,
  SidebarRail: () => <div />,
  useSidebar: () => ({ isMobile: false, state: 'expanded' }),
}))

// ---------------------------------------------------------------------------
// Mock dialog components to keep tests focused
// ---------------------------------------------------------------------------
vi.mock('@renderer/components/projects/create-project-dialog', () => ({
  CreateProjectDialog: ({ open }: any) =>
    open ? <div data-testid="create-project-dialog">Create Project Dialog</div> : null,
}))

vi.mock('@renderer/components/projects/edit-project-dialog', () => ({
  EditProjectDialog: ({ open, project }: any) =>
    open ? <div data-testid="edit-project-dialog">Edit {project?.name}</div> : null,
}))

vi.mock('@renderer/components/projects/delete-project-dialog', () => ({
  DeleteProjectDialog: ({ open, project }: any) =>
    open ? <div data-testid="delete-project-dialog">Delete {project?.name}</div> : null,
}))

vi.mock('@renderer/components/folders/create-folder-dialog', () => ({
  CreateFolderDialog: ({ open }: any) =>
    open ? <div data-testid="create-folder-dialog">Create Folder Dialog</div> : null,
}))

vi.mock('@renderer/components/folders/edit-folder-dialog', () => ({
  EditFolderDialog: ({ open, folder }: any) =>
    open ? <div data-testid="edit-folder-dialog">Edit {folder?.name}</div> : null,
}))

vi.mock('@renderer/components/folders/delete-folder-dialog', () => ({
  DeleteFolderDialog: ({ open, folder }: any) =>
    open ? <div data-testid="delete-folder-dialog">Delete {folder?.name}</div> : null,
}))

// ---------------------------------------------------------------------------
// Mock radix collapsible to simple HTML
// ---------------------------------------------------------------------------
vi.mock('@renderer/components/ui/collapsible', async () => {
  const React = await import('react')
  const CollapsibleCtx = React.createContext<{
    isOpen: boolean
    setIsOpen: (v: boolean) => void
  }>({ isOpen: false, setIsOpen: () => {} })

  return {
    Collapsible: ({ children, open, defaultOpen, onOpenChange, ...props }: any) => {
      const controlled = open !== undefined
      const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false)
      const isOpen = controlled ? open : internalOpen
      const setIsOpen = (v: boolean) => {
        if (!controlled) setInternalOpen(v)
        onOpenChange?.(v)
      }
      return (
        <CollapsibleCtx.Provider value={{ isOpen, setIsOpen }}>
          <div data-testid="collapsible" data-state={isOpen ? 'open' : 'closed'} {...props}>
            {children}
          </div>
        </CollapsibleCtx.Provider>
      )
    },
    CollapsibleTrigger: ({ children, asChild, ...props }: any) => {
      const { isOpen, setIsOpen } = React.useContext(CollapsibleCtx)
      return (
        <button data-testid="collapsible-trigger" onClick={() => setIsOpen(!isOpen)} {...props}>
          {children}
        </button>
      )
    },
    CollapsibleContent: ({ children, ...props }: any) => {
      const { isOpen } = React.useContext(CollapsibleCtx)
      return isOpen ? (
        <div data-testid="collapsible-content" {...props}>
          {children}
        </div>
      ) : null
    },
  }
})

// ---------------------------------------------------------------------------
// Mock dropdown-menu to simple HTML
// ---------------------------------------------------------------------------
vi.mock('@renderer/components/ui/dropdown-menu', async () => {
  const React = await import('react')
  return {
    DropdownMenu: ({ children }: any) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children, asChild, ...props }: any) => <div {...props}>{children}</div>,
    DropdownMenuContent: ({ children, ...props }: any) => (
      <div role="menu" {...props}>
        {children}
      </div>
    ),
    DropdownMenuItem: ({ children, variant, ...props }: any) => (
      <div role="menuitem" data-variant={variant} {...props}>
        {children}
      </div>
    ),
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
    DropdownMenuGroup: ({ children }: any) => <div>{children}</div>,
    DropdownMenuPortal: ({ children }: any) => <div>{children}</div>,
  }
})

// ---------------------------------------------------------------------------
// Mock separator / scroll-area / button / badge
// ---------------------------------------------------------------------------
vi.mock('@renderer/components/ui/separator', () => ({
  Separator: () => <hr />,
}))

vi.mock('@renderer/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}))

vi.mock('@renderer/components/ui/button', () => ({
  Button: ({ children, asChild, variant, size, ...props }: any) => (
    <button data-variant={variant} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@renderer/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

vi.mock('@renderer/components/layout/theme-toggle', () => ({
  ThemeToggle: () => <button>Theme Toggle</button>,
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Group 9C — Folder Tree + Sidebar + Project Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset store states
    projectStoreState = {
      projects: [sampleProject, sampleProject2],
      selectedProjectId: null,
      loading: false,
      error: null,
      fetchProjects: mockFetchProjects,
      selectProject: mockSelectProject,
      createProject: vi.fn(),
      updateProject: vi.fn(),
      deleteProject: vi.fn(),
    }

    folderStoreState = {
      folders: [rootFolder, childFolder, anotherRootFolder],
      loading: false,
      error: null,
      fetchFolders: mockFetchFolders,
      createFolder: vi.fn(),
      updateFolder: vi.fn(),
      deleteFolder: vi.fn(),
    }

    documentStoreState = {
      documents: [sampleDocument, sampleDocument2, sampleDocument3],
      loading: false,
      error: null,
      fetchDocumentsByProject: mockFetchDocumentsByProject,
      fetchDocumentsByFolder: mockFetchDocumentsByFolder,
      addDocument: vi.fn(),
      removeDocument: vi.fn(),
      deleteDocument: mockDeleteDocument,
      clear: vi.fn(),
    }

    uiStoreState = {
      sidebarOpen: true,
      currentPageTitle: '',
      setSidebarOpen: vi.fn(),
      setCurrentPageTitle: mockSetCurrentPageTitle,
    }
  })

  // -------------------------------------------------------------------------
  // Folder Tree
  // -------------------------------------------------------------------------
  describe('FolderTree', () => {
    let FolderTree: any

    beforeEach(async () => {
      const mod = await import('@renderer/components/folders/folder-tree')
      FolderTree = mod.FolderTree
    })

    it('renders root folders from flat folder list', () => {
      render(
        <FolderTree
          folders={[rootFolder, childFolder, anotherRootFolder]}
          projectId={1}
          selectedFolderId={null}
          onSelectFolder={vi.fn()}
        />,
      )

      // Root folders should be visible
      expect(screen.getByText('Root Folder')).toBeInTheDocument()
      expect(screen.getByText('Another Root')).toBeInTheDocument()
    })

    it('renders child folders nested under parent after expanding', async () => {
      const user = userEvent.setup()
      render(
        <FolderTree
          folders={[rootFolder, childFolder, anotherRootFolder]}
          projectId={1}
          selectedFolderId={null}
          onSelectFolder={vi.fn()}
        />,
      )

      // Child should not be visible initially (collapsed)
      expect(screen.queryByText('Child Folder')).not.toBeInTheDocument()

      // Expand root folder — find the trigger associated with "Root Folder"
      const triggers = screen.getAllByTestId('collapsible-trigger')
      await user.click(triggers[0])

      // Child should now be visible
      expect(screen.getByText('Child Folder')).toBeInTheDocument()
    })

    it('calls onSelectFolder when a folder is clicked', async () => {
      const onSelectFolder = vi.fn()
      const user = userEvent.setup()
      render(
        <FolderTree
          folders={[rootFolder, childFolder, anotherRootFolder]}
          projectId={1}
          selectedFolderId={null}
          onSelectFolder={onSelectFolder}
        />,
      )

      // Click on a root folder name
      await user.click(screen.getByText('Root Folder'))

      expect(onSelectFolder).toHaveBeenCalledWith(rootFolder.id)
    })

    it('renders empty state when no folders exist', () => {
      render(<FolderTree folders={[]} projectId={1} selectedFolderId={null} onSelectFolder={vi.fn()} />)

      expect(screen.getByText(/no folders/i)).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Document List
  // -------------------------------------------------------------------------
  describe('DocumentList', () => {
    let DocumentList: any

    beforeEach(async () => {
      const mod = await import('@renderer/components/documents/document-list')
      DocumentList = mod.DocumentList
    })

    it('renders document names, file sizes, and file type info', () => {
      render(<DocumentList documents={[sampleDocument, sampleDocument2, sampleDocument3]} onDeleteDocument={vi.fn()} />)

      // Document names
      expect(screen.getByText('notes.pdf')).toBeInTheDocument()
      expect(screen.getByText('photo.png')).toBeInTheDocument()
      expect(screen.getByText('data.csv')).toBeInTheDocument()

      // File sizes should be human-readable
      expect(screen.getByText(/2\.3\s*MB|2\.4\s*MB/)).toBeInTheDocument()
      expect(screen.getByText(/152\s*KB|156\s*KB|152\.3\s*KB/)).toBeInTheDocument()
    })

    it('renders empty state when no documents', () => {
      render(<DocumentList documents={[]} onDeleteDocument={vi.fn()} />)

      expect(screen.getByText(/no documents/i)).toBeInTheDocument()
    })

    it('calls onDeleteDocument when delete is triggered', async () => {
      const onDelete = vi.fn()
      const user = userEvent.setup()
      render(<DocumentList documents={[sampleDocument]} onDeleteDocument={onDelete} />)

      // Find the delete menu item
      const deleteItems = screen.getAllByRole('menuitem')
      const deleteItem = deleteItems.find((el) => el.textContent?.toLowerCase().includes('delete'))
      expect(deleteItem).toBeDefined()

      await user.click(deleteItem!)

      expect(onDelete).toHaveBeenCalledWith(sampleDocument.id)
    })
  })

  // -------------------------------------------------------------------------
  // App Sidebar
  // -------------------------------------------------------------------------
  describe('AppSidebar', () => {
    let AppSidebar: any

    beforeEach(async () => {
      const mod = await import('@renderer/components/layout/app-sidebar')
      AppSidebar = mod.AppSidebar
    })

    it('renders navigation items (Dashboard, Settings)', () => {
      render(<AppSidebar />)

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('renders project list from store', () => {
      render(<AppSidebar />)

      expect(screen.getByText('Test Project')).toBeInTheDocument()
      expect(screen.getByText('Second Project')).toBeInTheDocument()
    })

    it('fetches projects on mount', () => {
      render(<AppSidebar />)

      expect(mockFetchProjects).toHaveBeenCalled()
    })

    it('shows Projects header with "+" button for new project', () => {
      render(<AppSidebar />)

      // The Projects label should exist
      expect(screen.getByText('Projects')).toBeInTheDocument()

      // There should be a button to create a new project (with "+" or "New Project")
      const addButtons = screen.getAllByRole('button')
      const plusButton = addButtons.find(
        (btn) =>
          btn.getAttribute('aria-label')?.toLowerCase().includes('new project') ||
          btn.getAttribute('aria-label')?.toLowerCase().includes('add project') ||
          btn.textContent?.includes('+'),
      )
      expect(plusButton).toBeDefined()
    })

    it('shows create project dialog when "+" button is clicked', async () => {
      const user = userEvent.setup()
      render(<AppSidebar />)

      // Find the new project button
      const addButtons = screen.getAllByRole('button')
      const plusButton = addButtons.find(
        (btn) =>
          btn.getAttribute('aria-label')?.toLowerCase().includes('new project') ||
          btn.getAttribute('aria-label')?.toLowerCase().includes('add project') ||
          btn.textContent?.includes('+'),
      )!

      await user.click(plusButton)

      expect(screen.getByTestId('create-project-dialog')).toBeInTheDocument()
    })

    it('renders theme toggle in footer', () => {
      render(<AppSidebar />)

      expect(screen.getByText('Theme Toggle')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Project Page
  // -------------------------------------------------------------------------
  describe('ProjectPage', () => {
    let ProjectPage: any

    beforeEach(async () => {
      mockUseParams.mockReturnValue({ id: '1' })
      projectStoreState.projects = [sampleProject]

      const mod = await import('@renderer/pages/project-page')
      ProjectPage = mod.ProjectPage
    })

    it('sets page title to project name on mount', () => {
      render(<ProjectPage />)

      expect(mockSetCurrentPageTitle).toHaveBeenCalledWith('Test Project')
    })

    it('fetches folders for the project on mount', () => {
      render(<ProjectPage />)

      expect(mockFetchFolders).toHaveBeenCalledWith(1)
    })

    it('fetches all documents by project when no folder is selected', () => {
      render(<ProjectPage />)

      expect(mockFetchDocumentsByProject).toHaveBeenCalledWith(1)
    })

    it('renders project name in the header', () => {
      render(<ProjectPage />)

      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    it('renders project description when available', () => {
      render(<ProjectPage />)

      expect(screen.getByText('A test project description')).toBeInTheDocument()
    })

    it('renders folder tree and document list panels', () => {
      render(<ProjectPage />)

      // Folder tree should show root folders
      expect(screen.getByText('Root Folder')).toBeInTheDocument()
      expect(screen.getByText('Another Root')).toBeInTheDocument()

      // Document list should show documents
      expect(screen.getByText('notes.pdf')).toBeInTheDocument()
    })
  })
})
