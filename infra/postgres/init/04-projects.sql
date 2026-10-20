-- 04-projects.sql
-- Enterprise Projects, Documents, and Members Schema + Seed Data

-- 1. Create or Adjust projects table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        CREATE TABLE projects (
            id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            project_code        varchar(50) UNIQUE NOT NULL,
            project_name        varchar(255) NOT NULL,
            pic_user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
            status_project      varchar(50) NOT NULL,
            source_type         varchar(50) NOT NULL,
            start_date          date NOT NULL,
            target_date         date NOT NULL,
            real_live_date      date,
            unit_team           varchar(20) CHECK (unit_team IN ('Core', 'Non Core', 'All')),
            project_priority    varchar(50),
            repository          text,
            total_task          int NOT NULL DEFAULT 0,
            total_task_done     int NOT NULL DEFAULT 0,
            progress_percentage decimal(5,2) NOT NULL DEFAULT 0.00,
            active_blockers     text,
            health_status       varchar(50),
            key_risk_notes      text,
            estimated_mandays   int,
            actual_mandays      int,
            created_at          timestamptz NOT NULL DEFAULT now(),
            updated_at          timestamptz NOT NULL DEFAULT now()
        );
    ELSE
        -- If projects table exists from initial schema, alter to match the enterprise specification
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'name') THEN
            ALTER TABLE projects RENAME COLUMN name TO project_name;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'project_code') THEN
            ALTER TABLE projects ADD COLUMN project_code varchar(50);
            UPDATE projects SET project_code = 'PRJ-' || substr(id::text, 1, 8) WHERE project_code IS NULL;
            ALTER TABLE projects ALTER COLUMN project_code SET NOT NULL;
            ALTER TABLE projects ADD CONSTRAINT ux_projects_project_code UNIQUE (project_code);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'pic_user_id') THEN
            ALTER TABLE projects ADD COLUMN pic_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'status_project') THEN
            ALTER TABLE projects ADD COLUMN status_project varchar(50) NOT NULL DEFAULT 'INITIATE';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'source_type') THEN
            ALTER TABLE projects ADD COLUMN source_type varchar(50) NOT NULL DEFAULT 'INTERNAL';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'start_date') THEN
            ALTER TABLE projects ADD COLUMN start_date date NOT NULL DEFAULT CURRENT_DATE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'target_date') THEN
            ALTER TABLE projects ADD COLUMN target_date date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'real_live_date') THEN
            ALTER TABLE projects ADD COLUMN real_live_date date;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'unit_team') THEN
            ALTER TABLE projects ADD COLUMN unit_team varchar(20) DEFAULT 'Core' CHECK (unit_team IN ('Core', 'Non Core', 'All'));
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'project_priority') THEN
            ALTER TABLE projects ADD COLUMN project_priority varchar(50);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'repository') THEN
            ALTER TABLE projects ADD COLUMN repository text;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'total_task') THEN
            ALTER TABLE projects ADD COLUMN total_task int NOT NULL DEFAULT 0;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'total_task_done') THEN
            ALTER TABLE projects ADD COLUMN total_task_done int NOT NULL DEFAULT 0;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'progress_percentage') THEN
            ALTER TABLE projects ADD COLUMN progress_percentage decimal(5,2) NOT NULL DEFAULT 0.00;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'active_blockers') THEN
            ALTER TABLE projects ADD COLUMN active_blockers text;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'health_status') THEN
            ALTER TABLE projects ADD COLUMN health_status varchar(50);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'key_risk_notes') THEN
            ALTER TABLE projects ADD COLUMN key_risk_notes text;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'estimated_mandays') THEN
            ALTER TABLE projects ADD COLUMN estimated_mandays int;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'actual_mandays') THEN
            ALTER TABLE projects ADD COLUMN actual_mandays int;
        END IF;

        -- Ensure legacy created_by column from 01-init.sql is nullable
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'created_by') THEN
            ALTER TABLE projects ALTER COLUMN created_by DROP NOT NULL;
        END IF;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status_project);
