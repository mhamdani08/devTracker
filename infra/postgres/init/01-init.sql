-- Developer Progress Tracker Database Initialization

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            varchar(50) NOT NULL UNIQUE,
    name            varchar(100) NOT NULL,
    description     text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id         uuid REFERENCES roles(id) ON DELETE SET NULL,
    email           varchar(320) NOT NULL,
    full_name       varchar(150) NOT NULL,
    password_hash   text NOT NULL,
    system_role     varchar(20) NOT NULL DEFAULT 'USER'
                    CHECK (system_role IN ('SYS_ADMIN', 'USER')),
    status          varchar(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('INVITED', 'ACTIVE', 'DISABLED')),
    last_login_at   timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_lower
    ON users (lower(email))
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);
CREATE INDEX IF NOT EXISTS idx_users_system_role ON users (system_role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

-- 3. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            varchar(255) NOT NULL,
    description     text,
    created_by      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 4. Project Members Table
CREATE TABLE IF NOT EXISTS project_members (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            varchar(50) NOT NULL DEFAULT 'member',
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(project_id, user_id)
);

-- 5. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title           varchar(255) NOT NULL,
    description     text,
    status          varchar(50) NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'blocked')),
    priority        varchar(50) NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assignee_id     uuid REFERENCES users(id) ON DELETE SET NULL,
    created_by      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    due_date        timestamptz,
    blocker_reason  text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 6. Task Comments Table
CREATE TABLE IF NOT EXISTS task_comments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 7. Task Activity Table
CREATE TABLE IF NOT EXISTS task_activity (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action          varchar(100) NOT NULL,
    old_value       text,
    new_value       text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON task_activity(task_id);

-- SEED DATA: Roles
INSERT INTO roles (code, name, description) VALUES
    ('SYSTEM_ANALYST', 'System Analyst', 'Bertanggung jawab untuk analisa sistem, kebutuhan bisnis, dan spesifikasi teknis.'),
    ('BACKEND_DEV', 'Backend Developer', 'Bertanggung jawab atas arsitektur server, API, dan integrasi database.'),
    ('FRONTEND_DEV', 'Frontend Developer', 'Bertanggung jawab atas UI/UX, interaktivitas klien, dan integrasi API.'),
    ('FULLSTACK_DEV', 'Fullstack Developer', 'Bertanggung jawab pada pengerjaan frontend dan backend secara end-to-end.'),
    ('QA_ENGINEER', 'QA Engineer', 'Bertanggung jawab atas pengujian kualitas, testing otomatis, dan verifikasi bug.'),
    ('TECH_LEAD', 'Tech Lead', 'Memimpin arsitektur teknis dan koordinasi tim engineering.'),
    ('PROJECT_MANAGER', 'Project Manager', 'Mengelola timeline proyek, alokasi tugas, dan koordinasi stakeholder.')
ON CONFLICT (code) DO NOTHING;

-- SEED DATA: Default SysAdmin User (Password: Admin123!)
INSERT INTO users (role_id, email, full_name, password_hash, system_role, status)
SELECT 
    r.id,
    'admin@devtracker.local',
    'System Administrator',
    crypt('Admin123!', gen_salt('bf', 10)),
    'SYS_ADMIN',
    'ACTIVE'
FROM roles r
WHERE r.code = 'TECH_LEAD'
LIMIT 1
ON CONFLICT DO NOTHING;
