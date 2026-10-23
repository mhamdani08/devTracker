"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import ProjectDetailView from "./ProjectDetailView";

export default function ProjectsView({ authToken, currentUser }) {
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Users & Parameters dropdown choices
  const [userOptions, setUserOptions] = useState([]);
  const [phaseOptions, setPhaseOptions] = useState([]);
  const [healthOptions, setHealthOptions] = useState([]);
  const [priorityOptions, setPriorityOptions] = useState([]);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPhase, setFilterPhase] = useState("");
  const [filterHealth, setFilterHealth] = useState("");
  const [filterUnitTeam, setFilterUnitTeam] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState("create"); // "create" | "edit"
  const [selectedProject, setSelectedProject] = useState(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("overview"); // "overview" | "members" | "documents"
  const [projectDetail, setProjectDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Data State
  const initialFormState = {
    project_code: "",
    project_name: "",
    pic_user_id: "",
    status_project: "INITIATE",
    source_type: "INTERNAL",
    start_date: new Date().toISOString().split("T")[0],
    target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    real_live_date: "",
    unit_team: "Core",
    project_priority: "P2",
    repository: "",
    health_status: "GREEN",
    active_blockers: "",
    key_risk_notes: "",
    estimated_mandays: 30,
    actual_mandays: 0,
  };
  const [formData, setFormData] = useState(initialFormState);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetch Projects & Stats
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filterPhase) queryParams.append("status_project", filterPhase);
      if (filterHealth) queryParams.append("health_status", filterHealth);
      if (filterUnitTeam) queryParams.append("unit_team", filterUnitTeam);
      if (filterPriority) queryParams.append("priority", filterPriority);
      if (searchQuery) queryParams.append("search", searchQuery);

      const res = await fetch(`/api/v1/projects?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setProjects(json.data || []);
    } catch (err) {
      setError(err.message || "Failed to load projects data");
    } finally {
      setLoading(false);
    }
  }, [authToken, filterPhase, filterHealth, filterUnitTeam, filterPriority, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/projects/stats", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        setStats(json.data);
      }
    } catch (err) {
      console.error("Failed to load project statistics:", err);
    }
  }, [authToken]);

  // 2. Fetch Parameters & Users for select inputs
  useEffect(() => {
    async function loadDropdowns() {
      try {
        // Parameters
        const resParams = await fetch("/api/v1/parameters");
        if (resParams.ok) {
          const json = await resParams.json();
          const allParams = json.data || [];
          setPhaseOptions(allParams.filter((p) => p.parameter_type === "PROJECT_PHASE" && p.is_active));
          setHealthOptions(allParams.filter((p) => p.parameter_type === "PROJECT_HEALTH" && p.is_active));
          setPriorityOptions(allParams.filter((p) => p.parameter_type === "PRIORITY" && p.is_active));
        }

        // Users
        try {
          const resUsers = await fetch("/api/v1/users");
          if (resUsers.ok) {
            const jsonUsers = await resUsers.json();
            if (jsonUsers.data && jsonUsers.data.length > 0) {
              setUserOptions(
                jsonUsers.data.map((u) => ({
                  id: u.id,
                  name: `${u.full_name} (${u.email})`,
                }))
              );
              return;
            }
          }
        } catch (e) {
          console.warn("Could not fetch /api/v1/users:", e);
        }

        // Fallback Demo Users if API not responding yet
        const demoUsers = [
          { id: "admin", name: "System Administrator (admin@devtracker.local)" },
          { id: "sa", name: "Sarah Analyst (sa@devtracker.local)" },
          { id: "dev", name: "Budi Developer (dev@devtracker.local)" },
          { id: "qa", name: "Qonita Quality (qa@devtracker.local)" },
          { id: "pm", name: "Pratama Manager (pm@devtracker.local)" },
        ];
        setUserOptions(demoUsers);
      } catch (err) {
        console.error("Error loading dropdown data:", err);
      }
    }
    loadDropdowns();
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchStats();
  }, [fetchProjects, fetchStats]);

  // Fetch single project detail (including members & documents)
  const openProjectDetail = async (projectId) => {
    setIsDetailDrawerOpen(true);
    setLoadingDetail(true);
    setDetailTab("overview");
    try {
      const res = await fetch(`/api/v1/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      let json = null;
      try { json = await res.json(); } catch (e) { }
      if (!res.ok) throw new Error(json?.error || "Failed to retrieve project details");
      setProjectDetail(json?.data || null);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoadingDetail(false);
    }
  };

  const refreshProjectDetail = async (projectId) => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        let json = null;
        try { json = await res.json(); } catch (e) { }
        if (json?.data) setProjectDetail(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Form Handling
  const handleOpenCreateModal = () => {
    setFormMode("create");
    setSelectedProject(null);
    // Generate simple next code suggestion
    const nextNum = projects.length + 1;
    const codeSuggestion = `PRJ-${new Date().getFullYear()}-${String(nextNum).padStart(3, "0")}`;
    setFormData({
      ...initialFormState,
      project_code: codeSuggestion,
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (proj) => {
    setFormMode("edit");
    setSelectedProject(proj);
    setFormData({
      project_code: proj.project_code || "",
      project_name: proj.project_name || "",
      pic_user_id: proj.pic_user_id || "",
      status_project: proj.status_project || "INITIATE",
      source_type: proj.source_type || "INTERNAL",
      start_date: proj.start_date || "",
      target_date: proj.target_date || "",
      real_live_date: proj.real_live_date || "",
      unit_team: proj.unit_team || "Core",
      project_priority: proj.project_priority || "P2",
      repository: proj.repository || "",
      health_status: proj.health_status || "GREEN",
      active_blockers: proj.active_blockers || "",
      key_risk_notes: proj.key_risk_notes || "",
      estimated_mandays: proj.estimated_mandays || 0,
      actual_mandays: proj.actual_mandays || 0,
    });
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let cleanPicId = formData.pic_user_id || null;
      if (cleanPicId && cleanPicId.length < 32) {
        cleanPicId = null;
      }

      const payload = {
        ...formData,
        estimated_mandays: formData.estimated_mandays ? parseInt(formData.estimated_mandays, 10) : null,
        actual_mandays: formData.actual_mandays ? parseInt(formData.actual_mandays, 10) : null,
        real_live_date: formData.real_live_date ? formData.real_live_date : null,
        pic_user_id: cleanPicId,
      };

      const url = formMode === "create" ? "/api/v1/projects" : `/api/v1/projects/${selectedProject.id}`;
      const method = formMode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      let json = null;
      try {
        json = await res.json();
      } catch (err) {
        // Plain text response from server or proxy
      }

      if (!res.ok) {
        const errorText = json?.error || json?.message || (res.status === 404 ? "API endpoint /api/v1/projects is not available." : `HTTP ${res.status}: Failed to save project`);
        throw new Error(errorText);
      }

      showToast(formMode === "create" ? "Project created successfully!" : "Project updated successfully!", "success");
      setIsFormModalOpen(false);
      fetchProjects();
      fetchStats();
      if (formMode === "edit" && projectDetail?.id === selectedProject?.id) {
        refreshProjectDetail(selectedProject.id);
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async (proj) => {
    if (!confirm(`Are you sure you want to delete project ${proj.project_code} - ${proj.project_name}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/projects/${proj.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      let json = null;
      try { json = await res.json(); } catch (e) { }
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}: Failed to delete project`);

      showToast("Project deleted successfully", "success");
      if (isDetailDrawerOpen && projectDetail?.id === proj.id) {
        setIsDetailDrawerOpen(false);
      }
      fetchProjects();
      fetchStats();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // Helper styles for Health Badges
  const getHealthBadge = (health) => {
    const h = (health || "").toUpperCase();
    switch (h) {
      case "GREEN":
        return {
          label: "Green (On Track)",
          bg: "#ecfdf5",
          color: "#059669",
          border: "#a7f3d0",
          dot: "#10b981",
        };
      case "AMBER":
        return {
          label: "Amber (At Risk)",
          bg: "#fffbeb",
          color: "#d97706",
          border: "#fde68a",
          dot: "#f59e0b",
        };
      case "RED":
        return {
          label: "Red (Critical)",
          bg: "#fef2f2",
          color: "#dc2626",
          border: "#fecaca",
          dot: "#ef4444",
        };
      default:
        return {
          label: h || "Unspecified",
          bg: "#f1f5f9",
          color: "#64748b",
          border: "#e2e8f0",
          dot: "#94a3b8",
        };
    }
  };

  const getPhaseBadge = (phase) => {
    return {
      bg: "#faf5ff",
      color: "#7c3aed",
      border: "#e9d5ff",
    };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            backgroundColor: toast.type === "success" ? "#064e3b" : "#7f1d1d",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "14px",
            fontWeight: "500",
            animation: "slideUp 0.3s ease",
          }}
        >
          <span>{toast.type === "success" ? "✓" : "⚠"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {!isDetailDrawerOpen && (
        <>
          {/* 1. Sleek Compact Header */}
          <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          paddingBottom: "4px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ fontSize: "1.3rem", fontWeight: "700", color: "var(--text-main)", letterSpacing: "-0.01em", margin: 0 }}>
              Projects & Portfolio
            </h1>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: "var(--dash-primary)",
                backgroundColor: "var(--dash-primary-light)",
                padding: "2px 8px",
                borderRadius: "12px",
                border: "1px solid var(--dash-primary-border)",
              }}
            >
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "3px 0 0" }}>
            Monitor SDLC project phases, RAG health status, task progress, and documentation.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={fetchProjects}
            style={{
              padding: "7px 13px",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-main)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={loading ? "animate-pulse" : ""}>
              <path d="M23 4v6h-6"></path>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            Refresh
          </button>

          <button
            onClick={handleOpenCreateModal}
            style={{
              padding: "7px 15px",
              backgroundColor: "var(--dash-primary)",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 1px 3px rgba(5,150,105,0.3)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Project
          </button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div
        className="dash-card"
        style={{
          padding: "12px 16px",
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", flex: 1 }}>
          {/* Search Input */}
          <div style={{ position: "relative", minWidth: "240px", flex: "1 1 240px" }}>
            <input
              type="text"
              placeholder="Search project code, name, or PIC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "7px 12px 7px 32px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-light)",
                fontSize: "13px",
                outline: "none",
                backgroundColor: "var(--bg-subtle)",
              }}
            />
            <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-subtle)", fontSize: "13px" }}>
              🔍
            </span>
          </div>

          {/* Filter: Phase */}
          <select
            value={filterPhase}
            onChange={(e) => setFilterPhase(e.target.value)}
            style={{
              padding: "7px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-light)",
              fontSize: "13px",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-main)",
            }}
          >
            <option value="">All Phases</option>
            {phaseOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.name}
              </option>
            ))}
          </select>

          {/* Filter: Health */}
          <select
            value={filterHealth}
            onChange={(e) => setFilterHealth(e.target.value)}
            style={{
              padding: "7px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-light)",
              fontSize: "13px",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-main)",
            }}
          >
            <option value="">All Health Statuses</option>
            <option value="GREEN">🟢 Green (On Track)</option>
            <option value="AMBER">🟡 Amber (At Risk)</option>
            <option value="RED">🔴 Red (Critical)</option>
          </select>

          {/* Filter: Unit Team */}
          <select
            value={filterUnitTeam}
            onChange={(e) => setFilterUnitTeam(e.target.value)}
            style={{
              padding: "7px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-light)",
              fontSize: "13px",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-main)",
            }}
          >
            <option value="">All Unit Teams</option>
            <option value="Core">Core</option>
            <option value="Non Core">Non Core</option>
            <option value="All">All</option>
          </select>

          {/* Reset Filters */}
          {(searchQuery || filterPhase || filterHealth || filterUnitTeam || filterPriority) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterPhase("");
                setFilterHealth("");
                setFilterUnitTeam("");
                setFilterPriority("");
              }}
              style={{
                padding: "7px 12px",
                backgroundColor: "transparent",
                color: "#dc2626",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              ✕ Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Projects List Table */}
      {loading ? (
        <div className="dash-card" style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "16px", fontWeight: "600" }}>Loading projects list...</div>
        </div>
      ) : error ? (
        <div className="dash-card" style={{ padding: "40px", textAlign: "center", color: "#dc2626" }}>
          <div style={{ fontSize: "15px", fontWeight: "600" }}>An error occurred: {error}</div>
          <button onClick={fetchProjects} style={{ marginTop: "12px", padding: "8px 16px", cursor: "pointer" }}>
            Retry
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="dash-card" style={{ padding: "60px 20px", textAlign: "center" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📁</div>
          <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-main)" }}>No projects found</h3>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "420px", margin: "6px auto 16px" }}>
            {searchQuery || filterPhase || filterHealth || filterUnitTeam
              ? "No projects match your search or filter criteria. Try resetting the filters."
              : "Start by adding a project to track software lifecycles, team assignments, and supporting documents."}
          </p>
          {searchQuery || filterPhase || filterHealth || filterUnitTeam ? (
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterPhase("");
                setFilterHealth("");
                setFilterUnitTeam("");
              }}
              style={{
                padding: "8px 16px",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "13px",
              }}
            >
              Reset Filters
            </button>
          ) : (
            <button
              onClick={handleOpenCreateModal}
              style={{
                padding: "8px 18px",
                backgroundColor: "var(--dash-primary)",
                color: "#ffffff",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "13px",
              }}
            >
              + Add First Project
            </button>
          )}
        </div>
      ) : (
        <div className="dash-card" style={{ overflowX: "auto", position: "relative", minHeight: "260px" }}>
          {/* Backdrop to close active dropdown menu */}
          {activeMenuId && (
            <div
              style={{ position: "fixed", inset: 0, zIndex: 30 }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuId(null);
              }}
            />
          )}

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--bg-subtle)", borderBottom: "1px solid var(--border-light)", textAlign: "left" }}>
                <th style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-muted)", width: "120px", whiteSpace: "nowrap" }}>Code / Unit</th>
                <th style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-muted)" }}>Project Name</th>
                <th style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-muted)", width: "130px", whiteSpace: "nowrap" }}>Phase (SDLC)</th>
                <th style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-muted)", width: "130px", whiteSpace: "nowrap" }}>Health</th>
                <th style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-muted)", width: "120px", whiteSpace: "nowrap" }}>PIC</th>
                <th style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-muted)", width: "100px", whiteSpace: "nowrap" }}>Target Date</th>
                <th style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-muted)", width: "100px", whiteSpace: "nowrap" }}>Progress</th>
                <th
                  style={{
                    padding: "10px 14px",
                    fontWeight: "600",
                    color: "var(--text-muted)",
                    textAlign: "center",
                    width: "50px",
                    whiteSpace: "nowrap",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.map((proj, idx) => {
                const hBadge = getHealthBadge(proj.health_status);
                const isHovered = hoveredRowId === proj.id;
                const openUpwards = idx >= projects.length - 2 && projects.length >= 3;
                return (
                  <tr
                    key={proj.id}
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      cursor: "pointer",
                      backgroundColor: isHovered ? "var(--bg-subtle)" : "transparent",
                      transition: "background-color 0.15s ease",
                    }}
                    onMouseEnter={() => setHoveredRowId(proj.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                    onClick={() => openProjectDetail(proj.id)}
                  >
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontWeight: "700", color: "var(--dash-primary)", fontSize: "12px" }}>
                        {proj.project_code}
                      </div>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "600",
                          color: "#475569",
                          backgroundColor: "#f1f5f9",
                          padding: "1px 5px",
                          borderRadius: "3px",
                          display: "inline-block",
                          marginTop: "2px",
                        }}
                      >
                        {proj.unit_team}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: "600", color: "var(--text-main)" }}>{proj.project_name}</span>
                        {proj.repository && (
                          <a
                            href={proj.repository}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open Repository"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontSize: "10px",
                              fontWeight: "600",
                              color: "var(--dash-primary)",
                              backgroundColor: "var(--dash-primary-light)",
                              border: "1px solid var(--dash-primary-border)",
                              borderRadius: "3px",
                              padding: "1px 5px",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "2px",
                            }}
                          >
                            Git ↗
                          </a>
                        )}
                      </div>
                      {proj.active_blockers && (
                        <div style={{ fontSize: "11px", color: "#d97706", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <span>⚠️</span>
                          <span style={{ maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {proj.active_blockers}
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: "11px", color: "#7c3aed", backgroundColor: "#faf5ff", padding: "2px 7px", borderRadius: "4px", border: "1px solid #e9d5ff" }}>
                        {proj.status_project_name || proj.status_project}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "700",
                          backgroundColor: hBadge.bg,
                          color: hBadge.color,
                          border: `1px solid ${hBadge.border}`,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: hBadge.dot }}></span>
                        {proj.health_status || "UNSPEC"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {proj.pic_name || "-"}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-main)", whiteSpace: "nowrap", fontSize: "12px" }}>
                      {proj.target_date}
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "50px", height: "5px", backgroundColor: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ width: `${proj.progress_percentage}%`, height: "100%", backgroundColor: "var(--dash-primary)" }}></div>
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)" }}>{proj.progress_percentage}%</span>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "center",
                        position: "relative",
                        whiteSpace: "nowrap",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: "inline-block", position: "relative" }}>
                        {/* 3-line hamburger action button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === proj.id ? null : proj.id);
                          }}
                          title="Actions Menu"
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "6px",
                            border: activeMenuId === proj.id ? "1px solid var(--dash-primary)" : "1px solid var(--border-light)",
                            backgroundColor: activeMenuId === proj.id ? "var(--dash-primary-light)" : "var(--bg-surface)",
                            color: activeMenuId === proj.id ? "var(--dash-primary)" : "var(--text-main)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <line x1="4" y1="6" x2="20" y2="6"></line>
                            <line x1="4" y1="12" x2="20" y2="12"></line>
                            <line x1="4" y1="18" x2="20" y2="18"></line>
                          </svg>
                        </button>

                        {/* Action Dropdown Menu */}
                        {activeMenuId === proj.id && (
                          <div
                            className="dash-card animate-fade-in"
                            style={{
                              position: "absolute",
                              right: 0,
                              top: openUpwards ? "auto" : "calc(100% + 4px)",
                              bottom: openUpwards ? "calc(100% + 4px)" : "auto",
                              width: "165px",
                              backgroundColor: "var(--bg-surface)",
                              borderRadius: "8px",
                              border: "1px solid var(--border-light)",
                              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                              zIndex: 50,
                              padding: "5px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                              textAlign: "left",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                openProjectDetail(proj.id);
                              }}
                              style={{
                                width: "100%",
                                padding: "7px 10px",
                                backgroundColor: "transparent",
                                border: "none",
                                borderRadius: "5px",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: "500",
                                color: "var(--text-main)",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                textAlign: "left",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                              <span>View Details</span>
                            </button>

                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                handleOpenEditModal(proj);
                              }}
                              style={{
                                width: "100%",
                                padding: "7px 10px",
                                backgroundColor: "transparent",
                                border: "none",
                                borderRadius: "5px",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: "500",
                                color: "var(--text-main)",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                textAlign: "left",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                              <span>Edit Project</span>
                            </button>

                            {proj.repository && (
                              <a
                                href={proj.repository}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setActiveMenuId(null)}
                                style={{
                                  width: "100%",
                                  padding: "7px 10px",
                                  backgroundColor: "transparent",
                                  border: "none",
                                  borderRadius: "5px",
                                  fontSize: "12px",
                                  fontWeight: "500",
                                  color: "var(--text-main)",
                                  textDecoration: "none",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  textAlign: "left",
                                  boxSizing: "border-box",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                  <polyline points="15 3 21 3 21 9"></polyline>
                                  <line x1="10" y1="14" x2="21" y2="3"></line>
                                </svg>
                                <span>Git Repo ↗</span>
                              </a>
                            )}

                            <div style={{ height: "1px", backgroundColor: "var(--border-light)", margin: "3px 0" }}></div>

                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                handleDeleteProject(proj);
                              }}
                              style={{
                                width: "100%",
                                padding: "7px 10px",
                                backgroundColor: "transparent",
                                border: "none",
                                borderRadius: "5px",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: "500",
                                color: "#dc2626",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                textAlign: "left",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fef2f2")}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                              <span>Delete Project</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}

      {/* =========================================================================
       * 5. FULL-WIDTH PROJECT DETAIL VIEW
       * ========================================================================= */}
      {isDetailDrawerOpen && (
        <ProjectDetailView
          projectDetail={projectDetail}
          loadingDetail={loadingDetail}
          authToken={authToken}
          currentUser={currentUser}
          userOptions={userOptions}
          onBack={() => setIsDetailDrawerOpen(false)}
          onRefresh={() => projectDetail?.id && refreshProjectDetail(projectDetail.id)}
          onEdit={() => handleOpenEditModal(projectDetail)}
          onDelete={() => handleDeleteProject(projectDetail)}
          onDetailChange={() => projectDetail?.id && refreshProjectDetail(projectDetail.id)}
          showToast={showToast}
          getHealthBadge={getHealthBadge}
        />
      )}

      {/* =========================================================================
       * 6. CREATE / EDIT PROJECT MODAL FORM
       * ========================================================================= */}
      {isFormModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setIsFormModalOpen(false)}
        >
          <div
            className="dash-card"
            style={{
              width: "100%",
              maxWidth: "700px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", borderBottom: "1px solid var(--border-light)", paddingBottom: "16px", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>
                {formMode === "create" ? "Create New Project" : "Edit Project Details"}
              </h2>
              <button
                onClick={() => setIsFormModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Row 1: Code & Name */}
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    Project Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="PRJ-2026-001"
                    value={formData.project_code}
                    onChange={(e) => setFormData({ ...formData, project_code: e.target.value.toUpperCase() })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Initiative or project name..."
                    value={formData.project_name}
                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                    }}
                  />
                </div>
              </div>

              {/* Row 2: PIC, Source, Unit */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    Main Project PIC
                  </label>
                  <select
                    value={formData.pic_user_id}
                    onChange={(e) => setFormData({ ...formData, pic_user_id: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="">-- Select PIC --</option>
                    {userOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    Project Source
                  </label>
                  <select
                    value={formData.source_type}
                    onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="INTERNAL">Internal</option>
                    <option value="CLIENT">Client</option>
                    <option value="R&D">R&D</option>
                    <option value="MIGRATION">Migration</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    Unit Team *
                  </label>
                  <select
                    value={formData.unit_team}
                    onChange={(e) => setFormData({ ...formData, unit_team: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="Core">Core</option>
                    <option value="Non Core">Non Core</option>
                    <option value="All">All</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Phase, Health, Priority */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    SDLC Phase *
                  </label>
                  <select
                    value={formData.status_project}
                    onChange={(e) => setFormData({ ...formData, status_project: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                    }}
                  >
                    {phaseOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.name}
                      </option>
                    ))}
                    {phaseOptions.length === 0 && <option value="INITIATE">Initiate</option>}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    Project Health (RAG)
                  </label>
                  <select
                    value={formData.health_status}
                    onChange={(e) => setFormData({ ...formData, health_status: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="GREEN">🟢 Green (On Track)</option>
                    <option value="AMBER">🟡 Amber (At Risk)</option>
                    <option value="RED">🔴 Red (Critical)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    Priority
                  </label>
                  <select
                    value={formData.project_priority}
                    onChange={(e) => setFormData({ ...formData, project_priority: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                    }}
                  >
                    {priorityOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.name}
                      </option>
                    ))}
                    {priorityOptions.length === 0 && <option value="P2">P2 - High</option>}
                  </select>
                </div>
              </div>

              {/* Row 4: Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    Target Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    Actual Live Date
                  </label>
                  <input
                    type="date"
                    value={formData.real_live_date}
                    onChange={(e) => setFormData({ ...formData, real_live_date: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                    }}
                  />
                </div>
              </div>

              {/* Row 5: Mandays & Repository */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    Estimated Mandays
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.estimated_mandays}
                    onChange={(e) => setFormData({ ...formData, estimated_mandays: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    Actual Mandays
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.actual_mandays}
                    onChange={(e) => setFormData({ ...formData, actual_mandays: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    Git Repository URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://github.com/..."
                    value={formData.repository}
                    onChange={(e) => setFormData({ ...formData, repository: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                    }}
                  />
                </div>
              </div>

              {/* Row 6: Active Blockers */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                  Active Blockers (Task Lock / Obstacles)
                </label>
                <textarea
                  rows="2"
                  placeholder="Notes on issues, dependencies, or blockers..."
                  value={formData.active_blockers}
                  onChange={(e) => setFormData({ ...formData, active_blockers: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-light)",
                    fontSize: "13px",
                    resize: "vertical",
                  }}
                ></textarea>
              </div>

              {/* Row 7: Key Risks */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                  Key Risk Notes
                </label>
                <textarea
                  rows="2"
                  placeholder="Potential risk analysis or mitigation plan..."
                  value={formData.key_risk_notes}
                  onChange={(e) => setFormData({ ...formData, key_risk_notes: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-light)",
                    fontSize: "13px",
                    resize: "vertical",
                  }}
                ></textarea>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  style={{
                    padding: "9px 18px",
                    backgroundColor: "transparent",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "13px",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "9px 22px",
                    backgroundColor: "var(--dash-primary)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "13px",
                  }}
                >
                  {isSubmitting ? "Saving..." : formMode === "create" ? "Create Project" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
