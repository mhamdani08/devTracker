"use client";

import { useEffect, useState } from "react";
import { SIDEBAR_NAVIGATION, filterMenuForUser, getRoleBadgeStyle, groupMenuByCategory } from "../lib/navigation";
import GeneralParameterView from "../components/GeneralParameterView";

export default function HomePage() {
  // Authentication & User State
  const [authToken, setAuthToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Login Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDemoRole, setActiveDemoRole] = useState("admin");

  // Dashboard UI State
  const [apiStatus, setApiStatus] = useState({ state: "checking", data: null, latency: null });
  const [activeTab, setActiveTab] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isTablet, setIsTablet] = useState(false);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");

  const apiBaseUrl = "/api/v1";

  // Demo accounts for rapid role testing
  const demoAccounts = [
    { id: "admin", label: "SysAdmin", email: "admin@devtracker.local", role: "Tech Lead (SYS_ADMIN)" },
    { id: "sa", label: "System Analyst", email: "sa@devtracker.local", role: "System Analyst" },
    { id: "dev", label: "Developer", email: "dev@devtracker.local", role: "Backend Developer" },
    { id: "qa", label: "QA Engineer", email: "qa@devtracker.local", role: "QA Engineer" },
    { id: "pm", label: "Project Manager", email: "pm@devtracker.local", role: "Project Manager" },
  ];

  // 1. Initial Auth Check on Mount
  useEffect(() => {
    const savedToken = localStorage.getItem("devtracker_token");
    if (!savedToken) {
      setIsAuthChecking(false);
      return;
    }

    async function verifyAuth(token) {
      try {
        const res = await fetch(`${apiBaseUrl}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const json = await res.json();
          setAuthToken(token);
          setCurrentUser(json.data);
        } else {
          localStorage.removeItem("devtracker_token");
          setAuthToken(null);
          setCurrentUser(null);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setIsAuthChecking(false);
      }
    }

    verifyAuth(savedToken);
  }, [apiBaseUrl]);

  // 2. Health & API Latency Check
  useEffect(() => {
    async function checkApi() {
      const startTime = performance.now();
      try {
        const res = await fetch(`${apiBaseUrl}/status`);
        const latency = Math.round(performance.now() - startTime);
        if (res.ok) {
          const data = await res.json();
          setApiStatus({ state: "online", data, latency });
        } else {
          setApiStatus({ state: "error", error: `HTTP ${res.status}`, latency });
        }
      } catch (err) {
        setApiStatus({ state: "offline", error: err.message, latency: null });
      }
    }

    checkApi();
    const interval = setInterval(checkApi, 15000);
    return () => clearInterval(interval);
  }, [apiBaseUrl]);

  // 3. Responsive Breakpoints
  useEffect(() => {
    function handleResize() {
      const tablet = window.innerWidth < 1024;
      setIsTablet(tablet);
      if (tablet) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handleSelectMenu(itemId) {
    setActiveMenu(itemId);
    if (isTablet) {
      setSidebarOpen(false);
    }
  }

  // Handle Login
  async function handleLogin(e) {
    if (e) e.preventDefault();
    setLoginError("");

    if (!email.trim() || !password) {
      setLoginError("Email dan password wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || "Gagal melakukan login. Periksa email dan password Anda.");
        setIsSubmitting(false);
        return;
      }

      const token = data.data.token;
      const user = data.data.user;

      localStorage.setItem("devtracker_token", token);
      setAuthToken(token);
      setCurrentUser(user);
      setActiveMenu("dashboard");
      setIsSubmitting(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setLoginError(`Gagal menghubungi API: ${err.message}.`);
      setIsSubmitting(false);
    }
  }

  // Handle Logout
  function handleLogout() {
    localStorage.removeItem("devtracker_token");
    setAuthToken(null);
    setCurrentUser(null);
    setUserDropdownOpen(false);
    setEmail("");
    setPassword("");
    setLoginError("");
  }

  function selectDemoAccount(acc) {
    setActiveDemoRole(acc.id);
    setEmail(acc.email);
    setPassword("Admin123!");
    setLoginError("");
  }

  // Sample Tasks
  const sampleTasks = [
    {
      id: "TSK-101",
      title: "Inisialisasi arsitektur Docker Compose & Environment WSL",
      project: "DevTracker Core",
      status: "done",
      priority: "high",
      assignee: "System Administrator",
      assigneeInitials: "SA",
      dueDate: "Hari ini",
    },
    {
      id: "TSK-102",
      title: "Implementasi koneksi PostgreSQL & database migration (roles & users)",
      project: "Backend API",
      status: "done",
      priority: "high",
      assignee: "Budi Developer",
      assigneeInitials: "BD",
      dueDate: "Hari ini",
    },
    {
      id: "TSK-103",
      title: "Setup otorisasi JWT & endpoint /api/v1/auth/login",
      project: "Backend API",
      status: "done",
      priority: "high",
      assignee: "Tech Lead",
      assigneeInitials: "TL",
      dueDate: "Hari ini",
    },
    {
      id: "TSK-104",
      title: "Setup menu dan tabel referensi terpusat general_parameters (Unified Lookup Table)",
      project: "Master Data",
      status: "in_progress",
      priority: "medium",
      assignee: "Frontend Lead",
      assigneeInitials: "FL",
      dueDate: "22 Okt 2026",
    },
  ];

  const filteredTasks = sampleTasks.filter((t) => {
    if (activeTab === "in_progress" && t.status !== "in_progress") return false;
    if (activeTab === "blocked" && t.status !== "blocked") return false;
    if (activeTab === "done" && t.status !== "done") return false;
    if (taskSearchQuery.trim()) {
      const q = taskSearchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || t.project.toLowerCase().includes(q);
    }
    return true;
  });

  const allowedMenuItems = currentUser ? filterMenuForUser(SIDEBAR_NAVIGATION, currentUser) : [];
  const menuGroups = currentUser ? groupMenuByCategory(allowedMenuItems) : [];
  const roleBadge = currentUser ? getRoleBadgeStyle(currentUser.role_code) : null;

  // Icon renderer helper
  function renderMenuIcon(iconType) {
    switch (iconType) {
      case "dashboard":
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="9"></rect>
            <rect x="14" y="3" width="7" height="5"></rect>
            <rect x="14" y="12" width="7" height="9"></rect>
            <rect x="3" y="16" width="7" height="5"></rect>
          </svg>
        );
      case "tasks":
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
        );
      case "my_tasks":
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        );
      case "parameters":
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="21" x2="4" y2="14"></line>
            <line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line>
            <line x1="20" y1="12" x2="20" y2="3"></line>
            <line x1="1" y1="14" x2="7" y2="14"></line>
            <line x1="9" y1="8" x2="15" y2="8"></line>
            <line x1="17" y1="16" x2="23" y2="16"></line>
          </svg>
        );
      case "requirements":
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        );
      case "testing_queue":
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 2v6"></path>
            <path d="M15 2v6"></path>
            <path d="M12 17v5"></path>
            <path d="M5 8h14"></path>
            <path d="M6 8l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"></path>
          </svg>
        );
      case "roadmap":
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        );
      case "user_management":
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        );
      default:
        return (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        );
    }
  }

  // =========================================================================
  // VIEW 1: LOADING SKELETON
  // =========================================================================
  if (isAuthChecking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-canvas)" }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "3px solid var(--green-200)",
              borderTopColor: "var(--green-600)",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 0.75rem",
            }}
          ></div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: "600" }}>Memuat workspace devTracker...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: LOGIN FORM (DASH UI STYLE)
  // =========================================================================
  if (!authToken || !currentUser) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg-canvas)",
          padding: "1.5rem",
        }}
      >
        <div
          className="dash-card animate-fade-in"
          style={{
            width: "100%",
            maxWidth: "460px",
            padding: "2.25rem 2rem",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {/* Dash UI Auth Header */}
          <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                backgroundColor: "var(--green-600)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "var(--shadow-green)",
                marginBottom: "0.85rem",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </div>
            <h1 style={{ fontSize: "1.35rem", fontWeight: "800", color: "var(--text-main)", letterSpacing: "-0.02em" }}>
              Masuk ke devTracker
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "3px" }}>
              Sistem Pelacakan Progress & Kolaborasi Developer
            </p>
          </div>

          {/* Quick Demo Role Switcher */}
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid var(--border-light)",
              borderRadius: "8px",
              padding: "0.75rem",
              marginBottom: "1.25rem",
            }}
          >
            <div style={{ fontSize: "0.72rem", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
              Pilih Akun Demo Cepat:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {demoAccounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => selectDemoAccount(acc)}
                  style={{
                    fontSize: "0.74rem",
                    fontWeight: activeDemoRole === acc.id ? "700" : "600",
                    padding: "3px 8px",
                    borderRadius: "5px",
                    border: `1px solid ${activeDemoRole === acc.id ? "var(--green-500)" : "var(--border-light)"}`,
                    backgroundColor: activeDemoRole === acc.id ? "var(--green-50)" : "#ffffff",
                    color: activeDemoRole === acc.id ? "var(--green-800)" : "var(--text-main)",
                    cursor: "pointer",
                    transition: "all 0.12s ease",
                  }}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>

          {loginError && (
            <div
              style={{
                backgroundColor: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fecaca",
                padding: "0.65rem 0.85rem",
                borderRadius: "6px",
                fontSize: "0.82rem",
                marginBottom: "1rem",
                fontWeight: "500",
              }}
            >
              {loginError}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "1.1rem" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "var(--text-main)", marginBottom: "5px" }}>
                Alamat Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@devtracker.local"
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  fontSize: "0.85rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border-light)",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "1.35rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-main)" }}>
                  Kata Sandi (Password)
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ background: "none", border: "none", fontSize: "0.74rem", color: "var(--green-700)", fontWeight: "600", cursor: "pointer" }}
                >
                  {showPassword ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  fontSize: "0.85rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border-light)",
                  outline: "none",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="dash-btn dash-btn-primary"
              style={{
                width: "100%",
                padding: "0.65rem 1rem",
                fontSize: "0.88rem",
                fontWeight: "700",
              }}
            >
              {isSubmitting ? "Memverifikasi..." : "Masuk ke Workspace"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.74rem", color: "var(--text-muted)" }}>
            Docker Environment &bull; PostgreSQL 16 &bull; Go REST API
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: MAIN DASHBOARD SHELL (DASH UI STYLE)
  // =========================================================================
  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-canvas)" }}>
      {/* 1. SIDEBAR (DASH UI DARK SLATE) */}
      <aside
        style={{
          width: sidebarOpen ? "256px" : "70px",
          backgroundColor: "#0f172a", // Dash UI dark theme
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          borderRight: "1px solid #1e293b",
          transition: "width 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 50,
          position: isTablet ? "fixed" : "sticky",
          top: 0,
          height: "100vh",
          left: isTablet && !sidebarOpen ? "-260px" : 0,
        }}
      >
        {/* Sidebar Brand Header */}
        <div
          style={{
            height: "60px",
            display: "flex",
            alignItems: "center",
            padding: sidebarOpen ? "0 18px" : "0",
            justifyContent: sidebarOpen ? "flex-start" : "center",
            borderBottom: "1px solid #1e293b",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "7px",
              backgroundColor: "var(--green-500)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0f172a",
              fontWeight: "900",
              fontSize: "0.95rem",
              flexShrink: 0,
            }}
          >
            dT
          </div>
          {sidebarOpen && (
            <div>
              <div style={{ fontSize: "1rem", fontWeight: "800", letterSpacing: "-0.02em", color: "#ffffff" }}>
                devTracker
              </div>
              <div style={{ fontSize: "0.66rem", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" }}>
                Core Workspace
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Navigation Items */}
        <div style={{ flex: 1, padding: sidebarOpen ? "14px 10px" : "14px 6px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          {menuGroups.map((group) => (
            <div key={group.id}>
              {sidebarOpen && (
                <div
                  style={{
                    fontSize: "0.66rem",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#64748b",
                    padding: "0 10px 6px",
                  }}
                >
                  {group.label}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {group.items.map((item) => {
                  const isActive = activeMenu === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectMenu(item.id)}
                      title={!sidebarOpen ? item.label : undefined}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: sidebarOpen ? "space-between" : "center",
                        padding: sidebarOpen ? "0.55rem 0.75rem" : "0.55rem 0",
                        width: "100%",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: isActive ? "rgba(16, 185, 129, 0.15)" : "transparent",
                        color: isActive ? "#34d399" : "#94a3b8",
                        fontWeight: isActive ? "700" : "500",
                        fontSize: "0.82rem",
                        cursor: "pointer",
                        transition: "all 0.12s ease",
                        textAlign: "left",
                        borderLeft: isActive && sidebarOpen ? "3px solid #10b981" : "3px solid transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
                          e.currentTarget.style.color = "#ffffff";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.color = "#94a3b8";
                        }
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ color: isActive ? "#34d399" : "#64748b", display: "flex", flexShrink: 0 }}>
                          {renderMenuIcon(item.icon)}
                        </span>
                        {sidebarOpen && <span>{item.label}</span>}
                      </div>

                      {sidebarOpen && item.id === "general_parameters" && (
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: "700",
                            backgroundColor: "rgba(16, 185, 129, 0.2)",
                            color: "#34d399",
                            padding: "1px 6px",
                            borderRadius: "9999px",
                          }}
                        >
                          Lookup
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>


      </aside>

      {/* 2. MAIN LAYOUT (NAVBAR + CONTENT AREA) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* TOP NAVBAR (DASH UI NAVBAR) */}
        <header
          style={{
            height: "60px",
            backgroundColor: "#ffffff",
            borderBottom: "1px solid var(--border-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            position: "sticky",
            top: 0,
            zIndex: 40,
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.02)",
          }}
        >
          {/* Left: Sidebar Toggle + Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle Menu"
              style={{
                background: "none",
                border: "1px solid var(--border-light)",
                borderRadius: "6px",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text-main)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>

            {/* Quick Search */}
            <div style={{ position: "relative", width: "240px", display: isTablet ? "none" : "block" }}>
              <input
                type="text"
                placeholder="Cari task, dokumen, fitur... ⌘K"
                style={{
                  width: "100%",
                  padding: "0.4rem 0.6rem 0.4rem 1.85rem",
                  fontSize: "0.8rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border-light)",
                  backgroundColor: "#f8fafc",
                  outline: "none",
                }}
              />
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-subtle)"
                strokeWidth="2"
                style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)" }}
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>

          {/* Right: Status Pill + User Profile */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* Live Health Status */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "3px 9px",
                borderRadius: "9999px",
                backgroundColor: apiStatus.state === "online" ? "#ecfdf5" : "#fef2f2",
                color: apiStatus.state === "online" ? "#047857" : "#991b1b",
                fontSize: "0.74rem",
                fontWeight: "700",
                border: `1px solid ${apiStatus.state === "online" ? "#a7f3d0" : "#fecaca"}`,
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: apiStatus.state === "online" ? "#10b981" : "#ef4444",
                }}
                className={apiStatus.state === "online" ? "animate-pulse" : ""}
              ></span>
              <span>API {apiStatus.state === "online" ? `${apiStatus.latency}ms Online` : "Offline"}</span>
            </div>

            {/* User Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: "var(--green-100)",
                    color: "var(--green-800)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "800",
                    fontSize: "0.78rem",
                    border: "1px solid var(--green-300)",
                  }}
                >
                  {currentUser?.full_name?.split(" ").map((n) => n[0]).slice(0, 2).join("") || "U"}
                </div>
                <div style={{ textAlign: "left", display: isTablet ? "none" : "block" }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "var(--text-main)" }}>
                    {currentUser?.full_name}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    {currentUser?.role_name || "Developer"} &bull; {currentUser?.system_role}
                  </div>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              {userDropdownOpen && (
                <div
                  className="dash-card animate-fade-in"
                  style={{
                    position: "absolute",
                    top: "42px",
                    right: 0,
                    width: "210px",
                    zIndex: 100,
                    padding: "6px",
                  }}
                >
                  <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "var(--text-main)" }}>
                      {currentUser?.full_name}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{currentUser?.email}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: "4px",
                      border: "none",
                      background: "none",
                      color: "#dc2626",
                      fontSize: "0.82rem",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginTop: "4px",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fef2f2")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    <span>Keluar (Logout)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 3. MAIN CONTENT BODY */}
        <main style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
          <div style={{ maxWidth: "1360px", margin: "0 auto" }}>
            {/* GENERAL PARAMETER VIEW */}
            {activeMenu === "general_parameters" && (
              <GeneralParameterView authToken={authToken} />
            )}

            {/* DASHBOARD & TASKS VIEW */}
            {(activeMenu === "dashboard" || activeMenu === "tasks" || activeMenu === "my_tasks") && (
              <div className="animate-fade-in">
                {/* Dash UI Header Banner */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1.5rem",
                    flexWrap: "wrap",
                    gap: "1rem",
                  }}
                >
                  <div>
                    <h1 style={{ fontSize: "1.55rem", fontWeight: "800", color: "var(--text-main)", letterSpacing: "-0.02em" }}>
                      Dashboard Progres Developer
                    </h1>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "3px" }}>
                      Ikhtisar metrik tugas, blocker, dan pembaruan rilis tim engineering.
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => alert("Fitur Tambah Task Baru terhubung ke PostgreSQL API.")}
                      className="dash-btn dash-btn-primary"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      <span>Buat Task Baru</span>
                    </button>
                  </div>
                </div>

                {/* KPI METRIC CARDS (DASH UI STYLE) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "1rem",
                    marginBottom: "1.75rem",
                  }}
                >
                  {[
                    {
                      label: "Total Task Terdaftar",
                      val: "4",
                      badge: "100%",
                      desc: "Seluruh task aktif tim",
                      color: "var(--green-700)",
                      bgLight: "var(--green-50)",
                    },
                    {
                      label: "Task Milik Saya",
                      val: activeMenu === "my_tasks" ? "2" : "1",
                      badge: "Active",
                      desc: `Ditugaskan ke Anda`,
                      color: "#2563eb",
                      bgLight: "#eff6ff",
                    },
                    {
                      label: "Blocker & Kendala",
                      val: "0",
                      badge: "Clear",
                      desc: "Semua kendala teratasi",
                      color: "#047857",
                      bgLight: "#ecfdf5",
                    },
                    {
                      label: "Selesai (Done)",
                      val: "3",
                      badge: "75%",
                      desc: "Telah lolos verifikasi",
                      color: "#7c3aed",
                      bgLight: "#faf5ff",
                    },
                  ].map((metric, i) => (
                    <div
                      key={i}
                      className="dash-card"
                      style={{
                        padding: "1.1rem 1.25rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
                          {metric.label}
                        </span>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: "700",
                            color: metric.color,
                            backgroundColor: metric.bgLight,
                            padding: "2px 7px",
                            borderRadius: "9999px",
                          }}
                        >
                          {metric.badge}
                        </span>
                      </div>
                      <div style={{ fontSize: "1.85rem", fontWeight: "800", color: "var(--text-main)", margin: "0.5rem 0 0.15rem" }}>
                        {metric.val}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)" }}>{metric.desc}</div>
                    </div>
                  ))}
                </div>

                {/* TASK TRACKER TABLE CONTAINER (DASH UI SINGLE CARD) */}
                <div className="dash-card">
                  {/* Table Header & Segmented Tabs */}
                  <div
                    style={{
                      padding: "0 1.25rem",
                      borderBottom: "1px solid var(--border-light)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                      backgroundColor: "#fafbfc",
                    }}
                  >
                    <div style={{ display: "flex", gap: "4px" }}>
                      {[
                        { id: "all", label: "Semua Task", count: 4 },
                        { id: "in_progress", label: "In Progress", count: 1 },
                        { id: "done", label: "Done", count: 3 },
                        { id: "blocked", label: "Blocked", count: 0 },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "0.85rem 0.95rem",
                            background: "none",
                            border: "none",
                            borderBottom: activeTab === tab.id ? "2px solid var(--green-600)" : "2px solid transparent",
                            color: activeTab === tab.id ? "var(--green-700)" : "var(--text-muted)",
                            fontWeight: activeTab === tab.id ? "700" : "500",
                            fontSize: "0.82rem",
                            cursor: "pointer",
                          }}
                        >
                          <span>{tab.label}</span>
                          <span
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: "700",
                              padding: "1px 6px",
                              borderRadius: "9999px",
                              backgroundColor: activeTab === tab.id ? "var(--green-100)" : "#e2e8f0",
                              color: activeTab === tab.id ? "var(--green-800)" : "var(--text-muted)",
                            }}
                          >
                            {tab.count}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      Menampilkan <strong>{filteredTasks.length}</strong> task
                    </div>
                  </div>

                  {/* Filter & Search Toolbar */}
                  <div
                    style={{
                      padding: "0.75rem 1.25rem",
                      borderBottom: "1px solid var(--border-light)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <div style={{ position: "relative", minWidth: "260px" }}>
                      <input
                        type="text"
                        placeholder="Filter judul task, id, atau project..."
                        value={taskSearchQuery}
                        onChange={(e) => setTaskSearchQuery(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "0.45rem 0.65rem 0.45rem 1.9rem",
                          fontSize: "0.8rem",
                          borderRadius: "6px",
                          border: "1px solid var(--border-light)",
                          outline: "none",
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
                  </div>

                  {/* Dash UI Table */}
                  <div style={{ overflowX: "auto" }}>
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th style={{ width: "100px" }}>ID Task</th>
                          <th>Judul Task & Deskripsi</th>
                          <th style={{ width: "140px" }}>Proyek</th>
                          <th style={{ width: "160px" }}>Assignee</th>
                          <th style={{ width: "100px" }}>Prioritas</th>
                          <th style={{ width: "110px", textAlign: "center" }}>Status</th>
                          <th style={{ width: "110px" }}>Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTasks.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <span
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "0.75rem",
                                  fontWeight: "700",
                                  backgroundColor: "var(--bg-subtle)",
                                  color: "var(--text-main)",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                {t.id}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontWeight: "600", color: "var(--text-main)" }}>{t.title}</div>
                            </td>
                            <td>
                              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{t.project}</span>
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                <div
                                  style={{
                                    width: "24px",
                                    height: "24px",
                                    borderRadius: "50%",
                                    backgroundColor: "var(--green-100)",
                                    color: "var(--green-800)",
                                    fontSize: "0.68rem",
                                    fontWeight: "800",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    border: "1px solid var(--green-200)",
                                  }}
                                >
                                  {t.assigneeInitials}
                                </div>
                                <span style={{ fontSize: "0.8rem", color: "var(--text-main)", fontWeight: "500" }}>
                                  {t.assignee}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className={`dash-badge ${t.priority === "high" ? "dash-badge-danger" : "dash-badge-warning"}`}>
                                {t.priority === "high" ? "P1 High" : "P2 Med"}
                              </span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <span className={`dash-badge ${t.status === "done" ? "dash-badge-success" : "dash-badge-info"}`}>
                                {t.status === "done" ? "Selesai" : "In Progress"}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{t.dueDate}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer */}
                  <div
                    style={{
                      padding: "0.75rem 1.25rem",
                      borderTop: "1px solid var(--border-light)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.78rem",
                      color: "var(--text-muted)",
                      backgroundColor: "#fafbfc",
                    }}
                  >
                    <span>Menampilkan 1-4 dari 4 task</span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button disabled className="dash-btn dash-btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>
                        Sebelumnya
                      </button>
                      <button disabled className="dash-btn dash-btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>
                        Selanjutnya
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* REQUIREMENTS VIEW (DASH UI TABLE) */}
            {activeMenu === "requirements" && (
              <div className="dash-card animate-fade-in">
                <div style={{ padding: "1.1rem 1.35rem", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2 style={{ fontSize: "1.15rem", fontWeight: "800", color: "var(--text-main)" }}>Dokumen Spesifikasi (BRD & FSD)</h2>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Spesifikasi kebutuhan bisnis dan analisa teknis sistem.</p>
                  </div>
                  <button className="dash-btn dash-btn-primary">+ Buat Dokumen Baru</button>
                </div>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th style={{ width: "110px" }}>Nomor Dokumen</th>
                      <th>Judul Dokumen</th>
                      <th style={{ width: "160px" }}>Penulis</th>
                      <th style={{ width: "130px" }}>Tanggal</th>
                      <th style={{ width: "110px", textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: "BRD-01", title: "Business Requirement: Autentikasi JWT & Role Aplikasi", author: "Sarah Analyst", date: "19 Okt 2026", status: "Approved" },
                      { id: "FSD-02", title: "Functional Spec: Task Progress Tracking & Blocker Workflow", author: "Sarah Analyst", date: "20 Okt 2026", status: "In Review" },
                      { id: "API-03", title: "API Contract: Project Membership & Activity Logging", author: "Tech Lead", date: "21 Okt 2026", status: "Draft" },
                    ].map((doc) => (
                      <tr key={doc.id}>
                        <td><span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: "700" }}>{doc.id}</span></td>
                        <td style={{ fontWeight: "600" }}>{doc.title}</td>
                        <td style={{ color: "var(--text-muted)" }}>{doc.author}</td>
                        <td style={{ color: "var(--text-muted)" }}>{doc.date}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`dash-badge ${doc.status === "Approved" ? "dash-badge-success" : doc.status === "In Review" ? "dash-badge-warning" : "dash-badge-neutral"}`}>
                            {doc.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TESTING QUEUE VIEW (DASH UI TABLE) */}
            {activeMenu === "testing_queue" && (
              <div className="dash-card animate-fade-in">
                <div style={{ padding: "1.1rem 1.35rem", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2 style={{ fontSize: "1.15rem", fontWeight: "800", color: "var(--text-main)" }}>Antrean Uji QA (Quality Assurance)</h2>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Daftar fitur dan perbaikan yang siap diverifikasi QA Engineer.</p>
                  </div>
                  <button className="dash-btn dash-btn-primary">+ Log Hasil Uji</button>
                </div>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th style={{ width: "110px" }}>Test Case</th>
                      <th>Fitur / Task</th>
                      <th style={{ width: "130px" }}>Lingkungan</th>
                      <th style={{ width: "140px" }}>Tester</th>
                      <th style={{ width: "110px", textAlign: "center" }}>Status Uji</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: "TC-201", title: "Validasi login dengan kredensial salah (401 Unauthorized)", env: "Staging", tester: "Qonita Quality", status: "Pass" },
                      { id: "TC-202", title: "Pengujian filter parameter per group dan pencarian keyword", env: "Local Docker", tester: "Qonita Quality", status: "Ready" },
                    ].map((tc) => (
                      <tr key={tc.id}>
                        <td><span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: "700" }}>{tc.id}</span></td>
                        <td style={{ fontWeight: "600" }}>{tc.title}</td>
                        <td><span className="dash-badge dash-badge-neutral">{tc.env}</span></td>
                        <td style={{ color: "var(--text-muted)" }}>{tc.tester}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`dash-badge ${tc.status === "Pass" ? "dash-badge-success" : "dash-badge-warning"}`}>
                            {tc.status === "Pass" ? "Passed" : "Siap Uji"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ROADMAP & TIMELINE VIEW (DASH UI TABLE) */}
            {activeMenu === "roadmap" && (
              <div className="dash-card animate-fade-in">
                <div style={{ padding: "1.1rem 1.35rem", borderBottom: "1px solid var(--border-light)" }}>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: "800", color: "var(--text-main)" }}>Roadmap & Milestone Rilis</h2>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Jadwal rilis tahapan proyek dan progres penyelesaian fitur.</p>
                </div>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th style={{ width: "120px" }}>Sprint</th>
                      <th>Fase / Milestone</th>
                      <th style={{ width: "180px" }}>Jumlah Task</th>
                      <th style={{ width: "200px" }}>Progres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { sprint: "Sprint 1", phase: "Inisialisasi & Setup Autentikasi", items: "3 Task Selesai", progress: "100%" },
                      { sprint: "Sprint 2", phase: "Unified Lookup General Parameter", items: "1 Task Aktif", progress: "90%" },
                      { sprint: "Sprint 3", phase: "Task Management & Blocker Activity Log", items: "Belum Dimulai", progress: "0%" },
                    ].map((sp) => (
                      <tr key={sp.sprint}>
                        <td><span style={{ fontWeight: "700" }}>{sp.sprint}</span></td>
                        <td style={{ fontWeight: "600" }}>{sp.phase}</td>
                        <td style={{ color: "var(--text-muted)" }}>{sp.items}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ flex: 1, height: "6px", backgroundColor: "#e2e8f0", borderRadius: "9999px", overflow: "hidden" }}>
                              <div style={{ width: sp.progress, height: "100%", backgroundColor: "var(--green-600)" }}></div>
                            </div>
                            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--text-muted)" }}>{sp.progress}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* USER MANAGEMENT VIEW (DASH UI DIRECTORY TABLE) */}
            {activeMenu === "user_management" && (
              <div className="dash-card animate-fade-in">
                <div style={{ padding: "1.1rem 1.35rem", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2 style={{ fontSize: "1.15rem", fontWeight: "800", color: "var(--text-main)" }}>Manajemen Pengguna & Hak Akses</h2>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Direktori akun developer dan administrator level sistem.</p>
                  </div>
                  <button className="dash-btn dash-btn-primary">+ Tambah User Baru</button>
                </div>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Nama Pengguna</th>
                      <th>Email Akun</th>
                      <th style={{ width: "160px" }}>Role Profesi</th>
                      <th style={{ width: "130px" }}>Level Sistem</th>
                      <th style={{ width: "110px", textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demoAccounts.map((u, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div
                              style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "50%",
                                backgroundColor: "var(--green-100)",
                                color: "var(--green-800)",
                                fontSize: "0.72rem",
                                fontWeight: "800",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {u.label[0]}
                            </div>
                            <span style={{ fontWeight: "600" }}>{u.role.split(" (")[0]} User</span>
                          </div>
                        </td>
                        <td style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>{u.email}</td>
                        <td><span className="dash-badge dash-badge-info">{u.role}</span></td>
                        <td><span style={{ fontWeight: "700", fontSize: "0.78rem" }}>{u.id === "admin" ? "SYS_ADMIN" : "USER"}</span></td>
                        <td style={{ textAlign: "center" }}>
                          <span className="dash-badge dash-badge-success">ACTIVE</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
