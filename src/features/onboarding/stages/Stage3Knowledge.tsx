/**
 * Stage3Knowledge — Prove Your Knowledge
 *
 * Presents AI-derived multiple-choice and true/false questions generated
 * from the existing RepositoryAnalysis. No extra AI calls.
 */

import { useState, useMemo } from 'react'
import { Button, Card, StatusBadge } from '../../../components/ui'
import { buildKnowledgeQuestions } from '../challengeBuilder'
import type { RepositoryAnalysis } from '../../../types'
import type { OnboardingStage } from '../questBuilder'
import type { BuiltQuestion } from '../challengeBuilder'

interface Props {
  analysis: RepositoryAnalysis
  stage: OnboardingStage
  onComplete: () => void
}

// ---------------------------------------------------------------------------
// Single question view
// ---------------------------------------------------------------------------

interface QuestionCardProps {
  question: BuiltQuestion
  index: number
  total: number
  onAnswer: (answerId: string) => void
}

function QuestionCard({ question, index, total, onAnswer }: QuestionCardProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  const selectedAnswer = selected ? question.answers.find((a) => a.id === selected) : null
  const isCorrect = selectedAnswer?.isCorrect ?? false

  function handleSelect(id: string) {
    if (revealed) return
    setSelected(id)
  }

  function handleSubmit() {
    if (!selected) return
    setRevealed(true)
  }

  function handleContinue() {
    onAnswer(selected!)
  }

  return (
    <div className="kq-question-card">
      <div className="kq-question-header">
        <span className="kq-question-num">Question {index + 1} of {total}</span>
        <span className="analysis-tag">{question.concept}</span>
      </div>

      <p className="kq-prompt">{question.prompt}</p>

      <div className="kq-answers">
        {question.answers.map((answer) => {
          let cls = 'kq-answer'
          if (revealed) {
            if (answer.isCorrect) cls += ' is-correct'
            else if (answer.id === selected && !answer.isCorrect) cls += ' is-wrong'
          } else if (answer.id === selected) {
            cls += ' is-selected'
          }
          return (
            <button
              key={answer.id}
              className={cls}
              onClick={() => handleSelect(answer.id)}
              disabled={revealed}
            >
              <span className="kq-answer-marker" />
              {answer.text}
            </button>
          )
        })}
      </div>

      {!revealed && (
        <div className="explore-step-actions">
          <Button onClick={handleSubmit} disabled={!selected}>
            Submit answer →
          </Button>
        </div>
      )}

      {revealed && (
        <div className={`kq-feedback ${isCorrect ? 'kq-feedback-correct' : 'kq-feedback-wrong'}`}>
          <div className="kq-feedback-header">
            <strong>{isCorrect ? '✓ Correct' : '✗ Incorrect'}</strong>
            <span className="kq-feedback-concept">{question.concept}</span>
          </div>
          <p>{question.explanation}</p>
          <div className="explore-step-actions">
            <Button onClick={handleContinue}>
              {index < total - 1 ? 'Next question →' : 'See results →'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Results summary
// ---------------------------------------------------------------------------

interface ResultsSummaryProps {
  questions: BuiltQuestion[]
  answers: Record<string, string>
  onComplete: () => void
  onRetry: () => void
}

function ResultsSummary({ questions, answers, onComplete, onRetry }: ResultsSummaryProps) {
  const results = questions.map((q) => {
    const answerId = answers[q.id]
    const answer = q.answers.find((a) => a.id === answerId)
    return { question: q, isCorrect: answer?.isCorrect ?? false }
  })
  const correct = results.filter((r) => r.isCorrect).length
  const total = questions.length
  const percent = Math.round((correct / total) * 100)
  const passed = percent >= 60

  return (
    <Card className="kq-results">
      <div className="kq-results-header">
        <div>
          <span className="card-label">Knowledge check complete</span>
          <h3>{correct} of {total} correct — {percent}%</h3>
          <p className="stage-description">
            {passed
              ? 'You demonstrated solid understanding of this codebase.'
              : 'Review the explanations below, then revisit the architecture stages if needed.'}
          </p>
        </div>
        <StatusBadge tone={passed ? 'complete' : 'neutral'}>
          {passed ? 'Passed' : 'Review needed'}
        </StatusBadge>
      </div>

      <div className="kq-results-list">
        {results.map((r, i) => (
          <div key={r.question.id} className={`kq-result-row ${r.isCorrect ? 'is-correct' : 'is-wrong'}`}>
            <span className="kq-result-icon">{r.isCorrect ? '✓' : '✗'}</span>
            <div className="kq-result-body">
              <span className="kq-result-q">Q{i + 1}: {r.question.prompt.length > 80
                ? r.question.prompt.slice(0, 80) + '…'
                : r.question.prompt}</span>
              {!r.isCorrect && (
                <span className="kq-result-explanation">{r.question.explanation}</span>
              )}
            </div>
            <span className="analysis-tag">{r.question.concept}</span>
          </div>
        ))}
      </div>

      <div className="explore-step-actions">
        {!passed && (
          <Button variant="ghost" onClick={onRetry}>Try again</Button>
        )}
        <Button onClick={onComplete}>
          {passed ? 'Continue to Investigation →' : 'Continue anyway →'}
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Stage3Knowledge({ analysis, stage, onComplete }: Props) {
  const questions = useMemo(() => buildKnowledgeQuestions(analysis), [analysis])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showResults, setShowResults] = useState(false)

  function handleAnswer(answerId: string) {
    const question = questions[currentIndex]
    const updated = { ...answers, [question.id]: answerId }
    setAnswers(updated)

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setShowResults(true)
    }
  }

  function handleRetry() {
    setCurrentIndex(0)
    setAnswers({})
    setShowResults(false)
  }

  if (questions.length === 0) {
    return (
      <div className="stage-content">
        <div className="stage-header">
          <div>
            <span className="card-label">{stage.tagline}</span>
            <h2>{stage.title}</h2>
          </div>
          <StatusBadge tone="neutral">Skipped</StatusBadge>
        </div>
        <Card>
          <p className="explore-empty">Not enough analysis data to generate questions. Continue to the next stage.</p>
          <div className="explore-step-actions">
            <Button onClick={onComplete}>Continue →</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="stage-content">
      <div className="stage-header">
        <div>
          <span className="card-label">{stage.tagline}</span>
          <h2>{stage.title}</h2>
          <p className="stage-description">{stage.description}</p>
        </div>
        <StatusBadge tone="active">In progress</StatusBadge>
      </div>

      {/* Progress dots */}
      <div className="kq-progress-row">
        {questions.map((q, i) => {
          const answered = q.id in answers
          const isCurrent = i === currentIndex && !showResults
          return (
            <span
              key={q.id}
              className={`kq-dot ${isCurrent ? 'is-current' : ''} ${answered ? 'is-answered' : ''}`}
              title={`Question ${i + 1}: ${q.concept}`}
            />
          )
        })}
        <span className="kq-progress-label">
          {showResults ? 'Complete' : `${currentIndex + 1} / ${questions.length}`}
        </span>
      </div>

      {!showResults ? (
        <QuestionCard
          key={`q-${currentIndex}`}
          question={questions[currentIndex]}
          index={currentIndex}
          total={questions.length}
          onAnswer={handleAnswer}
        />
      ) : (
        <ResultsSummary
          questions={questions}
          answers={answers}
          onComplete={onComplete}
          onRetry={handleRetry}
        />
      )}

      {/* Hint card showing what's being tested */}
      {!showResults && (
        <Card className="kq-hint-card">
          <p className="card-label">What's being tested</p>
          <p className="analysis-muted">
            These questions draw on the architecture components, key concepts, and dependencies
            identified in the analysis of <strong>{analysis.projectSummary.name}</strong>.
            No information is required beyond what you've already explored.
          </p>
        </Card>
      )}
    </div>
  )
}
