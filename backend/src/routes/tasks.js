const router = require('express').Router({ mergeParams: true });
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const getMembership = (projectId, userId) =>
  db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);

const canAccessProject = (projectId, user) => {
  if (user.role === 'admin') return true;
  return !!getMembership(projectId, user.id);
};

const isProjectAdmin = (projectId, user) => {
  if (user.role === 'admin') return true;
  const m = getMembership(projectId, user.id);
  return m?.role === 'admin';
};

// GET /api/projects/:projectId/tasks
router.get('/', authenticate, (req, res) => {
  if (!canAccessProject(req.params.projectId, req.user)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { status, priority, assigned_to } = req.query;
  let query = `
    SELECT t.*,
      u1.name as assigned_to_name,
      u2.name as created_by_name
    FROM tasks t
    LEFT JOIN users u1 ON u1.id = t.assigned_to
    LEFT JOIN users u2 ON u2.id = t.created_by
    WHERE t.project_id = ?
  `;
  const params = [req.params.projectId];

  if (status) { query += ' AND t.status = ?'; params.push(status); }
  if (priority) { query += ' AND t.priority = ?'; params.push(priority); }
  if (assigned_to) { query += ' AND t.assigned_to = ?'; params.push(assigned_to); }

  query += ' ORDER BY t.created_at DESC';
  const tasks = db.prepare(query).all(...params);
  res.json({ tasks });
});

// POST /api/projects/:projectId/tasks
router.post('/', authenticate, (req, res) => {
  if (!canAccessProject(req.params.projectId, req.user)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { title, description, status, priority, assigned_to, due_date } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Task title is required' });

  const validStatuses = ['todo', 'in_progress', 'done'];
  const validPriorities = ['low', 'medium', 'high'];

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (priority && !validPriorities.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority' });
  }

  // Validate assigned user is in project
  if (assigned_to) {
    const isMember = db.prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(req.params.projectId, assigned_to);
    if (!isMember && req.user.role !== 'admin') {
      return res.status(400).json({ error: 'Assigned user must be a project member' });
    }
  }

  const result = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.projectId,
    title.trim(),
    description?.trim() || '',
    status || 'todo',
    priority || 'medium',
    assigned_to || null,
    due_date || null,
    req.user.id
  );

  const task = db.prepare(`
    SELECT t.*, u1.name as assigned_to_name, u2.name as created_by_name
    FROM tasks t
    LEFT JOIN users u1 ON u1.id = t.assigned_to
    LEFT JOIN users u2 ON u2.id = t.created_by
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ task });
});

// GET /api/projects/:projectId/tasks/:taskId
router.get('/:taskId', authenticate, (req, res) => {
  if (!canAccessProject(req.params.projectId, req.user)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const task = db.prepare(`
    SELECT t.*, u1.name as assigned_to_name, u2.name as created_by_name
    FROM tasks t
    LEFT JOIN users u1 ON u1.id = t.assigned_to
    LEFT JOIN users u2 ON u2.id = t.created_by
    WHERE t.id = ? AND t.project_id = ?
  `).get(req.params.taskId, req.params.projectId);

  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({ task });
});

// PUT /api/projects/:projectId/tasks/:taskId
router.put('/:taskId', authenticate, (req, res) => {
  if (!canAccessProject(req.params.projectId, req.user)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?')
    .get(req.params.taskId, req.params.projectId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Members can only update status of tasks assigned to them
  const canAdmin = isProjectAdmin(req.params.projectId, req.user);
  if (!canAdmin && task.assigned_to !== req.user.id) {
    // Members can only see the task, not edit it unless assigned
    return res.status(403).json({ error: 'Only project admins or the assignee can edit tasks' });
  }

  const { title, description, status, priority, assigned_to, due_date } = req.body;

  const updated = {
    title: canAdmin ? (title?.trim() || task.title) : task.title,
    description: canAdmin ? (description?.trim() ?? task.description) : task.description,
    status: status || task.status,
    priority: canAdmin ? (priority || task.priority) : task.priority,
    assigned_to: canAdmin ? (assigned_to !== undefined ? assigned_to : task.assigned_to) : task.assigned_to,
    due_date: canAdmin ? (due_date !== undefined ? due_date : task.due_date) : task.due_date,
  };

  db.prepare(`
    UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?,
      assigned_to = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(updated.title, updated.description, updated.status, updated.priority,
    updated.assigned_to, updated.due_date, req.params.taskId);

  const updatedTask = db.prepare(`
    SELECT t.*, u1.name as assigned_to_name, u2.name as created_by_name
    FROM tasks t
    LEFT JOIN users u1 ON u1.id = t.assigned_to
    LEFT JOIN users u2 ON u2.id = t.created_by
    WHERE t.id = ?
  `).get(req.params.taskId);

  res.json({ task: updatedTask });
});

// DELETE /api/projects/:projectId/tasks/:taskId
router.delete('/:taskId', authenticate, (req, res) => {
  if (!isProjectAdmin(req.params.projectId, req.user)) {
    return res.status(403).json({ error: 'Only project admins can delete tasks' });
  }
  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND project_id = ?')
    .get(req.params.taskId, req.params.projectId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.taskId);
  res.json({ message: 'Task deleted' });
});

module.exports = router;
