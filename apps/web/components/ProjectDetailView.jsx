"use client";

import { useState } from "react";

export default function ProjectDetailView({
  projectDetail,
  loadingDetail,
  authToken,
  userOptions = [],
  onBack,
  onRefresh,
  onEdit,
  onDelete,
  onDetailChange,
  showToast,
  getHealthBadge,
}) {
  const [detailTab, setDetailTab] = useState("overview"); // "overview" | "members" | "documents"
  const [copiedRepo, setCopiedRepo] = useState(false);

  // Sub-resource form state
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("DEVELOPER");
  const [newDocName, setNewDocName] = useState("");
  const [newDocType, setNewDocType] = useState("BRD");
  const [newDocUrl, setNewDocUrl] = useState("");
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);

  const handleCopyRepo = (repoUrl) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(repoUrl);
      setCopiedRepo(true);
      setTimeout(() => setCopiedRepo(false), 2000);
    }
  };

  // Sub-resource handlers: Add Member
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberUserId) {
      showToast?.("Please select a user to add", "error");
      return;
    }
    setIsSubmittingSub(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectDetail.id}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          user_id: newMemberUserId,
          role: newMemberRole,
        }),
      });
      let json = null;
      try {
        json = await res.json();
      } catch (e) {}
      if (!res.ok) throw new Error(json?.error || "Failed to add member");

      showToast?.("Team member added successfully", "success");
      setNewMemberUserId("");
      onDetailChange?.();
    } catch (err) {
      showToast?.(err.message, "error");
    } finally {
      setIsSubmittingSub(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm("Remove this team member from the project?")) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectDetail.id}/members/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("Failed to remove team member");
      showToast?.("Team member removed successfully", "success");
      onDetailChange?.();
    } catch (err) {
      showToast?.(err.message, "error");
    }
  };

  // Sub-resource handlers: Add Document
  const handleAddDocument = async (e) => {
    e.preventDefault();
    if (!newDocName || !newDocUrl) {
      showToast?.("Document name and file URL are required", "error");
      return;
    }
    setIsSubmittingSub(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectDetail.id}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          doc_name: newDocName,
          doc_type: newDocType,
          file_url: newDocUrl,
          storage_type: "EXTERNAL_LINK",
        }),
      });
      let json = null;
      try {
        json = await res.json();
      } catch (e) {}
      if (!res.ok) throw new Error(json?.error || "Failed to add document");

      showToast?.("Project document added successfully", "success");
      setNewDocName("");
      setNewDocUrl("");
      onDetailChange?.();
    } catch (err) {
      showToast?.(err.message, "error");
    } finally {
      setIsSubmittingSub(false);
    }
  };

  const handleRemoveDocument = async (docId) => {
    if (!confirm("Remove this document from the project?")) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectDetail.id}/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("Failed to remove document");
      showToast?.("Document removed successfully", "success");
      onDetailChange?.();
    } catch (err) {
      showToast?.(err.message, "error");
    }
  };

  const hBadge = getHealthBadge
    ? getHealthBadge(projectDetail?.health_status)
    : { label: projectDetail?.health_status || "UNSPEC", bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0", dot: "#94a3b8" };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
      {/* Top Bar: Back Button, Breadcrumb, Actions */}
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
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={onBack}
            style={{
              padding: "7px 14px",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-main)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--dash-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-light)")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to Projects
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)" }}>
            <span>Projects</span>
            <span>/</span>
            <span style={{ fontWeight: "700", color: "var(--dash-primary)", fontFamily: "var(--font-mono)" }}>
              {projectDetail?.project_code || "PRJ-..."}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={onRefresh}
            disabled={loadingDetail}
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
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className={loadingDetail ? "animate-pulse" : ""}
            >
              <path d="M23 4v6h-6"></path>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            Refresh
          </button>

          {projectDetail && (
            <>
              <button
                onClick={onEdit}
                style={{
                  padding: "7px 14px",
                  backgroundColor: "var(--bg-surface)",
                  color: "var(--text-main)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
                Edit Project
              </button>

              <button
                onClick={onDelete}
                style={{
                  padding: "7px 14px",
                  backgroundColor: "#fef2f2",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Loading or Missing State */}
      {loadingDetail ? (
        <div className="dash-card" style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "6px" }}>Loading project details...</div>
          <div style={{ fontSize: "13px" }}>Retrieving lifecycle specs, assignments, and supporting documents.</div>
        </div>
      ) : !projectDetail ? (
        <div className="dash-card" style={{ padding: "40px", textAlign: "center", color: "#dc2626" }}>
          <div style={{ fontSize: "15px", fontWeight: "600" }}>Project details not found.</div>
          <button
            onClick={onBack}
            style={{
              marginTop: "12px",
              padding: "8px 16px",
              cursor: "pointer",
              borderRadius: "6px",
              border: "1px solid var(--border-light)",
            }}
          >
            ← Back to Projects
          </button>
        </div>
      ) : (
        <>
          {/* 1. Full-Width Project Hero Banner */}
          <div
            className="dash-card"
            style={{
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              background: "linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-subtle) 100%)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    fontWeight: "700",
                    backgroundColor: "var(--dash-primary-light)",
                    color: "var(--dash-primary)",
                    padding: "3px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--dash-primary-border)",
                  }}
                >
                  {projectDetail.project_code}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#475569",
                    backgroundColor: "#e2e8f0",
                    padding: "3px 10px",
                    borderRadius: "6px",
                  }}
                >
                  Unit: {projectDetail.unit_team}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    backgroundColor: "#faf5ff",
                    color: "#7c3aed",
                    border: "1px solid #e9d5ff",
                    padding: "3px 10px",
                    borderRadius: "6px",
                  }}
                >
                  Phase: {projectDetail.status_project_name || projectDetail.status_project}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    backgroundColor: hBadge.bg,
                    color: hBadge.color,
                    border: `1px solid ${hBadge.border}`,
                    padding: "3px 10px",
                    borderRadius: "6px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: hBadge.dot }}></span>
                  Health: {projectDetail.health_status || "UNSPEC"}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    backgroundColor: "#fef2f2",
                    color: "#dc2626",
                    border: "1px solid #fecaca",
                    padding: "3px 10px",
                    borderRadius: "6px",
                  }}
                >
                  Priority: {projectDetail.project_priority || "P2"}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    backgroundColor: "#f1f5f9",
                    color: "#64748b",
                    padding: "3px 10px",
                    borderRadius: "6px",
                  }}
                >
                  Source: {projectDetail.source_type}
                </span>
              </div>

              {projectDetail.repository && (
                <a
                  href={projectDetail.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "var(--dash-primary)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    textDecoration: "none",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-light)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                  </svg>
                  Repository ↗
                </a>
              )}
            </div>

            <div>
              <h1 style={{ fontSize: "1.45rem", fontWeight: "700", color: "var(--text-main)", margin: "4px 0 6px 0", letterSpacing: "-0.01em" }}>
                {projectDetail.project_name}
              </h1>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "14px", fontSize: "13px", color: "var(--text-muted)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>👤 PIC:</span>
                  <strong style={{ color: "var(--text-main)" }}>{projectDetail.pic_name || "Unassigned"}</strong>
                  {projectDetail.pic_email && <span>({projectDetail.pic_email})</span>}
                </div>
                <div>•</div>
                <div>
                  <span>Target Go-Live:</span> <strong style={{ color: "var(--text-main)" }}>{projectDetail.target_date}</strong>
                </div>
                {projectDetail.real_live_date && (
                  <>
                    <div>•</div>
                    <div style={{ color: "#059669", fontWeight: "600" }}>
                      ✓ Actual Go-Live: {projectDetail.real_live_date}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 2. Full-Width 4-KPI Metric Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
            }}
          >
            {/* KPI 1: Completion */}
            <div className="dash-card" style={{ padding: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                TASK COMPLETION
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "8px" }}>
                <span style={{ fontSize: "22px", fontWeight: "800", color: "var(--dash-primary)" }}>
                  {projectDetail.progress_percentage}%
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  ({projectDetail.total_task_done || 0} / {projectDetail.total_task || 0} tasks done)
                </span>
              </div>
              <div style={{ width: "100%", height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ width: `${projectDetail.progress_percentage}%`, height: "100%", backgroundColor: "var(--dash-primary)" }}></div>
              </div>
            </div>

            {/* KPI 2: Schedule & Timeline */}
            <div className="dash-card" style={{ padding: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                PROJECT TIMELINE
              </div>
              <div style={{ fontSize: "13px", display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                <div>
                  Start Date: <strong style={{ color: "var(--text-main)" }}>{projectDetail.start_date}</strong>
                </div>
                <div>
                  Target Date: <strong style={{ color: "var(--text-main)" }}>{projectDetail.target_date}</strong>
                </div>
              </div>
            </div>

            {/* KPI 3: Mandays Effort */}
            <div className="dash-card" style={{ padding: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                MANDAYS EFFORT
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "8px" }}>
                <span style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-main)" }}>
                  {projectDetail.actual_mandays || 0} / {projectDetail.estimated_mandays || 0}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>days used</span>
              </div>
              <div style={{ width: "100%", height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(((projectDetail.actual_mandays || 0) / Math.max(1, projectDetail.estimated_mandays || 1)) * 100)
                    )}%`,
                    height: "100%",
                    backgroundColor: "#3b82f6",
                  }}
                ></div>
              </div>
            </div>

            {/* KPI 4: Health Status & Phase */}
            <div className="dash-card" style={{ padding: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                SDLC STATUS & HEALTH
              </div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: "#7c3aed", marginTop: "2px" }}>
                {projectDetail.status_project_name || projectDetail.status_project}
              </div>
              <div style={{ fontSize: "12px", color: hBadge.color, marginTop: "4px", fontWeight: "600" }}>
                ● {hBadge.label}
              </div>
            </div>
          </div>

          {/* 3. Navigation Tabs Strip */}
          <div
            className="dash-card"
            style={{
              display: "flex",
              gap: "8px",
              padding: "6px 8px",
              backgroundColor: "var(--bg-surface)",
            }}
          >
            {[
              { id: "overview", label: "Overview & Specifications", icon: "📋" },
              { id: "members", label: `Team Members (${projectDetail?.members?.length || 0})`, icon: "👥" },
              { id: "documents", label: `Supporting Documents (${projectDetail?.documents?.length || 0})`, icon: "📁" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDetailTab(tab.id)}
                style={{
                  padding: "9px 18px",
                  backgroundColor: detailTab === tab.id ? "var(--dash-primary-light)" : "transparent",
                  color: detailTab === tab.id ? "var(--dash-primary)" : "var(--text-muted)",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  fontWeight: detailTab === tab.id ? "700" : "500",
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* 4. Tab Body Content */}
          {detailTab === "overview" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "16px" }}>
              {/* Left Column: Specifications & Codebase */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* General Specs Card */}
                <div className="dash-card" style={{ padding: "20px" }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "var(--text-main)",
                      marginBottom: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>📋</span> Project Specifications
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px" }}>
                      <span style={{ color: "var(--text-muted)" }}>Project Code:</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: "700", color: "var(--dash-primary)" }}>
                        {projectDetail.project_code}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px" }}>
                      <span style={{ color: "var(--text-muted)" }}>Project Name:</span>
                      <span style={{ fontWeight: "600", color: "var(--text-main)", textAlign: "right" }}>{projectDetail.project_name}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px" }}>
                      <span style={{ color: "var(--text-muted)" }}>Project Source:</span>
                      <span style={{ fontWeight: "600" }}>{projectDetail.source_type}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px" }}>
                      <span style={{ color: "var(--text-muted)" }}>Unit Team:</span>
                      <span style={{ fontWeight: "600" }}>{projectDetail.unit_team}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px" }}>
                      <span style={{ color: "var(--text-muted)" }}>Primary Lead PIC:</span>
                      <span style={{ fontWeight: "600" }}>{projectDetail.pic_name || "Unassigned"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px" }}>
                      <span style={{ color: "var(--text-muted)" }}>PIC Contact Email:</span>
                      <span style={{ color: "var(--text-muted)" }}>{projectDetail.pic_email || "-"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px" }}>
                      <span style={{ color: "var(--text-muted)" }}>Start Date:</span>
                      <span>{projectDetail.start_date}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Target Live Date:</span>
                      <span style={{ fontWeight: "600" }}>{projectDetail.target_date}</span>
                    </div>
                  </div>
                </div>

                {/* Codebase & Git Card */}
                <div className="dash-card" style={{ padding: "20px" }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "var(--text-main)",
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>💻</span> Codebase & Source Control
                  </div>
                  {projectDetail.repository ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div
                        style={{
                          padding: "10px 14px",
                          backgroundColor: "var(--bg-subtle)",
                          border: "1px solid var(--border-light)",
                          borderRadius: "6px",
                          fontFamily: "var(--font-mono)",
                          fontSize: "12px",
                          wordBreak: "break-all",
                          color: "var(--text-main)",
                        }}
                      >
                        {projectDetail.repository}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <a
                          href={projectDetail.repository}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "6px 14px",
                            backgroundColor: "var(--dash-primary)",
                            color: "#ffffff",
                            borderRadius: "var(--radius-md)",
                            textDecoration: "none",
                            fontSize: "12px",
                            fontWeight: "600",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          Open Repository ↗
                        </a>
                        <button
                          onClick={() => handleCopyRepo(projectDetail.repository)}
                          style={{
                            padding: "6px 14px",
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-light)",
                            borderRadius: "var(--radius-md)",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "500",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          {copiedRepo ? "✓ Copied!" : "📋 Copy URL"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                      No git repository URL specified. You can link a repository by clicking "Edit Project".
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Blockers, Risks, Quick Nav */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Active Blockers Card */}
                <div
                  className="dash-card"
                  style={{
                    padding: "20px",
                    backgroundColor: projectDetail.active_blockers ? "#fffbeb" : "var(--bg-surface)",
                    borderColor: projectDetail.active_blockers ? "#fde68a" : "var(--border-light)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "700",
                      color: projectDetail.active_blockers ? "#b45309" : "var(--text-main)",
                      marginBottom: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>{projectDetail.active_blockers ? "⚠️" : "✓"}</span>
                    <span>Active Blockers & Impediments</span>
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      lineHeight: "1.5",
                      color: projectDetail.active_blockers ? "#92400e" : "var(--text-muted)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {projectDetail.active_blockers ||
                      "No active blockers reported for this project. Workflow is proceeding smoothly."}
                  </div>
                </div>

                {/* Key Risks Card */}
                <div className="dash-card" style={{ padding: "20px" }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "var(--text-main)",
                      marginBottom: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>🛡️</span> Key Risk Notes & Mitigation
                  </div>
                  <div style={{ fontSize: "13px", lineHeight: "1.5", color: "var(--text-main)", whiteSpace: "pre-wrap" }}>
                    {projectDetail.key_risk_notes ||
                      "No critical risk notes recorded. Regularly review architecture and external dependency schedules."}
                  </div>
                </div>

                {/* Quick Jump Box */}
                <div className="dash-card" style={{ padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-main)" }}>Team & Documentation</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {projectDetail.members?.length || 0} team members &bull; {projectDetail.documents?.length || 0} documents
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => setDetailTab("members")}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "var(--bg-subtle)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "var(--radius-md)",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      View Team →
                    </button>
                    <button
                      onClick={() => setDetailTab("documents")}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "var(--bg-subtle)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "var(--radius-md)",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      View Docs →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Team Members */}
          {detailTab === "members" && (
            <div className="dash-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: "700", margin: 0, color: "var(--text-main)" }}>
                    Project Team Members ({projectDetail.members?.length || 0})
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "3px 0 0" }}>
                    Engineers, analysts, and managers assigned to this project.
                  </p>
                </div>
              </div>

              {/* Add Member Form */}
              <form
                onSubmit={handleAddMember}
                style={{
                  padding: "16px",
                  backgroundColor: "var(--bg-subtle)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                }}
              >
                <div style={{ flex: "1 1 240px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "5px" }}>
                    Select User *
                  </label>
                  <select
                    value={newMemberUserId}
                    onChange={(e) => setNewMemberUserId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                      backgroundColor: "var(--bg-surface)",
                      color: "var(--text-main)",
                    }}
                  >
                    <option value="">-- Choose User --</option>
                    {userOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ width: "200px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "5px" }}>
                    Project Role *
                  </label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                      backgroundColor: "var(--bg-surface)",
                      color: "var(--text-main)",
                    }}
                  >
                    <option value="OWNER">OWNER</option>
                    <option value="PROJECT_MANAGER">PROJECT_MANAGER</option>
                    <option value="DEVELOPER">DEVELOPER</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingSub}
                  style={{
                    padding: "9px 18px",
                    backgroundColor: "var(--dash-primary)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {isSubmittingSub ? "Adding..." : "+ Add Member"}
                </button>
              </form>

              {/* Members Table */}
              {projectDetail.members?.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>👥</div>
                  <div style={{ fontSize: "14px", fontWeight: "600" }}>No team members assigned yet</div>
                  <div style={{ fontSize: "12px", marginTop: "4px" }}>Select a user above to assign them to this project.</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-light)", backgroundColor: "var(--bg-subtle)", textAlign: "left" }}>
                        <th style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-muted)" }}>Team Member</th>
                        <th style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-muted)", width: "180px" }}>Project Role</th>
                        <th style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-muted)", width: "150px" }}>Joined Date</th>
                        <th style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-muted)", width: "80px", textAlign: "center" }}>
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectDetail.members.map((m) => {
                        const roleStyle =
                          m.role === "OWNER"
                            ? { bg: "#fef3c7", color: "#b45309", border: "#fde68a" }
                            : m.role === "PROJECT_MANAGER"
                            ? { bg: "#ede9fe", color: "#6d28d9", border: "#ddd6fe" }
                            : m.role === "DEVELOPER"
                            ? { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" }
                            : { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" };

                        return (
                          <tr key={m.user_id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                            <td style={{ padding: "12px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <div
                                  style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "50%",
                                    backgroundColor: "var(--dash-primary-light)",
                                    color: "var(--dash-primary)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: "700",
                                    fontSize: "13px",
                                    border: "1px solid var(--dash-primary-border)",
                                  }}
                                >
                                  {m.user_full_name ? m.user_full_name.charAt(0).toUpperCase() : "U"}
                                </div>
                                <div>
                                  <div style={{ fontWeight: "600", color: "var(--text-main)" }}>{m.user_full_name}</div>
                                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{m.user_email}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  backgroundColor: roleStyle.bg,
                                  color: roleStyle.color,
                                  border: `1px solid ${roleStyle.border}`,
                                  padding: "3px 10px",
                                  borderRadius: "6px",
                                }}
                              >
                                {m.role}
                              </span>
                            </td>
                            <td style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: "12px" }}>
                              {m.joined_at ? m.joined_at.split("T")[0] : "-"}
                            </td>
                            <td style={{ padding: "12px 14px", textAlign: "center" }}>
                              <button
                                onClick={() => handleRemoveMember(m.user_id)}
                                title="Remove from team"
                                style={{
                                  padding: "6px 10px",
                                  backgroundColor: "transparent",
                                  color: "#dc2626",
                                  border: "1px solid transparent",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = "#fef2f2";
                                  e.currentTarget.style.borderColor = "#fecaca";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = "transparent";
                                  e.currentTarget.style.borderColor = "transparent";
                                }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Supporting Documents */}
          {detailTab === "documents" && (
            <div className="dash-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Centralized External Link Info */}
              <div
                style={{
                  padding: "12px 16px",
                  backgroundColor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "6px",
                  fontSize: "13px",
                  color: "#1e40af",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span style={{ fontSize: "16px" }}>ℹ️</span>
                <span>
                  Documents are organized as centralized external cloud links (Google Drive, Confluence, SharePoint, Figma, etc.).
                </span>
              </div>

              {/* Add Document Form */}
              <form
                onSubmit={handleAddDocument}
                style={{
                  padding: "16px",
                  backgroundColor: "var(--bg-subtle)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ fontWeight: "700", fontSize: "13px", color: "var(--text-main)" }}>
                  + Register Supporting Document Link
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                      Document Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Software Requirements Specification (SRS) v2.0"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
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
                      Category *
                    </label>
                    <select
                      value={newDocType}
                      onChange={(e) => setNewDocType(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: "13px",
                      }}
                    >
                      <option value="SOW">SOW</option>
                      <option value="BRD">BRD</option>
                      <option value="FSD">FSD</option>
                      <option value="BAST">BAST</option>
                      <option value="ARCHITECTURE">Architecture</option>
                      <option value="MEETING_NOTES">Meeting Notes</option>
                      <option value="FIGMA">Figma / UI Design</option>
                      <option value="LAINNYA">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                    Document URL Link (Drive, Confluence, SharePoint, Figma) *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://drive.google.com/... or https://confluence.corp/..."
                    value={newDocUrl}
                    onChange={(e) => setNewDocUrl(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: "13px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    disabled={isSubmittingSub}
                    style={{
                      padding: "8px 18px",
                      backgroundColor: "var(--dash-primary)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "600",
                    }}
                  >
                    {isSubmittingSub ? "Saving..." : "+ Register Document"}
                  </button>
                </div>
              </form>

              {/* Documents Table */}
              {projectDetail.documents?.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>📄</div>
                  <div style={{ fontSize: "14px", fontWeight: "600" }}>No documents linked to this project yet</div>
                  <div style={{ fontSize: "12px", marginTop: "4px" }}>
                    Use the form above to attach requirements, specs, or meeting notes.
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-light)", backgroundColor: "var(--bg-subtle)", textAlign: "left" }}>
                        <th style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-muted)" }}>Document Title</th>
                        <th style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-muted)", width: "140px" }}>Category</th>
                        <th style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-muted)", width: "160px" }}>Uploader</th>
                        <th style={{ padding: "10px 14px", fontWeight: "600", color: "var(--text-muted)", width: "160px", textAlign: "center" }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectDetail.documents.map((doc) => (
                        <tr key={doc.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "6px",
                                  backgroundColor: "#f8fafc",
                                  border: "1px solid var(--border-light)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "14px",
                                }}
                              >
                                📄
                              </div>
                              <div>
                                <div style={{ fontWeight: "600", color: "var(--text-main)" }}>{doc.doc_name}</div>
                                <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                                  {doc.file_url?.slice(0, 50)}...
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "12px 14px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: "700",
                                backgroundColor: "#eff6ff",
                                color: "#2563eb",
                                border: "1px solid #bfdbfe",
                                padding: "3px 8px",
                                borderRadius: "6px",
                              }}
                            >
                              {doc.doc_type || "DOCUMENT"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: "12px" }}>
                            <div>{doc.uploader_name || "System"}</div>
                            <div style={{ fontSize: "11px" }}>{doc.created_at ? doc.created_at.split("T")[0] : ""}</div>
                          </td>
                          <td style={{ padding: "12px 14px", textAlign: "center" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  padding: "5px 12px",
                                  backgroundColor: "var(--dash-primary-light)",
                                  color: "var(--dash-primary)",
                                  borderRadius: "4px",
                                  border: "1px solid var(--dash-primary-border)",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                Open ↗
                              </a>
                              <button
                                onClick={() => handleRemoveDocument(doc.id)}
                                title="Delete document"
                                style={{
                                  padding: "5px 10px",
                                  backgroundColor: "transparent",
                                  color: "#dc2626",
                                  border: "1px solid transparent",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = "#fef2f2";
                                  e.currentTarget.style.borderColor = "#fecaca";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = "transparent";
                                  e.currentTarget.style.borderColor = "transparent";
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
