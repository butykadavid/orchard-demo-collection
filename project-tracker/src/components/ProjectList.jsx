import ProjectCard from './ProjectCard'
import '../styles/ProjectList.css'

function ProjectList({ projects, onEdit, onDelete }) {
    return (
        <div className="projects-grid">
            {projects.map((project) => (
                <ProjectCard
                    key={project.id}
                    project={project}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    isDraft={false}
                />
            ))}
        </div>
    )
}

export default ProjectList
