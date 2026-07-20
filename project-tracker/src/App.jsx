import { useState, useEffect } from 'react'
import { createStore } from '@orchardapp/sdk'
import './App.css'
import ProjectForm from './components/ProjectForm'
import DraftsList from './components/DraftsList'
import ProjectList from './components/ProjectList'

function App() {
  const [state, setState] = useState({
    projects: [],
    drafts: []
  })
  const [editingId, setEditingId] = useState(null)
  const [editingData, setEditingData] = useState(null)
  const [store, setStore] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

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
      endDate: projectData.endDate || '',
      status: projectData.status || 'active',
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
        endDate: projectData.endDate || '',
        status: projectData.status || 'active',
        isDraft: projectData.isDraft || false
      }

      let updatedProjects = s.projects.filter((p) => p.id !== id)
      let updatedDrafts = s.drafts.filter((p) => p.id !== id)

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
        return { ...s, drafts: s.drafts.filter((p) => p.id !== id) }
      }
      return { ...s, projects: s.projects.filter((p) => p.id !== id) }
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
      drafts: s.drafts.filter((p) => p.id !== draftProject.id)
    }))
  }

  const openProjectForm = (project = null, isDraft = false) => {
    if (project) {
      setEditingId(project.id)
      setEditingData({ ...project, isDraft })
    } else {
      setEditingId(null)
      setEditingData(null)
    }
    setIsFormOpen(true)
  }

  const closeProjectForm = () => {
    setEditingId(null)
    setEditingData(null)
    setIsFormOpen(false)
  }

  const startEditing = (project, isDraft = false) => {
    openProjectForm(project, isDraft)
  }

  const cancelEditing = () => {
    closeProjectForm()
  }

  const handleFormSubmit = (projectData) => {
    if (editingId) {
      updateProject(editingId, projectData)
    } else {
      addProject(projectData)
    }
    closeProjectForm()
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <button className="hero-action" onClick={() => openProjectForm()}>
          + Add Project
        </button>
      </header>

      <main className="app-main">
        {state.drafts && state.drafts.length > 0 && (
          <section className="drafts-section">
            <div className="section-heading">
              <div>
                <h2>Drafts</h2>
                <p>{state.drafts.length} ideas waiting for the right moment.</p>
              </div>
            </div>
            <DraftsList
              drafts={state.drafts}
              onStart={startDraftProject}
              onEdit={startEditing}
              onDelete={deleteProject}
            />
          </section>
        )}

        <section className="projects-section">
          <div className="section-heading">
            <div>
              <h2>Timeline</h2>
              <p>{state.projects ? state.projects.length : 0} active projects.</p>
            </div>
          </div>
          {state.projects && state.projects.length > 0 ? (
            <ProjectList
              projects={state.projects}
              onEdit={startEditing}
              onDelete={deleteProject}
            />
          ) : (
            <p className="empty-state">No active projects yet. Start one now.</p>
          )}
        </section>
      </main>

      <ProjectForm
        isOpen={isFormOpen}
        onClose={closeProjectForm}
        onSubmit={handleFormSubmit}
        onCancel={cancelEditing}
        initialData={editingData}
        isEditing={editingId !== null}
      />
    </div>
  )
}

export default App
