"use client";

import { useState, useEffect, useMemo } from "react";

// Standard Parameter Type Configurations with Dash UI styling
const TYPE_CONFIGS = {
  TASK_STATUS: {
    id: "TASK_STATUS",
    label: "Task Status",
    category: "Workflow",
    description: "Siklus hidup dan tahapan pengerjaan task dari Backlog hingga Done.",
    accentColor: "#059669",
    bgLight: "#ecfdf5",
    borderLight: "#a7f3d0",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 11l3 3L22 4"></path>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
      </svg>
    ),
  },
  PRIORITY: {
    id: "PRIORITY",
    label: "Tingkat Prioritas",
    category: "SLA & Urgensi",
    description: "Tingkat urgensi penanganan task dan batas waktu eskalasi (P1 - P4).",
    accentColor: "#dc2626",
    bgLight: "#fef2f2",
    borderLight: "#fecaca",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
    ),
  },
  TASK_TYPE: {
    id: "TASK_TYPE",
    label: "Tipe Task",
    category: "Teknis",
    description: "Klasifikasi jenis pekerjaan software (Feature, Bugfix, Refactor, Tech Debt).",
    accentColor: "#4f46e5",
    bgLight: "#eef2ff",
    borderLight: "#c7d2fe",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
        <polyline points="2 17 12 22 22 17"></polyline>
        <polyline points="2 12 12 17 22 12"></polyline>
      </svg>
    ),
  },
  PROJECT_HEALTH: {
    id: "PROJECT_HEALTH",
    label: "Project Health (RAG)",
    category: "Portofolio",
    description: "Indikator risiko proyek berbasis evaluasi standar Red-Amber-Green.",
    accentColor: "#0284c7",
    bgLight: "#f0f9ff",
    borderLight: "#bae6fd",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
      </svg>
    ),
  },
  PROJECT_PHASE: {
    id: "PROJECT_PHASE",
    label: "Fase Proyek (SDLC)",
    category: "Milestone Rilis",
    description: "Tahapan siklus software dari Initiate, Dev, UT, SIT, UAT hingga GoLive.",
    accentColor: "#7c3aed",
    bgLight: "#faf5ff",
    borderLight: "#e9d5ff",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
      </svg>
    ),
  },
};

