# TaskPilot — Team Task Manager

A full-stack team task management app with role-based access control, built with React + Express + SQLite.

## Live Demo

https://taskpilot-production-48da.up.railway.app/

## Features

- **Auth** — Signup/login with JWT, roles: Admin / Member
- **Projects** — Create, edit, delete projects; manage team membership
- **Tasks** — Kanban board (Todo / In Progress / Done), priority levels, assignments, due dates
- **Dashboard** — Task progress, overdue alerts, personal task view
- **RBAC** — Admins manage everything; members update only their assigned tasks

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, React Router v6, Tailwind CSS, Vite |
| Backend | Node.js, Express.js |
| Database | SQLite (via better-sqlite3) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Deploy | Railway |

## API Reference

### Auth
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/api/auth/signup` | Public | Register (role: admin/member) |
| POST | `/api/auth/login` | Public | Login, returns JWT |
| GET | `/api/auth/me` | Auth | Current user |
| GET | `/api/auth/users` | Auth | All users (for assignment) |

### Projects
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/api/projects` | Auth | List accessible projects |
| POST | `/api/projects` | Auth | Create project |
| GET | `/api/projects/:id` | Member+ | Project + members |
| PUT | `/api/projects/:id` | Project Admin | Update project |
| DELETE | `/api/projects/:id` | Owner/Admin | Delete project |
| POST | `/api/projects/:id/members` | Project Admin | Add member |
| DELETE | `/api/projects/:id/members/:uid` | Project Admin | Remove member |
| PATCH | `/api/projects/:id/members/:uid/role` | Project Admin | Change role |

### Tasks
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/api/projects/:pid/tasks` | Member+ | List tasks (filter: status, priority) |
| POST | `/api/projects/:pid/tasks` | Member+ | Create task |
| GET | `/api/projects/:pid/tasks/:id` | Member+ | Task detail |
| PUT | `/api/projects/:pid/tasks/:id` | Admin or Assignee | Update task |
| DELETE | `/api/projects/:pid/tasks/:id` | Project Admin | Delete task |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | Stats, overdue tasks, my tasks |

## Local Development

```bash
# 1. Install
cd backend && npm install
cd ../frontend && npm install

# 2. Backend env
cp backend/.env.example backend/.env
# Edit JWT_SECRET

# 3. Run (two terminals)
cd backend && npm run dev   # http://localhost:5000
cd frontend && npm run dev  # http://localhost:5173
```

## Deploy on Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub Repo
3. Select the repo
4. Set environment variables:
   ```
   NODE_ENV=production
   JWT_SECRET=<your-random-secret>
   PORT=5000
   ```
5. Railway auto-detects `railway.toml` and builds + serves everything from the backend
6. Your app is live at the Railway URL

## Project Structure

```
taskpilot/
├── backend/
│   ├── src/
│   │   ├── index.js          # Express app
│   │   ├── db.js             # SQLite + schema
│   │   ├── middleware/
│   │   │   └── auth.js       # JWT middleware, RBAC helpers
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── projects.js
│   │       ├── tasks.js
│   │       └── dashboard.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/            # Login, Signup, Dashboard, Projects, ProjectDetail, TaskBoard
│   │   ├── components/       # Layout, Modal
│   │   ├── context/          # AuthContext
│   │   ├── api.js            # Fetch wrapper
│   │   └── App.jsx
│   └── package.json
└── railway.toml
```

## Role Logic

| Action | Global Admin | Project Admin | Project Member |
|--------|-------------|---------------|----------------|
| Create project | ✅ | ✅ | ✅ |
| Delete any project | ✅ | ❌ | ❌ |
| Add/remove members | ✅ | ✅ | ❌ |
| Create/delete tasks | ✅ | ✅ | ✅ (create only) |
| Edit any task | ✅ | ✅ | ❌ |
| Update own task status | ✅ | ✅ | ✅ (if assigned) |
