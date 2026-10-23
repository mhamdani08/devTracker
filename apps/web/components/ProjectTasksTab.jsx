"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

export default function ProjectTasksTab({
  projectDetail,
  authToken,
  currentUser,
  userOptions = [],
  showToast,
  onProjectRefresh,
}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Parameter options
  const [taskStatusOptions, setTaskStatusOptions] = useState([]);
  const [taskTypeOptions, setTaskTypeOptions] = useState([]);
  const [priorityOptions, setPriorityOptions] = useState([]);

  // View state: "kanban" | "table"
  const [viewMode, setViewMode] = useState("kanban");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterAssignee, setFilterAssignee] = useState(""); // "" | "ME" | userID

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
  const [selectedTask, setSelectedTask] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const initialFormState = {
    title: "",
    description: "",
    task_type: "FEATURE",
    priority: "P3",
    task_status: "BACKLOG",
    assignee_id: "",
    branch_pr_link: "",
    target_due: "",
    est_hours: 8,
    actual_hours: 0,
    blocker_tech_notes: "",
    sort_order: 0,
  };
  const [formData, setFormData] = useState(initialFormState);

  // Fetch general parameters for tasks
  useEffect(() => {
    async function loadParams() {
      try {
        const res = await fetch("/api/v1/parameters");
        if (res.ok) {
          const json = await res.json();
          const allParams = json.data || [];
          setTaskStatusOptions(allParams.filter((p) => p.parameter_type === "TASK_STATUS" && p.is_active));
          setTaskTypeOptions(allParams.filter((p) => p.parameter_type === "TASK_TYPE" && p.is_active));
          setPriorityOptions(allParams.filter((p) => p.parameter_type === "PRIORITY" && p.is_active));
        }
      } catch (err) {
        console.warn("Could not load task parameters:", err);
      }
    }
    loadParams();
  }, []);

  // Fetch tasks for this project
  const fetchTasks = useCallback(async () => {
    if (!projectDetail?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/projects/${projectDetail.id}/tasks`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTasks(json.data || []);
    } catch (err) {
      setError(err.message || "Failed to load project tasks");
    } finally {
      setLoading(false);
    }
  }, [projectDetail?.id, authToken]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Combined project member options + user options
  const assigneeChoices = useMemo(() => {
    if (projectDetail?.members && projectDetail.members.length > 0) {
      return projectDetail.members.map((m) => ({
        id: m.user_id,
        name: `${m.user_full_name} (${m.role})`,
      }));
    }
    return userOptions;
  }, [projectDetail?.members, userOptions]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchCode = t.task_code?.toLowerCase().includes(q);
        const matchTitle = t.title?.toLowerCase().includes(q);
        const matchAssignee = t.assignee_name?.toLowerCase().includes(q);
        if (!matchCode && !matchTitle && !matchAssignee) return false;
      }
      if (filterStatus && t.task_status !== filterStatus) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterType && t.task_type !== filterType) return false;
      if (filterAssignee) {
        if (filterAssignee === "ME") {
          if (t.assignee_id !== currentUser?.id) return false;
        } else if (t.assignee_id !== filterAssignee) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, searchQuery, filterStatus, filterPriority, filterType, filterAssignee, currentUser]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.task_status === "DONE").length;
    const inProgress = tasks.filter((t) => t.task_status === "IN_PROGRESS").length;
    const blocked = tasks.filter((t) => t.task_status === "BLOCKED").length;
    const totalEst = tasks.reduce((sum, t) => sum + (parseFloat(t.est_hours) || 0), 0);
    const totalActual = tasks.reduce((sum, t) => sum + (parseFloat(t.actual_hours) || 0), 0);
    const progress = total > 0 ? ((done / total) * 100).toFixed(1) : 0;
    return { total, done, inProgress, blocked, totalEst, totalActual, progress };
  }, [tasks]);

  // Kanban status columns definition
  const kanbanColumns = [
    { code: "BACKLOG", label: "Backlog", color: "#64748b", bg: "rgba(100, 116, 139, 0.08)" },
    { code: "TO_DO", label: "To Do", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.08)" },
    { code: "IN_PROGRESS", label: "In Progress", color: "#0284c7", bg: "rgba(2, 132, 199, 0.08)" },
    { code: "CODE_REVIEW", label: "Code Review", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.08)" },
    { code: "QA_TESTING", label: "QA / Testing", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)" },
    { code: "BLOCKED", label: "Blocked", color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)" },
    { code: "DONE", label: "Done", color: "#10b981", bg: "rgba(16, 185, 129, 0.08)" },
  ];

  // Helper styles & badges
  const getPriorityBadge = (prio) => {
    switch (prio) {
      case "P1":
        return { bg: "rgba(239, 68, 68, 0.15)", color: "#dc2626", border: "#fca5a5", label: "P1 Critical" };
      case "P2":
        return { bg: "rgba(249, 115, 22, 0.15)", color: "#ea580c", border: "#fdba74", label: "P2 High" };
      case "P3":
        return { bg: "rgba(59, 130, 246, 0.15)", color: "#2563eb", border: "#93c5fd", label: "P3 Medium" };
      case "P4":
        return { bg: "rgba(107, 114, 128, 0.15)", color: "#4b5563", border: "#d1d5db", label: "P4 Low" };
      default:
        return { bg: "var(--bg-subtle)", color: "var(--text-muted)", border: "var(--border-subtle)", label: prio };
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case "FEATURE":
        return { bg: "rgba(16, 185, 129, 0.12)", color: "#059669", label: "Feature" };
      case "BUGFIX":
        return { bg: "rgba(239, 68, 68, 0.12)", color: "#dc2626", label: "Bugfix" };
      case "REFACTOR":
        return { bg: "rgba(147, 51, 234, 0.12)", color: "#7e22ce", label: "Refactor" };
      case "TECH_DEBT":
        return { bg: "rgba(245, 158, 11, 0.12)", color: "#b45309", label: "Tech Debt" };
      case "HOTFIX":
        return { bg: "rgba(225, 29, 72, 0.12)", color: "#be123c", label: "Hotfix" };
      case "MODIFIED":
        return { bg: "rgba(2, 132, 199, 0.12)", color: "#0369a1", label: "Modified" };
      default:
        return { bg: "var(--bg-subtle)", color: "var(--text-muted)", label: type };
    }
  };

  // Open Create Modal
  const handleOpenCreate = (prefilledStatus = "BACKLOG") => {
    setModalMode("create");
    setSelectedTask(null);
    setFormData({
      ...initialFormState,
      task_status: prefilledStatus,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (task) => {
    setModalMode("edit");
    setSelectedTask(task);
    setFormData({
      title: task.title || "",
      description: task.description || "",
      task_type: task.task_type || "FEATURE",
      priority: task.priority || "P3",
      task_status: task.task_status || "BACKLOG",
      assignee_id: task.assignee_id || "",
      branch_pr_link: task.branch_pr_link || "",
      target_due: task.target_due || "",
      est_hours: task.est_hours || 0,
      actual_hours: task.actual_hours || 0,
      blocker_tech_notes: task.blocker_tech_notes || "",
      sort_order: task.sort_order || 0,
    });
    setIsModalOpen(true);
  };

  // Submit Create or Edit Form
  const handleSubmitTask = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast?.("Judul task wajib diisi", "error");
      return;
    }
    if (formData.task_status === "BLOCKED" && !formData.blocker_tech_notes.trim()) {
      showToast?.("Catatan teknis blocker wajib diisi saat status BLOCKED", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description ? formData.description.trim() : null,
        task_type: formData.task_type,
        priority: formData.priority,
        task_status: formData.task_status,
        assignee_id: formData.assignee_id || null,
        branch_pr_link: formData.branch_pr_link ? formData.branch_pr_link.trim() : null,
        target_due: formData.target_due || null,
        est_hours: parseFloat(formData.est_hours) || 0,
        actual_hours: parseFloat(formData.actual_hours) || 0,
        blocker_tech_notes: formData.blocker_tech_notes ? formData.blocker_tech_notes.trim() : null,
        sort_order: parseInt(formData.sort_order) || 0,
      };

      let url = `/api/v1/projects/${projectDetail.id}/tasks`;
      let method = "POST";

      if (modalMode === "edit" && selectedTask) {
        url = `/api/v1/tasks/${selectedTask.id}`;
        method = "PUT";
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan task");

      showToast?.(
        modalMode === "create"
          ? `Task ${json.data?.task_code || ""} berhasil dibuat`
          : "Task berhasil diperbarui",
        "success"
      );

      setIsModalOpen(false);
      fetchTasks();
      onProjectRefresh?.(); // Trigger refresh of projectDetail so total_task and progress update!
    } catch (err) {
      showToast?.(err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Status Change (from Kanban card or dropdown)
  const handleQuickStatusChange = async (task, newStatus) => {
    if (task.task_status === newStatus) return;

    if (newStatus === "BLOCKED") {
      const notes = prompt("Masukkan catatan teknis / alasan blocker (Task Lock):", task.blocker_tech_notes || "");
      if (notes === null) return;
      if (!notes.trim()) {
        showToast?.("Catatan teknis blocker wajib diisi!", "error");
        return;
      }
      return executeStatusChange(task, newStatus, notes.trim());
    }

    return executeStatusChange(task, newStatus, null);
  };

  const executeStatusChange = async (task, newStatus, blockerNotes) => {
    try {
      const payload = {
        task_status: newStatus,
        blocker_tech_notes: blockerNotes !== undefined ? blockerNotes : task.blocker_tech_notes,
      };

      const res = await fetch(`/api/v1/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengubah status task");

      showToast?.(`Status ${task.task_code} diubah ke ${newStatus}`, "success");
      fetchTasks();
      onProjectRefresh?.();
    } catch (err) {
      showToast?.(err.message, "error");
    }
  };

  // Delete Task
  const handleDeleteTask = async (task) => {
    if (!confirm(`Hapus task ${task.task_code}: "${task.title}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/tasks/${task.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus task");

      showToast?.(`Task ${task.task_code} berhasil dihapus`, "success");
      fetchTasks();
      onProjectRefresh?.();
    } catch (err) {
      showToast?.(err.message, "error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 1. Header Summary Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
        }}
      >
        {/* Total Tasks */}
        <div
          className="dash-card"
          style={{
            padding: "16px",
            backgroundColor: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "rgba(59, 130, 246, 0.12)",
              color: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            📋
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Total Tasks
            </div>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-primary)" }}>
              {stats.total}
            </div>
          </div>
        </div>

        {/* In Progress */}
        <div
          className="dash-card"
          style={{
            padding: "16px",
            backgroundColor: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "rgba(2, 132, 199, 0.12)",
              color: "#0284c7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            ⚡
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
              In Progress
            </div>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "#0284c7" }}>
              {stats.inProgress}
            </div>
          </div>
        </div>

        {/* Blocked */}
        <div
          className="dash-card"
          style={{
            padding: "16px",
            backgroundColor: stats.blocked > 0 ? "rgba(239, 68, 68, 0.05)" : "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            border: stats.blocked > 0 ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            🚨
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Active Blockers
            </div>
            <div style={{ fontSize: "22px", fontWeight: "800", color: stats.blocked > 0 ? "#dc2626" : "var(--text-primary)" }}>
              {stats.blocked}
            </div>
          </div>
        </div>

        {/* Done & Progress */}
        <div
          className="dash-card"
          style={{
            padding: "16px",
            backgroundColor: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              color: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            ✅
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Completed
              </span>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#10b981" }}>
                {stats.progress}%
              </span>
            </div>
            <div style={{ fontSize: "20px", fontWeight: "800", color: "#10b981" }}>
              {stats.done} / {stats.total}
            </div>
          </div>
        </div>

        {/* Hours Logged */}
        <div
          className="dash-card"
          style={{
            padding: "16px",
            backgroundColor: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              backgroundColor: "rgba(139, 92, 246, 0.12)",
              color: "#8b5cf6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            ⏱️
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Hours (Act / Est)
            </div>
            <div style={{ fontSize: "19px", fontWeight: "800", color: "var(--text-primary)" }}>
              {stats.totalActual}h <span style={{ fontSize: "13px", fontWeight: "500", color: "var(--text-muted)" }}>/ {stats.totalEst}h</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Controls & Filter Bar */}
      <div
        className="dash-card"
        style={{
          padding: "14px 18px",
          backgroundColor: "var(--bg-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", flex: 1 }}>
          {/* Search */}
          <div style={{ position: "relative", minWidth: "200px" }}>
            <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: "13px" }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Search code, title, assignee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "8px 12px 8px 30px",
                fontSize: "13px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-canvas)",
                color: "var(--text-primary)",
                width: "100%",
                outline: "none",
              }}
            />
          </div>

          {/* Quick Filter: My Tasks */}
          <button
            type="button"
            onClick={() => setFilterAssignee(filterAssignee === "ME" ? "" : "ME")}
            style={{
              padding: "7px 14px",
              borderRadius: "var(--radius-md)",
              border: filterAssignee === "ME" ? "1px solid #3b82f6" : "1px solid var(--border-subtle)",
              backgroundColor: filterAssignee === "ME" ? "rgba(59, 130, 246, 0.12)" : "transparent",
              color: filterAssignee === "ME" ? "#2563eb" : "var(--text-muted)",
              fontWeight: filterAssignee === "ME" ? "700" : "500",
              fontSize: "12px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>👤</span>
            <span>My Tasks</span>
          </button>

          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            style={{
              padding: "7px 10px",
              fontSize: "12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-canvas)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">All Priorities</option>
            <option value="P1">P1 - Critical</option>
            <option value="P2">P2 - High</option>
            <option value="P3">P3 - Medium</option>
            <option value="P4">P4 - Low</option>
          </select>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: "7px 10px",
              fontSize: "12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-canvas)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">All Types</option>
            <option value="FEATURE">Feature</option>
            <option value="BUGFIX">Bugfix</option>
            <option value="HOTFIX">Hotfix</option>
            <option value="REFACTOR">Refactor</option>
            <option value="TECH_DEBT">Tech Debt</option>
          </select>

          {/* Reset Filters */}
          {(searchQuery || filterPriority || filterType || filterAssignee || filterStatus) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setFilterPriority("");
                setFilterType("");
                setFilterAssignee("");
                setFilterStatus("");
              }}
              style={{
                padding: "6px 10px",
                fontSize: "11px",
                border: "none",
                background: "none",
                color: "#ef4444",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* View Toggle & New Task Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* View mode toggle */}
          <div
            style={{
              display: "flex",
              backgroundColor: "var(--bg-canvas)",
              borderRadius: "var(--radius-md)",
              padding: "3px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              title="Kanban Board View"
              style={{
                padding: "6px 12px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                backgroundColor: viewMode === "kanban" ? "var(--bg-surface)" : "transparent",
                color: viewMode === "kanban" ? "var(--dash-primary)" : "var(--text-muted)",
                boxShadow: viewMode === "kanban" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                fontWeight: viewMode === "kanban" ? "700" : "500",
                fontSize: "12px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <span>📌</span>
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table List View"
              style={{
                padding: "6px 12px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                backgroundColor: viewMode === "table" ? "var(--bg-surface)" : "transparent",
                color: viewMode === "table" ? "var(--dash-primary)" : "var(--text-muted)",
                boxShadow: viewMode === "table" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                fontWeight: viewMode === "table" ? "700" : "500",
                fontSize: "12px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <span>📑</span>
              <span>List</span>
            </button>
          </div>

          {/* Create Task Button */}
          <button
            type="button"
            onClick={() => handleOpenCreate("BACKLOG")}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--dash-primary)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 4px rgba(0, 102, 204, 0.25)",
            }}
          >
            <span>➕</span>
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* 3. Main Content: Kanban or Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
          <div className="spinner" style={{ margin: "0 auto 12px auto" }} />
          <div>Memuat task backlog...</div>
        </div>
      ) : error ? (
        <div
          style={{
            padding: "20px",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "var(--radius-md)",
            color: "#dc2626",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      ) : filteredTasks.length === 0 && tasks.length === 0 ? (
        /* Empty State */
        <div
          className="dash-card"
          style={{
            textAlign: "center",
            padding: "70px 20px",
            backgroundColor: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            border: "2px dashed var(--border-subtle)",
          }}
        >
          <div style={{ fontSize: "42px", marginBottom: "12px" }}>🚀</div>
          <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
            Belum ada task di proyek ini
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "450px", margin: "0 auto 20px auto" }}>
            Mulai backlog pekerjaan proyek dengan menambahkan task pertama. Kode task seperti <strong>{projectDetail?.project_code}-T01</strong> akan di-generate secara otomatis.
          </p>
          <button
            type="button"
            onClick={() => handleOpenCreate("BACKLOG")}
            style={{
              padding: "9px 20px",
              backgroundColor: "var(--dash-primary)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            ➕ Buat Task Pertama
          </button>
        </div>
      ) : viewMode === "kanban" ? (
        /* ================= KANBAN BOARD VIEW ================= */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
            alignItems: "start",
            overflowX: "auto",
            paddingBottom: "16px",
          }}
        >
          {kanbanColumns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.task_status === col.code);
            return (
              <div
                key={col.code}
                style={{
                  backgroundColor: "var(--bg-canvas)",
                  borderRadius: "var(--radius-lg)",
                  border: col.code === "BLOCKED" && colTasks.length > 0 ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  maxHeight: "80vh",
                }}
              >
                {/* Column Header */}
                <div
                  style={{
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid var(--border-subtle)",
                    backgroundColor: col.bg,
                    borderTopLeftRadius: "var(--radius-lg)",
                    borderTopRightRadius: "var(--radius-lg)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        backgroundColor: col.color,
                      }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
                      {col.label}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        padding: "2px 7px",
                        borderRadius: "10px",
                        backgroundColor: "var(--bg-surface)",
                        color: col.color,
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      {colTasks.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenCreate(col.code)}
                    title={`Add task to ${col.label}`}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: "16px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    +
                  </button>
                </div>

                {/* Column Task Cards */}
                <div
                  style={{
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    overflowY: "auto",
                    flex: 1,
                  }}
                >
                  {colTasks.length === 0 ? (
                    <div
                      style={{
                        padding: "30px 10px",
                        textAlign: "center",
                        fontSize: "12px",
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      Tidak ada task
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const prioBadge = getPriorityBadge(task.priority);
                      const typeBadge = getTypeBadge(task.task_type);
                      const isOverdue =
                        task.target_due &&
                        task.task_status !== "DONE" &&
                        new Date(task.target_due) < new Date(new Date().toISOString().split("T")[0]);

                      return (
                        <div
                          key={task.id}
                          className="dash-card"
                          style={{
                            padding: "14px",
                            backgroundColor: "var(--bg-surface)",
                            borderRadius: "var(--radius-md)",
                            border: task.task_status === "BLOCKED" ? "1px solid #ef4444" : "1px solid var(--border-subtle)",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                            position: "relative",
                          }}
                        >
                          {/* Card Top: Code & Badges */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: "800",
                                color: "var(--dash-primary)",
                                fontFamily: "monospace",
                                letterSpacing: "0.5px",
                                backgroundColor: "var(--dash-primary-light)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                              }}
                            >
                              {task.task_code}
                            </span>

                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              {/* Priority Pill */}
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: "700",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: prioBadge.bg,
                                  color: prioBadge.color,
                                  border: `1px solid ${prioBadge.border}`,
                                }}
                              >
                                {prioBadge.label}
                              </span>

                              {/* Type Pill */}
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: "700",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: typeBadge.bg,
                                  color: typeBadge.color,
                                }}
                              >
                                {typeBadge.label}
                              </span>
                            </div>
                          </div>

                          {/* Card Title */}
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: "600",
                              color: "var(--text-primary)",
                              lineHeight: "1.4",
                            }}
                          >
                            {task.title}
                          </div>

                          {/* Description preview */}
                          {task.description && (
                            <div
                              style={{
                                fontSize: "11px",
                                color: "var(--text-muted)",
                                lineHeight: "1.35",
                                maxHeight: "34px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {task.description}
                            </div>
                          )}

                          {/* Blocker Alert Box (Task Lock) */}
                          {task.task_status === "BLOCKED" && task.blocker_tech_notes && (
                            <div
                              style={{
                                padding: "8px 10px",
                                backgroundColor: "rgba(239, 68, 68, 0.1)",
                                borderLeft: "3px solid #ef4444",
                                borderRadius: "4px",
                                fontSize: "11px",
                                color: "#b91c1c",
                              }}
                            >
                              <div style={{ fontWeight: "700", marginBottom: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                                <span>🔒 Task Lock:</span>
                              </div>
                              <div style={{ wordBreak: "break-word" }}>{task.blocker_tech_notes}</div>
                            </div>
                          )}

                          {/* Branch / Aldon Link */}
                          {task.branch_pr_link && (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                fontSize: "11px",
                                color: "#0284c7",
                                backgroundColor: "rgba(2, 132, 199, 0.08)",
                                padding: "3px 8px",
                                borderRadius: "4px",
                                fontFamily: "monospace",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <span>🌿</span>
                              <span>{task.branch_pr_link}</span>
                            </div>
                          )}

                          {/* Card Footer: Assignee, Hours, Due, Status Menu */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              borderTop: "1px solid var(--border-subtle)",
                              paddingTop: "8px",
                              marginTop: "2px",
                              fontSize: "11px",
                              gap: "6px",
                            }}
                          >
                            {/* Assignee Avatar */}
                            <div style={{ display: "flex", alignItems: "center", gap: "5px", flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  width: "22px",
                                  height: "22px",
                                  borderRadius: "50%",
                                  backgroundColor: task.assignee_id ? "var(--dash-primary)" : "var(--bg-subtle)",
                                  color: task.assignee_id ? "#fff" : "var(--text-muted)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "10px",
                                  fontWeight: "700",
                                  flexShrink: 0,
                                }}
                              >
                                {task.assignee_name ? task.assignee_name.charAt(0).toUpperCase() : "?"}
                              </div>
                              <span
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  color: task.assignee_name ? "var(--text-primary)" : "var(--text-muted)",
                                  fontSize: "11px",
                                }}
                              >
                                {task.assignee_name || "Unassigned"}
                              </span>
                            </div>

                            {/* Hours */}
                            <div
                              style={{
                                fontSize: "11px",
                                color: "var(--text-muted)",
                                fontWeight: "600",
                                flexShrink: 0,
                              }}
                              title="Realisasi / Estimasi Jam"
                            >
                              ⏱️ {task.actual_hours}/{task.est_hours}h
                            </div>

                            {/* Due Date */}
                            {task.target_due && (
                              <div
                                style={{
                                  fontSize: "10px",
                                  fontWeight: isOverdue ? "700" : "500",
                                  color: isOverdue ? "#dc2626" : "var(--text-muted)",
                                  backgroundColor: isOverdue ? "rgba(239, 68, 68, 0.12)" : "transparent",
                                  padding: isOverdue ? "2px 5px" : "0",
                                  borderRadius: "3px",
                                  flexShrink: 0,
                                }}
                                title={isOverdue ? "Overdue deadline!" : "Target due date"}
                              >
                                📅 {task.target_due.substring(5)}
                              </div>
                            )}

                            {/* Actions button */}
                            <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(task)}
                                title="Edit Task"
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "13px",
                                  padding: "3px",
                                }}
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task)}
                                title="Hapus Task"
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "13px",
                                  padding: "3px",
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>

                          {/* Quick Status Dropdown */}
                          <div style={{ marginTop: "-2px" }}>
                            <select
                              value={task.task_status}
                              onChange={(e) => handleQuickStatusChange(task, e.target.value)}
                              style={{
                                width: "100%",
                                padding: "4px 8px",
                                fontSize: "10px",
                                fontWeight: "600",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--border-subtle)",
                                backgroundColor: "var(--bg-canvas)",
                                color: "var(--text-primary)",
                                cursor: "pointer",
                              }}
                            >
                              <option value="BACKLOG">Move to: Backlog</option>
                              <option value="TO_DO">Move to: To Do</option>
                              <option value="IN_PROGRESS">Move to: In Progress</option>
                              <option value="CODE_REVIEW">Move to: Code Review</option>
                              <option value="QA_TESTING">Move to: QA Testing</option>
                              <option value="BLOCKED">Move to: Blocked (Lock)</option>
                              <option value="DONE">Move to: Done</option>
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= TABLE LIST VIEW ================= */
        <div
          className="dash-card"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-subtle)",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--bg-canvas)", borderBottom: "1px solid var(--border-subtle)" }}>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: "700", color: "var(--text-muted)" }}>Code</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: "700", color: "var(--text-muted)" }}>Title & Blocker</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: "700", color: "var(--text-muted)" }}>Type</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: "700", color: "var(--text-muted)" }}>Priority</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: "700", color: "var(--text-muted)" }}>Status</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: "700", color: "var(--text-muted)" }}>Assignee</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: "700", color: "var(--text-muted)" }}>Hours</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: "700", color: "var(--text-muted)" }}>Target Due</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: "700", color: "var(--text-muted)" }}>Branch / Aldon</th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: "700", color: "var(--text-muted)" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const prioBadge = getPriorityBadge(task.priority);
                  const typeBadge = getTypeBadge(task.task_type);
                  const isOverdue =
                    task.target_due &&
                    task.task_status !== "DONE" &&
                    new Date(task.target_due) < new Date(new Date().toISOString().split("T")[0]);

                  return (
                    <tr
                      key={task.id}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-canvas)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      {/* Code */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            fontWeight: "800",
                            fontFamily: "monospace",
                            color: "var(--dash-primary)",
                            backgroundColor: "var(--dash-primary-light)",
                            padding: "3px 7px",
                            borderRadius: "4px",
                            fontSize: "11px",
                          }}
                        >
                          {task.task_code}
                        </span>
                      </td>

                      {/* Title & Blocker */}
                      <td style={{ padding: "12px 14px", minWidth: "220px" }}>
                        <div style={{ fontWeight: "600", color: "var(--text-primary)", marginBottom: "2px" }}>
                          {task.title}
                        </div>
                        {task.task_status === "BLOCKED" && task.blocker_tech_notes && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#dc2626",
                              backgroundColor: "rgba(239, 68, 68, 0.1)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              display: "inline-block",
                              marginTop: "4px",
                            }}
                          >
                            🔒 <strong>Blocker:</strong> {task.blocker_tech_notes}
                          </div>
                        )}
                      </td>

                      {/* Type */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "2px 7px",
                            borderRadius: "4px",
                            backgroundColor: typeBadge.bg,
                            color: typeBadge.color,
                          }}
                        >
                          {typeBadge.label}
                        </span>
                      </td>

                      {/* Priority */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "2px 7px",
                            borderRadius: "4px",
                            backgroundColor: prioBadge.bg,
                            color: prioBadge.color,
                            border: `1px solid ${prioBadge.border}`,
                          }}
                        >
                          {prioBadge.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <select
                          value={task.task_status}
                          onChange={(e) => handleQuickStatusChange(task, e.target.value)}
                          style={{
                            padding: "4px 8px",
                            fontSize: "11px",
                            fontWeight: "600",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border-subtle)",
                            backgroundColor: "var(--bg-surface)",
                            color: "var(--text-primary)",
                            cursor: "pointer",
                          }}
                        >
                          <option value="BACKLOG">Backlog</option>
                          <option value="TO_DO">To Do</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="CODE_REVIEW">Code Review</option>
                          <option value="QA_TESTING">QA / Testing</option>
                          <option value="BLOCKED">Blocked (Lock)</option>
                          <option value="DONE">Done</option>
                        </select>
                      </td>

                      {/* Assignee */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div
                            style={{
                              width: "22px",
                              height: "22px",
                              borderRadius: "50%",
                              backgroundColor: task.assignee_id ? "var(--dash-primary)" : "var(--bg-subtle)",
                              color: task.assignee_id ? "#fff" : "var(--text-muted)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              fontWeight: "700",
                            }}
                          >
                            {task.assignee_name ? task.assignee_name.charAt(0).toUpperCase() : "?"}
                          </div>
                          <span>{task.assignee_name || "Unassigned"}</span>
                        </div>
                      </td>

                      {/* Hours */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                        <strong>{task.actual_hours}h</strong> / {task.est_hours}h
                      </td>

                      {/* Target Due */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        {task.target_due ? (
                          <span
                            style={{
                              fontWeight: isOverdue ? "700" : "normal",
                              color: isOverdue ? "#dc2626" : "var(--text-primary)",
                            }}
                          >
                            {task.target_due} {isOverdue && "⚠️"}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>-</span>
                        )}
                      </td>

                      {/* Branch / Aldon Link */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        {task.branch_pr_link ? (
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: "11px",
                              backgroundColor: "rgba(2, 132, 199, 0.08)",
                              color: "#0284c7",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            {task.branch_pr_link}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "12px 14px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(task)}
                          title="Edit Task"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "14px",
                            marginRight: "6px",
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task)}
                          title="Hapus Task"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "14px",
                          }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. MODAL CREATE / EDIT TASK */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            className="dash-card"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderRadius: "var(--radius-xl)",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "var(--text-primary)" }}>
                  {modalMode === "create" ? "➕ Buat Task Baru" : `✏️ Edit Task: ${selectedTask?.task_code}`}
                </h3>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Proyek: <strong>{projectDetail?.project_code}</strong> - {projectDetail?.project_name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitTask} style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Title */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                    Judul Task (Title) <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Implementasi Idempotency Switch Settlement"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-canvas)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Row 2: Type, Priority, Status */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                      Tipe Task (Type)
                    </label>
                    <select
                      value={formData.task_type}
                      onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-canvas)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                      }}
                    >
                      <option value="FEATURE">Feature</option>
                      <option value="BUGFIX">Bugfix</option>
                      <option value="HOTFIX">Hotfix</option>
                      <option value="REFACTOR">Refactor</option>
                      <option value="TECH_DEBT">Tech Debt</option>
                      <option value="MODIFIED">Modified</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                      Prioritas
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-canvas)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                      }}
                    >
                      <option value="P1">P1 - Critical</option>
                      <option value="P2">P2 - High</option>
                      <option value="P3">P3 - Medium</option>
                      <option value="P4">P4 - Low</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                      Status
                    </label>
                    <select
                      value={formData.task_status}
                      onChange={(e) => setFormData({ ...formData, task_status: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-canvas)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                      }}
                    >
                      <option value="BACKLOG">Backlog</option>
                      <option value="TO_DO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="CODE_REVIEW">Code Review</option>
                      <option value="QA_TESTING">QA / Testing</option>
                      <option value="BLOCKED">Blocked (Task Lock)</option>
                      <option value="DONE">Done</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: Assignee & Target Due */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                      Assignee (Anggota Tim)
                    </label>
                    <select
                      value={formData.assignee_id}
                      onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-canvas)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                      }}
                    >
                      <option value="">-- Belum Ditugaskan (Unassigned) --</option>
                      {assigneeChoices.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                      Target Tenggat Waktu (Target Due)
                    </label>
                    <input
                      type="date"
                      value={formData.target_due}
                      onChange={(e) => setFormData({ ...formData, target_due: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-canvas)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                </div>

                {/* Row 4: Hours & Branch / Aldon */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                      Est. Hours (Jam)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={formData.est_hours}
                      onChange={(e) => setFormData({ ...formData, est_hours: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-canvas)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                      Actual Hours (Realisasi)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={formData.actual_hours}
                      onChange={(e) => setFormData({ ...formData, actual_hours: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-canvas)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                      Branch, PR Link, atau Task Aldon
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. feat/payment-switch, ALD-102931"
                      value={formData.branch_pr_link}
                      onChange={(e) => setFormData({ ...formData, branch_pr_link: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-canvas)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                </div>

                {/* Conditional Blocker Notes */}
                {formData.task_status === "BLOCKED" && (
                  <div
                    style={{
                      padding: "14px",
                      backgroundColor: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#b91c1c", marginBottom: "6px" }}>
                      🔒 Catatan Teknis / Blocker Aktif (Task Lock) <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Jelaskan kendala teknis atau dependency eksternal penyebab task ter-lock..."
                      value={formData.blocker_tech_notes}
                      onChange={(e) => setFormData({ ...formData, blocker_tech_notes: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid #fca5a5",
                        backgroundColor: "#fff",
                        color: "#991b1b",
                        fontSize: "13px",
                        outline: "none",
                        resize: "vertical",
                      }}
                    />
                  </div>
                )}

                {/* Description */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                    Rincian Pekerjaan & Kriteria Teknis (Description)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Deskripsi langkah implementasi, acceptance criteria, atau link dokumen teknis..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-canvas)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div
                style={{
                  marginTop: "24px",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  borderTop: "1px solid var(--border-subtle)",
                  paddingTop: "16px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    backgroundColor: "transparent",
                    color: "var(--text-muted)",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "9px 24px",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    backgroundColor: "var(--dash-primary)",
                    color: "#fff",
                    fontWeight: "600",
                    fontSize: "13px",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? "Menyimpan..." : modalMode === "create" ? "Buat Task" : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
