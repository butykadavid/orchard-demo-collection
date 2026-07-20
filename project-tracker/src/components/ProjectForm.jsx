import { useState, useEffect } from 'react'
import '../styles/ProjectForm.css'

function ProjectForm({ isOpen, onClose, onSubmit, onCancel, initialData, isEditing }) {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate] = useState('')
    const [supportUntil, setSupportUntil] = useState('')
    const [status, setStatus] = useState('in-progress')
    const [isDraft, setIsDraft] = useState(false)

    const resetForm = () => {
        setTitle('')
        setDescription('')
        setStartDate(new Date().toISOString().split('T')[0])
        setEndDate('')
        setSupportUntil('')
        setStatus('in-progress')
        setIsDraft(false)
    }

    useEffect(() => {
        if (!isOpen) return

        if (initialData) {
            setTitle(initialData.title || '')
            setDescription(initialData.description || '')
            setStartDate(initialData.startDate || new Date().toISOString().split('T')[0])
            setEndDate(initialData.endDate || '')
            setSupportUntil(initialData.supportUntil || '')
            setStatus(initialData.status || 'in-progress')
            setIsDraft(initialData.isDraft || false)
            return
        }

        resetForm()
    }, [initialData, isOpen])

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
            endDate,
            supportUntil,
            status,
            isDraft
        })

        if (!isEditing) {
            resetForm()
        }
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <p className="modal-eyebrow">{isEditing ? 'Edit project' : 'New project'}</p>
                        <h3>{isEditing ? 'Update your project' : 'Add a new project'}</h3>
                    </div>
                    <button type="button" className="icon-button" onClick={onClose} aria-label="Close form">
                        ×
                    </button>
                </div>

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

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="endDate">End Date</label>
                            <input
                                id="endDate"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="status">Status</label>
                            <select
                                id="status"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="form-input"
                            >
                                <option value="in-progress">In Progress</option>
                                <option value="done">Done</option>
                                <option value="failed">Failed</option>
                                <option value="in-support">In Support</option>
                            </select>
                        </div>
                    </div>

                    {status === 'in-support' && (
                        <div className="form-group">
                            <label htmlFor="supportUntil">Support Until</label>
                            <input
                                id="supportUntil"
                                type="date"
                                value={supportUntil}
                                onChange={(e) => setSupportUntil(e.target.value)}
                                className="form-input"
                            />
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="submit" className="btn btn-primary">
                            {isEditing ? 'Update Project' : 'Add Project'}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="btn btn-secondary"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default ProjectForm
