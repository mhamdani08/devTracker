"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

export default function UsersView({ authToken, currentUser }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterSystemRole, setFilterSystemRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState("create"); // "create" | "edit"
  const [selectedUser, setSelectedUser] = useState(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Data
  const initialFormState = {
    full_name: "",
    email: "",
    password: "",
    role_id: "",
    system_role: "USER",
    status: "ACTIVE",
  };
  const [formData, setFormData] = useState(initialFormState);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetch Users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/users?all=true", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setUsers(json.data || []);
    } catch (err) {
      setError(err.message || "Gagal memuat daftar pengguna");
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  // 2. Fetch Stats & Roles
  const fetchStatsAndRoles = useCallback(async () => {
    try {
      const [resStats, resRoles] = await Promise.all([
        fetch("/api/v1/users/stats", { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch("/api/v1/roles", { headers: { Authorization: `Bearer ${authToken}` } }),
      ]);

      if (resStats.ok) {
        const jsonStats = await resStats.json();
        setStats(jsonStats.data);
      }
      if (resRoles.ok) {
        const jsonRoles = await resRoles.json();
        setRoles(jsonRoles.data || []);
      }
    } catch (err) {
      console.warn("Could not load stats or roles:", err);
    }
  }, [authToken]);

  useEffect(() => {
    fetchUsers();
    fetchStatsAndRoles();
  }, [fetchUsers, fetchStatsAndRoles]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = u.full_name?.toLowerCase().includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q);
        const matchRole = u.role_name?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchRole) return false;
      }
      if (filterRole && u.role_id !== filterRole) return false;
      if (filterSystemRole && u.system_role !== filterSystemRole) return false;
      if (filterStatus && u.status !== filterStatus) return false;
      return true;
    });
  }, [users, searchQuery, filterRole, filterSystemRole, filterStatus]);

  // Role Badge Styling
  const getRoleBadgeStyle = (code) => {
    switch (code) {
      case "TECH_LEAD":
        return { bg: "rgba(139, 92, 246, 0.12)", color: "#7c3aed", border: "rgba(139, 92, 246, 0.25)" };
      case "SYSTEM_ANALYST":
        return { bg: "rgba(6, 182, 212, 0.12)", color: "#0891b2", border: "rgba(6, 182, 212, 0.25)" };
      case "BACKEND_DEV":
      case "FRONTEND_DEV":
      case "FULLSTACK_DEV":
        return { bg: "rgba(59, 130, 246, 0.12)", color: "#2563eb", border: "rgba(59, 130, 246, 0.25)" };
      case "QA_ENGINEER":
        return { bg: "rgba(245, 158, 11, 0.12)", color: "#d97706", border: "rgba(245, 158, 11, 0.25)" };
      case "PROJECT_MANAGER":
        return { bg: "rgba(16, 185, 129, 0.12)", color: "#059669", border: "rgba(16, 185, 129, 0.25)" };
      default:
        return { bg: "var(--bg-subtle)", color: "var(--text-muted)", border: "var(--border-subtle)" };
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormMode("create");
    setSelectedUser(null);
    setFormData({
      ...initialFormState,
      role_id: roles[0]?.id || "",
    });
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (user) => {
    setFormMode("edit");
    setSelectedUser(user);
    setFormData({
      full_name: user.full_name || "",
      email: user.email || "",
      password: "",
      role_id: user.role_id || "",
      system_role: user.system_role || "USER",
      status: user.status || "ACTIVE",
    });
    setIsFormModalOpen(true);
  };

  // Open Reset Password Modal
  const handleOpenResetPassword = (user) => {
    setSelectedUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setIsPasswordModalOpen(true);
  };

  // Submit User Form (Create / Edit)
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim() || !formData.email.trim()) {
      showToast("Nama lengkap dan email wajib diisi", "error");
      return;
    }
    if (formMode === "create" && (!formData.password || formData.password.length < 6)) {
      showToast("Password akun baru minimal harus 6 karakter", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      let url = "/api/v1/users";
      let method = "POST";
      const payload = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        role_id: formData.role_id || null,
        system_role: formData.system_role,
        status: formData.status,
      };

      if (formMode === "create") {
        payload.password = formData.password;
      } else {
        url = `/api/v1/users/${selectedUser.id}`;
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
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan data pengguna");

      showToast(json.message || "Data pengguna berhasil disimpan", "success");
      setIsFormModalOpen(false);
      fetchUsers();
      fetchStatsAndRoles();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Password Reset
  const handleSubmitResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast("Password baru minimal 6 karakter", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Konfirmasi password tidak cocok", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/users/${selectedUser.id}/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ new_password: newPassword }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mereset password");

      showToast(`Password untuk ${selectedUser.full_name} berhasil direset`, "success");
      setIsPasswordModalOpen(false);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle User Status
  const handleToggleStatus = async (user) => {
    if (user.id === currentUser?.id) {
      showToast("Anda tidak dapat menonaktifkan akun Anda sendiri", "error");
      return;
    }

    const actionText = user.status === "ACTIVE" ? "nonaktifkan" : "aktifkan";
    if (!confirm(`Apakah Anda yakin ingin me-${actionText} akun ${user.full_name} (${user.email})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/users/${user.id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengubah status akun");

      showToast(json.message, "success");
      fetchUsers();
      fetchStatsAndRoles();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // Delete User
  const handleDeleteUser = async (user) => {
    if (user.id === currentUser?.id) {
      showToast("Anda tidak dapat menghapus akun Anda sendiri", "error");
      return;
    }

    if (!confirm(`Hapus akun pengguna ${user.full_name} (${user.email})? Tindakan ini akan menonaktifkan akses akun.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus pengguna");

      showToast(json.message || "Pengguna berhasil dihapus", "success");
      fetchUsers();
      fetchStatsAndRoles();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 99999,
            padding: "12px 20px",
            borderRadius: "var(--radius-md)",
            backgroundColor: toast.type === "error" ? "#dc2626" : "#059669",
            color: "#fff",
            fontSize: "13px",
            fontWeight: "600",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          {toast.message}
        </div>
      )}

      {/* 1. Header & Summary Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Total Users */}
        <div
          className="dash-card"
          style={{
            padding: "18px",
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
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              backgroundColor: "rgba(59, 130, 246, 0.12)",
              color: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            👥
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Total Pengguna
            </div>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-primary)" }}>
              {stats?.total_users ?? users.length}
            </div>
          </div>
        </div>

        {/* Active Users */}
        <div
          className="dash-card"
          style={{
            padding: "18px",
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
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              color: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            🟢
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Akun Aktif
            </div>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "#10b981" }}>
              {stats?.active_users ?? users.filter((u) => u.status === "ACTIVE").length}
            </div>
          </div>
        </div>

        {/* Disabled Users */}
        <div
          className="dash-card"
          style={{
            padding: "18px",
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
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            ⛔
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Akun Nonaktif
            </div>
            <div style={{ fontSize: "24px", fontWeight: "800", color: (stats?.disabled_users ?? 0) > 0 ? "#ef4444" : "var(--text-primary)" }}>
              {stats?.disabled_users ?? users.filter((u) => u.status === "DISABLED").length}
            </div>
          </div>
        </div>

        {/* SysAdmins */}
        <div
          className="dash-card"
          style={{
            padding: "18px",
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
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              backgroundColor: "rgba(139, 92, 246, 0.12)",
              color: "#8b5cf6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            🛡️
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Level SYS_ADMIN
            </div>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "#8b5cf6" }}>
              {stats?.sysadmin_users ?? users.filter((u) => u.system_role === "SYS_ADMIN").length}
            </div>
          </div>
        </div>

        {/* Roles Available */}
        <div
          className="dash-card"
          style={{
            padding: "18px",
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
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              backgroundColor: "rgba(2, 132, 199, 0.12)",
              color: "#0284c7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            🏷️
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Role Profesi
            </div>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-primary)" }}>
              {stats?.total_roles ?? roles.length}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Controls & Filter Bar */}
      <div
        className="dash-card"
        style={{
          padding: "16px 20px",
          backgroundColor: "var(--bg-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", flex: 1 }}>
          {/* Search */}
          <div style={{ position: "relative", minWidth: "240px" }}>
            <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: "14px" }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Cari nama, email, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "8px 12px 8px 32px",
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

          {/* Filter Role */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            style={{
              padding: "8px 12px",
              fontSize: "12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-canvas)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">Semua Role Profesi</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Filter System Role */}
          <select
            value={filterSystemRole}
            onChange={(e) => setFilterSystemRole(e.target.value)}
            style={{
              padding: "8px 12px",
              fontSize: "12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-canvas)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">Semua Level Sistem</option>
            <option value="SYS_ADMIN">SYS_ADMIN</option>
            <option value="USER">USER</option>
          </select>

          {/* Filter Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: "8px 12px",
              fontSize: "12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-canvas)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">Semua Status</option>
            <option value="ACTIVE">Aktif (ACTIVE)</option>
            <option value="DISABLED">Nonaktif (DISABLED)</option>
          </select>

          {/* Reset button */}
          {(searchQuery || filterRole || filterSystemRole || filterStatus) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setFilterRole("");
                setFilterSystemRole("");
                setFilterStatus("");
              }}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                border: "none",
                background: "none",
                color: "#ef4444",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Action Button: Create User */}
        <button
          type="button"
          onClick={handleOpenCreate}
          style={{
            padding: "9px 18px",
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
            boxShadow: "0 2px 4px rgba(0, 102, 204, 0.2)",
          }}
        >
          <span>➕</span>
          <span>Tambah Pengguna Baru</span>
        </button>
      </div>

      {/* 3. Directory Table */}
      <div
        className="dash-card"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div className="spinner" style={{ margin: "0 auto 12px auto" }} />
            <div>Memuat data direktori pengguna...</div>
          </div>
        ) : error ? (
          <div
            style={{
              padding: "24px",
              color: "#dc2626",
              textAlign: "center",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
            }}
          >
            {error}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>👥</div>
            <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--text-primary)" }}>
              Tidak ada pengguna yang cocok dengan kriteria filter
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--bg-canvas)", borderBottom: "1px solid var(--border-subtle)" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700", color: "var(--text-muted)" }}>Pengguna</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700", color: "var(--text-muted)" }}>Role Profesi</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700", color: "var(--text-muted)" }}>Level Sistem</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "700", color: "var(--text-muted)" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700", color: "var(--text-muted)" }}>Login Terakhir</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "700", color: "var(--text-muted)" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const roleStyle = getRoleBadgeStyle(user.role_code);
                  const isCurrent = user.id === currentUser?.id;

                  return (
                    <tr
                      key={user.id}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-canvas)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      {/* User Info */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              backgroundColor: user.status === "ACTIVE" ? "var(--dash-primary)" : "var(--border-subtle)",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "700",
                              fontSize: "13px",
                              flexShrink: 0,
                            }}
                          >
                            {user.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div>
                            <div style={{ fontWeight: "700", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span>{user.full_name}</span>
                              {isCurrent && (
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: "800",
                                    backgroundColor: "rgba(59, 130, 246, 0.15)",
                                    color: "#2563eb",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                  }}
                                >
                                  Anda
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Profesi */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            backgroundColor: roleStyle.bg,
                            color: roleStyle.color,
                            border: `1px solid ${roleStyle.border}`,
                          }}
                        >
                          {user.role_name || "Tanpa Role"}
                        </span>
                      </td>

                      {/* System Role */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "800",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            backgroundColor: user.system_role === "SYS_ADMIN" ? "rgba(139, 92, 246, 0.15)" : "var(--bg-canvas)",
                            color: user.system_role === "SYS_ADMIN" ? "#7c3aed" : "var(--text-muted)",
                            border: user.system_role === "SYS_ADMIN" ? "1px solid rgba(139, 92, 246, 0.3)" : "1px solid var(--border-subtle)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span>{user.system_role === "SYS_ADMIN" ? "🛡️ SYS_ADMIN" : "👤 USER"}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "3px 9px",
                            borderRadius: "12px",
                            backgroundColor: user.status === "ACTIVE" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                            color: user.status === "ACTIVE" ? "#059669" : "#dc2626",
                            border: user.status === "ACTIVE" ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(239, 68, 68, 0.25)",
                          }}
                        >
                          {user.status === "ACTIVE" ? "● Aktif" : "○ Nonaktif"}
                        </span>
                      </td>

                      {/* Last Login */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap", color: "var(--text-muted)", fontSize: "12px" }}>
                        {user.last_login_at ? (
                          new Date(user.last_login_at).toLocaleString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        ) : (
                          <span style={{ fontStyle: "italic" }}>Belum pernah login</span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td style={{ padding: "14px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            title="Edit Data Pengguna"
                            style={{
                              background: "none",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: "var(--radius-sm)",
                              padding: "4px 8px",
                              cursor: "pointer",
                              fontSize: "12px",
                              backgroundColor: "var(--bg-canvas)",
                            }}
                          >
                            ✏️ Edit
                          </button>

                          {/* Reset Password button */}
                          <button
                            type="button"
                            onClick={() => handleOpenResetPassword(user)}
                            title="Reset Password"
                            style={{
                              background: "none",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: "var(--radius-sm)",
                              padding: "4px 8px",
                              cursor: "pointer",
                              fontSize: "12px",
                              backgroundColor: "var(--bg-canvas)",
                            }}
                          >
                            🔑 Password
                          </button>

                          {/* Toggle Status */}
                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => handleToggleStatus(user)}
                            title={isCurrent ? "Tidak dapat menonaktifkan akun sendiri" : user.status === "ACTIVE" ? "Nonaktifkan Akun" : "Aktifkan Akun"}
                            style={{
                              background: "none",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: "var(--radius-sm)",
                              padding: "4px 8px",
                              cursor: isCurrent ? "not-allowed" : "pointer",
                              opacity: isCurrent ? 0.4 : 1,
                              fontSize: "12px",
                              backgroundColor: user.status === "ACTIVE" ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)",
                              color: user.status === "ACTIVE" ? "#dc2626" : "#059669",
                            }}
                          >
                            {user.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => handleDeleteUser(user)}
                            title={isCurrent ? "Tidak dapat menghapus akun sendiri" : "Hapus Pengguna"}
                            style={{
                              background: "none",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              borderRadius: "var(--radius-sm)",
                              padding: "4px 8px",
                              cursor: isCurrent ? "not-allowed" : "pointer",
                              opacity: isCurrent ? 0.4 : 1,
                              fontSize: "12px",
                              color: "#dc2626",
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. MODAL: TAMBAH / EDIT PENGGUNA */}
      {isFormModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
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
              maxWidth: "540px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
                {formMode === "create" ? "➕ Tambah Pengguna Baru" : `✏️ Edit Pengguna: ${selectedUser?.full_name}`}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
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

            <form onSubmit={handleSubmitForm} style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Full Name */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                    Nama Lengkap <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-canvas)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                    Alamat Email <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="budi@devtracker.local"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-canvas)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Password (Only for Create) */}
                {formMode === "create" && (
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                      Password Akun Baru <span style={{ color: "#ef4444" }}>*</span> (Min. 6 Karakter)
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-canvas)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                  </div>
                )}

                {/* Role Profesi */}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                    Role Profesi Pekerjaan
                  </label>
                  <select
                    value={formData.role_id}
                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-canvas)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="">-- Pilih Role Profesi --</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Row: Level Sistem & Status */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                      Level Sistem (Hak Akses)
                    </label>
                    <select
                      value={formData.system_role}
                      onChange={(e) => setFormData({ ...formData, system_role: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-canvas)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                      }}
                    >
                      <option value="USER">USER (Pengguna Biasa)</option>
                      <option value="SYS_ADMIN">SYS_ADMIN (Administrator)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                      Status Akun
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-canvas)",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                      }}
                    >
                      <option value="ACTIVE">ACTIVE (Aktif)</option>
                      <option value="DISABLED">DISABLED (Nonaktif)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Actions */}
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
                  onClick={() => setIsFormModalOpen(false)}
                  style={{
                    padding: "8px 16px",
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
                    padding: "8px 20px",
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
                  {isSubmitting ? "Menyimpan..." : formMode === "create" ? "Buat Akun" : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: RESET PASSWORD */}
      {isPasswordModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
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
              maxWidth: "460px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
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
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
                  🔑 Reset Password
                </h3>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Akun: <strong>{selectedUser?.full_name}</strong> ({selectedUser?.email})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
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

            <form onSubmit={handleSubmitResetPassword} style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                    Password Baru (Min. 6 Karakter) <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-canvas)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                    Konfirmasi Password Baru <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-canvas)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

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
                  onClick={() => setIsPasswordModalOpen(false)}
                  style={{
                    padding: "8px 16px",
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
                    padding: "8px 20px",
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
                  {isSubmitting ? "Mereset..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
