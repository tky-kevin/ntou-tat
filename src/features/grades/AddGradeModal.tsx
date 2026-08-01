import React, { useState } from 'react'
import { X } from 'lucide-react'

export function AddGradeModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (name: string, credits: number, score: number | null, required: boolean, category: string) => void
}) {
  const [name, setName] = useState('')
  const [credits, setCredits] = useState(3)
  const [scoreText, setScoreText] = useState('85')
  const [required, setRequired] = useState(true)
  const [category, setCategory] = useState('必修')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      alert('請輸入課程名稱！')
      return
    }
    const scoreVal = scoreText.trim()
    const numericScore = Number(scoreVal)
    const finalScore = Number.isFinite(numericScore) && scoreVal !== '' ? numericScore : null

    onSave(
      name.trim(),
      credits,
      finalScore,
      required,
      category
    )
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="course-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <button className="sheet-close" type="button" aria-label="關閉" onClick={onClose}>
          <X size={21} />
        </button>
        <h2>新增模擬成績</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px', marginTop: '14px' }}>
          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>科目名稱</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ padding: '8px 10px', background: '#252a30', border: '1px solid var(--line-strong)', borderRadius: '6px', color: '#fff' }}
              placeholder="例如：熱力學"
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <label style={{ display: 'grid', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>學分</span>
              <input
                type="number"
                min={1}
                max={10}
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                style={{ padding: '8px 10px', background: '#252a30', border: '1px solid var(--line-strong)', borderRadius: '6px', color: '#fff' }}
              />
            </label>
            <label style={{ display: 'grid', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>分數 (0-100 或 letter)</span>
              <input
                type="text"
                value={scoreText}
                onChange={(e) => setScoreText(e.target.value)}
                style={{ padding: '8px 10px', background: '#252a30', border: '1px solid var(--line-strong)', borderRadius: '6px', color: '#fff' }}
                placeholder="例如：85 或 A+"
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>科目選別</span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setRequired(e.target.value === '必修')
              }}
              style={{ padding: '8px', background: '#252a30', border: '1px solid var(--line-strong)', borderRadius: '6px', color: '#fff' }}
            >
              <option value="必修">必修</option>
              <option value="選修">選修</option>
              <option value="通識">通識</option>
            </select>
          </label>

          <button
            type="submit"
            style={{
              padding: '10px 20px',
              background: 'var(--brand)',
              color: '#fff',
              fontWeight: 800,
              borderRadius: '6px',
              marginTop: '8px',
            }}
          >
            儲存模擬成績
          </button>
        </form>
      </section>
    </div>
  )
}
