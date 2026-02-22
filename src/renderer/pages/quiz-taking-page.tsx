import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import {
  GraduationCap,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Clock,
  AlertCircle,
  Check,
  X,
  Award,
  RotateCcw,
  Send,
  SkipForward,
} from 'lucide-react'
import { toast } from 'sonner'
import { useIpc, useIpcMutation } from '@renderer/hooks/use-ipc'
import { useUIStore } from '@renderer/store/ui-store'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Progress } from '@renderer/components/ui/progress'
import { Input } from '@renderer/components/ui/input'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { Separator } from '@renderer/components/ui/separator'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@renderer/components/ui/alert-dialog'
import { RadioGroup, RadioGroupItem } from '@renderer/components/ui/radio-group'
import { Label } from '@renderer/components/ui/label'
import { DifficultyBadge } from '@renderer/components/quiz/difficulty-badge'
import { typeBadgeLabel, OPTION_LETTERS } from '@renderer/components/quiz/question-utils'
import { scoreQuiz, formatElapsedTime, type QuizScoreResult } from '@renderer/lib/quiz-scoring'
import { cn } from '@renderer/lib/utils'
import type { QuizQuestionDto, QuizAttemptDto } from '@shared/types'

type Phase = 'start' | 'taking' | 'results' | 'reviewing'

