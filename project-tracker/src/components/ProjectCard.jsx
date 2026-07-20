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
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }

    const daysActive = calculateDaysActive(project.startDate)

    if (isDraft) {
        return (
            <div className="project-card draft-card">
                <h3>{project.title}</h3>
                <div className="project-actions">
                    {onStart && (
                        <button onClick={() => onStart(project)} className="btn-icon launch" title="Start project">
                            🚀
                        </button>
                    )}
                    <button onClick={() => onEdit(project, isDraft)} className="btn-icon edit" title="Edit">
                        ✎
                    </button>
                    <button onClick={() => onDelete(project.id, isDraft)} className="btn-icon delete" title="Delete">
                        ✕
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="project-card timeline-row-card">
            <div className="timeline-content">
                <div className="timeline-header">
                    <div>
                        <h3>{project.title}</h3>
                        <p className="timeline-date">Started {formatDate(project.startDate)} • {daysActive} days</p>
                    </div>
                    <div className="project-actions">
                        <button onClick={() => onEdit(project, isDraft)} className="btn-icon edit" title="Edit">
                            ✎
                        </button>
                        <button onClick={() => onDelete(project.id, isDraft)} className="btn-icon delete" title="Delete">
                            ✕
                        </button>
                    </div>
                </div>

                {project.description && <p className="project-description">{project.description}</p>}

                <div className="project-meta-row">
                    {project.endDate && <span className="meta-pill">Ends {formatDate(project.endDate)}</span>}
                    {project.supportUntil && <span className="meta-pill">Support until {formatDate(project.supportUntil)}</span>}
                    <span className={`meta-pill status-${project.status || 'in-progress'}`}>{(project.status || 'in-progress').replace('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase())}</span>
                </div>
            </div>
        </div>
    )
}

export default ProjectCard
