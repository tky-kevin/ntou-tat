import { X, FileText, ExternalLink, Trash2 } from 'lucide-react'
import type { CourseSummary } from '../../types'
import { useCourseFiles } from '../../core/api/hooks'

export function CourseSheet({
  course,
  onClose,
  onDeleteCourse,
}: {
  course: CourseSummary
  onClose: () => void
  onDeleteCourse?: (courseTitle: string) => void
}) {
  const { data: files = [], isLoading: loading } = useCourseFiles(course.id)

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="course-sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <button className="sheet-close" type="button" aria-label="關閉" onClick={onClose}>
          <X size={21} />
        </button>
        <div className="course-accent" style={{ background: course.color }} />
        <h2>{course.title}</h2>
        <div className="course-code">{course.code || '課程資料'}</div>
        <dl>
          <div><dt>授課教師</dt><dd>{course.instructor || '—'}</dd></div>
          <div><dt>上課地點</dt><dd>{course.classroom || '—'}</dd></div>
          <div><dt>學分</dt><dd>{course.credits || '—'}</dd></div>
        </dl>

        {onDeleteCourse ? (
          <button
            className="delete-course-btn"
            type="button"
            style={{
              width: '100%',
              height: '42px',
              marginTop: '12px',
              background: 'var(--danger-soft)',
              color: 'var(--danger)',
              border: '1px solid #69303e',
              borderRadius: '6px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onClick={() => onDeleteCourse(course.title)}
          >
            <Trash2 size={17} />
            刪除此課程
          </button>
        ) : null}

        <div className="section-label">課程檔案</div>
        {loading ? (
          <div className="loading-line" />
        ) : files.length ? (
          files.map((file) => (
            <a className="file-row" href={file.url} key={file.id} rel="noreferrer" target="_blank">
              <FileText size={19} />
              <span>{file.title}</span>
              <ExternalLink size={16} />
            </a>
          ))
        ) : (
          <div className="muted-row">尚未取得課程檔案</div>
        )}
      </section>
    </div>
  )
}
