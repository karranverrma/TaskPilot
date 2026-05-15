const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// GET /api/dashboard
router.get('/', authenticate, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  let stats = {};

  if (isAdmin) {
    // Admin sees everything
    stats.totalProjects = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
    stats.totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;

    stats.tasksByStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM tasks GROUP BY status
    `).all();

    stats.tasksByPriority = db.prepare(`
      SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority
    `).all();

    stats.overdueTasks = db.prepare(`
      SELECT t.*, p.name as project_name, u.name as assigned_to_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.due_date < ? AND t.status != 'done'
      ORDER BY t.due_date ASC
      LIMIT 10
    `).all(today);

    stats.recentTasks = db.prepare(`
      SELECT t.*, p.name as project_name, u.name as assigned_to_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON u.id = t.assigned_to
      ORDER BY t.created_at DESC
      LIMIT 8
    `).all();

    stats.myTasks = db.prepare(`
      SELECT t.*, p.name as project_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.assigned_to = ? AND t.status != 'done'
      ORDER BY t.due_date IS NULL, t.due_date ASC
      LIMIT 5
    `).all(userId);

  } else {
    // Member sees only their data
    stats.totalProjects = db.prepare(
      'SELECT COUNT(*) as c FROM project_members WHERE user_id = ?'
    ).get(userId).c;

    stats.tasksByStatus = db.prepare(`
      SELECT t.status, COUNT(*) as count
      FROM tasks t
      JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
      GROUP BY t.status
    `).all(userId);

    stats.tasksByPriority = db.prepare(`
      SELECT t.priority, COUNT(*) as count
      FROM tasks t
      JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
      GROUP BY t.priority
    `).all(userId);

    stats.overdueTasks = db.prepare(`
      SELECT t.*, p.name as project_name, u.name as assigned_to_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.due_date < ? AND t.status != 'done'
      ORDER BY t.due_date ASC
      LIMIT 10
    `).all(userId, today);

    stats.myTasks = db.prepare(`
      SELECT t.*, p.name as project_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.assigned_to = ? AND t.status != 'done'
      ORDER BY t.due_date IS NULL, t.due_date ASC
      LIMIT 8
    `).all(userId);

    stats.recentTasks = db.prepare(`
      SELECT t.*, p.name as project_name, u.name as assigned_to_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
      LEFT JOIN users u ON u.id = t.assigned_to
      ORDER BY t.created_at DESC
      LIMIT 8
    `).all(userId);
  }

  res.json(stats);
});

module.exports = router;
