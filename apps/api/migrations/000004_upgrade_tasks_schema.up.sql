-- 000004_upgrade_tasks_schema.up.sql
-- Enterprise Tasks Backlog Schema with Auto-generated task_code and Project Stats Sync Trigger

-- 1. Add last_task_number to projects table
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
    -- Check if tasks table exists
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
        -- Drop old legacy check constraints from initial MVP schema if present
        ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
        ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;

        -- Alter or add columns to match enterprise specification
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'task_code') THEN
            ALTER TABLE tasks ADD COLUMN task_code varchar(60);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'task_type') THEN
            ALTER TABLE tasks ADD COLUMN task_type varchar(50) NOT NULL DEFAULT 'FEATURE';
        END IF;

        -- Harmonize task_status column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'task_status') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'status') THEN
                ALTER TABLE tasks RENAME COLUMN status TO task_status;
            ELSE
                ALTER TABLE tasks ADD COLUMN task_status varchar(50) NOT NULL DEFAULT 'BACKLOG';
            END IF;
        END IF;

        -- Normalize legacy lowercase status to uppercase general_parameters codes
        UPDATE tasks SET task_status = 'BACKLOG' WHERE task_status IN ('todo', 'backlog');
        UPDATE tasks SET task_status = 'IN_PROGRESS' WHERE task_status IN ('in_progress', 'progress');
        UPDATE tasks SET task_status = 'CODE_REVIEW' WHERE task_status IN ('review', 'code_review');
        UPDATE tasks SET task_status = 'DONE' WHERE task_status IN ('done');
        UPDATE tasks SET task_status = 'BLOCKED' WHERE task_status IN ('blocked');

        -- Harmonize priority column
        UPDATE tasks SET priority = 'P1' WHERE priority IN ('urgent', 'p1');
        UPDATE tasks SET priority = 'P2' WHERE priority IN ('high', 'p2');
        UPDATE tasks SET priority = 'P3' WHERE priority IN ('medium', 'p3');
        UPDATE tasks SET priority = 'P4' WHERE priority IN ('low', 'p4');
        ALTER TABLE tasks ALTER COLUMN priority SET DEFAULT 'P3';

        -- Harmonize due date
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'target_due') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'due_date') THEN
                ALTER TABLE tasks ADD COLUMN target_due date;
                UPDATE tasks SET target_due = due_date::date WHERE due_date IS NOT NULL;
            ELSE
                ALTER TABLE tasks ADD COLUMN target_due date;
            END IF;
        END IF;

        -- Blocker notes
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'blocker_tech_notes') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'blocker_reason') THEN
                ALTER TABLE tasks RENAME COLUMN blocker_reason TO blocker_tech_notes;
            ELSE
                ALTER TABLE tasks ADD COLUMN blocker_tech_notes text;
            END IF;
        END IF;

        -- Branch / PR / Aldon link
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'branch_pr_link') THEN
            ALTER TABLE tasks ADD COLUMN branch_pr_link text;
        END IF;

        -- Completed timestamp
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'completed_at') THEN
            ALTER TABLE tasks ADD COLUMN completed_at timestamptz;
        END IF;

        -- Hours tracking
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'est_hours') THEN
            ALTER TABLE tasks ADD COLUMN est_hours decimal(6,2) NOT NULL DEFAULT 0.00;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'actual_hours') THEN
            ALTER TABLE tasks ADD COLUMN actual_hours decimal(6,2) NOT NULL DEFAULT 0.00;
        END IF;

        -- Sort order
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'sort_order') THEN
            ALTER TABLE tasks ADD COLUMN sort_order int NOT NULL DEFAULT 0;
        END IF;

        -- Backfill task_code if any nulls exist
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

-- 3. Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(task_status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_target_due ON tasks(target_due);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status_order ON tasks(project_id, task_status, sort_order);

-- 4. Synchronization Trigger: Auto-recalculate Project Stats (total_task, total_task_done, progress_percentage, active_blockers)
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

    -- If this was an UPDATE and project_id changed, recalculate the old project as well
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
