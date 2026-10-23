-- 05-tasks.sql
-- Enterprise Tasks Backlog Schema with Auto-generated task_code, Project Stats Sync Trigger, and Demo Tasks Seed

-- 1. Ensure last_task_number exists on projects
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'last_task_number'
    ) THEN
        ALTER TABLE projects ADD COLUMN last_task_number int NOT NULL DEFAULT 0;
    END IF;
END $$;

-- 2. Upgrade or Create tasks table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
        CREATE TABLE tasks (
            id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            task_code           varchar(60) NOT NULL,
            title               varchar(255) NOT NULL,
            description         text,
            task_type           varchar(50) NOT NULL DEFAULT 'FEATURE',
            priority            varchar(50) NOT NULL DEFAULT 'P3',
            task_status         varchar(50) NOT NULL DEFAULT 'BACKLOG',
            assignee_id         uuid REFERENCES users(id) ON DELETE SET NULL,
            created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
            branch_pr_link      text,
            target_due          date,
            completed_at        timestamptz,
            est_hours           decimal(6,2) NOT NULL DEFAULT 0.00,
            actual_hours        decimal(6,2) NOT NULL DEFAULT 0.00,
            blocker_tech_notes  text,
            sort_order          int NOT NULL DEFAULT 0,
            created_at          timestamptz NOT NULL DEFAULT now(),
            updated_at          timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT ux_tasks_project_task_code UNIQUE (project_id, task_code)
        );
    ELSE
        ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
        ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'task_code') THEN
            ALTER TABLE tasks ADD COLUMN task_code varchar(60);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'task_type') THEN
            ALTER TABLE tasks ADD COLUMN task_type varchar(50) NOT NULL DEFAULT 'FEATURE';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'task_status') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'status') THEN
                ALTER TABLE tasks RENAME COLUMN status TO task_status;
            ELSE
                ALTER TABLE tasks ADD COLUMN task_status varchar(50) NOT NULL DEFAULT 'BACKLOG';
            END IF;
        END IF;

        UPDATE tasks SET task_status = 'BACKLOG' WHERE task_status IN ('todo', 'backlog');
        UPDATE tasks SET task_status = 'IN_PROGRESS' WHERE task_status IN ('in_progress', 'progress');
        UPDATE tasks SET task_status = 'CODE_REVIEW' WHERE task_status IN ('review', 'code_review');
        UPDATE tasks SET task_status = 'DONE' WHERE task_status IN ('done');
        UPDATE tasks SET task_status = 'BLOCKED' WHERE task_status IN ('blocked');

        UPDATE tasks SET priority = 'P1' WHERE priority IN ('urgent', 'p1');
        UPDATE tasks SET priority = 'P2' WHERE priority IN ('high', 'p2');
        UPDATE tasks SET priority = 'P3' WHERE priority IN ('medium', 'p3');
        UPDATE tasks SET priority = 'P4' WHERE priority IN ('low', 'p4');
        ALTER TABLE tasks ALTER COLUMN priority SET DEFAULT 'P3';

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'target_due') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'due_date') THEN
                ALTER TABLE tasks ADD COLUMN target_due date;
                UPDATE tasks SET target_due = due_date::date WHERE due_date IS NOT NULL;
            ELSE
                ALTER TABLE tasks ADD COLUMN target_due date;
            END IF;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'blocker_tech_notes') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'blocker_reason') THEN
                ALTER TABLE tasks RENAME COLUMN blocker_reason TO blocker_tech_notes;
            ELSE
                ALTER TABLE tasks ADD COLUMN blocker_tech_notes text;
            END IF;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'branch_pr_link') THEN
            ALTER TABLE tasks ADD COLUMN branch_pr_link text;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'completed_at') THEN
            ALTER TABLE tasks ADD COLUMN completed_at timestamptz;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'est_hours') THEN
            ALTER TABLE tasks ADD COLUMN est_hours decimal(6,2) NOT NULL DEFAULT 0.00;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'actual_hours') THEN
            ALTER TABLE tasks ADD COLUMN actual_hours decimal(6,2) NOT NULL DEFAULT 0.00;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'sort_order') THEN
            ALTER TABLE tasks ADD COLUMN sort_order int NOT NULL DEFAULT 0;
        END IF;

        DO $backfill$
        DECLARE
            t_row RECORD;
            p_code varchar(50);
            curr_cnt int;
        BEGIN
            FOR t_row IN SELECT id, project_id FROM tasks WHERE task_code IS NULL ORDER BY created_at ASC LOOP
                SELECT project_code, last_task_number INTO p_code, curr_cnt FROM projects WHERE id = t_row.project_id;
                curr_cnt := curr_cnt + 1;
                UPDATE projects SET last_task_number = curr_cnt WHERE id = t_row.project_id;
                UPDATE tasks SET task_code = p_code || '-T' || lpad(curr_cnt::text, 2, '0') WHERE id = t_row.id;
            END LOOP;
        END $backfill$;

        ALTER TABLE tasks ALTER COLUMN task_code SET NOT NULL;
        ALTER TABLE tasks DROP CONSTRAINT IF EXISTS ux_tasks_project_task_code;
        ALTER TABLE tasks ADD CONSTRAINT ux_tasks_project_task_code UNIQUE (project_id, task_code);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(task_status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_target_due ON tasks(target_due);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status_order ON tasks(project_id, task_status, sort_order);

-- 3. Synchronization Trigger: Auto-recalculate Project Stats
CREATE OR REPLACE FUNCTION fn_recalculate_project_task_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_project_id uuid;
    v_total int;
    v_done int;
    v_progress decimal(5,2);
    v_active_blockers text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_project_id := OLD.project_id;
    ELSE
        target_project_id := NEW.project_id;
    END IF;

    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE task_status = 'DONE'),
        string_agg(
            CASE 
                WHEN task_status = 'BLOCKED' AND blocker_tech_notes IS NOT NULL AND trim(blocker_tech_notes) <> '' 
                THEN task_code || ': ' || trim(blocker_tech_notes) 
                ELSE NULL 
            END, 
            E'\n'
        )
    INTO 
        v_total, 
        v_done, 
        v_active_blockers
    FROM tasks
    WHERE project_id = target_project_id;

    IF v_total > 0 THEN
        v_progress := ROUND((v_done::decimal / v_total::decimal) * 100.0, 2);
    ELSE
        v_progress := 0.00;
    END IF;

    UPDATE projects
    SET 
        total_task = v_total,
        total_task_done = v_done,
        progress_percentage = v_progress,
        active_blockers = NULLIF(trim(v_active_blockers), ''),
        updated_at = now()
    WHERE id = target_project_id;

    IF TG_OP = 'UPDATE' AND OLD.project_id <> NEW.project_id THEN
        SELECT 
            COUNT(*),
            COUNT(*) FILTER (WHERE task_status = 'DONE'),
            string_agg(
                CASE 
                    WHEN task_status = 'BLOCKED' AND blocker_tech_notes IS NOT NULL AND trim(blocker_tech_notes) <> '' 
                    THEN task_code || ': ' || trim(blocker_tech_notes) 
                    ELSE NULL 
                END, 
                E'\n'
            )
        INTO v_total, v_done, v_active_blockers
        FROM tasks
        WHERE project_id = OLD.project_id;

        IF v_total > 0 THEN
            v_progress := ROUND((v_done::decimal / v_total::decimal) * 100.0, 2);
        ELSE
            v_progress := 0.00;
        END IF;

        UPDATE projects
        SET 
            total_task = v_total,
            total_task_done = v_done,
            progress_percentage = v_progress,
            active_blockers = NULLIF(trim(v_active_blockers), ''),
            updated_at = now()
        WHERE id = OLD.project_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_recalc_project_stats ON tasks;
