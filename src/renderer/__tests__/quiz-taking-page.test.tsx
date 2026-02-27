/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import type { QuizDetailDto, QuizAttemptDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
const mockElectronAPI = {
  'db:quizzes:get': vi.fn(),
  'db:quiz-attempts:list': vi.fn(),
  'db:quiz-attempts:create': vi.fn(),
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

const uiStoreState = {
  sidebarOpen: true,
  currentPageTitle: '',
  setSidebarOpen: vi.fn(),
  setCurrentPageTitle: mockSetCurrentPageTitle,
}

vi.mock('@renderer/store/ui-store', () => ({
  useUIStore: (selector: any) => selector(uiStoreState),
}))

// ---------------------------------------------------------------------------
// Mock sonner
// ---------------------------------------------------------------------------
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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
  Button: ({ children, variant, size, disabled, ...props }: any) => (
    <button data-variant={variant} data-size={size} disabled={disabled} {...props}>
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
  Separator: (props: any) => <hr data-testid="separator" {...props} />,
}))

vi.mock('@renderer/components/ui/progress', () => ({
  Progress: ({ value, ...props }: any) => (
    <div data-testid="progress" data-value={value} role="progressbar" {...props} />
  ),
}))

vi.mock('@renderer/components/ui/input', () => ({
  Input: (props: any) => <input data-testid="input" {...props} />,
}))

