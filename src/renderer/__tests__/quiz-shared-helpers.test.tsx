/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { typeBadgeLabel, OPTION_LETTERS } from '@renderer/components/quiz/question-utils'

// Mock Badge component for jsdom
vi.mock('@renderer/components/ui/badge', () => ({
  Badge: ({ children, variant, ...props }: any) => (
    <span data-variant={variant} data-testid="badge" {...props}>
      {children}
    </span>
  ),
}))

describe('question-utils', () => {
  describe('typeBadgeLabel', () => {
    it('should return "MCQ" for multiple-choice', () => {
      expect(typeBadgeLabel('multiple-choice')).toBe('MCQ')
    })

    it('should return "T/F" for true-false', () => {
      expect(typeBadgeLabel('true-false')).toBe('T/F')
    })

    it('should return "Short Answer" for short-answer', () => {
      expect(typeBadgeLabel('short-answer')).toBe('Short Answer')
    })

    it('should return "Question" for unknown type', () => {
      expect(typeBadgeLabel('unknown')).toBe('Question')
      expect(typeBadgeLabel(undefined)).toBe('Question')
    })
  })

  describe('OPTION_LETTERS', () => {
    it('should contain A through H', () => {
      expect(OPTION_LETTERS).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    })
  })
})

describe('DifficultyBadge', () => {
  it('should render a Badge with capitalized difficulty text', async () => {
    const { DifficultyBadge } = await import('@renderer/components/quiz/difficulty-badge')
    render(<DifficultyBadge difficulty="easy" />)
    expect(screen.getByTestId('badge')).toHaveTextContent('Easy')
  })

  it('should return null for undefined difficulty', async () => {
    const { DifficultyBadge } = await import('@renderer/components/quiz/difficulty-badge')
    const { container } = render(<DifficultyBadge difficulty={undefined} />)
    expect(container.innerHTML).toBe('')
  })
})
