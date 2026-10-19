-- 03-general-parameters.sql

CREATE TABLE IF NOT EXISTS general_parameters (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parameter_type  varchar(50) NOT NULL,
    code            varchar(50) NOT NULL,
    name            varchar(100) NOT NULL,
    sort_order      int NOT NULL DEFAULT 0,
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_general_parameters_type_code 
    ON general_parameters (parameter_type, code);

CREATE INDEX IF NOT EXISTS idx_general_parameters_type 
    ON general_parameters (parameter_type);

CREATE INDEX IF NOT EXISTS idx_general_parameters_active 
    ON general_parameters (is_active);

-- Seed Data: General Parameters
INSERT INTO general_parameters (parameter_type, code, name, sort_order, is_active) VALUES
    -- TASK_STATUS
    ('TASK_STATUS', 'BACKLOG', 'Backlog', 1, true),
    ('TASK_STATUS', 'IN_PROGRESS', 'In Progress', 2, true),
    ('TASK_STATUS', 'CODE_REVIEW', 'Code Review', 3, true),
    ('TASK_STATUS', 'QA_TESTING', 'QA / Testing', 4, true),
    ('TASK_STATUS', 'DONE', 'Done', 5, true),
    ('TASK_STATUS', 'BLOCKED', 'Blocked', 6, true),
    ('TASK_STATUS', 'TO_DO', 'To Do', 7, true),

    -- PRIORITY
    ('PRIORITY', 'P1', 'P1 - Critical', 1, true),
    ('PRIORITY', 'P2', 'P2 - High', 2, true),
    ('PRIORITY', 'P3', 'P3 - Medium', 3, true),
    ('PRIORITY', 'P4', 'P4 - Low', 4, true),

    -- TASK_TYPE
    ('TASK_TYPE', 'FEATURE', 'Feature', 1, true),
    ('TASK_TYPE', 'BUGFIX', 'Bugfix', 2, true),
    ('TASK_TYPE', 'REFACTOR', 'Refactor', 3, true),
    ('TASK_TYPE', 'TECH_DEBT', 'Tech Debt', 4, true),
    ('TASK_TYPE', 'HOTFIX', 'Hotfix', 5, true),
    ('TASK_TYPE', 'MODIFIED', 'Modified', 6, true),

    -- PROJECT_HEALTH
    ('PROJECT_HEALTH', 'GREEN', 'Green', 1, true),
    ('PROJECT_HEALTH', 'AMBER', 'Amber', 2, true),
    ('PROJECT_HEALTH', 'RED', 'Red', 3, true),

    -- PROJECT_PHASE
    ('PROJECT_PHASE', 'INITIATE', 'Initiate', 1, true),
    ('PROJECT_PHASE', 'ASSESSMENT', 'Assessment', 2, true),
    ('PROJECT_PHASE', 'DEVELOPMENT', 'Development', 3, true),
    ('PROJECT_PHASE', 'UT', 'UT', 4, true),
    ('PROJECT_PHASE', 'SIT', 'SIT', 5, true),
    ('PROJECT_PHASE', 'UAT', 'UAT', 6, true),
    ('PROJECT_PHASE', 'READY_DEPLOY', 'Ready to Deploy', 7, true),
    ('PROJECT_PHASE', 'GOLIVE', 'GoLive', 8, true)
ON CONFLICT (parameter_type, code) DO NOTHING;