CREATE TRIGGER trg_tasks_recalc_project_stats
AFTER INSERT OR UPDATE OR DELETE ON tasks
FOR EACH ROW
EXECUTE FUNCTION fn_recalculate_project_task_stats();

-- 4. Seed Initial Realistic Tasks for Demo Project 'PRJ-2026-001'
DO $$
DECLARE
    prj_id uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid;
    u_admin uuid;
    u_dev uuid;
    u_sa uuid;
    u_qa uuid;
BEGIN
    SELECT id INTO u_admin FROM users WHERE email = 'admin@devtracker.local' LIMIT 1;
    SELECT id INTO u_dev FROM users WHERE email = 'dev@devtracker.local' LIMIT 1;
    SELECT id INTO u_sa FROM users WHERE email = 'sa@devtracker.local' LIMIT 1;
    SELECT id INTO u_qa FROM users WHERE email = 'qa@devtracker.local' LIMIT 1;

    -- Only seed if tasks for this project are empty
    IF NOT EXISTS (SELECT 1 FROM tasks WHERE project_id = prj_id) THEN
        -- Task 1: Done
        INSERT INTO tasks (
            project_id, task_code, title, description, task_type, priority, task_status,
            assignee_id, created_by, branch_pr_link, target_due, completed_at,
            est_hours, actual_hours, sort_order
        ) VALUES (
            prj_id, 'PRJ-2026-001-T01', 'Desain Skema Database Settlement Engine',
            'Rancang skema tabel transaksi kliring, ledger balance, dan idempotency key pada PostgreSQL.',
            'FEATURE', 'P1', 'DONE',
            u_sa, u_admin, 'https://github.com/mhamdani08/devTracker/pull/1',
            CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE - INTERVAL '14 days',
            16.00, 14.50, 1
        );

        -- Task 2: Done
        INSERT INTO tasks (
            project_id, task_code, title, description, task_type, priority, task_status,
            assignee_id, created_by, branch_pr_link, target_due, completed_at,
            est_hours, actual_hours, sort_order
        ) VALUES (
            prj_id, 'PRJ-2026-001-T02', 'Implementasi Core Message Queue Consumer',
            'Bangun consumer Kafka / RabbitMQ untuk ingest transaksi settlement secara paralel tanpa deadlock.',
            'FEATURE', 'P1', 'DONE',
            u_dev, u_admin, 'feat/PRJ-001-T02-queue-consumer',
            CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '8 days',
            32.00, 30.00, 2
        );

        -- Task 3: In Progress
        INSERT INTO tasks (
            project_id, task_code, title, description, task_type, priority, task_status,
            assignee_id, created_by, branch_pr_link, target_due,
            est_hours, actual_hours, sort_order
        ) VALUES (
            prj_id, 'PRJ-2026-001-T03', 'Integrasi API ISO 8583 Settlement Switch',
            'Parsing format payload transaksi finansial antar bank sesuai spesifikasi switching partner.',
            'FEATURE', 'P2', 'IN_PROGRESS',
            u_dev, u_admin, 'feat/PRJ-001-T03-iso8583',
            CURRENT_DATE + INTERVAL '5 days',
            24.00, 12.00, 3
        );

        -- Task 4: Code Review
        INSERT INTO tasks (
            project_id, task_code, title, description, task_type, priority, task_status,
            assignee_id, created_by, branch_pr_link, target_due,
            est_hours, actual_hours, sort_order
        ) VALUES (
            prj_id, 'PRJ-2026-001-T04', 'Unit Testing & Mocking Settlement Worker',
            'Cakupan test minimum 85% untuk fungsi balance recalculation dan reverse settlement transaction.',
            'FEATURE', 'P2', 'CODE_REVIEW',
            u_dev, u_admin, 'PR #12: feat/worker-unit-test',
            CURRENT_DATE + INTERVAL '2 days',
            16.00, 16.00, 4
        );

        -- Task 5: QA Testing
        INSERT INTO tasks (
            project_id, task_code, title, description, task_type, priority, task_status,
            assignee_id, created_by, branch_pr_link, target_due,
            est_hours, actual_hours, sort_order
        ) VALUES (
            prj_id, 'PRJ-2026-001-T05', 'End-to-End Stress Test Konkurensi 5000 TPS',
            'Pengujian beban settlement menggunakan k6 untuk memvalidasi tidak ada double-spending atau race condition.',
            'FEATURE', 'P1', 'QA_TESTING',
            u_qa, u_admin, 'ALD-883921 / PR #14',
            CURRENT_DATE + INTERVAL '7 days',
            20.00, 8.00, 5
        );

        -- Task 6: Blocked
        INSERT INTO tasks (
            project_id, task_code, title, description, task_type, priority, task_status,
            assignee_id, created_by, branch_pr_link, target_due,
            est_hours, actual_hours, blocker_tech_notes, sort_order
        ) VALUES (
            prj_id, 'PRJ-2026-001-T06', 'Setup mTLS Gateway ke Server Clearing House',
            'Konfigurasi enkripsi sertifikat mTLS dan firewall IP whitelisting ke gateway clearing house.',
            'HOTFIX', 'P1', 'BLOCKED',
            u_admin, u_admin, 'Task Aldon: ALD-900124',
            CURRENT_DATE - INTERVAL '1 days',
            12.00, 4.00,
            'Menunggu persetujuan IT Security Clearance & rilis sertifikat root CA dari clearing house eksternal.',
            6
        );

        -- Task 7: Backlog
        INSERT INTO tasks (
            project_id, task_code, title, description, task_type, priority, task_status,
            assignee_id, created_by, branch_pr_link, target_due,
            est_hours, actual_hours, sort_order
        ) VALUES (
            prj_id, 'PRJ-2026-001-T07', 'Dashboard Metrik Real-time Grafana Settlement Latency',
            'Export metrics Prometheus (throughput, failure rate, settlement latency P99) ke Grafana.',
            'TECH_DEBT', 'P3', 'BACKLOG',
            u_dev, u_admin, NULL,
            CURRENT_DATE + INTERVAL '20 days',
            16.00, 0.00, 7
        );

        -- Update last_task_number on project
        UPDATE projects SET last_task_number = 7 WHERE id = prj_id;
    END IF;
END $$;
