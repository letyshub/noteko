import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { GraduationCap, ArrowLeft, ChevronRight, Calendar, FileText, Hash, Check, AlertCircle } from 'lucide-react'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useUIStore } from '@renderer/store/ui-store'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { Separator } from '@renderer/components/ui/separator'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import type { QuizQuestionDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Helper: Difficulty badge color
// ---------------------------------------------------------------------------
function DifficultyBadge({ difficulty }: { difficulty?: string }) {
  if (!difficulty) return null
  const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
  return <Badge variant="outline">{label}</Badge>
}

// ---------------------------------------------------------------------------
// Helper: Question type badge label
// ---------------------------------------------------------------------------
function typeBadgeLabel(type?: string): string {
  switch (type) {
    case 'multiple-choice':
      return 'MCQ'
    case 'true-false':
      return 'T/F'
    case 'short-answer':
      return 'Short Answer'
    default:
      return 'Question'
  }
}

// ---------------------------------------------------------------------------
// Helper: MCQ option letter
// ---------------------------------------------------------------------------
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

// ---------------------------------------------------------------------------
// QuestionCard
// ---------------------------------------------------------------------------
function QuestionCard({ question, index }: { question: QuizQuestionDto; index: number }) {
  return (
    <div className="space-y-3">
      {/* Question header */}
      <div className="flex items-start gap-2">
        <span className="font-semibold">{index + 1}.</span>
        <span className="flex-1">{question.question}</span>
      </div>

      {/* Type + difficulty badges */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{typeBadgeLabel(question.type)}</Badge>
        <DifficultyBadge difficulty={question.difficulty} />
      </div>

      {/* Answer options */}
      {question.type === 'multiple-choice' && question.options && (
        <div className="space-y-1 pl-5">
          {question.options.map((option, i) => {
            const isCorrect = option === question.correct_answer
            return (
              <div
                key={i}
                data-correct={isCorrect ? 'true' : undefined}
                className={`flex items-center gap-2 rounded-md px-2 py-1 ${
                  isCorrect ? 'font-bold text-green-600 dark:text-green-400' : ''
                }`}
              >
                <span className="text-sm text-muted-foreground">{OPTION_LETTERS[i]}.</span>
                {isCorrect && <Check className="h-4 w-4 text-green-600 dark:text-green-400" />}
                <span>{option}</span>
              </div>
            )
          })}
        </div>
      )}

      {question.type === 'true-false' && (
        <div className="space-y-1 pl-5">
          {['True', 'False'].map((value) => {
            const isCorrect = value === question.correct_answer
            return (
              <div
                key={value}
                data-correct={isCorrect ? 'true' : undefined}
                className={`flex items-center gap-2 rounded-md px-2 py-1 ${
                  isCorrect ? 'font-bold text-green-600 dark:text-green-400' : ''
                }`}
              >
                {isCorrect && <Check className="h-4 w-4 text-green-600 dark:text-green-400" />}
                <span>{value}</span>
              </div>
            )
          })}
        </div>
      )}

      {question.type === 'short-answer' && (
        <div className="pl-5">
          <p className="text-sm text-muted-foreground">Expected Answer</p>
          <p data-correct="true" className="font-bold text-green-600 dark:text-green-400">
            {question.correct_answer}
          </p>
        </div>
      )}

      {/* Explanation */}
      {question.explanation && (
        <div className="rounded-md bg-muted/50 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Explanation</p>
          <p className="text-sm">{question.explanation}</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// QuizPage
// ---------------------------------------------------------------------------
export function QuizPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const setCurrentPageTitle = useUIStore((s) => s.setCurrentPageTitle)

  // Fetch quiz detail with questions
  const { data: quiz, loading, error, refetch } = useIpc(() => window.electronAPI['db:quizzes:get'](Number(id)), [id])

  // Set page title when quiz loads
  useEffect(() => {
    if (quiz) {
      setCurrentPageTitle(`Quiz: ${quiz.title}`)
    } else {
      setCurrentPageTitle('Quiz')
    }
  }, [quiz, setCurrentPageTitle])

  // Format date
  const formattedDate = quiz
    ? new Date(quiz.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : ''

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        {/* Metadata skeleton */}
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <Skeleton className="h-px w-full" />
          {/* Question skeletons */}
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">Error loading quiz</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Go Back
          </Button>
          <Button onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  // Quiz not found
  if (!quiz) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">Quiz not found</h2>
          <p className="mt-1 text-sm text-muted-foreground">The quiz you are looking for does not exist.</p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Go Back
        </Button>
      </div>
    )
  }

  const questionCount = quiz.questions?.length ?? quiz.question_count ?? 0

  return (
    <div className="flex flex-1 flex-col">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-1 border-b px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Link
          to={`/documents/${quiz.document_id}`}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Source Document
        </Link>
      </div>

      {/* Scrollable content area */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-6">
          {/* Quiz metadata header */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                <GraduationCap className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold">{quiz.title}</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formattedDate}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Source Document
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {questionCount} {questionCount === 1 ? 'question' : 'questions'}
                  </span>
                  <DifficultyBadge difficulty={quiz.difficulty_level} />
                </div>
              </div>
            </div>
            <Separator />
          </div>

          {/* Question cards */}
          {quiz.questions && quiz.questions.length > 0 ? (
            <div className="space-y-0">
              {quiz.questions.map((question, index) => (
                <div key={question.id}>
                  <QuestionCard question={question} index={index} />
                  {index < quiz.questions.length - 1 && <Separator className="my-4" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-md border bg-muted/30 p-8 text-center">
              <p className="text-sm text-muted-foreground">No questions in this quiz.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
