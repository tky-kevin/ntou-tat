import type { Grade, CreditSummary } from '../../types'

import { emptyCredits } from '../../core/api/publicData'

export const creditSummaryFromGrades = (grades: Grade[]): CreditSummary => {
  const passed = grades.filter((grade) =>
    grade.score === null
      ? !/不及格|未通過|F/i.test(grade.letter ?? '')
      : grade.score >= 60,
  )
  const totalEarned = passed.reduce((total, grade) => total + grade.credits, 0)
  const requiredEarned = passed
    .filter((grade) => grade.required)
    .reduce((total, grade) => total + grade.credits, 0)
  return {
    ...emptyCredits,
    totalEarned,
    requiredEarned,
    electiveEarned: totalEarned - requiredEarned,
  }
}