CREATE INDEX IF NOT EXISTS idx_projects_health ON projects (health_status);
CREATE INDEX IF NOT EXISTS idx_projects_unit_team ON projects (unit_team);
CREATE INDEX IF NOT EXISTS idx_projects_pic ON projects (pic_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_target_date ON projects (target_date);

-- 2. Create project_documents table
CREATE TABLE IF NOT EXISTS project_documents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    doc_name        varchar(255) NOT NULL,
    doc_type        varchar(50),
    file_url        text NOT NULL,
    storage_type    varchar(20) NOT NULL DEFAULT 'EXTERNAL_LINK',
    file_size_bytes bigint,
    uploaded_by     uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents (project_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_uploaded_by ON project_documents (uploaded_by);

-- 3. Create or upgrade project_members table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_members') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_members' AND column_name = 'joined_at') THEN
            DROP TABLE project_members CASCADE;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_members') THEN
        CREATE TABLE project_members (
            project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
            user_id         uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            role            varchar(30) NOT NULL CHECK (role IN ('OWNER', 'PROJECT_MANAGER', 'DEVELOPER', 'VIEWER')),
            joined_at       timestamptz NOT NULL DEFAULT now(),
            invited_by      uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at      timestamptz NOT NULL DEFAULT now(),
            updated_at      timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (project_id, user_id)
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_project_members_user_project ON project_members (user_id, project_id);

-- 4. Seed Realistic Projects Data
INSERT INTO projects (
    id, project_code, project_name, pic_user_id, status_project, source_type,
    start_date, target_date, real_live_date, unit_team, project_priority, repository,
    total_task, total_task_done, progress_percentage, active_blockers, health_status,
    key_risk_notes, estimated_mandays, actual_mandays
)
SELECT 
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
    'PRJ-2026-001',
    'Core Banking Real-time Settlement Engine',
    u_pm.id,
    'DEVELOPMENT',
    'CLIENT',
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE + INTERVAL '45 days',
    NULL,
    'Core',
    'P1',
    'https://github.com/mhamdani08/devTracker',
    24,
    16,
    66.67,
    'Menunggu finalisasi API Gateway security clearance dari IT Risk.',
    'AMBER',
    'SLA integrasi pihak ketiga berpotensi mundur 1 minggu bila sertifikat mTLS belum diterbitkan.',
    120,
    75
FROM (SELECT id FROM users WHERE email = 'pm@devtracker.local' LIMIT 1) u_pm
ON CONFLICT (project_code) DO NOTHING;

INSERT INTO projects (
    id, project_code, project_name, pic_user_id, status_project, source_type,
    start_date, target_date, real_live_date, unit_team, project_priority, repository,
    total_task, total_task_done, progress_percentage, active_blockers, health_status,
    key_risk_notes, estimated_mandays, actual_mandays
)
SELECT 
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::uuid,
    'PRJ-2026-002',
    'Mobile Banking SuperApp Redesign V3',
    u_dev.id,
    'UAT',
    'INTERNAL',
    CURRENT_DATE - INTERVAL '60 days',
    CURRENT_DATE + INTERVAL '10 days',
    NULL,
    'Non Core',
    'P2',
    'https://github.com/mhamdani08/devTracker',
    35,
    30,
    85.71,
    NULL,
    'GREEN',
    'Hasil uji UAT internal mencapai skor 98% pass rate.',
    90,
    82
FROM (SELECT id FROM users WHERE email = 'dev@devtracker.local' LIMIT 1) u_dev
ON CONFLICT (project_code) DO NOTHING;

INSERT INTO projects (
    id, project_code, project_name, pic_user_id, status_project, source_type,
    start_date, target_date, real_live_date, unit_team, project_priority, repository,
    total_task, total_task_done, progress_percentage, active_blockers, health_status,
    key_risk_notes, estimated_mandays, actual_mandays
)
SELECT 
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33'::uuid,
    'PRJ-2026-003',
    'Internal HR Portal & Payroll Automation',
    u_admin.id,
    'INITIATE',
    'INTERNAL',
    CURRENT_DATE - INTERVAL '5 days',
    CURRENT_DATE + INTERVAL '60 days',
    NULL,
    'All',
    'P3',
    'https://github.com/mhamdani08/devTracker',
    10,
    1,
    10.00,
    'Menunggu approval anggaran modul e-signature dari Finance.',
    'GREEN',
    'Kebutuhan integrasi dengan bank payroll sudah terverifikasi.',
    45,
    6
FROM (SELECT id FROM users WHERE email = 'admin@devtracker.local' LIMIT 1) u_admin
ON CONFLICT (project_code) DO NOTHING;

-- 5. Seed Project Members
INSERT INTO project_members (project_id, user_id, role, joined_at)
SELECT p.id, u.id, 'PROJECT_MANAGER', now()
FROM projects p, users u
WHERE p.project_code = 'PRJ-2026-001' AND u.email = 'pm@devtracker.local'
ON CONFLICT (project_id, user_id) DO NOTHING;

INSERT INTO project_members (project_id, user_id, role, joined_at)
SELECT p.id, u.id, 'DEVELOPER', now()
FROM projects p, users u
WHERE p.project_code = 'PRJ-2026-001' AND u.email = 'dev@devtracker.local'
ON CONFLICT (project_id, user_id) DO NOTHING;

INSERT INTO project_members (project_id, user_id, role, joined_at)
SELECT p.id, u.id, 'VIEWER', now()
FROM projects p, users u
WHERE p.project_code = 'PRJ-2026-001' AND u.email = 'qa@devtracker.local'
ON CONFLICT (project_id, user_id) DO NOTHING;

INSERT INTO project_members (project_id, user_id, role, joined_at)
SELECT p.id, u.id, 'OWNER', now()
FROM projects p, users u
WHERE p.project_code = 'PRJ-2026-002' AND u.email = 'admin@devtracker.local'
ON CONFLICT (project_id, user_id) DO NOTHING;

INSERT INTO project_members (project_id, user_id, role, joined_at)
SELECT p.id, u.id, 'DEVELOPER', now()
FROM projects p, users u
WHERE p.project_code = 'PRJ-2026-002' AND u.email = 'dev@devtracker.local'
ON CONFLICT (project_id, user_id) DO NOTHING;

-- 6. Seed Project Documents
INSERT INTO project_documents (project_id, doc_name, doc_type, file_url, storage_type, uploaded_by)
SELECT p.id, 'SOW Final Settlement Core Engine v2.1', 'SOW', 'https://drive.google.com/file/d/demo-sow-settlement/view', 'EXTERNAL_LINK', u.id
FROM projects p, users u
WHERE p.project_code = 'PRJ-2026-001' AND u.email = 'pm@devtracker.local'
ON CONFLICT DO NOTHING;

INSERT INTO project_documents (project_id, doc_name, doc_type, file_url, storage_type, uploaded_by)
SELECT p.id, 'Spesifikasi Arsitektur & mTLS Security Clearance', 'FSD', 'https://confluence.internal.corp/pages/viewpage.action?pageId=98214', 'EXTERNAL_LINK', u.id
FROM projects p, users u
WHERE p.project_code = 'PRJ-2026-001' AND u.email = 'admin@devtracker.local'
ON CONFLICT DO NOTHING;

INSERT INTO project_documents (project_id, doc_name, doc_type, file_url, storage_type, uploaded_by)
SELECT p.id, 'BRD Redesign SuperApp v3.0 - Signed', 'BRD', 'https://drive.google.com/file/d/demo-brd-superapp/view', 'EXTERNAL_LINK', u.id
FROM projects p, users u
WHERE p.project_code = 'PRJ-2026-002' AND u.email = 'sa@devtracker.local'
ON CONFLICT DO NOTHING;

INSERT INTO project_documents (project_id, doc_name, doc_type, file_url, storage_type, uploaded_by)
SELECT p.id, 'Berita Acara Serah Terima (BAST) UAT Fase 1', 'BAST', 'https://sharepoint.corp/docs/BAST-UAT-SuperApp-signed.pdf', 'EXTERNAL_LINK', u.id
FROM projects p, users u
WHERE p.project_code = 'PRJ-2026-002' AND u.email = 'qa@devtracker.local'
ON CONFLICT DO NOTHING;
