/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { QuizDetailDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
const mockElectronAPI = {
  'db:quizzes:get': vi.fn(),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// ---------------------------------------------------------------------------
// Mock react-router
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn()
const mockUseParams = vi.fn(() => ({ id: '7' }))

vi.mock('react-router', () => ({
  useParams: () => mockUseParams(),
  useNavigate: () => mockNavigate,
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

// ---------------------------------------------------------------------------
// Mock Zustand stores
// ---------------------------------------------------------------------------
const mockSetCurrentPageTitle = vi.fn()

let uiStoreState = {
  sidebarOpen: true,
  currentPageTitle: '',
  setSidebarOpen: vi.fn(),
  setCurrentPageTitle: mockSetCurrentPageTitle,
}

vi.mock('@renderer/store/ui-store', () => ({
  useUIStore: (selector: any) => selector(uiStoreState),
}))

// ---------------------------------------------------------------------------
// Mock shadcn/ui components for jsdom
// ---------------------------------------------------------------------------
vi.mock('@renderer/components/ui/badge', () => ({
  Badge: ({ children, variant, className, ...props }: any) => (
    <span data-variant={variant} data-testid="badge" className={className} {...props}>
      {children}
    </span>
  ),
}))

vi.mock('@renderer/components/ui/button', () => ({
  Button: ({ children, variant, ...props }: any) => (
    <button data-variant={variant} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@renderer/components/ui/skeleton', () => ({
  Skeleton: ({ className, ...props }: any) => <div data-testid="skeleton" className={className} {...props} />,
}))

vi.mock('@renderer/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: any) => (
    <div data-testid="scroll-area" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@renderer/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const mockQuizDetail: QuizDetailDto = {
  id: 7,
  document_id: 42,
  title: 'Biology Basics Quiz',
  created_at: '2026-02-20T14:30:00Z',
  question_count: 3,
  difficulty_level: 'medium',
  question_types: 'mixed',
  questions: [
    {
      id: 1,
      quiz_id: 7,
      question: 'What is the powerhouse of the cell?',
      options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'],
      correct_answer: 'Mitochondria',
      explanation: "Mitochondria generate most of the cell's supply of ATP.",
      type: 'multiple-choice',
      difficulty: 'easy',
    },
    {
      id: 2,
      quiz_id: 7,
      question: 'DNA stands for Deoxyribonucleic Acid.',
      options: null,
      correct_answer: 'True',
      explanation: 'DNA is short for Deoxyribonucleic Acid.',
      type: 'true-false',
      difficulty: 'easy',
    },
    {
      id: 3,
      quiz_id: 7,
      question: 'What molecule carries genetic information?',
      options: null,
      correct_answer: 'DNA',
      explanation: 'DNA (Deoxyribonucleic Acid) stores genetic instructions.',
      type: 'short-answer',
      difficulty: 'medium',
    },
  ],
}

// ===========================================================================
// Quiz Display Page Tests
// ===========================================================================
describe('QuizPage', () => {
  let QuizPage: any

  beforeEach(async () => {
    vi.clearAllMocks()
    mockUseParams.mockReturnValue({ id: '7' })

    uiStoreState = {
      sidebarOpen: true,
      currentPageTitle: '',
      setSidebarOpen: vi.fn(),
      setCurrentPageTitle: mockSetCurrentPageTitle,
    }

    // Default: return quiz detail
    mockElectronAPI['db:quizzes:get'].mockResolvedValue({
      success: true,
      data: mockQuizDetail,
    })

    // Reset module cache to pick up fresh mocks
    vi.resetModules()
    const mod = await import('@renderer/pages/quiz-page')
    QuizPage = mod.QuizPage
  })

  it('fetches and renders quiz data via db:quizzes:get IPC call', async () => {
    render(<QuizPage />)

    // Should have called the IPC with the quiz ID from params
    expect(mockElectronAPI['db:quizzes:get']).toHaveBeenCalledWith(7)

    // Wait for quiz title to appear
    await waitFor(() => {
      expect(screen.getByText('Biology Basics Quiz')).toBeInTheDocument()
    })

    // All three questions should be rendered
    await waitFor(() => {
      expect(screen.getByText('What is the powerhouse of the cell?')).toBeInTheDocument()
      expect(screen.getByText('DNA stands for Deoxyribonucleic Acid.')).toBeInTheDocument()
      expect(screen.getByText('What molecule carries genetic information?')).toBeInTheDocument()
    })

    // Page title should be set
    expect(mockSetCurrentPageTitle).toHaveBeenCalledWith('Quiz: Biology Basics Quiz')
  })

  it('renders MCQ options with the correct answer highlighted (Check icon + green text)', async () => {
    render(<QuizPage />)

    // Wait for quiz to load
    await waitFor(() => {
      expect(screen.getByText('What is the powerhouse of the cell?')).toBeInTheDocument()
    })

    // All 4 MCQ options should be rendered (use getAllByText for "Mitochondria"
    // since it also appears in the explanation text)
    expect(screen.getByText('Nucleus')).toBeInTheDocument()
    expect(screen.getAllByText(/Mitochondria/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Ribosome')).toBeInTheDocument()
    expect(screen.getByText('Golgi apparatus')).toBeInTheDocument()

    // The correct answer "Mitochondria" option should be marked with data-correct="true"
    // Find all elements with data-correct="true" within the MCQ question area
    const correctElements = document.querySelectorAll('[data-correct="true"]')
    expect(correctElements.length).toBeGreaterThanOrEqual(1)

    // The correct answer container should contain "Mitochondria"
    const mcqCorrectAnswer = Array.from(correctElements).find((el) => el.textContent?.includes('Mitochondria'))
    expect(mcqCorrectAnswer).toBeDefined()
  })

  it('shows loading skeletons while data is being fetched', async () => {
    // Make the IPC call never resolve to keep loading state
    mockElectronAPI['db:quizzes:get'].mockReturnValue(new Promise(() => {}))

    // Must re-import after changing mock
    vi.resetModules()
    const mod = await import('@renderer/pages/quiz-page')
    QuizPage = mod.QuizPage

    render(<QuizPage />)

    // Should show skeleton loading indicators
    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)

    // The quiz title should NOT be visible during loading
    expect(screen.queryByText('Biology Basics Quiz')).not.toBeInTheDocument()
  })

  it('shows error state when quiz API returns an error (invalid quiz ID)', async () => {
    // Make the IPC call return an error (simulating invalid/nonexistent quiz ID)
    mockElectronAPI['db:quizzes:get'].mockResolvedValue({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Quiz 999 not found' },
    })

    // Must re-import after changing mock
    vi.resetModules()
    const mod = await import('@renderer/pages/quiz-page')
    QuizPage = mod.QuizPage

    render(<QuizPage />)

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('Error loading quiz')).toBeInTheDocument()
    })

    // Should show error details
    expect(screen.getByText('Quiz 999 not found')).toBeInTheDocument()

    // Should show Go Back and Try Again buttons
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()

    // Quiz title should NOT be visible
    expect(screen.queryByText('Biology Basics Quiz')).not.toBeInTheDocument()
  })

  it('shows "Quiz not found" when quiz data is null after successful API call', async () => {
    // Return success but with null data (quiz doesn't exist)
    mockElectronAPI['db:quizzes:get'].mockResolvedValue({
      success: true,
      data: null,
    })

    // Must re-import after changing mock
    vi.resetModules()
    const mod = await import('@renderer/pages/quiz-page')
    QuizPage = mod.QuizPage

    render(<QuizPage />)

    // Should show "Quiz not found" message
    await waitFor(() => {
      expect(screen.getByText('Quiz not found')).toBeInTheDocument()
    })

    // Should have a Go Back button
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })
})
