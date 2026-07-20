import ProjectCard from './ProjectCard'
import '../styles/ProjectList.css'

function ProjectList({ projects, onEdit, onDelete }) {
    const sortedProjects = [...projects].sort((a, b) => a.startDate.localeCompare(b.startDate))
    const earliestStart = sortedProjects[0]?.startDate

    const getTimelineStyle = (project) => {
        if (!earliestStart) return { left: '0%', width: '0%' }

        const start = new Date(project.startDate + 'T00:00:00')
        const earliest = new Date(earliestStart + 'T00:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const endDate = project.endDate ? new Date(project.endDate + 'T00:00:00') : today
        const effectiveEnd = endDate > today ? today : endDate
        const totalSpan = Math.max(1, Math.ceil((today - earliest) / (1000 * 60 * 60 * 24)))
        const offset = Math.max(0, Math.ceil((start - earliest) / (1000 * 60 * 60 * 24)))
        const duration = Math.max(1, Math.ceil((effectiveEnd - start) / (1000 * 60 * 60 * 24)) + 1)
        const visibleDuration = Math.min(duration, totalSpan - offset)

        return {
            left: `${(offset / totalSpan) * 100}%`,
            width: `${(visibleDuration / totalSpan) * 100}%`
        }
    }

    const getSupportStyle = (project) => {
        if (!earliestStart || project.status !== 'in-support') return { left: '0%', width: '0%' }

        const start = new Date(project.startDate + 'T00:00:00')
        const earliest = new Date(earliestStart + 'T00:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const endDate = project.endDate ? new Date(project.endDate + 'T00:00:00') : start
        const supportStart = endDate > start ? endDate : start
        const supportUntil = project.supportUntil ? new Date(project.supportUntil + 'T00:00:00') : today
        const effectiveSupportEnd = supportUntil > today ? today : supportUntil

        if (effectiveSupportEnd <= supportStart) return { left: '0%', width: '0%' }

        const totalSpan = Math.max(1, Math.ceil((today - earliest) / (1000 * 60 * 60 * 24)))
        const offset = Math.max(0, Math.ceil((supportStart - earliest) / (1000 * 60 * 60 * 24)))
        const duration = Math.max(1, Math.ceil((effectiveSupportEnd - supportStart) / (1000 * 60 * 60 * 24)) + 1)
        const visibleDuration = Math.min(duration, totalSpan - offset)

        return {
            left: `${(offset / totalSpan) * 100}%`,
            width: `${(visibleDuration / totalSpan) * 100}%`
        }
    }

    return (
        <div className="projects-timeline">
            {sortedProjects.map((project) => (
                <div key={project.id} className="timeline-row">
                    <ProjectCard
                        project={project}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        isDraft={false}
                    />

                    <div className="timeline-track">
                        <div className="timeline-bar timeline-bar-base" style={getTimelineStyle(project)} />
                        {project.status === 'in-support' && (
                            <div className="timeline-bar timeline-bar-support" style={getSupportStyle(project)} />
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

export default ProjectList
