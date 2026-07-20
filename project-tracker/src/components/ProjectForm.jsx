import { useState, useEffect } from 'react'
import '../styles/ProjectForm.css'

function ProjectForm({ onSubmit, onCancel, initialData, isEditing }) {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [tagInput, setTagInput] = useState('')
    const [tags, setTags] = useState([])
    const [isDraft, setIsDraft] = useState(false)

    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title)
            setDescription(initialData.description)
            setStartDate(initialData.startDate)
            setTags(initialData.tags || [])
            setIsDraft(initialData.isDraft || false)
            setTagInput('')
        }
    }, [initialData])

    const handleAddTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            const newTag = tagInput.trim().startsWith('#') ? tagInput.trim() : `#${tagInput.trim()}`
            setTags([...tags, newTag])
            setTagInput('')
        }
    }

    const handleRemoveTag = (index) => {
        setTags(tags.filter((_, i) => i !== index))
    }

    const handleSubmit = (e) => {
        e.preventDefault()

        if (!title.trim()) {
            alert('Please enter a project title')
            return
        }

        onSubmit({
            title: title.trim(),
            description: description.trim(),
            startDate,
            tags,
            isDraft
        })

        // Reset form if not editing
        if (!isEditing) {
            setTitle('')
            setDescription('')
            setStartDate(new Date().toISOString().split('T')[0])
            setTags([])
            setTagInput('')
            setIsDraft(false)
        }
    }

    return (
        <form className="project-form" onSubmit={handleSubmit}>
            <div className="form-group">
                <label htmlFor="title">Project Title *</label>
                <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Build a personal website"
                    className="form-input"
                />
            </div>

            <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's your project about?"
                    className="form-textarea"
                    rows={4}
                />
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label htmlFor="startDate">Start Date</label>
                    <input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="form-input"
                    />
                </div>

                <div className="form-group checkbox">
                    <label htmlFor="isDraft">
                        <input
                            id="isDraft"
                            type="checkbox"
                            checked={isDraft}
                            onChange={(e) => setIsDraft(e.target.checked)}
                        />
                        Save as Draft
                    </label>
                </div>
            </div>

            <div className="form-group">
                <label htmlFor="tags">Hashtags</label>
                <div className="tag-input-group">
                    <input
                        id="tags"
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                handleAddTag()
                            }
                        }}
                        placeholder="Add a tag and press Enter"
                        className="form-input"
                    />
                    <button
                        type="button"
                        onClick={handleAddTag}
                        className="btn btn-secondary"
                    >
                        Add Tag
                    </button>
                </div>

                {tags.length > 0 && (
                    <div className="tags-display">
                        {tags.map((tag, index) => (
                            <span key={index} className="tag">
                                {tag}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveTag(index)}
                                    className="tag-remove"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                    {isEditing ? 'Update Project' : 'Add Project'}
                </button>
                {isEditing && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="btn btn-secondary"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    )
}

export default ProjectForm
