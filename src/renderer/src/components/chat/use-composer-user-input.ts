import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ChatBlock,
  UserInputAnswer,
  UserInputOption,
  UserInputQuestion
} from '../../agent/types'
import {
  allAnswered,
  answerFromOption,
  answerFromTypedText,
  answersByQuestionId,
  nextUnansweredIndex,
  orderedAnswers
} from './user-input-panel-logic'

export type PendingUserInputBlock = Extract<ChatBlock, { kind: 'user_input' }>

type ResolveUserInput = (
  blockId: string,
  action: { kind: 'submit'; answers: UserInputAnswer[] } | { kind: 'cancel' }
) => Promise<void>

/**
 * Drives the composer-docked ask-user panel. Owns the in-progress answer map
 * and the stepper index so both the panel (presentational) and the composer's
 * send/keyboard handlers (type-to-answer) operate on one source of truth.
 *
 * Selecting an option or typing an answer for the current question advances to
 * the next unanswered question, and auto-submits once the last one resolves —
 * so the common single-question case is a single click.
 */
export type ComposerUserInputController = {
  /** True when there is a pending block with at least one question to answer. */
  active: boolean
  block: PendingUserInputBlock | null
  questions: UserInputQuestion[]
  /** Index of the question currently shown in the panel. */
  index: number
  total: number
  currentQuestion: UserInputQuestion | null
  answers: Record<string, UserInputAnswer>
  isSelected: (questionId: string, optionLabel: string) => boolean
  isAnswered: (questionId: string) => boolean
  chooseOption: (question: UserInputQuestion, option: UserInputOption) => void
  /** Returns true when the text was consumed as the current question's answer. */
  submitTypedText: (text: string) => boolean
  goToIndex: (index: number) => void
  cancel: () => void
}

export function useComposerUserInput(
  block: PendingUserInputBlock | null,
  resolveUserInput: ResolveUserInput
): ComposerUserInputController {
  const [answers, setAnswers] = useState<Record<string, UserInputAnswer>>({})
  const [index, setIndex] = useState(0)
  // Synchronous one-shot guard: the store only flips block.status away from
  // 'pending' after the submit RPC resolves, so without this a rapid second
  // selection (double-click) would dispatch a second submit for the same ask
  // during the in-flight window. Re-armed when a fresh block arrives.
  const resolvedRef = useRef(false)

  const blockId = block?.id ?? null
  const blockAnswers = block?.answers
  useEffect(() => {
    setAnswers(answersByQuestionId(blockAnswers))
    setIndex(0)
    resolvedRef.current = false
  }, [blockId, blockAnswers])

  const questions = useMemo(() => block?.questions ?? [], [block])
  const total = questions.length
  const safeIndex = total > 0 ? Math.min(index, total - 1) : 0
  const currentQuestion = total > 0 ? questions[safeIndex] : null

  const applyAnswer = useCallback(
    (answer: UserInputAnswer) => {
      if (!block || resolvedRef.current) return
      const nextMap = { ...answers, [answer.id]: answer }
      setAnswers(nextMap)
      if (allAnswered(questions, nextMap)) {
        resolvedRef.current = true
        void resolveUserInput(block.id, {
          kind: 'submit',
          answers: orderedAnswers(questions, nextMap)
        })
        return
      }
      setIndex((current) => nextUnansweredIndex(questions, nextMap, current))
    },
    [answers, block, questions, resolveUserInput]
  )

  const chooseOption = useCallback(
    (question: UserInputQuestion, option: UserInputOption) => {
      applyAnswer(answerFromOption(question, option))
    },
    [applyAnswer]
  )

  const submitTypedText = useCallback(
    (text: string): boolean => {
      if (!currentQuestion || text.trim().length === 0) return false
      applyAnswer(answerFromTypedText(currentQuestion, text))
      return true
    },
    [applyAnswer, currentQuestion]
  )

  const cancel = useCallback(() => {
    if (!block || resolvedRef.current) return
    resolvedRef.current = true
    void resolveUserInput(block.id, { kind: 'cancel' })
  }, [block, resolveUserInput])

  const isSelected = useCallback(
    (questionId: string, optionLabel: string): boolean => {
      const answer = answers[questionId]
      return Boolean(answer && answer.label === optionLabel && answer.value === optionLabel)
    },
    [answers]
  )

  const isAnswered = useCallback(
    (questionId: string): boolean => Boolean(answers[questionId]),
    [answers]
  )

  return useMemo(
    () => ({
      active: Boolean(block) && total > 0,
      block,
      questions,
      index: safeIndex,
      total,
      currentQuestion,
      answers,
      isSelected,
      isAnswered,
      chooseOption,
      submitTypedText,
      goToIndex: setIndex,
      cancel
    }),
    [
      answers,
      block,
      cancel,
      chooseOption,
      currentQuestion,
      isAnswered,
      isSelected,
      questions,
      safeIndex,
      submitTypedText,
      total
    ]
  )
}
