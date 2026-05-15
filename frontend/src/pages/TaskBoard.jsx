import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const STATUSES = [
  { key: 'todo', label: 'To Do', dot: 'bg-slate-500' },
  { key: 'in_progress', label: 'In Progress', dot: 'bg-blue-400' },
  { key: 'done', label: 'Done', dot: 'bg-green-400' },
];

const PRIORITIES = ['low', 'medium', 'high'];

function TaskCard({ task, onEdit, onDelete, canAdmin, isAssignee }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
  const canEdit = canAdmin || isAssignee;

  return (
    <div className="bg-surface-2 border border-surface-3 rounded-xl p-3.5 group hover:border-amber-400/20 transition-all duration-150">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-slate-200 leading-snug flex-1">{task.title}</p>
        {canEdit && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={() => onEdit(task)}
              className="text-slate-500 hover:text-amber-400 p-0.5 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            {canAdmin && (
              <button onClick={() => onDelete(task)}
                className="text-slate-500 hover:text-red-400 p-0.5 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {task.description && (
        <p className="text-xs text-slate-500 mb-2.5 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`badge-${task.priority}`}>{task.priority}</span>
        {task.assigned_to_name && (
          <span className="text-xs font-mono text-slate-500 bg-surface-3 px-1.5 py-0.5 rounded truncate max-w-[100px]">
            @{task.assigned_to_name.split(' ')[0]}
          </span>
        )}
        {task.due_date && (
          <span className={`text-xs font-mono ml-auto ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
            {isOverdue && '⚠ '}
            {new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </div>
  );
}

const emptyForm = { title: '', description: '', status: 'todo', priority: 'medium', assigned_to: '', due_date: '' };

export default function TaskBoard() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const load = useCallback(() => {
    Promise.all([
      api.get(`/projects/${projectId}`),
      api.get(`/projects/${projectId}/tasks`),
    ]).then(([pd, td]) => {
      setProject(pd.project);
      setMembers(pd.members);
      setTasks(td.tasks);
    }).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const isAdmin = user.role === 'admin' || project?.my_role === 'admin';

  const filtered = tasks.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  const byStatus = (s) => filtered.filter(t => t.status === s);

  const openCreate = (status = 'todo') => {
    setForm({ ...emptyForm, status });
    setEditingTask(null);
    setError('');
    setShowCreate(true);
  };

  const openEdit = (task) => {
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assigned_to: task.assigned_to || '',
      due_date: task.due_date || '',
    });
    setEditingTask(task);
    setError('');
    setShowCreate(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const payload = {
      ...form,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
    };
    try {
      if (editingTask) {
        await api.put(`/projects/${projectId}/tasks/${editingTask.id}`, payload);
      } else {
        await api.post(`/projects/${projectId}/tasks`, payload);
      }
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTask = async () => {
    if (!deleteTarget) return;
    await api.delete(`/projects/${projectId}/tasks/${deleteTarget.id}`);
    setDeleteTarget(null);
    load();
  };

  const quickStatus = async (task, newStatus) => {
    await api.put(`/projects/${projectId}/tasks/${task.id}`, { status: newStatus });
    load();
  };

  if (loading) return (
    <div className="p-8 flex justify-center">
      <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="h-screen flex flex-col animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-surface-3 bg-surface-1 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-0.5">
              <Link to="/projects" className="hover:text-slate-300">Projects</Link>
              <span>/</span>
              <Link to={`/projects/${projectId}`} className="hover:text-slate-300">{project?.name}</Link>
              <span>/</span>
              <span className="text-slate-300">Tasks</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filters */}
          <select
            className="bg-surface-2 border border-surface-3 text-slate-400 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-400/50"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">All status</option>
            {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select
            className="bg-surface-2 border border-surface-3 text-slate-400 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-400/50"
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
          >
            <option value="">All priority</option>
            {PRIORITIES.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
          </select>
          <button onClick={() => openCreate()} className="btn-primary text-xs py-1.5">
            + Add Task
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-4 h-full min-w-max">
          {STATUSES.map(col => {
            const colTasks = byStatus(col.key);
            return (
              <div key={col.key} className="w-72 flex-shrink-0 flex flex-col">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className="text-sm font-semibold text-slate-300">{col.label}</span>
                    <span className="text-xs font-mono text-slate-600 bg-surface-3 px-1.5 py-0.5 rounded">
                      {colTasks.length}
                    </span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => openCreate(col.key)}
                      className="text-slate-600 hover:text-amber-400 transition-colors text-lg leading-none"
                    >+</button>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-2.5 overflow-y-auto">
                  {colTasks.map(task => (
                    <div key={task.id}>
                      <TaskCard
                        task={task}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                        canAdmin={isAdmin}
                        isAssignee={task.assigned_to === user.id}
                      />
                      {/* Quick status move */}
                      {(isAdmin || task.assigned_to === user.id) && (
                        <div className="flex gap-1 mt-1 px-0.5 opacity-0 hover:opacity-100 transition-opacity">
                          {STATUSES.filter(s => s.key !== col.key).map(s => (
                            <button
                              key={s.key}
                              onClick={() => quickStatus(task, s.key)}
                              className="flex-1 text-xs text-slate-600 hover:text-slate-300 bg-surface-2 hover:bg-surface-3 border border-surface-3 rounded px-1.5 py-0.5 transition-all"
                            >
                              → {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {colTasks.length === 0 && (
                    <div className="border-2 border-dashed border-surface-3 rounded-xl p-6 text-center">
                      <p className="text-xs text-slate-600">No tasks</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={editingTask ? 'Edit Task' : 'New Task'}
      >
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
            <input className="input" placeholder="Task title"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
            <textarea className="input resize-none h-16 text-xs" placeholder="Optional details"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
              <select className="input text-xs" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Priority</label>
              <select className="input text-xs" value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
          </div>
          {isAdmin && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Assign to</label>
                <select className="input text-xs" value={form.assigned_to}
                  onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Due date</label>
                <input className="input text-xs" type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={submitting}>
              {submitting ? 'Saving…' : editingTask ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Task">
        <p className="text-slate-400 text-sm mb-4">
          Delete <strong className="text-white">"{deleteTarget?.title}"</strong>? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteTarget(null)} className="btn-ghost flex-1">Cancel</button>
          <button onClick={deleteTask} className="btn-danger flex-1">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