export default function GeneralParameterView({ authToken }) {
  const [parameters, setParameters] = useState([]);
  const [typeSummaries, setTypeSummaries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Category / Group selection (default to "ALL" or "TASK_STATUS")
  const [selectedGroup, setSelectedGroup] = useState("ALL");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
  const [currentParam, setCurrentParam] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast State
  const [toast, setToast] = useState(null);

  // Form Fields
  const [formType, setFormType] = useState("TASK_STATUS");
  const [customType, setCustomType] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formSortOrder, setFormSortOrder] = useState(1);
  const [formIsActive, setFormIsActive] = useState(true);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch parameters
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resParams, resTypes] = await Promise.all([
        fetch("/api/v1/parameters"),
        fetch("/api/v1/parameters/types"),
      ]);

      if (!resParams.ok || !resTypes.ok) {
        throw new Error("Gagal mengambil data dari server");
      }

      const dataParams = await resParams.json();
      const dataTypes = await resTypes.json();

      setParameters(dataParams.data || []);
      setTypeSummaries(dataTypes.data || []);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Gagal memuat parameter", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute Category List with counts
  const categoriesList = useMemo(() => {
    const map = {};

    // Base standard configs
    Object.keys(TYPE_CONFIGS).forEach((key) => {
      map[key] = {
        ...TYPE_CONFIGS[key],
        totalCount: 0,
        activeCount: 0,
      };
    });

    // Dynamic types from database
    parameters.forEach((p) => {
      const typeKey = p.parameter_type;
      if (!map[typeKey]) {
        map[typeKey] = {
          id: typeKey,
          label: typeKey.replace(/_/g, " "),
          category: "Kustom",
          description: "Kategori kustom konfigurasi sistem.",
          accentColor: "#0d9488",
          bgLight: "#f0fdfa",
          borderLight: "#99f6e4",
          icon: (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
          ),
          totalCount: 0,
          activeCount: 0,
        };
      }
      map[typeKey].totalCount += 1;
      if (p.is_active) map[typeKey].activeCount += 1;
    });

    return Object.values(map);
  }, [parameters]);

  // Filtered Categories in sidebar
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categoriesList;
    const q = categorySearch.toLowerCase().trim();
    return categoriesList.filter((c) => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [categoriesList, categorySearch]);

  // Current selected category details
  const activeCategoryMeta = useMemo(() => {
    if (selectedGroup === "ALL") {
      return {
        id: "ALL",
        label: "Semua Kategori Parameter",
        category: "Unified Overview",
        description: "Menampilkan seluruh entri referensi sistem terpusat (Task Status, Prioritas, Tipe Task, Health, & SDLC Phase).",
        accentColor: "var(--green-700)",
        totalCount: parameters.length,
      };
    }
    return categoriesList.find((c) => c.id === selectedGroup) || {
      id: selectedGroup,
      label: selectedGroup,
      description: "Data referensi parameter.",
      accentColor: "var(--green-700)",
      totalCount: 0,
    };
  }, [selectedGroup, categoriesList, parameters.length]);

  // Filtered Parameters Table Data
  const displayedParameters = useMemo(() => {
    return parameters
      .filter((p) => {
        // Group filter
        if (selectedGroup !== "ALL" && p.parameter_type !== selectedGroup) {
          return false;
        }
        // Active status filter
        if (filterActiveOnly && !p.is_active) {
          return false;
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesCode = p.code?.toLowerCase().includes(q);
          const matchesName = p.name?.toLowerCase().includes(q);
          const matchesType = p.parameter_type?.toLowerCase().includes(q);
          return matchesCode || matchesName || matchesType;
        }
        return true;
      })
      .sort((a, b) => {
        if (selectedGroup === "ALL") {
          if (a.parameter_type !== b.parameter_type) {
            return a.parameter_type.localeCompare(b.parameter_type);
          }
        }
        return a.sort_order - b.sort_order;
      });
  }, [parameters, selectedGroup, filterActiveOnly, searchQuery]);

  // Helpers
  const getBadgeStyle = (typeId) => {
    const found = TYPE_CONFIGS[typeId];
    if (found) return found;
    return { accentColor: "#475569", bgLight: "#f1f5f9", borderLight: "#cbd5e1" };
  };

  // Open Modal Create
  const openCreateModal = () => {
    setModalMode("create");
    setCurrentParam(null);
    const target = selectedGroup !== "ALL" ? selectedGroup : "TASK_STATUS";
    setFormType(target);
    setCustomType("");
    setFormCode("");
    setFormName("");
    const itemsInTarget = parameters.filter((p) => p.parameter_type === target);
    setFormSortOrder(itemsInTarget.length + 1);
    setFormIsActive(true);
    setModalError("");
    setIsModalOpen(true);
  };

  // Open Modal Edit
  const openEditModal = (param) => {
    setModalMode("edit");
    setCurrentParam(param);
    setFormType(param.parameter_type);
    setFormCode(param.code);
    setFormName(param.name);
    setFormSortOrder(param.sort_order);
    setFormIsActive(param.is_active);
    setModalError("");
    setIsModalOpen(true);
  };

  // Submit Form
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalError("");

    const targetType = formType === "CUSTOM" ? customType.trim().toUpperCase() : formType;
    if (!targetType) {
      setModalError("Kategori parameter wajib ditentukan.");
      return;
    }
    if (modalMode === "create" && !formCode.trim()) {
      setModalError("Kode parameter wajib diisi.");
      return;
    }
    if (!formName.trim()) {
      setModalError("Nama label parameter wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === "create") {
        const payload = {
          parameter_type: targetType,
          code: formCode.trim().toUpperCase(),
          name: formName.trim(),
          sort_order: parseInt(formSortOrder, 10) || 0,
          is_active: formIsActive,
        };

        const res = await fetch("/api/v1/parameters", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal membuat parameter");

        showToast(`Parameter "${payload.name}" berhasil dibuat.`);
      } else {
        const payload = {
          name: formName.trim(),
          sort_order: parseInt(formSortOrder, 10) || 0,
          is_active: formIsActive,
        };

        const res = await fetch(`/api/v1/parameters/${currentParam.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal memperbarui parameter");

        showToast(`Parameter "${currentParam.code}" berhasil diperbarui.`);
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active
  const handleToggleActive = async (param) => {
    try {
      const res = await fetch(`/api/v1/parameters/${param.id}/toggle`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status parameter");

      setParameters((prev) =>
        prev.map((item) => (item.id === param.id ? { ...item, is_active: !item.is_active } : item))
      );
      showToast(`Status "${param.name}" berhasil diubah.`);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // Confirm Delete
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/v1/parameters/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus parameter");

      setParameters((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      showToast(`Parameter "${deleteTarget.name}" berhasil dihapus.`);
      setDeleteTarget(null);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: "2.5rem" }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "24px",
            zIndex: 9999,
            backgroundColor: toast.type === "error" ? "#fef2f2" : "#ecfdf5",
            color: toast.type === "error" ? "#991b1b" : "#065f46",
            border: `1px solid ${toast.type === "error" ? "#fca5a5" : "#6ee7b7"}`,
            borderRadius: "8px",
            padding: "10px 16px",
            boxShadow: "0 10px 20px -5px rgba(0, 0, 0, 0.12)",
            fontSize: "0.85rem",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {toast.type === "error" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* DASH UI PAGE HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.25rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid var(--border-light)",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.72rem",
                fontWeight: "700",
                textTransform: "uppercase",
                backgroundColor: "var(--green-50)",
                color: "var(--green-800)",
                padding: "2px 7px",
                borderRadius: "4px",
                border: "1px solid var(--green-200)",
              }}
            >
              Unified Lookup Table
            </span>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Sistem & Tata Kelola</span>
          </div>
          <h1 style={{ fontSize: "1.45rem", fontWeight: "800", color: "var(--text-main)", letterSpacing: "-0.02em" }}>
            Parameter Umum (General Parameters)
          </h1>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "2px" }}>
            Pengaturan terpusat untuk status, prioritas, tipe task, fase SDLC, dan indikator kesehatan proyek.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={fetchData}
            title="Muat ulang data"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "0.45rem 0.85rem",
              borderRadius: "6px",
              border: "1px solid var(--border-light)",
              backgroundColor: "#ffffff",
              color: "var(--text-main)",
              fontSize: "0.8rem",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={loading ? "animate-pulse" : ""}>
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            <span>Refresh</span>
          </button>

          <button
            onClick={openCreateModal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "0.48rem 1rem",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--green-600)",
              color: "#ffffff",
              fontSize: "0.82rem",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "var(--shadow-sm)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--green-700)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--green-600)")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Tambah Parameter</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DASH UI MASTER-DETAIL CONTAINER (Single Card / Panel Layout - NO CARDS)    */}
      {/* ========================================================================= */}
      <div
        style={{
          display: "flex",
          backgroundColor: "#ffffff",
          borderRadius: "10px",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
          minHeight: "620px",
        }}
      >
        {/* LEFT COLUMN: TIPE PARAMETER SIDEBAR (Dash UI Vertical Navigation) */}
        <div
          style={{
            width: "270px",
            minWidth: "270px",
            borderRight: "1px solid var(--border-light)",
            backgroundColor: "#fafbfc",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Sidebar Header */}
          <div style={{ padding: "0.9rem 1rem", borderBottom: "1px solid var(--border-light)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "0.74rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                Kategori Parameter
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: "700",
                  backgroundColor: "#e2e8f0",
                  color: "var(--text-muted)",
                  padding: "1px 6px",
                  borderRadius: "9999px",
                }}
              >
                {categoriesList.length}
              </span>
            </div>

            {/* Quick search categories */}
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Filter kategori..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.4rem 0.6rem 0.4rem 1.8rem",
                  fontSize: "0.78rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border-light)",
                  outline: "none",
                  backgroundColor: "#ffffff",
                }}
              />
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-subtle)"
                strokeWidth="2"
                style={{ position: "absolute", left: "7px", top: "50%", transform: "translateY(-50%)" }}
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>

          {/* Sidebar Category List */}
          <div style={{ flex: 1, padding: "0.5rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
            {/* 1. All Categories Option */}
            <button
              onClick={() => setSelectedGroup("ALL")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.55rem 0.75rem",
                borderRadius: "6px",
                border: "none",
                backgroundColor: selectedGroup === "ALL" ? "var(--green-50)" : "transparent",
                color: selectedGroup === "ALL" ? "var(--green-800)" : "var(--text-main)",
                fontWeight: selectedGroup === "ALL" ? "700" : "500",
                fontSize: "0.82rem",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.12s ease",
                borderLeft: selectedGroup === "ALL" ? "3px solid var(--green-600)" : "3px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (selectedGroup !== "ALL") e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.03)";
              }}
              onMouseLeave={(e) => {
                if (selectedGroup !== "ALL") e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                <span>Semua Kategori</span>
              </div>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: "700",
                  padding: "1px 6px",
                  borderRadius: "9999px",
                  backgroundColor: selectedGroup === "ALL" ? "var(--green-100)" : "#e2e8f0",
                  color: selectedGroup === "ALL" ? "var(--green-800)" : "var(--text-muted)",
                }}
              >
                {parameters.length}
              </span>
            </button>

            <div style={{ height: "1px", backgroundColor: "var(--border-light)", margin: "4px 8px" }}></div>

            {/* 2. Specific Category Items */}
            {filteredCategories.map((cat) => {
              const isSelected = selectedGroup === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedGroup(cat.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: isSelected ? "var(--green-50)" : "transparent",
                    color: isSelected ? "var(--green-800)" : "var(--text-main)",
                    fontWeight: isSelected ? "700" : "500",
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.12s ease",
                    borderLeft: isSelected ? `3px solid ${cat.accentColor || "var(--green-600)"}` : "3px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.03)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "9px", overflow: "hidden" }}>
                    <span style={{ color: isSelected ? cat.accentColor : "var(--text-muted)", display: "flex", flexShrink: 0 }}>
                      {cat.icon}
                    </span>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {cat.label}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: "700",
                      padding: "1px 6px",
                      borderRadius: "9999px",
                      backgroundColor: isSelected ? "var(--green-100)" : "#e2e8f0",
                      color: isSelected ? "var(--green-800)" : "var(--text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    {cat.totalCount}
                  </span>
                </button>
              );
            })}
          </div>


        </div>

        {/* RIGHT COLUMN: PARAMETER DATA TABLE (Dash UI Clean Content View) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Content Subheader Bar */}
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--border-light)",
              backgroundColor: "#ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--text-main)" }}>
                  {activeCategoryMeta.label}
                </h2>
                {selectedGroup !== "ALL" && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.7rem",
                      fontWeight: "700",
                      backgroundColor: "var(--bg-subtle)",
                      color: "var(--text-muted)",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {selectedGroup}
                  </span>
                )}
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                {activeCategoryMeta.description}
              </p>
            </div>

            {/* Quick action button inside group */}
            {selectedGroup !== "ALL" && (
              <button
                onClick={() => openCreateModal()}
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border-light)",
                  backgroundColor: "#ffffff",
                  color: "var(--green-700)",
                  fontSize: "0.78rem",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--green-50)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
              >
                <span>+ Tambah Nilai</span>
              </button>
            )}
          </div>

          {/* Table Search & Controls Toolbar */}
          <div
            style={{
              padding: "0.75rem 1.25rem",
              borderBottom: "1px solid var(--border-light)",
              backgroundColor: "#fcfcfd",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            {/* Search Input */}
            <div style={{ position: "relative", minWidth: "240px", flex: "1 1 240px" }}>
              <input
                type="text"
                placeholder={selectedGroup === "ALL" ? "Cari di seluruh parameter..." : `Cari dalam ${activeCategoryMeta.label}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.45rem 0.65rem 0.45rem 1.9rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border-light)",
                  fontSize: "0.8rem",
                  outline: "none",
                  backgroundColor: "#ffffff",
                }}
              />
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-subtle)"
                strokeWidth="2"
                style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)" }}
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>

            {/* Filter Toggle & Counter */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.78rem",
                  fontWeight: "600",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={filterActiveOnly}
                  onChange={(e) => setFilterActiveOnly(e.target.checked)}
                  style={{ accentColor: "var(--green-600)", width: "15px", height: "15px", cursor: "pointer" }}
                />
                <span>Hanya Aktif</span>
              </label>

              <span style={{ color: "var(--border-light)" }}>|</span>

              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Menampilkan <strong>{displayedParameters.length}</strong> data
              </span>
            </div>
          </div>

          {/* Clean Data Table */}
          <div style={{ flex: 1, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem", textAlign: "left" }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: "#f8fafc",
                    borderBottom: "1px solid var(--border-light)",
                    color: "var(--text-muted)",
                    fontSize: "0.72rem",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  <th style={{ padding: "0.65rem 1rem", width: "70px", textAlign: "center" }}>Urut</th>
                  {selectedGroup === "ALL" && (
                    <th style={{ padding: "0.65rem 0.85rem", width: "140px" }}>Kategori</th>
                  )}
                  <th style={{ padding: "0.65rem 0.85rem", width: "170px" }}>Kode Internal</th>
                  <th style={{ padding: "0.65rem 0.85rem" }}>Label Tampilan</th>
                  <th style={{ padding: "0.65rem 0.85rem", width: "140px" }}>Pratinjau Badge</th>
                  <th style={{ padding: "0.65rem 0.85rem", width: "110px", textAlign: "center" }}>Status</th>
                  <th style={{ padding: "0.65rem 1rem", width: "90px", textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={selectedGroup === "ALL" ? 7 : 6} style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                        <div className="animate-pulse" style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "var(--green-200)" }}></div>
                        <span style={{ fontSize: "0.82rem" }}>Memuat parameter...</span>
                      </div>
                    </td>
                  </tr>
                ) : displayedParameters.length === 0 ? (
                  <tr>
                    <td colSpan={selectedGroup === "ALL" ? 7 : 6} style={{ padding: "3.5rem 1rem", textAlign: "center", color: "var(--text-muted)" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--text-subtle)" strokeWidth="1.5">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="8" y1="12" x2="16" y2="12"></line>
                        </svg>
                        <div style={{ fontWeight: "700", color: "var(--text-main)", fontSize: "0.9rem" }}>Data tidak ditemukan</div>
                        <div style={{ fontSize: "0.78rem" }}>
                          {searchQuery ? `Tidak ada data yang sesuai dengan pencarian "${searchQuery}".` : "Belum ada entri parameter terdaftar."}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedParameters.map((param, idx) => {
                    const badgeMeta = getBadgeStyle(param.parameter_type);

                    return (
                      <tr
                        key={param.id}
                        style={{
                          borderBottom: "1px solid var(--border-light)",
                          backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fcfcfd",
                          transition: "background 0.1s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(16, 185, 129, 0.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "#ffffff" : "#fcfcfd")}
                      >
                        {/* Sort Order */}
                        <td style={{ padding: "0.65rem 1rem", verticalAlign: "middle", textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-block",
                              minWidth: "22px",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              backgroundColor: "#f1f5f9",
                              color: "var(--text-muted)",
                              fontSize: "0.74rem",
                              fontWeight: "700",
                            }}
                          >
                            {param.sort_order}
                          </span>
                        </td>

                        {/* Category (Only if ALL is selected) */}
                        {selectedGroup === "ALL" && (
                          <td style={{ padding: "0.65rem 0.85rem", verticalAlign: "middle" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 7px",
                                borderRadius: "4px",
                                fontSize: "0.7rem",
                                fontWeight: "700",
                                backgroundColor: badgeMeta.bgLight,
                                color: badgeMeta.accentColor,
                                border: `1px solid ${badgeMeta.borderLight}`,
                              }}
                            >
                              {param.parameter_type}
                            </span>
                          </td>
                        )}

                        {/* Code */}
                        <td style={{ padding: "0.65rem 0.85rem", verticalAlign: "middle" }}>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "0.78rem",
                              fontWeight: "600",
                              color: "var(--text-main)",
                              backgroundColor: "var(--bg-subtle)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            {param.code}
                          </span>
                        </td>

                        {/* Name */}
                        <td style={{ padding: "0.65rem 0.85rem", verticalAlign: "middle" }}>
                          <div style={{ fontWeight: "600", color: "var(--text-main)" }}>{param.name}</div>
                        </td>

                        {/* Badge Preview */}
                        <td style={{ padding: "0.65rem 0.85rem", verticalAlign: "middle" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "5px",
                              fontSize: "0.73rem",
                              fontWeight: "700",
                              backgroundColor: badgeMeta.bgLight,
                              color: badgeMeta.accentColor,
                              border: `1px solid ${badgeMeta.borderLight}`,
                            }}
                          >
                            {param.name}
                          </span>
                        </td>

                        {/* Status Toggle */}
                        <td style={{ padding: "0.65rem 0.85rem", verticalAlign: "middle", textAlign: "center" }}>
                          <button
                            onClick={() => handleToggleActive(param)}
                            title={`Klik untuk ubah status`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              border: `1px solid ${param.is_active ? "#a7f3d0" : "#cbd5e1"}`,
                              backgroundColor: param.is_active ? "#ecfdf5" : "#f1f5f9",
                              color: param.is_active ? "#047857" : "#64748b",
                              fontSize: "0.72rem",
                              fontWeight: "700",
                              cursor: "pointer",
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                backgroundColor: param.is_active ? "#10b981" : "#94a3b8",
                              }}
                            ></span>
                            <span>{param.is_active ? "Aktif" : "Non-Aktif"}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "0.65rem 1rem", verticalAlign: "middle", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            {/* Edit */}
                            <button
                              onClick={() => openEditModal(param)}
                              title="Edit parameter"
                              style={{
                                padding: "4px 6px",
                                borderRadius: "4px",
                                border: "1px solid var(--border-light)",
                                backgroundColor: "#ffffff",
                                color: "var(--text-main)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "var(--green-50)";
                                e.currentTarget.style.color = "var(--green-700)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "#ffffff";
                                e.currentTarget.style.color = "var(--text-main)";
                              }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setDeleteTarget(param)}
                              title="Hapus parameter"
                              style={{
                                padding: "4px 6px",
                                borderRadius: "4px",
                                border: "1px solid var(--border-light)",
                                backgroundColor: "#ffffff",
                                color: "var(--text-muted)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#fef2f2";
                                e.currentTarget.style.color = "#ef4444";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "#ffffff";
                                e.currentTarget.style.color = "var(--text-muted)";
                              }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DIALOG (CREATE / EDIT)                                              */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            zIndex: 999,
            padding: "1rem",
            paddingTop: "60px",
            overflowY: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setIsModalOpen(false);
          }}
        >
          <div
            className="animate-fade-in"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "10px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--border-light)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "1.1rem 1.35rem",
                borderBottom: "1px solid var(--border-light)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#f8fafc",
              }}
            >
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--text-main)" }}>
                  {modalMode === "create" ? "Tambah Nilai Parameter" : `Edit Parameter: ${currentParam?.code}`}
                </h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  Tabel referensi sistem `general_parameters`.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} style={{ padding: "1.25rem 1.35rem" }}>
              {modalError && (
                <div
                  style={{
                    backgroundColor: "#fef2f2",
                    color: "#991b1b",
                    border: "1px solid #fecaca",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    marginBottom: "1rem",
                    fontWeight: "500",
                  }}
                >
                  {modalError}
                </div>
              )}

              {/* Category */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "var(--text-main)", marginBottom: "5px" }}>
                  Kategori Parameter (Tipe) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                {modalMode === "edit" ? (
                  <input
                    type="text"
                    disabled
                    value={formType}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid #e2e8f0",
                      backgroundColor: "#f8fafc",
                      fontSize: "0.82rem",
                      color: "var(--text-muted)",
                      fontWeight: "700",
                    }}
                  />
                ) : (
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--border-light)",
                      fontSize: "0.82rem",
                      outline: "none",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    {categoriesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} ({c.id})
                      </option>
                    ))}
                    <option value="CUSTOM">+ Kategori Kustom Baru...</option>
                  </select>
                )}
              </div>

              {/* Custom Type Input if chosen */}
              {modalMode === "create" && formType === "CUSTOM" && (
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "var(--text-main)", marginBottom: "5px" }}>
                    Kode Kategori Kustom (UPPERCASE) <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: ENVIRONMENT_TYPE"
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value.toUpperCase())}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--border-light)",
                      fontSize: "0.82rem",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                </div>
              )}

              {/* Code */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "var(--text-main)", marginBottom: "5px" }}>
                  Kode Parameter (Internal Code) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: IN_PROGRESS atau P1"
                  value={formCode}
                  disabled={modalMode === "edit"}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border-light)",
                    fontSize: "0.82rem",
                    fontFamily: "var(--font-mono)",
                    backgroundColor: modalMode === "edit" ? "#f8fafc" : "#ffffff",
                    color: modalMode === "edit" ? "var(--text-muted)" : "var(--text-main)",
                  }}
                />
              </div>

              {/* Display Name */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "var(--text-main)", marginBottom: "5px" }}>
                  Label Tampilan (Display Name) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: In Progress atau P1 - Critical"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border-light)",
                    fontSize: "0.82rem",
                  }}
                />
              </div>

              {/* Sort Order & Status */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "var(--text-main)", marginBottom: "5px" }}>
                    Urutan Sorting
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--border-light)",
                      fontSize: "0.82rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "var(--text-main)", marginBottom: "5px" }}>
                    Status
                  </label>
                  <div style={{ paddingTop: "6px" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", fontWeight: "600", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        style={{ accentColor: "var(--green-600)", width: "15px", height: "15px" }}
                      />
                      <span>{formIsActive ? "Aktif" : "Non-Aktif"}</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "0.48rem 0.9rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border-light)",
                    backgroundColor: "#ffffff",
                    color: "var(--text-main)",
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "0.48rem 1.15rem",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "var(--green-600)",
                    color: "#ffffff",
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  {isSubmitting ? "Menyimpan..." : modalMode === "create" ? "Simpan" : "Perbarui"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL                                                 */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            zIndex: 999,
            padding: "1rem",
            paddingTop: "80px",
            overflowY: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setDeleteTarget(null);
          }}
        >
          <div
            className="animate-fade-in"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "10px",
              width: "100%",
              maxWidth: "420px",
              padding: "1.35rem",
              boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--border-light)",
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "#dc2626", marginBottom: "6px" }}>
              Hapus Parameter Ini?
            </h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-main)", lineHeight: "1.5", marginBottom: "1.25rem" }}>
              Anda akan menghapus nilai <strong style={{ fontFamily: "var(--font-mono)" }}>{deleteTarget.code}</strong> ({deleteTarget.name}) dari kategori <strong>{deleteTarget.parameter_type}</strong>.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border-light)",
                  backgroundColor: "#ffffff",
                  color: "var(--text-main)",
                  fontSize: "0.82rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                style={{
                  padding: "0.45rem 1.15rem",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  fontSize: "0.82rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
