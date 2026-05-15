const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// Helper: check project access
const getProjectMembership = (projectId, userId) =>
  db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);

const isProjectAdmin = (projectId, user) => {
  if (user.role === 'admin') return true;
  const m = getProjectMembership(projectId, user.id);
  return m?.role === 'admin';
};

// GET /api/projects - list accessible projects
router.get('/', authenticate, (req, res) => {
  let projects;
  if (req.user.role === 'admin') {
    projects = db.prepare(`
      SELECT p.*, u.name as owner_name,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      ORDER BY p.created_at DESC
    `).all();
  } else {
    projects = db.prepare(`
      SELECT p.*, u.name as owner_name, pm.role as my_role,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
      ORDER BY p.created_at DESC
    `).all(req.user.id);
  }
  res.json({ projects });
});

// POST /api/projects - create project
router.post('/', authenticate, (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Project name is required' });

  const tx = db.transaction(() => {
    const proj = db.prepare(
      'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)'
    ).run(name.trim(), description?.trim() || '', req.user.id);

    // Owner auto-joins as admin
    db.prepare(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
    ).run(proj.lastInsertRowid, req.user.id, 'admin');

    return proj.lastInsertRowid;
  });

  const id = tx();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json({ project });
});

// GET /api/projects/:id
router.get('/:id', authenticate, (req, res) => {
  const project = db.prepare(`
    SELECT p.*, u.name as owner_name
    FROM projects p JOIN users u ON u.id = p.owner_id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Access check
  if (req.user.role !== 'admin') {
    const m = getProjectMembership(req.params.id, req.user.id);
    if (!m) return res.status(403).json({ error: 'Access denied' });
    project.my_role = m.role;
  } else {
    project.my_role = 'admin';
  }

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.role as global_role, pm.role as project_role, pm.joined_at
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
    ORDER BY pm.joined_at
  `).all(req.params.id);

  res.json({ project, members });
});

// PUT /api/projects/:id
router.put('/:id', authenticate, (req, res) => {
  if (!isProjectAdmin(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Only project admins can update projects' });
  }
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Project name is required' });

  db.prepare('UPDATE projects SET name = ?, description = ? WHERE id = ?')
    .run(name.trim(), description?.trim() || '', req.params.id);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ project });
});

// DELETE /api/projects/:id
router.delete('/:id', authenticate, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the project owner or global admin can delete this project' });
  }

  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ message: 'Project deleted' });
});

// POST /api/projects/:id/members - add member
router.post('/:id/members', authenticate, (req, res) => {
  if (!isProjectAdmin(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Only project admins can add members' });
  }
  const { userId, role } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  try {
    db.prepare(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
    ).run(req.params.id, userId, role === 'admin' ? 'admin' : 'member');
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'User is already a member' });
    }
    throw err;
  }

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.role as global_role, pm.role as project_role
    FROM project_members pm JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
  `).all(req.params.id);

  res.status(201).json({ members });
});

// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', authenticate, (req, res) => {
  if (!isProjectAdmin(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Only project admins can remove members' });
  }
  // Prevent removing the owner
  const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(req.params.id);
  if (project.owner_id == req.params.userId) {
    return res.status(400).json({ error: 'Cannot remove the project owner' });
  }
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?')
    .run(req.params.id, req.params.userId);
  res.json({ message: 'Member removed' });
});

// PATCH /api/projects/:id/members/:userId/role
router.patch('/:id/members/:userId/role', authenticate, (req, res) => {
  if (!isProjectAdmin(req.params.id, req.user)) {
    return res.status(403).json({ error: 'Only project admins can change roles' });
  }
  const { role } = req.body;
  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or member' });
  }
  db.prepare('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?')
    .run(role, req.params.id, req.params.userId);
  res.json({ message: 'Role updated' });
});

module.exports = router;
