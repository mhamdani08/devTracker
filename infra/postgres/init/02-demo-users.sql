-- Demo Users for Testing Different Roles

INSERT INTO users (role_id, email, full_name, password_hash, system_role, status)
SELECT r.id, 'sa@devtracker.local', 'Sarah Analyst', crypt('Admin123!', gen_salt('bf', 10)), 'USER', 'ACTIVE'
FROM roles r WHERE r.code = 'SYSTEM_ANALYST'
AND NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = 'sa@devtracker.local');

INSERT INTO users (role_id, email, full_name, password_hash, system_role, status)
SELECT r.id, 'dev@devtracker.local', 'Budi Developer', crypt('Admin123!', gen_salt('bf', 10)), 'USER', 'ACTIVE'
FROM roles r WHERE r.code = 'BACKEND_DEV'
AND NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = 'dev@devtracker.local');

INSERT INTO users (role_id, email, full_name, password_hash, system_role, status)
SELECT r.id, 'qa@devtracker.local', 'Qonita Quality', crypt('Admin123!', gen_salt('bf', 10)), 'USER', 'ACTIVE'
FROM roles r WHERE r.code = 'QA_ENGINEER'
AND NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = 'qa@devtracker.local');

INSERT INTO users (role_id, email, full_name, password_hash, system_role, status)
SELECT r.id, 'pm@devtracker.local', 'Pratama Manager', crypt('Admin123!', gen_salt('bf', 10)), 'USER', 'ACTIVE'
FROM roles r WHERE r.code = 'PROJECT_MANAGER'
AND NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = 'pm@devtracker.local');
