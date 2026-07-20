import '../styles/ProjectCard.css'

function ProjectCard({ project, onEdit, onDelete, isDraft, onStart }) {
    const formatDate = (dateString) => {
        const date = new Date(dateString + 'T00:00:00')
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const calculateDaysActive = (startDate) => {
        const start = new Date(startDate + 'T00:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const diffTime = Math.abs(today - start)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
    }

    const daysActive = calculateDaysActive(project.startDate)

    return (
        <div className="project-card">
            <div className="project-header">
                <h3>{project.title}</h3>
                <div className="project-actions">
                    <button
                        onClick={() => onEdit(project, isDraft)}
                        className="btn-icon edit"
                        title="Edit"
                    >
                        ✎
                    </button>
                    <button
                        onClick={() => onDelete(project.id, isDraft)}
                        className="btn-icon delete"
                        title="Delete"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {project.description && (
                <p className="project-description">{project.description}</p>
            )}

            <div className="project-meta">
                <div className="date-info">
                    <span className="label">Started:</span>
                    <span className="value">{formatDate(project.startDate)}</span>
                    {!isDraft && (
                        <span className="days-active">({daysActive} days)</span>
                    )}
                </div>
            </div>

            {project.tags && project.tags.length > 0 && (
                <div className="project-tags">
                    {project.tags.map((tag, index) => (
                        <span key={index} className="tag-badge">
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {isDraft && onStart && (
                <button
                    onClick={() => onStart(project)}
                    className="btn btn-success start-btn"
                >
                    Start Now 🚀
                </button>
            )}
        </div>
    )
}

export default ProjectCard
