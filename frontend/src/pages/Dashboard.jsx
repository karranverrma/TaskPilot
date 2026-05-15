import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const statusConfig = {
  todo: { label: 'To Do', color: 'text-slate-400', bg: 'bg-slate-400' },
  in_progress: { label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-400' },
  done: { label: 'Done', color: 'text-green-400', bg: 'bg-green-400' },
};

const priorityConfig = {
  low: { label: 'Low', color: 'text-slate-400' },
  medium: { label: 'Medium', color: 'text-amber-400' },
  high: { label: 'High', color: 'text-red-400' },
};

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-3">{label}</p>
      <p className={`text-3xl font-bold ${accent || 'text-white'} mb-1`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function TaskRow({ task }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-3 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 font-medium truncate">{task.title}</p>
        <p className="text-xs text-slate-500 truncate">{task.project_name}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {task.due_date && (
          <span className={`text-xs font-mono ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
            {isOverdue ? '⚠ ' : ''}{new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        )}
        <span className={`badge-${task.status}`}>
          {statusConfig[task.status]?.label}
        </span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const statusMap = {};
  stats?.tasksByStatus?.forEach(s => { statusMap[s.status] = s.count; });
  const totalTasks = Object.values(statusMap).reduce((a, b) => a + b, 0);

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
          {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 text-sm">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Projects" value={stats?.totalProjects ?? 0} sub="accessible to you" />
        <StatCard label="Total Tasks" value={totalTasks} sub="across all projects" />
        <StatCard
          label="In Progress"
          value={statusMap.in_progress ?? 0}
          sub="being worked on"
          accent="text-blue-400"
        />
        <StatCard
          label="Overdue"
          value={stats?.overdueTasks?.length ?? 0}
          sub="past due date"
          accent={stats?.overdueTasks?.length > 0 ? 'text-red-400' : 'text-white'}
        />
      </div>

      {/* Progress bars */}
      {totalTasks > 0 && (
        <div className="card p-5 mb-6">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">Task Progress</p>
          <div className="space-y-3">
            {Object.entries(statusConfig).map(([key, cfg]) => {
              const count = statusMap[key] ?? 0;
              const pct = totalTasks ? Math.round((count / totalTasks) * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className={cfg.color}>{cfg.label}</span>
                    <span className="text-slate-500 font-mono">{count} / {totalTasks} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cfg.bg} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Tasks */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">My Tasks</p>
            <Link to="/projects" className="text-xs text-amber-400 hover:text-amber-300">View all →</Link>
          </div>
          {stats?.myTasks?.length > 0 ? (
            <div>{stats.myTasks.map(t => <TaskRow key={t.id} task={t} />)}</div>
          ) : (
            <p className="text-slate-500 text-sm py-4 text-center">No tasks assigned to you</p>
          )}
        </div>

        {/* Overdue / Recent */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
              {stats?.overdueTasks?.length > 0 ? '⚠ Overdue Tasks' : 'Recent Tasks'}
            </p>
          </div>
          {stats?.overdueTasks?.length > 0 ? (
            <div>{stats.overdueTasks.map(t => <TaskRow key={t.id} task={t} />)}</div>
          ) : stats?.recentTasks?.length > 0 ? (
            <div>{stats.recentTasks.map(t => <TaskRow key={t.id} task={t} />)}</div>
          ) : (
            <p className="text-slate-500 text-sm py-4 text-center">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