// ---------------------------------------------------------------------------
// QuizTakingPage
// ---------------------------------------------------------------------------
export function QuizTakingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const setCurrentPageTitle = useUIStore((s) => s.setCurrentPageTitle)

  // Data fetching
  const { data: quiz, loading, error, refetch } = useIpc(() => window.electronAPI['db:quizzes:get'](Number(id)), [id])
  const { data: attempts, refetch: refetchAttempts } = useIpc(
    () => window.electronAPI['db:quiz-attempts:list'](Number(id)),
    [id],
  )
  const { mutate } = useIpcMutation<QuizAttemptDto>()

  // Phase state machine
  const [phase, setPhase] = useState<Phase>('start')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [score, setScore] = useState<QuizScoreResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Page title
  useEffect(() => {
    if (quiz) {
      setCurrentPageTitle(`Take Quiz: ${quiz.title}`)
    } else {
      setCurrentPageTitle('Take Quiz')
    }
  }, [quiz, setCurrentPageTitle])

  // Timer
  useEffect(() => {
    if (phase === 'taking') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1)
      }, 1000)
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [phase])

  const questions = useMemo(() => quiz?.questions ?? [], [quiz?.questions])
  const currentQuestion = questions[currentQuestionIndex]
  const answeredCount = Object.keys(answers).filter((k) => answers[k] !== '').length
  const totalQuestions = questions.length

  // Handlers
  const handleStartQuiz = useCallback(() => {
    setPhase('taking')
    setElapsedSeconds(0)
  }, [])

  const handleSelectAnswer = useCallback((questionId: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [String(questionId)]: answer }))
  }, [])

  const handlePrevious = useCallback(() => {
    setCurrentQuestionIndex((i) => Math.max(0, i - 1))
  }, [])

  const handleNext = useCallback(() => {
    setCurrentQuestionIndex((i) => Math.min(totalQuestions - 1, i + 1))
  }, [totalQuestions])

  const handleSkip = useCallback(() => {
    setCurrentQuestionIndex((i) => Math.min(totalQuestions - 1, i + 1))
  }, [totalQuestions])

  const handleSubmit = useCallback(async () => {
    if (!quiz) return
    setSubmitting(true)
    const result = scoreQuiz(questions, answers)
    setScore(result)

    const attemptResult = await mutate(() =>
      window.electronAPI['db:quiz-attempts:create']({
        quiz_id: Number(id),
        score: Math.round(result.percentage),
        total_questions: result.totalQuestions,
        answers,
      }),
    )

    setSubmitting(false)
    if (attemptResult) {
      toast.success('Quiz submitted!')
      setPhase('results')
      refetchAttempts()
    } else {
      toast.error('Failed to save quiz attempt')
    }
  }, [quiz, questions, answers, id, mutate, refetchAttempts])

  const handleRetake = useCallback(() => {
    setPhase('start')
    setCurrentQuestionIndex(0)
    setAnswers({})
    setElapsedSeconds(0)
    setScore(null)
    setSubmitting(false)
    refetchAttempts()
  }, [refetchAttempts])

  // Guard clauses
  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex flex-col gap-4 p-6">
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-12 w-32" />
        </div>
      </div>
    )
  }

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

  // Phase rendering
  return (
    <div className="flex flex-1 flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 border-b px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Link to={`/quizzes/${id}`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          Quiz Details
        </Link>
      </div>

      {phase === 'start' && <StartScreen quiz={quiz} attempts={attempts ?? []} onStart={handleStartQuiz} />}

      {phase === 'taking' && currentQuestion && (
        <TakingScreen
          questions={questions}
          currentIndex={currentQuestionIndex}
          currentQuestion={currentQuestion}
          answers={answers}
          answeredCount={answeredCount}
          totalQuestions={totalQuestions}
          elapsedSeconds={elapsedSeconds}
          submitting={submitting}
          onSelectAnswer={handleSelectAnswer}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onSkip={handleSkip}
          onSubmit={handleSubmit}
          onJumpTo={setCurrentQuestionIndex}
        />
      )}

      {phase === 'results' && score && (
        <ResultsScreen
          score={score}
          elapsedSeconds={elapsedSeconds}
          onReview={() => setPhase('reviewing')}
          onRetake={handleRetake}
        />
      )}

      {phase === 'reviewing' && score && (
        <ReviewScreen
          questions={questions}
          answers={answers}
          score={score}
          onBackToResults={() => setPhase('results')}
          onRetake={handleRetake}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StartScreen
// ---------------------------------------------------------------------------
function StartScreen({
  quiz,
  attempts,
  onStart,
}: {
  quiz: { title: string; document_id: number; questions: QuizQuestionDto[]; difficulty_level?: string }
  attempts: Array<{ id: number; score: number; total_questions: number; completed_at: string }>
  onStart: () => void
}) {
  const questionCount = quiz.questions.length
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <GraduationCap className="h-8 w-8 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold">{quiz.title}</h2>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>
              {questionCount} {questionCount === 1 ? 'question' : 'questions'}
            </span>
            <DifficultyBadge difficulty={quiz.difficulty_level} />
            <Link
              to={`/documents/${quiz.document_id}`}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Source Document
            </Link>
          </div>
        </div>

        <Button size="lg" onClick={onStart} data-testid="start-quiz-btn">
          Start Quiz
        </Button>

        {attempts.length > 0 && (
          <div className="w-full space-y-2">
            <Separator />
            <h3 className="text-sm font-medium text-muted-foreground">Previous Attempts</h3>
            <div className="space-y-1">
              {attempts.map((a, i) => (
                <div key={a.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <span>Attempt {attempts.length - i}</span>
                  <span className="font-medium">{a.score}%</span>
                  <span className="text-xs text-muted-foreground">{new Date(a.completed_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TakingScreen
// ---------------------------------------------------------------------------
function TakingScreen({
  questions,
  currentIndex,
  currentQuestion,
  answers,
  answeredCount,
  totalQuestions,
  elapsedSeconds,
  submitting,
  onSelectAnswer,
  onPrevious,
  onNext,
  onSkip,
  onSubmit,
  onJumpTo,
}: {
  questions: QuizQuestionDto[]
  currentIndex: number
  currentQuestion: QuizQuestionDto
  answers: Record<string, string>
  answeredCount: number
  totalQuestions: number
  elapsedSeconds: number
  submitting: boolean
  onSelectAnswer: (questionId: number, answer: string) => void
  onPrevious: () => void
  onNext: () => void
  onSkip: () => void
  onSubmit: () => void
  onJumpTo: (index: number) => void
}) {
  const isFirst = currentIndex === 0
  const isLast = currentIndex === totalQuestions - 1
  const unansweredCount = totalQuestions - answeredCount
  const currentAnswer = answers[String(currentQuestion.id)] ?? ''
  const timerDisplay = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-4 p-6">
        {/* Progress and timer */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Progress
              value={(answeredCount / totalQuestions) * 100}
              aria-label={`${answeredCount} of ${totalQuestions} answered`}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {answeredCount} of {totalQuestions} answered
          </span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground" aria-live="polite">
            <Clock className="h-4 w-4" />
            {timerDisplay}
          </span>
        </div>

        {/* Question content */}
        <div className="space-y-4 transition-opacity duration-200">
          {/* Question header */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-lg font-semibold">{currentIndex + 1}.</span>
              <span className="flex-1 text-lg">{currentQuestion.question}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{typeBadgeLabel(currentQuestion.type)}</Badge>
              <DifficultyBadge difficulty={currentQuestion.difficulty} />
            </div>
          </div>

          {/* Answer input based on question type */}
          {currentQuestion.type === 'multiple-choice' && currentQuestion.options && (
            <RadioGroup
              value={currentAnswer}
              onValueChange={(value) => onSelectAnswer(currentQuestion.id, value)}
              className="space-y-2"
            >
              {currentQuestion.options.map((option, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 rounded-md border px-4 py-3 transition-colors',
                    currentAnswer === option ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <RadioGroupItem value={option} id={`option-${i}`} />
                  <Label htmlFor={`option-${i}`} className="flex-1 cursor-pointer">
                    <span className="mr-2 font-medium text-muted-foreground">{OPTION_LETTERS[i]}.</span>
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {currentQuestion.type === 'true-false' && (
            <div className="grid grid-cols-2 gap-4">
              {['True', 'False'].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={currentAnswer === value}
                  onClick={() => onSelectAnswer(currentQuestion.id, value)}
                  className={cn(
                    'flex h-24 items-center justify-center rounded-md border text-lg font-medium transition-colors',
                    currentAnswer === value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-input bg-background hover:bg-muted/50',
                  )}
                >
                  {currentAnswer === value && <Check className="mr-2 h-5 w-5" />}
                  {value}
                </button>
              ))}
            </div>
          )}

          {currentQuestion.type === 'short-answer' && (
            <div className="space-y-2">
              <Label htmlFor="short-answer-input">Your Answer</Label>
              <Input
                id="short-answer-input"
                placeholder="Type your answer..."
                value={currentAnswer}
                onChange={(e) => onSelectAnswer(currentQuestion.id, e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Question navigator pills */}
        <div className="flex flex-wrap gap-1.5" role="navigation" aria-label="Question navigator">
          {questions.map((q, i) => {
            const isAnswered = answers[String(q.id)] != null && answers[String(q.id)] !== ''
            const isCurrent = i === currentIndex
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onJumpTo(i)}
                aria-label={`Go to question ${i + 1}`}
                aria-current={isCurrent ? 'true' : undefined}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                  isCurrent
                    ? 'border-2 border-primary text-primary'
                    : isAnswered
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {i + 1}
              </button>
            )
          })}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={isFirst} onClick={onPrevious}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>

          <div className="flex gap-2">
            {!isLast && (
              <>
                <Button variant="ghost" size="sm" onClick={onSkip}>
                  <SkipForward className="mr-1 h-4 w-4" />
                  Skip
                </Button>
                <Button size="sm" onClick={onNext}>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={answeredCount === 0 || submitting} data-testid="submit-quiz-btn">
                  <Send className="mr-1 h-4 w-4" />
                  Submit
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Submit Quiz?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {unansweredCount > 0
                      ? `You answered ${answeredCount} of ${totalQuestions} questions. Unanswered questions will be marked as incorrect.`
                      : `You answered all ${totalQuestions} questions. Ready to submit?`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Go Back</AlertDialogCancel>
                  <AlertDialogAction onClick={onSubmit}>Submit</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}

// ---------------------------------------------------------------------------
// ResultsScreen
// ---------------------------------------------------------------------------
function ResultsScreen({
  score,
  elapsedSeconds,
  onReview,
  onRetake,
}: {
  score: QuizScoreResult
  elapsedSeconds: number
  onReview: () => void
  onRetake: () => void
}) {
  const scoreColor =
    score.percentage >= 80
      ? 'text-green-600 dark:text-green-400'
      : score.percentage >= 60
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400'

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col items-center gap-6 p-6">
        <Award className="h-16 w-16 text-muted-foreground" />

        <div className="text-center">
          <p className={cn('text-5xl font-bold', scoreColor)} data-testid="score-percentage">
            {Math.round(score.percentage)}%
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {score.totalCorrect}/{score.totalQuestions} correct
          </p>
        </div>

        <div className="w-full max-w-sm">
          <Progress value={score.percentage} />
        </div>

        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Time: {formatElapsedTime(elapsedSeconds)}</span>
        </div>

        {/* Per-type breakdown */}
        {score.breakdown.length > 1 && (
          <div className="w-full max-w-sm space-y-3">
            <Separator />
            <h3 className="text-sm font-medium">Breakdown by Type</h3>
            {score.breakdown.map((b) => (
              <div key={b.type} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <Badge variant="secondary">{typeBadgeLabel(b.type)}</Badge>
                  <span className="text-muted-foreground">
                    {b.correct}/{b.total} ({Math.round(b.percentage)}%)
                  </span>
                </div>
                <Progress value={b.percentage} className="h-2" />
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={onReview}>Review Answers</Button>
          <Button variant="outline" onClick={onRetake}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Retake Quiz
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}

// ---------------------------------------------------------------------------
// ReviewScreen
// ---------------------------------------------------------------------------
function ReviewScreen({
  questions,
  answers,
  score,
  onBackToResults,
  onRetake,
}: {
  questions: QuizQuestionDto[]
  answers: Record<string, string>
  score: QuizScoreResult
  onBackToResults: () => void
  onRetake: () => void
}) {
  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-4 p-6">
        {/* Summary */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBackToResults}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Results
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            Score: {Math.round(score.percentage)}% ({score.totalCorrect}/{score.totalQuestions})
          </span>
        </div>

        <Separator />

        {/* Question review cards */}
        {questions.map((q, index) => {
          const userAnswer = answers[String(q.id)] ?? ''
          const isAnswered = userAnswer !== ''
          let isCorrect = false
          if (isAnswered) {
            if (q.type === 'short-answer') {
              isCorrect = userAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
            } else {
              isCorrect = userAnswer === q.correct_answer
            }
          }

          return (
            <div key={q.id} className="space-y-3">
              {/* Question header */}
              <div className="flex items-start gap-2">
                <span className="font-semibold">{index + 1}.</span>
                <span className="flex-1">{q.question}</span>
                {isAnswered ? (
                  isCorrect ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      <Check className="mr-1 h-3 w-3" />
                      CORRECT
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <X className="mr-1 h-3 w-3" />
                      INCORRECT
                    </Badge>
                  )
                ) : (
                  <Badge variant="destructive">NO ANSWER</Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="secondary">{typeBadgeLabel(q.type)}</Badge>
                <DifficultyBadge difficulty={q.difficulty} />
              </div>

              {/* Answer comparison */}
              {q.type === 'multiple-choice' && q.options && (
                <div className="space-y-1 pl-5">
                  {q.options.map((option, i) => {
                    const isUserChoice = option === userAnswer
                    const isCorrectOption = option === q.correct_answer
                    return (
                      <div
                        key={i}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1',
                          isCorrectOption &&
                            'bg-green-100 font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400',
                          isUserChoice &&
                            !isCorrectOption &&
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                        )}
                      >
                        <span className="text-sm text-muted-foreground">{OPTION_LETTERS[i]}.</span>
                        {isCorrectOption && <Check className="h-4 w-4 text-green-600 dark:text-green-400" />}
                        {isUserChoice && !isCorrectOption && <X className="h-4 w-4 text-red-600 dark:text-red-400" />}
                        <span>{option}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {q.type === 'true-false' && (
                <div className="space-y-1 pl-5">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Your answer: </span>
                    <span
                      className={
                        isCorrect
                          ? 'font-bold text-green-600 dark:text-green-400'
                          : 'font-bold text-red-600 dark:text-red-400'
                      }
                    >
                      {isAnswered ? userAnswer : '—'}
                    </span>
                  </p>
                  {!isCorrect && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Correct answer: </span>
                      <span className="font-bold text-green-600 dark:text-green-400">{q.correct_answer}</span>
                    </p>
                  )}
                </div>
              )}

              {q.type === 'short-answer' && (
                <div className="space-y-1 pl-5">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Your answer: </span>
                    <span
                      className={
                        isCorrect
                          ? 'font-bold text-green-600 dark:text-green-400'
                          : 'font-bold text-red-600 dark:text-red-400'
                      }
                    >
                      {isAnswered ? userAnswer : '—'}
                    </span>
                  </p>
                  {!isCorrect && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Correct answer: </span>
                      <span className="font-bold text-green-600 dark:text-green-400">{q.correct_answer}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Explanation */}
              {q.explanation && (
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Explanation</p>
                  <p className="text-sm">{q.explanation}</p>
                </div>
              )}

              {index < questions.length - 1 && <Separator className="my-2" />}
            </div>
          )
        })}

        {/* Bottom buttons */}
        <Separator />
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBackToResults}>
            Back to Results
          </Button>
          <Button onClick={onRetake}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Retake Quiz
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}
