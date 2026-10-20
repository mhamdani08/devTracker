-- 000003_setup_projects_schema.up.sql
-- Enterprise Projects, Project Documents, and Project Members Schema

-- 1. Upgrade / Create projects table
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

-- 2. Create Indexes on projects
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status_project);
CREATE INDEX IF NOT EXISTS idx_projects_health ON projects (health_status);
CREATE INDEX IF NOT EXISTS idx_projects_unit_team ON projects (unit_team);
CREATE INDEX IF NOT EXISTS idx_projects_pic ON projects (pic_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_target_date ON projects (target_date);

-- 3. Create project_documents table
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

-- 4. Recreate or alter project_members table to match enterprise spec
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_members') THEN
        -- Drop old project_members if it had surrogate id and loose constraints
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_members' AND column_name = 'id') THEN
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