vi.mock('@renderer/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

vi.mock('@renderer/components/ui/radio-group', () => ({
  RadioGroup: ({ children, value, ...props }: any) => (
    <div data-testid="radio-group" data-value={value} {...props}>
      {children}
    </div>
  ),
  RadioGroupItem: ({ value, id, ...props }: any) => (
    <input type="radio" data-testid={`radio-item-${value}`} value={value} id={id} {...props} />
  ),
}))

vi.mock('@renderer/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: any) => <div data-testid="alert-dialog">{children}</div>,
  AlertDialogTrigger: ({ children }: any) => <div data-testid="alert-dialog-trigger">{children}</div>,
  AlertDialogContent: ({ children }: any) => <div data-testid="alert-dialog-content">{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: any) => <p data-testid="alert-dialog-description">{children}</p>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: any) => <button data-testid="alert-dialog-cancel">{children}</button>,
  AlertDialogAction: ({ children, onClick }: any) => (
    <button data-testid="alert-dialog-action" onClick={onClick}>
      {children}
    </button>
  ),
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const mockQuiz: QuizDetailDto = {
  id: 7,
  document_id: 3,
  title: 'Biology Quiz',
  created_at: '2026-02-20T10:00:00.000Z',
  question_count: 3,
  difficulty_level: 'medium',
  question_types: 'all',
  questions: [
    {
      id: 101,
      quiz_id: 7,
      question: 'What is DNA?',
      type: 'multiple-choice',
      options: ['Protein', 'Deoxyribonucleic acid', 'Ribonucleic acid', 'Sugar'],
      correct_answer: 'Deoxyribonucleic acid',
      explanation: 'DNA stands for Deoxyribonucleic acid.',
      difficulty: 'easy',
    },
    {
      id: 102,
      quiz_id: 7,
      question: 'Plants produce oxygen.',
      type: 'true-false',
      options: ['True', 'False'],
      correct_answer: 'True',
      explanation: 'Through photosynthesis, plants produce oxygen.',
      difficulty: 'easy',
    },
    {
      id: 103,
      quiz_id: 7,
      question: 'What organelle is the powerhouse of the cell?',
      type: 'short-answer',
      options: null,
      correct_answer: 'Mitochondria',
      explanation: 'Mitochondria generate most of the ATP.',
      difficulty: 'medium',
    },
  ],
}

const mockAttempts: QuizAttemptDto[] = [
  { id: 1, quiz_id: 7, score: 67, total_questions: 3, answers: null, completed_at: '2026-02-21T09:00:00Z' },
]

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function renderPage() {
  const { QuizTakingPage } = await import('@renderer/pages/quiz-taking-page')
  return render(<QuizTakingPage />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('QuizTakingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockElectronAPI['db:quizzes:get'].mockResolvedValue({ success: true, data: mockQuiz })
    mockElectronAPI['db:quiz-attempts:list'].mockResolvedValue({ success: true, data: mockAttempts })
    mockElectronAPI['db:quiz-attempts:create'].mockResolvedValue({
      success: true,
      data: { id: 10, quiz_id: 7, score: 2, total_questions: 3, answers: {}, completed_at: '2026-02-22T10:00:00Z' },
    })
  })

  // --- Guard states ---

  describe('loading state', () => {
    it('should render skeleton placeholders while loading', async () => {
      mockElectronAPI['db:quizzes:get'].mockReturnValue(new Promise(() => {})) // never resolves
      await renderPage()
      expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
    })
  })

  describe('error state', () => {
    it('should render error message with Go Back and Try Again buttons', async () => {
      mockElectronAPI['db:quizzes:get'].mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Quiz not found in DB' },
      })
      await renderPage()
      await waitFor(() => expect(screen.getByText('Error loading quiz')).toBeInTheDocument())
      expect(screen.getByText('Go Back')).toBeInTheDocument()
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })
  })

  describe('not found state', () => {
    it('should render not found message when quiz is null', async () => {
      mockElectronAPI['db:quizzes:get'].mockResolvedValue({ success: true, data: null })
      await renderPage()
      await waitFor(() => expect(screen.getByText('Quiz not found')).toBeInTheDocument())
      expect(screen.getByText('Go Back')).toBeInTheDocument()
    })
  })

  // --- Start screen ---

  describe('start screen', () => {
    it('should display quiz title, question count, and difficulty', async () => {
      await renderPage()
      await waitFor(() => expect(screen.getByText('Biology Quiz')).toBeInTheDocument())
      expect(screen.getByText(/3 questions/)).toBeInTheDocument()
    })

    it('should display Start Quiz button', async () => {
      await renderPage()
      await waitFor(() => expect(screen.getByTestId('start-quiz-btn')).toBeInTheDocument())
      expect(screen.getByText('Start Quiz')).toBeInTheDocument()
    })

    it('should show previous attempts with score percentages', async () => {
      await renderPage()
      await waitFor(() => expect(screen.getByText('Previous Attempts')).toBeInTheDocument())
      expect(screen.getByText('67%')).toBeInTheDocument() // 2/3 = 67%
    })

    it('should hide attempts section when no previous attempts', async () => {
      mockElectronAPI['db:quiz-attempts:list'].mockResolvedValue({ success: true, data: [] })
      await renderPage()
      await waitFor(() => expect(screen.getByText('Biology Quiz')).toBeInTheDocument())
      expect(screen.queryByText('Previous Attempts')).not.toBeInTheDocument()
    })
  })

  // --- Taking screen ---

  describe('taking screen', () => {
    async function startQuiz() {
      await renderPage()
      await waitFor(() => expect(screen.getByTestId('start-quiz-btn')).toBeInTheDocument())
      fireEvent.click(screen.getByTestId('start-quiz-btn'))
    }

    it('should show MCQ question with radio options after starting', async () => {
      await startQuiz()
      await waitFor(() => expect(screen.getByText('What is DNA?')).toBeInTheDocument())
      expect(screen.getByTestId('radio-group')).toBeInTheDocument()
    })

    it('should navigate to next question on Next button click', async () => {
      await startQuiz()
      await waitFor(() => expect(screen.getByText('What is DNA?')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Next'))
      await waitFor(() => expect(screen.getByText('Plants produce oxygen.')).toBeInTheDocument())
    })

    it('should navigate to previous question on Previous button click', async () => {
      await startQuiz()
      await waitFor(() => expect(screen.getByText('What is DNA?')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Next'))
      await waitFor(() => expect(screen.getByText('Plants produce oxygen.')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Previous'))
      await waitFor(() => expect(screen.getByText('What is DNA?')).toBeInTheDocument())
    })

    it('should show progress bar and timer', async () => {
      await startQuiz()
      await waitFor(() => expect(screen.getByTestId('progress')).toBeInTheDocument())
      expect(screen.getByText('00:00')).toBeInTheDocument()
    })

    it('should show question navigator pills for all questions', async () => {
      await startQuiz()
      await waitFor(() => expect(screen.getByLabelText('Go to question 1')).toBeInTheDocument())
      expect(screen.getByLabelText('Go to question 2')).toBeInTheDocument()
      expect(screen.getByLabelText('Go to question 3')).toBeInTheDocument()
    })

    it('should jump to question when clicking navigator pill', async () => {
      await startQuiz()
      await waitFor(() => expect(screen.getByText('What is DNA?')).toBeInTheDocument())
      fireEvent.click(screen.getByLabelText('Go to question 3'))
      await waitFor(() => expect(screen.getByText('What organelle is the powerhouse of the cell?')).toBeInTheDocument())
    })

    it('should show T/F toggle buttons for true-false questions', async () => {
      await startQuiz()
      await waitFor(() => expect(screen.getByText('What is DNA?')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Next'))
      await waitFor(() => expect(screen.getByText('True')).toBeInTheDocument())
      expect(screen.getByText('False')).toBeInTheDocument()
    })

    it('should show text input for short-answer questions', async () => {
      await startQuiz()
      await waitFor(() => expect(screen.getByText('What is DNA?')).toBeInTheDocument())
      fireEvent.click(screen.getByLabelText('Go to question 3'))
      await waitFor(() => expect(screen.getByTestId('input')).toBeInTheDocument())
    })

    it('should have submit button disabled when no questions answered', async () => {
      await startQuiz()
      await waitFor(() => expect(screen.getByTestId('submit-quiz-btn')).toBeInTheDocument())
      expect(screen.getByTestId('submit-quiz-btn')).toBeDisabled()
    })
  })

  // --- Submission and results ---

  describe('submission and results', () => {
    it('should call db:quiz-attempts:create on submit confirmation', async () => {
      await renderPage()
      await waitFor(() => expect(screen.getByTestId('start-quiz-btn')).toBeInTheDocument())
      fireEvent.click(screen.getByTestId('start-quiz-btn'))

      // Navigate to T/F question and click True
      await waitFor(() => expect(screen.getByText('What is DNA?')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Next'))
      await waitFor(() => expect(screen.getByText('True')).toBeInTheDocument())
      fireEvent.click(screen.getByText('True'))

      // Click submit and confirm
      fireEvent.click(screen.getByTestId('submit-quiz-btn'))
      fireEvent.click(screen.getByTestId('alert-dialog-action'))

      await waitFor(() => {
        expect(mockElectronAPI['db:quiz-attempts:create']).toHaveBeenCalled()
      })
    })

    it('should show results page with score after submission', async () => {
      await renderPage()
      await waitFor(() => expect(screen.getByTestId('start-quiz-btn')).toBeInTheDocument())
      fireEvent.click(screen.getByTestId('start-quiz-btn'))

      // Answer T/F question
      await waitFor(() => expect(screen.getByText('What is DNA?')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Next'))
      await waitFor(() => expect(screen.getByText('True')).toBeInTheDocument())
      fireEvent.click(screen.getByText('True'))

      // Submit
      fireEvent.click(screen.getByTestId('submit-quiz-btn'))
      fireEvent.click(screen.getByTestId('alert-dialog-action'))

      await waitFor(() => {
        expect(screen.getByTestId('score-percentage')).toBeInTheDocument()
      })
      expect(screen.getByText('Review Answers')).toBeInTheDocument()
      expect(screen.getByText('Retake Quiz')).toBeInTheDocument()
    })
  })

  // --- Review and retake ---

  describe('review and retake', () => {
    async function getToResults() {
      await renderPage()
      await waitFor(() => expect(screen.getByTestId('start-quiz-btn')).toBeInTheDocument())
      fireEvent.click(screen.getByTestId('start-quiz-btn'))

      // Answer T/F
      await waitFor(() => expect(screen.getByText('What is DNA?')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Next'))
      await waitFor(() => expect(screen.getByText('True')).toBeInTheDocument())
      fireEvent.click(screen.getByText('True'))

      // Submit
      fireEvent.click(screen.getByTestId('submit-quiz-btn'))
      fireEvent.click(screen.getByTestId('alert-dialog-action'))

      await waitFor(() => expect(screen.getByTestId('score-percentage')).toBeInTheDocument())
    }

    it('should show review page when clicking Review Answers', async () => {
      await getToResults()
      const reviewBtn = screen.getByText('Review Answers')
      await act(async () => {
        fireEvent.click(reviewBtn)
      })
      await waitFor(() => expect(screen.getByText('What is DNA?')).toBeInTheDocument())
      expect(screen.getByText('Plants produce oxygen.')).toBeInTheDocument()
    })

    it('should return to start screen on Retake Quiz', async () => {
      await getToResults()
      const retakeBtn = screen.getAllByText('Retake Quiz')[0]
      await act(async () => {
        fireEvent.click(retakeBtn)
      })
      await waitFor(() => expect(screen.getByTestId('start-quiz-btn')).toBeInTheDocument())
    })
  })
})
