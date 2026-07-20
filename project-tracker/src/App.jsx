import { useState, useEffect } from 'react'
import { createStore } from '@orchardapp/sdk'
import './App.css'
import ProjectForm from './components/ProjectForm'
import DraftsList from './components/DraftsList'

function App() {
  const [state, setState] = useState({
    projects: [],
    drafts: []
  })
  const [editingId, setEditingId] = useState(null)
  const [editingData, setEditingData] = useState(null)
  const [store, setStore] = useState(null)

  // Initialize store on mount
  useEffect(() => {
    const projectStore = createStore('projectTrackerData', {
      projects: [],
      drafts: []
    })
    setStore(projectStore)

    projectStore.subscribe((newState) => {
      setState(newState)
    })
  }, [])

  const addProject = (projectData) => {
    if (!store) return

    const newProject = {
      id: Date.now().toString(),
      title: projectData.title,
      description: projectData.description,
      startDate: projectData.startDate || new Date().toISOString().split('T')[0],
      tags: projectData.tags || [],
      isDraft: projectData.isDraft || false
    }

    store.update((s) => {
      if (newProject.isDraft) {
        return { ...s, drafts: [...s.drafts, newProject] }
      }
      return { ...s, projects: [...s.projects, newProject] }
    })
  }

  const updateProject = (id, projectData) => {
    if (!store) return

    store.update((s) => {
      const updatedProject = {
        id,
        title: projectData.title,
        description: projectData.description,
        startDate: projectData.startDate,
        tags: projectData.tags || [],
        isDraft: projectData.isDraft || false
      }

      // Remove from current location
      let updatedProjects = s.projects.filter(p => p.id !== id)
      let updatedDrafts = s.drafts.filter(p => p.id !== id)

      // Add to new location
      if (updatedProject.isDraft) {
        updatedDrafts = [...updatedDrafts, updatedProject]
      } else {
        updatedProjects = [...updatedProjects, updatedProject]
      }

      return {
        projects: updatedProjects,
        drafts: updatedDrafts
      }
    })

    setEditingId(null)
    setEditingData(null)
  }

  const deleteProject = (id, isDraft = false) => {
    if (!store) return

    store.update((s) => {
      if (isDraft) {
        return { ...s, drafts: s.drafts.filter(p => p.id !== id) }
      }
      return { ...s, projects: s.projects.filter(p => p.id !== id) }
    })
  }

  const startDraftProject = (draftProject) => {
    if (!store) return

    const activeProject = {
      ...draftProject,
      isDraft: false,
      startDate: new Date().toISOString().split('T')[0]
    }

    store.update((s) => ({
      projects: [...s.projects, activeProject],
      drafts: s.drafts.filter(p => p.id !== draftProject.id)
    }))
  }

  const startEditing = (project, isDraft = false) => {
    setEditingId(project.id)
    setEditingData({ ...project, isDraft })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingData(null)
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h3>Hobby Project Tracker</h3>
      </header>

      <main className="app-main">
        <section className="form-section">
          <h2>{editingId ? 'Edit Project' : 'Add New Project'}</h2>
          <ProjectForm
            onSubmit={editingId ? (data) => updateProject(editingId, data) : addProject}
            onCancel={cancelEditing}
            initialData={editingData}
            isEditing={editingId !== null}
          />
        </section>

        {state.drafts && state.drafts.length > 0 && (
          <section className="drafts-section">
            <h2>📋 Draft Projects ({state.drafts.length})</h2>
            <DraftsList
              drafts={state.drafts}
              onStart={startDraftProject}
              onEdit={startEditing}
              onDelete={deleteProject}
            />
          </section>
        )}

        <section className="projects-section">
          <h2>🚀 Timeline ({state.projects ? state.projects.length : 0})</h2>
          {state.projects && state.projects.length > 0 ? (
            <ProjectTimeline
              projects={state.projects}
              onEdit={startEditing}
              onDelete={deleteProject}
            />
          ) : (
            <p className="empty-state">No active projects yet. Start one now!</p>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
