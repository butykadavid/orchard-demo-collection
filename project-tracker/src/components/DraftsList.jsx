import ProjectCard from './ProjectCard'
import '../styles/DraftsList.css'

function DraftsList({ drafts, onStart, onEdit, onDelete }) {
    return (
        <div className="drafts-grid">
            {drafts.map((draft) => (
                <ProjectCard
                    key={draft.id}
                    project={draft}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    isDraft={true}
                    onStart={onStart}
                />
            ))}
        </div>
    )
}

export default DraftsList
