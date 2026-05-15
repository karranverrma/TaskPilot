import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [memberRole, setMemberRole] = useState('member');
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([
      api.get(`/projects/${id}`),
      api.get('/auth/users'),
    ]).then(([pd, ud]) => {
      setProject(pd.project);
      setMembers(pd.members);
      setAllUsers(ud.users);
      setEditForm({ name: pd.project.name, description: pd.project.description || '' });
    }).catch(() => navigate('/projects'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const isAdmin = user.role === 'admin' || project?.my_role === 'admin';

  const nonMembers = allUsers.filter(u => !members.find(m => m.id === u.id));

  const addMember = async () => {
    if (!selectedUserId) return;
    setError('');
    try {
      await api.post(`/projects/${id}/members`, { userId: selectedUserId, role: memberRole });
      setShowAddMember(false);
      setSelectedUserId('');
      setMemberRole('member');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeMember = async (userId) => {
    if (!window.confirm('Remove this member?')) return;
    await api.delete(`/projects/${id}/members/${userId}`);
    load();
  };

  const toggleRole = async (member) => {
    const newRole = member.project_role === 'admin' ? 'member' : 'admin';
    await api.patch(`/projects/${id}/members/${member.id}/role`, { role: newRole });
    load();
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    await api.put(`/projects/${id}`, editForm);
    setShowEdit(false);
    load();
  };

  if (loading) return (
    <div className="p-8 flex justify-center">
      <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-8 animate-fade-in max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link to="/projects" className="hover:text-slate-300">Projects</Link>
        <span>/</span>
        <span className="text-slate-300">{project?.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{project?.name}</h1>
          {project?.description && <p className="text-slate-400 text-sm">{project.description}</p>}
          <p className="text-xs text-slate-500 font-mono mt-1">
            Owned by {project?.owner_name} · Created {new Date(project?.created_at).toLocaleDateString('en-IN')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAdmin && (
            <button onClick={() => setShowEdit(true)} className="btn-ghost">Edit</button>
          )}
          <Link to={`/projects/${id}/tasks`} className="btn-primary">
            Open Tasks →
          </Link>
        </div>
      </div>

      {/* Members */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-3">
          <p className="font-semibold text-white text-sm">Team Members</p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">{members.length} members</span>
            {isAdmin && (
              <button onClick={() => setShowAddMember(true)} className="btn-primary text-xs py-1.5">
                + Add member
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-surface-3">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-8 h-8 rounded-full bg-surface-3 border border-surface-4 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-slate-300">{m.name?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-200 truncate">{m.name}</p>
                  {m.id === project?.owner_id && (
                    <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">owner</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                  m.project_role === 'admin'
                    ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                    : 'text-slate-400 bg-surface-3 border-surface-3'
                }`}>
                  {m.project_role}
                </span>
                {isAdmin && m.id !== project?.owner_id && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleRole(m)}
                      className="text-xs text-slate-500 hover:text-amber-400 px-2 py-1 rounded hover:bg-surface-3 transition-all"
                    >
                      {m.project_role === 'admin' ? '↓ member' : '↑ admin'}
                    </button>
                    <button
                      onClick={() => removeMember(m.id)}
                      className="text-slate-600 hover:text-red-400 p-1 rounded hover:bg-red-400/5 transition-all"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Member Modal */}
      <Modal open={showAddMember} onClose={() => { setShowAddMember(false); setError(''); }} title="Add Member">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Select user</label>
            <select
              className="input"
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
            >
              <option value="">— choose a user —</option>
              {nonMembers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Role in project</label>
            <div className="grid grid-cols-2 gap-2">
              {['member', 'admin'].map(r => (
                <button key={r} type="button"
                  onClick={() => setMemberRole(r)}
                  className={`py-2 rounded-lg border text-sm font-medium capitalize transition-all ${
                    memberRole === r ? 'bg-amber-400/10 border-amber-400/40 text-amber-400' : 'border-surface-3 text-slate-500 hover:border-slate-500'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowAddMember(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={addMember} className="btn-primary flex-1" disabled={!selectedUserId}>Add member</button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Project">
        <form onSubmit={saveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Project name</label>
            <input className="input" value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
            <textarea className="input resize-none h-20" value={editForm.description}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowEdit(false)} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Save changes</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
