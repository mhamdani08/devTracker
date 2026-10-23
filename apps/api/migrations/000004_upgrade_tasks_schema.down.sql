-- 000004_upgrade_tasks_schema.down.sql

DROP TRIGGER IF EXISTS trg_tasks_recalc_project_stats ON tasks;
DROP FUNCTION IF EXISTS fn_recalculate_project_task_stats();

DROP TABLE IF EXISTS tasks CASCADE;
