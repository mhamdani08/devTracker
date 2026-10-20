-- 000003_setup_projects_schema.down.sql

DROP TABLE IF EXISTS project_documents CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
-- Note: Not dropping projects completely to prevent data loss on existing tasks, or drop if rollback
