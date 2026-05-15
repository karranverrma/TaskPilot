import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

function ProjectCard({ project, onDelete }) {
  const { user } = useAuth();
  const canDelete = user.role === 'admin' || project.owner_id === user.id;

  return (
    <div className="card p-5 hover:border-amber-400/20 transition-all duration-150 group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <Link
            to={`/projects/${project.id}`}
            className="font-semibold text-white hover:text-amber-400 transition-colors block truncate"
          >
            {project.name}
          </Link>
          {project.description && (
            <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{project.description}</p>
          )}
        </div>
        {canDelete && (
          <button
            onClick={() => onDelete(project)}
            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all duration-150 flex-shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
        <span className="flex items-center gap-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
          </svg>
          {project.member_count} members
        </span>
        <span className="flex items-center gap-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
          </svg>
          {project.task_count} tasks
        </span>
        {project.my_role && (
          <span className={`ml-auto px-1.5 py-0.5 rounded text-xs ${
            project.my_role === 'admin' ? 'bg-amber-400/10 text-amber-400' : 'bg-surface-3 text-slate-400'
          }`}>
            {project.my_role}
          </span>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Link to={`/projects/${project.id}`} className="btn-ghost text-xs py-1.5 flex-1 text-center">
          Details
        </Link>
        <Link to={`/projects/${project.id}/tasks`} className="btn-primary text-xs py-1.5 flex-1 text-center">
          Tasks →
        </Link>
      </div>
    </div>
  );
}

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/projects').then(d => setProjects(d.projects)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/projects', form);
      setShowModal(false);
      setForm({ name: '', description: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await api.delete(`/projects/${deleteTarget.id}`);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Projects</h1>
          <p className="text-slate-500 text-sm">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          + New Project
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 bg-surface-3 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} className="w-6 h-6">
              <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
            </svg>
          </div>
          <p className="text-slate-400 font-medium mb-1">No projects yet</p>
          <p className="text-slate-500 text-sm mb-4">Create your first project to get started</p>
          <button onClick={() => setShowModal(true)} className="btn-primary">Create project</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Project">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Project name</label>
            <input className="input" placeholder="e.g. RiskGuard v2"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
            <textarea className="input resize-none h-20" placeholder="What is this project about?"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Project">
        <p className="text-slate-400 text-sm mb-4">
          Are you sure you want to delete <strong className="text-white">{deleteTarget?.name}</strong>?
          All tasks and members will be permanently removed.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteTarget(null)} className="btn-ghost flex-1">Cancel</button>
          <button onClick={confirmDelete} className="btn-danger flex-1">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
