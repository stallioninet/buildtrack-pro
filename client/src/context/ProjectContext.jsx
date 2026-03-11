import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.get('/projects');
      setProjects(data);

      // Restore last selected project from localStorage
      const savedId = localStorage.getItem(`bt_project_${user.id}`);
      const saved = savedId ? data.find(p => p.id === parseInt(savedId)) : null;

      if (saved) {
        setCurrentProject(saved);
      } else if (data.length > 0) {
        setCurrentProject(data[0]);
      } else {
        setCurrentProject(null);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const selectProject = useCallback((project) => {
    setCurrentProject(project);
    if (user && project) {
      localStorage.setItem(`bt_project_${user.id}`, String(project.id));
    }
  }, [user]);

  const refreshProjects = useCallback(() => {
    return loadProjects();
  }, [loadProjects]);

  return (
    <ProjectContext.Provider value={{
      projects,
      currentProject,
      selectProject,
      refreshProjects,
      loading,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider');
  return ctx;
}
