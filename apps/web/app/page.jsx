"use client";

import { useEffect, useState } from "react";
import { SIDEBAR_NAVIGATION, filterMenuForUser, getRoleBadgeStyle, groupMenuByCategory } from "../lib/navigation";

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

  // Same-origin Next.js proxy to backend
  const apiBaseUrl = "/api/v1";

  // Demo accounts for rapid role testing
  const demoAccounts = [
    { id: "admin", label: "SysAdmin / Lead", email: "admin@devtracker.local", role: "Tech Lead (SYS_ADMIN)" },
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
    const interval = setInterval(checkApi, 12000);
    return () => clearInterval(interval);
  }, [apiBaseUrl]);

  // 3. Responsive Breakpoints: Tablet/Mobile (< 1024px) auto-collapses to Drawer Overlay
  useEffect(() => {
    function handleResize() {
      const tablet = window.innerWidth < 1024;
      setIsTablet(tablet);
      if (tablet) {
        setSidebarOpen(false); // default closed drawer on mobile & tablet
      } else {
        setSidebarOpen(true);  // default open (256px) on desktop
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handleSelectMenu(itemId) {
    setActiveMenu(itemId);
    if (isTablet) {
      setSidebarOpen(false); // auto-close drawer overlay after selection on mobile/tablet
    }
  }

  // Handle Login Submit
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

      // Success
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

  // Select demo account
  function selectDemoAccount(acc) {
    setActiveDemoRole(acc.id);
    setEmail(acc.email);
    setPassword("Admin123!");
    setLoginError("");
  }

  // Demo Tasks
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
      blocker: null,
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
      blocker: null,
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
      blocker: null,
    },
    {
      id: "TSK-104",
      title: "Integrasi audit log perubahan status task & blocker warning",
      project: "DevTracker Core",
      status: "in_progress",
      priority: "medium",
      assignee: "Frontend Lead",
      assigneeInitials: "FL",
      dueDate: "22 Okt 2026",
      blocker: null,
    },
  ];

  const filteredTasks = sampleTasks.filter((t) => {
    if (activeTab === "all") return true;
    if (activeTab === "in_progress") return t.status === "in_progress";
    if (activeTab === "blocked") return t.status === "blocked";
    if (activeTab === "done") return t.status === "done";
    return true;
  });

  // Calculate dynamic menu items for current user
  const allowedMenuItems = currentUser ? filterMenuForUser(SIDEBAR_NAVIGATION, currentUser) : [];
  const menuGroups = currentUser ? groupMenuByCategory(allowedMenuItems) : [];
  const roleBadge = currentUser ? getRoleBadgeStyle(currentUser.role_code) : null;

  // Icon renderer helper
  function renderMenuIcon(iconType) {
    switch (iconType) {
      case "dashboard":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="9"></rect>
            <rect x="14" y="3" width="7" height="5"></rect>
            <rect x="14" y="12" width="7" height="9"></rect>
            <rect x="3" y="16" width="7" height="5"></rect>
          </svg>
        );
      case "tasks":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
        );
      case "my_tasks":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        );
      case "requirements":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        );
      case "testing_queue":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 2v6"></path>
            <path d="M15 2v6"></path>
            <path d="M12 17v5"></path>
            <path d="M5 8h14"></path>
            <path d="M6 8l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"></path>
          </svg>
        );
      case "bugs":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m8 2 1.88 1.88"></path>
            <path d="M14.12 3.88 16 2"></path>
            <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"></path>
            <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"></path>
            <path d="M12 20v-9"></path>
            <path d="M6.53 9C4.6 8.8 3 7.1 3 5"></path>
            <path d="M6 13H2"></path>
            <path d="M3 21c0-2.1 1.7-3.9 3.8-4"></path>
            <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"></path>
            <path d="M22 13h-4"></path>
            <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"></path>
          </svg>
        );
      case "roadmap":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        );
      case "blockers":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        );
      case "user_management":
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        );
      case "activity":
      default:
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="12 8 12 12 14 14"></polyline>
            <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"></path>
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
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              border: "3px solid var(--green-200)",
              borderTopColor: "var(--green-600)",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 1rem",
            }}
          ></div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontWeight: "500" }}>Memuat sesi devTracker...</p>
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
  // VIEW 2: LOGIN FORM (Clean White Theme + Emerald Green Accents)
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
        {/* Login Card */}
        <div
          className="animate-fade-in"
          style={{
            width: "100%",
            maxWidth: "480px",
            backgroundColor: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-light)",
            boxShadow: "var(--shadow-lg)",
            padding: "2.5rem 2.25rem",
          }}
        >
          {/* Header & Logo */}
          <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "var(--green-600)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--shadow-green)",
                marginBottom: "1rem",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </div>
            <h1 style={{ fontSize: "1.45rem", fontWeight: "800", color: "var(--text-main)", letterSpacing: "-0.03em", margin: 0, lineHeight: 1.25 }}>
              Core & Apps Support
            </h1>
            <p style={{ color: "var(--green-700)", fontSize: "0.95rem", fontWeight: "700", marginTop: "0.35rem", letterSpacing: "-0.01em" }}>
              Development Tracker
            </p>
          </div>

          {/* Quick Demo Role Selector */}
          <div
            style={{
              backgroundColor: "var(--green-50)",
              border: "1px solid var(--green-200)",
              borderRadius: "var(--radius-md)",
              padding: "0.85rem",
              marginBottom: "1.5rem",
            }}
          >
            <div style={{ fontSize: "0.74rem", fontWeight: "700", color: "var(--green-900)", marginBottom: "0.5rem" }}>
              Pilih Role Akun Demo untuk Uji Sidebar Dinamis:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {demoAccounts.map((acc) => {
                const isSelected = activeDemoRole === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => selectDemoAccount(acc)}
                    style={{
                      padding: "0.3rem 0.6rem",
                      borderRadius: "6px",
                      border: isSelected ? "1px solid var(--green-600)" : "1px solid rgba(0,0,0,0.08)",
                      backgroundColor: isSelected ? "var(--green-600)" : "#ffffff",
                      color: isSelected ? "#ffffff" : "var(--green-900)",
                      fontSize: "0.72rem",
                      fontWeight: isSelected ? "700" : "600",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {acc.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--green-800)", marginTop: "0.45rem", fontFamily: "var(--font-mono)" }}>
              Password: <strong>Admin123!</strong>
            </div>
          </div>

          {/* Error Alert */}
          {loginError && (
            <div
              style={{
                backgroundColor: "var(--red-50)",
                border: "1px solid #fecaca",
                borderRadius: "var(--radius-md)",
                padding: "0.75rem 1rem",
                marginBottom: "1.25rem",
                color: "var(--red-500)",
                fontSize: "0.84rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{loginError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin}>
            {/* Email Field */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: "600", color: "var(--text-main)", marginBottom: "0.4rem" }}>
                Email Akun
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <svg
                  style={{ position: "absolute", left: "12px", color: "var(--text-subtle)", pointerEvents: "none" }}
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <input
                  type="email"
                  required
                  placeholder="nama@perusahaan.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.65rem 1rem 0.65rem 2.4rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border-light)",
                    fontSize: "0.9rem",
                    color: "var(--text-main)",
                    backgroundColor: "#ffffff",
                    outline: "none",
                    fontFamily: "inherit",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--green-500)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(16, 185, 129, 0.15)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-light)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--text-main)" }}>
                  Password
                </label>
              </div>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <svg
                  style={{ position: "absolute", left: "12px", color: "var(--text-subtle)", pointerEvents: "none" }}
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Masukkan password Anda"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.65rem 2.5rem 0.65rem 2.4rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border-light)",
                    fontSize: "0.9rem",
                    color: "var(--text-main)",
                    backgroundColor: "#ffffff",
                    outline: "none",
                    fontFamily: "inherit",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--green-500)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(16, 185, 129, 0.15)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-light)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    background: "none",
                    border: "none",
                    color: "var(--text-subtle)",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title={showPassword ? "Sembunyikan password" : "Lihat password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "none",
                backgroundColor: isSubmitting ? "var(--green-700)" : "var(--green-600)",
                color: "#ffffff",
                fontSize: "0.95rem",
                fontWeight: "700",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                boxShadow: "var(--shadow-green)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) e.currentTarget.style.backgroundColor = "var(--green-700)";
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) e.currentTarget.style.backgroundColor = "var(--green-600)";
              }}
            >
              {isSubmitting ? (
                <>
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      border: "2px solid #ffffff",
                      borderTopColor: "transparent",
                      animation: "spin 0.8s linear infinite",
                    }}
                  ></div>
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Workspace</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Service Status Footer */}
          <div style={{ marginTop: "2rem", borderTop: "1px solid var(--border-light)", paddingTop: "1rem", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.72rem", color: "var(--text-subtle)" }}>
              <span>API: <strong>:8081</strong></span>
              <span>&bull;</span>
              <span>Web: <strong>:3002</strong></span>
              <span>&bull;</span>
              <span>DB: <strong>:5435</strong></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: AUTHENTICATED DASHBOARD WITH DYNAMIC SIDEBAR
  // =========================================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "var(--bg-canvas)", overflow: "hidden" }}>
      {/* ============================================================ */}
      {/* 1. TOP NAVBAR (64px, Sticky & Fixed, Subtle Border) */}
      {/* ============================================================ */}
      <nav
        style={{
          height: "64px",
          minHeight: "64px",
          maxHeight: "64px",
          flexShrink: 0,
          backgroundColor: "var(--green-900)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          position: "sticky",
          top: 0,
          zIndex: 50,
          boxShadow: "none",
        }}
      >
        {/* Brand & Sidebar Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: "rgba(255, 255, 255, 0.12)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#ffffff",
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
            title={
              isTablet
                ? (sidebarOpen ? "Tutup Drawer Menu" : "Buka Drawer Menu (Overlay)")
                : (sidebarOpen ? "Tutup Sidebar (Kecilkan ke 68px)" : "Buka Sidebar (Perluas ke 256px)")
            }
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "var(--green-500)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </div>
            <div>
              <div style={{ color: "#ffffff", fontWeight: "700", fontSize: "1.1rem", letterSpacing: "-0.01em", lineHeight: 1.1 }}>
                devTracker
              </div>
              <div style={{ color: "var(--green-200)", fontSize: "0.68rem", fontWeight: "500", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Developer Workspace
              </div>
            </div>
          </div>
        </div>

        {/* Center: Search / Filter input (Hidden gracefully on tablet/mobile) */}
        <div style={{ display: isTablet ? "none" : "flex", alignItems: "center", gap: "0.5rem", flex: 1, maxWidth: "380px", margin: "0 1.5rem" }}>
          <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center" }}>
            <svg
              style={{ position: "absolute", left: "12px", color: "var(--green-200)", pointerEvents: "none" }}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Cari task, tiket, atau blocker..."
              style={{
                width: "100%",
                padding: "0.5rem 1rem 0.5rem 2.25rem",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                backgroundColor: "rgba(2, 44, 34, 0.45)",
                color: "#ffffff",
                fontSize: "0.85rem",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        {/* Right Status Indicator & Authenticated User Profile */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
          {/* Live API Status Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.35rem 0.75rem",
              borderRadius: "var(--radius-full)",
              backgroundColor: apiStatus.state === "online" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
              border: `1px solid ${apiStatus.state === "online" ? "var(--green-400)" : "var(--red-500)"}`,
            }}
          >
            <span
              className={apiStatus.state === "online" ? "animate-pulse" : ""}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: apiStatus.state === "online" ? "var(--green-400)" : "var(--red-500)",
                display: "inline-block",
              }}
            ></span>
            <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "#ffffff" }}>
              API: {apiStatus.state === "online" ? `ONLINE (${apiStatus.latency}ms)` : apiStatus.state.toUpperCase()}
            </span>
          </div>

          {/* User Profile & Logout Dropdown */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                background: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "8px",
                padding: "0.3rem 0.6rem 0.3rem 0.4rem",
                cursor: "pointer",
                color: "#ffffff",
              }}
            >
              <div
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  backgroundColor: "var(--green-600)",
                  border: "2px solid var(--green-400)",
                  color: "#ffffff",
                  fontWeight: "700",
                  fontSize: "0.8rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {currentUser?.full_name ? currentUser.full_name[0].toUpperCase() : "U"}
              </div>
              <div style={{ textAlign: "left", display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: "700", lineHeight: 1.1 }}>{currentUser?.full_name}</span>
                <span style={{ fontSize: "0.68rem", color: "var(--green-200)" }}>
                  {currentUser?.role_name || currentUser?.system_role}
                </span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {/* Dropdown Menu */}
            {userDropdownOpen && (
              <div
                className="animate-fade-in"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "42px",
                  width: "230px",
                  backgroundColor: "#ffffff",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.08)",
                  border: "1px solid var(--border-light)",
                  padding: "0.5rem",
                  zIndex: 50,
                }}
              >
                <div style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid var(--border-light)", marginBottom: "0.25rem" }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "var(--text-main)" }}>{currentUser?.full_name}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", wordBreak: "break-all" }}>{currentUser?.email}</div>
                  <div style={{ marginTop: "0.35rem", display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem", borderRadius: "4px", backgroundColor: "var(--green-50)", color: "var(--green-700)", fontWeight: "700" }}>
                      {currentUser?.system_role}
                    </span>
                    {currentUser?.role_name && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          padding: "0.1rem 0.4rem",
                          borderRadius: "4px",
                          backgroundColor: roleBadge?.bg || "var(--bg-subtle)",
                          color: roleBadge?.color || "var(--text-muted)",
                          fontWeight: "700",
                        }}
                      >
                        {currentUser?.role_name}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "transparent",
                    color: "var(--red-500)",
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--red-50)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Keluar (Logout)
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ============================================================ */}
      {/* 2. BODY LAYOUT (Sticky Sidebar + Scrollable Content Area) */}
      {/* ============================================================ */}
      <div style={{ display: "flex", flex: 1, height: "calc(100vh - 64px)", overflow: "hidden", position: "relative" }}>
        {/* Tablet / Mobile Drawer Backdrop Overlay */}
        {isTablet && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed",
              top: "64px",
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(2, 44, 34, 0.5)",
              backdropFilter: "blur(2px)",
              zIndex: 55,
              transition: "opacity 0.2s ease",
            }}
          />
        )}

        {/* 2A. DYNAMIC SIDEBAR (Width: 256px Buka, 68px Tutup / Overlay on Tablet) */}
        <aside
          style={{
            backgroundColor: "var(--green-950)",
            color: "#ffffff",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            overflowY: "auto",
            overflowX: "hidden",
            boxSizing: "border-box",
            ...(isTablet
              ? {
                  position: "fixed",
                  top: "64px",
                  bottom: 0,
                  left: 0,
                  width: "256px",
                  minWidth: "256px",
                  maxWidth: "256px",
                  height: "calc(100vh - 64px)",
                  zIndex: 60,
                  transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
                  transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: sidebarOpen ? "4px 0 24px rgba(0, 0, 0, 0.35)" : "none",
                }
              : {
                  position: "relative",
                  height: "100%",
                  flexShrink: 0,
                  width: sidebarOpen ? "256px" : "68px",
                  minWidth: sidebarOpen ? "256px" : "68px",
                  maxWidth: sidebarOpen ? "256px" : "68px",
                  transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.22s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
                  zIndex: 30,
                  boxShadow: "none",
                }),
          }}
        >
          <div
            style={{
              padding: (!isTablet && !sidebarOpen) ? "1rem 0.5rem" : "1rem 0.85rem",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "1.1rem",
              boxSizing: "border-box",
            }}
          >
            {/* 1. CORPORATE WORKSPACE & TENANT HEADER */}
            {(!isTablet && !sidebarOpen) ? (
              <div
                title={`Workspace: Core & Apps Support\nRole: ${currentUser?.role_name || "Developer"} (${currentUser?.system_role})`}
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto",
                  cursor: "default",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
                }}
              >
                <span style={{ fontSize: "0.82rem", fontWeight: "800", color: "#ffffff", letterSpacing: "-0.02em", lineHeight: 1 }}>CAS</span>
                <span style={{ fontSize: "0.55rem", color: "var(--green-200)", fontWeight: "700", lineHeight: 1, marginTop: "2px" }}>W/S</span>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
                }}
              >
                {/* Tenant Title & Logo */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "8px",
                      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      border: "1px solid rgba(16, 185, 129, 0.35)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                      <path d="M2 17l10 5 10-5"></path>
                      <path d="M2 12l10 5 10-5"></path>
                    </svg>
                  </div>
                  <div style={{ overflow: "hidden", flex: 1 }}>
                    <div
                      style={{
                        fontSize: "0.62rem",
                        fontWeight: "700",
                        color: "var(--green-400)",
                        letterSpacing: "0.07em",
                        textTransform: "uppercase",
                        lineHeight: 1,
                      }}
                    >
                      Workspace Aktif
                    </div>
                    <div
                      style={{
                        fontSize: "0.88rem",
                        fontWeight: "700",
                        color: "#ffffff",
                        marginTop: "3px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      Core & Apps Support
                    </div>
                  </div>
                </div>

                {/* User Profession & System Role */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: "6px",
                    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "0.7rem",
                      color: "rgba(255, 255, 255, 0.85)",
                      fontWeight: "500",
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: "#10b981",
                        display: "inline-block",
                      }}
                    />
                    <span>{currentUser?.role_name || "Developer"}</span>
                  </div>

                  <span
                    style={{
                      fontSize: "0.62rem",
                      fontWeight: "700",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      backgroundColor: currentUser?.system_role === "SYS_ADMIN" ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.08)",
                      color: currentUser?.system_role === "SYS_ADMIN" ? "#34d399" : "rgba(255, 255, 255, 0.65)",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {currentUser?.system_role}
                  </span>
                </div>
              </div>
            )}

            {/* 2. CORPORATE CATEGORIZED NAVIGATION */}
            <div style={{ display: "flex", flexDirection: "column", gap: (isTablet || sidebarOpen) ? "1.1rem" : "0.5rem", overflowY: "auto" }}>
              {menuGroups.map((group, groupIdx) => {
                const showFull = isTablet || sidebarOpen;

                return (
                  <div key={group.id} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    {/* Category Section Header */}
                    {showFull ? (
                      <div
                        style={{
                          fontSize: "0.64rem",
                          fontWeight: "700",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "rgba(255, 255, 255, 0.4)",
                          padding: "6px 8px 4px 8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>{group.label}</span>
                        <span style={{ fontSize: "0.6rem", fontWeight: "600", color: "rgba(255, 255, 255, 0.25)" }}>
                          {group.items.length}
                        </span>
                      </div>
                    ) : (
                      groupIdx > 0 && (
                        <div
                          style={{
                            height: "1px",
                            backgroundColor: "rgba(255, 255, 255, 0.08)",
                            margin: "6px 6px",
                          }}
                        />
                      )
                    )}

                    {/* Menu Navigation Buttons */}
                    <nav style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      {group.items.map((item) => {
                        const isActive = activeMenu === item.id;
                        const counts = { totalTasks: "4", myTasks: "2", blockers: "0" };
                        const badgeValue = item.badge ? item.badge(counts) : null;

                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelectMenu(item.id)}
                            title={!showFull ? `${item.label}${badgeValue ? ` (${badgeValue})` : ""}` : undefined}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: !showFull ? "center" : "space-between",
                              padding: !showFull ? "0" : "0 10px",
                              width: !showFull ? "40px" : "100%",
                              height: "36px",
                              borderRadius: "7px",
                              border: isActive ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid transparent",
                              backgroundColor: isActive ? "rgba(16, 185, 129, 0.12)" : "transparent",
                              color: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.7)",
                              cursor: "pointer",
                              fontSize: "0.82rem",
                              fontWeight: isActive ? "600" : "500",
                              transition: "all 0.15s ease",
                              margin: !showFull ? "0 auto" : "0",
                              position: "relative",
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
                                e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)";
                              }
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: !showFull ? "0" : "8px",
                                justifyContent: !showFull ? "center" : "flex-start",
                                width: !showFull ? "100%" : "auto",
                                overflow: "hidden",
                              }}
                            >
                              {/* Left active line indicator for corporate touch */}
                              {showFull && isActive && (
                                <div
                                  style={{
                                    width: "3px",
                                    height: "14px",
                                    borderRadius: "2px",
                                    backgroundColor: "#10b981",
                                    marginRight: "-2px",
                                  }}
                                />
                              )}
                              <span
                                style={{
                                  color: isActive ? "#34d399" : "rgba(255, 255, 255, 0.6)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                {renderMenuIcon(item.icon)}
                              </span>
                              {showFull && (
                                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {item.label}
                                </span>
                              )}
                            </div>

                            {/* Badge Counter */}
                            {badgeValue && (
                              showFull ? (
                                <span
                                  style={{
                                    fontSize: "0.65rem",
                                    fontWeight: "600",
                                    fontFamily: "var(--font-mono)",
                                    padding: "1px 6px",
                                    borderRadius: "9999px",
                                    backgroundColor: item.badgeColor ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.08)",
                                    color: item.badgeColor || "rgba(255, 255, 255, 0.85)",
                                    border: "1px solid rgba(255, 255, 255, 0.08)",
                                    flexShrink: 0,
                                  }}
                                >
                                  {badgeValue}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    position: "absolute",
                                    top: "3px",
                                    right: "3px",
                                    minWidth: "15px",
                                    height: "15px",
                                    borderRadius: "9999px",
                                    backgroundColor: item.badgeColor || "var(--green-500)",
                                    color: "#ffffff",
                                    fontSize: "0.58rem",
                                    fontWeight: "700",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: "0 2px",
                                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
                                  }}
                                >
                                  {badgeValue}
                                </span>
                              )
                            )}
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ============================================================ */}
        {/* 3. MAIN CONTENT (Independent Scroll, 24px Padding, Border Halus) */}
        {/* ============================================================ */}
        <main
          style={{
            flex: 1,
            height: "100%",
            backgroundColor: "var(--bg-canvas)",
            padding: "24px",
            overflowY: "auto",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            boxSizing: "border-box",
          }}
        >
          <div style={{ maxWidth: "1360px", margin: "0 auto", width: "100%" }}>
            {/* Header Title & User Welcome */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "1.75rem",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div>
                <h1 style={{ fontSize: "1.75rem", fontWeight: "800", color: "var(--text-main)", letterSpacing: "-0.03em" }}>
                  Selamat Datang, {currentUser?.full_name} 👋
                </h1>
                <p style={{ color: "var(--text-muted)", fontSize: "0.92rem", marginTop: "0.25rem" }}>
                  Role Profesi: <strong style={{ color: "var(--green-700)" }}>{currentUser?.role_name || "Developer"}</strong> &bull; Level: <strong>{currentUser?.system_role}</strong>
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={() => alert("Fitur Tambah Task Baru terhubung ke PostgreSQL API.")}
                  style={{
                    backgroundColor: "var(--green-600)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0.6rem 1.1rem",
                    fontSize: "0.88rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    boxShadow: "var(--shadow-green)",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--green-700)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--green-600)")}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Buat Task Baru
                </button>
              </div>
            </div>

            {/* ============================================================ */}
            {/* VIEW CONTENT BASED ON ACTIVE SIDEBAR SELECTION */}
            {/* ============================================================ */}

            {/* 1. VIEW: REQUIREMENTS (Khusus System Analyst & Tech Lead) */}
            {activeMenu === "requirements" && (
              <div className="animate-fade-in" style={{ backgroundColor: "#ffffff", borderRadius: "var(--radius-lg)", padding: "1.75rem", border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)", marginBottom: "2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                  <div>
                    <h2 style={{ fontSize: "1.2rem", fontWeight: "700", color: "var(--text-main)" }}>Dokumen Spesifikasi & BRD / FSD</h2>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Akses khusus System Analyst & Tim Arsitektur untuk menyusun spesifikasi fitur.</p>
                  </div>
                  <button style={{ backgroundColor: "var(--blue-500)", color: "#ffffff", border: "none", borderRadius: "6px", padding: "0.45rem 0.9rem", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer" }}>+ Buat Dokumen Baru</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {[
                    { id: "BRD-01", title: "Business Requirement Document: Autentikasi JWT & Role Aplikasi", author: "Sarah Analyst", date: "19 Okt 2026", status: "Approved" },
                    { id: "FSD-02", title: "Functional Spec: Task Progress Tracking & Blocker Workflow", author: "Sarah Analyst", date: "20 Okt 2026", status: "In Review" },
                    { id: "API-03", title: "API Contract: Project Membership & Activity Logging", author: "System Analyst", date: "21 Okt 2026", status: "Draft" },
                  ].map((doc) => (
                    <div key={doc.id} style={{ padding: "1rem", border: "1px solid var(--border-light)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--blue-500)", backgroundColor: "var(--blue-50)", padding: "0.15rem 0.45rem", borderRadius: "4px" }}>{doc.id}</span>
                          <span style={{ fontWeight: "600", fontSize: "0.92rem", color: "var(--text-main)" }}>{doc.title}</span>
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-subtle)" }}>Penulis: {doc.author} &bull; Diperbarui: {doc.date}</div>
                      </div>
                      <span style={{ fontSize: "0.75rem", fontWeight: "700", padding: "0.2rem 0.6rem", borderRadius: "9999px", backgroundColor: doc.status === "Approved" ? "var(--green-50)" : "var(--amber-50)", color: doc.status === "Approved" ? "var(--green-700)" : "var(--amber-500)" }}>{doc.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. VIEW: TESTING QUEUE (Khusus QA Engineer) */}
            {activeMenu === "testing_queue" && (
              <div className="animate-fade-in" style={{ backgroundColor: "#ffffff", borderRadius: "var(--radius-lg)", padding: "1.75rem", border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)", marginBottom: "2rem" }}>
                <div style={{ marginBottom: "1.25rem" }}>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: "700", color: "var(--text-main)" }}>Antrean Pengujian QA (Ready for QA)</h2>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Daftar fitur dan bug fix yang sudah siap diuji oleh tim QA Engineer.</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {[
                    { id: "QA-01", task: "Verifikasi login multi-role dengan token JWT dan case-insensitive email", dev: "Budi Developer", env: "Staging WSL", priority: "High" },
                    { id: "QA-02", task: "Uji coba hot reload frontend Next.js dan bind port 3002", dev: "Frontend Team", env: "Local Dev", priority: "Medium" },
                  ].map((item) => (
                    <div key={item.id} style={{ padding: "1rem", border: "1px solid var(--border-light)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: "600", fontSize: "0.92rem", color: "var(--text-main)", marginBottom: "0.25rem" }}>{item.task}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-subtle)" }}>Developer: {item.dev} &bull; Environment: {item.env}</div>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button style={{ backgroundColor: "var(--green-600)", color: "#ffffff", border: "none", borderRadius: "6px", padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer" }}>✓ Lulus (Pass)</button>
                        <button style={{ backgroundColor: "var(--red-500)", color: "#ffffff", border: "none", borderRadius: "6px", padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer" }}>✗ Tolak (Reject)</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. VIEW: ROADMAP & TIMELINE (Khusus PM & Tech Lead) */}
            {activeMenu === "roadmap" && (
              <div className="animate-fade-in" style={{ backgroundColor: "#ffffff", borderRadius: "var(--radius-lg)", padding: "1.75rem", border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)", marginBottom: "2rem" }}>
                <div style={{ marginBottom: "1.25rem" }}>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: "700", color: "var(--text-main)" }}>Project Roadmap & Milestone Sprint</h2>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Pelacakan target tanggal, milestone rilis, dan beban kerja tim.</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
                  {[
                    { phase: "Sprint 1: Core Setup", progress: "100%", status: "Selesai", items: "Docker, Schema PostgreSQL, JWT Backend, Login UI" },
                    { phase: "Sprint 2: Task CRUD & RBAC", progress: "40%", status: "Sedang Berjalan", items: "CRUD Task, Assignee, Status Updates, Activity Audit" },
                    { phase: "Sprint 3: Blocker Workflow", progress: "0%", status: "Rencana", items: "Eskalasi Blocker, Notifikasi Tim, Filter Dashboard" },
                  ].map((sprint, i) => (
                    <div key={i} style={{ padding: "1.25rem", border: "1px solid var(--border-light)", borderRadius: "8px", backgroundColor: "var(--bg-subtle)" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--green-700)", textTransform: "uppercase" }}>{sprint.status}</div>
                      <div style={{ fontSize: "1rem", fontWeight: "700", color: "var(--text-main)", margin: "0.35rem 0 0.5rem" }}>{sprint.phase}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>{sprint.items}</div>
                      <div style={{ height: "6px", backgroundColor: "#e2e8f0", borderRadius: "9999px", overflow: "hidden" }}>
                        <div style={{ width: sprint.progress, height: "100%", backgroundColor: "var(--green-600)" }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. VIEW: USER MANAGEMENT (Khusus SysAdmin) */}
            {activeMenu === "user_management" && (
              <div className="animate-fade-in" style={{ backgroundColor: "#ffffff", borderRadius: "var(--radius-lg)", padding: "1.75rem", border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)", marginBottom: "2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                  <div>
                    <h2 style={{ fontSize: "1.2rem", fontWeight: "700", color: "var(--text-main)" }}>Manajemen Pengguna & Hak Akses</h2>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Akses administrator level sistem (`SYS_ADMIN`) untuk mengelola peran dan status anggota.</p>
                  </div>
                  <button style={{ backgroundColor: "var(--green-600)", color: "#ffffff", border: "none", borderRadius: "6px", padding: "0.45rem 0.9rem", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer" }}>+ Tambah User Baru</button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-light)", textAlign: "left", color: "var(--text-muted)" }}>
                        <th style={{ padding: "0.6rem 0.5rem" }}>Nama Pengguna</th>
                        <th style={{ padding: "0.6rem 0.5rem" }}>Email</th>
                        <th style={{ padding: "0.6rem 0.5rem" }}>Role Aplikasi</th>
                        <th style={{ padding: "0.6rem 0.5rem" }}>Level Sistem</th>
                        <th style={{ padding: "0.6rem 0.5rem" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demoAccounts.map((u, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                          <td style={{ padding: "0.75rem 0.5rem", fontWeight: "600" }}>{u.role.split(" (")[0]} User</td>
                          <td style={{ padding: "0.75rem 0.5rem", color: "var(--text-muted)" }}>{u.email}</td>
                          <td style={{ padding: "0.75rem 0.5rem" }}><span style={{ backgroundColor: "var(--green-50)", color: "var(--green-700)", padding: "0.2rem 0.5rem", borderRadius: "4px", fontWeight: "600", fontSize: "0.75rem" }}>{u.role}</span></td>
                          <td style={{ padding: "0.75rem 0.5rem", fontWeight: "600" }}>{u.id === "admin" ? "SYS_ADMIN" : "USER"}</td>
                          <td style={{ padding: "0.75rem 0.5rem", color: "var(--green-700)", fontWeight: "700" }}>ACTIVE</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. DEFAULT DASHBOARD CARDS (Rendered on Dashboard / Task Tracker) */}
            {(activeMenu === "dashboard" || activeMenu === "tasks" || activeMenu === "my_tasks") && (
              <>
                {/* METRIC CARDS */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                    gap: "1.25rem",
                    marginBottom: "2rem",
                  }}
                >
                  {[
                    {
                      label: "Total Task Terdaftar",
                      val: "4",
                      badge: "100%",
                      desc: "Seluruh task tim",
                      borderTop: "3px solid var(--green-600)",
                    },
                    {
                      label: "Task Milik Saya",
                      val: activeMenu === "my_tasks" ? "2" : "1",
                      badge: "Active",
                      desc: `Ditugaskan ke ${currentUser?.full_name}`,
                      borderTop: "3px solid var(--blue-500)",
                    },
                    {
                      label: "Blocker Terdeteksi",
                      val: "0",
                      badge: "Clear",
                      badgeColor: "var(--green-700)",
                      desc: "Semua rintangan teratasi",
                      borderTop: "3px solid var(--green-500)",
                    },
                    {
                      label: "Selesai (Done)",
                      val: "3",
                      badge: "75%",
                      desc: "Telah lolos verifikasi",
                      borderTop: "3px solid var(--green-500)",
                    },
                  ].map((card, i) => (
                    <div
                      key={i}
                      style={{
                        backgroundColor: "var(--bg-surface)",
                        borderRadius: "var(--radius-md)",
                        padding: "1.25rem",
                        border: "1px solid var(--border-light)",
                        borderTop: card.borderTop,
                        boxShadow: "var(--shadow-sm)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--text-muted)" }}>{card.label}</span>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: "700",
                            color: card.badgeColor || "var(--green-700)",
                            backgroundColor: "var(--green-50)",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "var(--radius-full)",
                          }}
                        >
                          {card.badge}
                        </span>
                      </div>
                      <div style={{ fontSize: "1.85rem", fontWeight: "800", color: "var(--text-main)", margin: "0.6rem 0 0.2rem" }}>
                        {card.val}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-subtle)" }}>{card.desc}</div>
                    </div>
                  ))}
                </div>

                {/* TASK TRACKER SECTION */}
                <div
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-light)",
                    boxShadow: "var(--shadow-sm)",
                    padding: "1.5rem",
                    marginBottom: "2rem",
                  }}
                >
                  {/* Header and Filter Tabs */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "1rem",
                      borderBottom: "1px solid var(--border-light)",
                      paddingBottom: "1rem",
                      marginBottom: "1.25rem",
                    }}
                  >
                    <div>
                      <h2 style={{ fontSize: "1.15rem", fontWeight: "700", color: "var(--text-main)" }}>
                        {activeMenu === "my_tasks" ? "Task Khusus yang Ditugaskan ke Anda" : "Daftar Task & Progres Terkini"}
                      </h2>
                      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        Dikelompokkan berdasarkan status pengerjaan developer.
                      </p>
                    </div>

                    {/* Filter Tabs */}
                    <div style={{ display: "flex", gap: "0.35rem", backgroundColor: "var(--bg-subtle)", padding: "0.25rem", borderRadius: "8px" }}>
                      {[
                        { id: "all", label: "Semua Task" },
                        { id: "in_progress", label: "Sedang Berjalan" },
                        { id: "done", label: "Selesai" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          style={{
                            padding: "0.4rem 0.8rem",
                            borderRadius: "6px",
                            border: "none",
                            fontSize: "0.78rem",
                            fontWeight: activeTab === tab.id ? "700" : "500",
                            backgroundColor: activeTab === tab.id ? "#ffffff" : "transparent",
                            color: activeTab === tab.id ? "var(--green-700)" : "var(--text-muted)",
                            boxShadow: activeTab === tab.id ? "var(--shadow-sm)" : "none",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Task Items */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {filteredTasks.map((task) => (
                      <div
                        key={task.id}
                        style={{
                          border: "1px solid var(--border-light)",
                          borderRadius: "var(--radius-md)",
                          padding: "1rem 1.25rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "1rem",
                          backgroundColor: "#ffffff",
                          transition: "transform 0.15s ease, box-shadow 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "var(--green-500)";
                          e.currentTarget.style.boxShadow = "var(--shadow-md)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "var(--border-light)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        {/* Left: ID & Title */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem" }}>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "0.75rem",
                                fontWeight: "600",
                                color: "var(--text-muted)",
                                backgroundColor: "var(--bg-subtle)",
                                padding: "0.15rem 0.4rem",
                                borderRadius: "4px",
                              }}
                            >
                              {task.id}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-subtle)", fontWeight: "500" }}>
                              &bull; {task.project}
                            </span>
                          </div>
                          <div style={{ fontWeight: "600", fontSize: "0.95rem", color: "var(--text-main)" }}>
                            {task.title}
                          </div>
                        </div>

                        {/* Right: Meta & Status Badge */}
                        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                          {/* Assignee Avatar */}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div
                              style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "50%",
                                backgroundColor: "var(--green-100)",
                                color: "var(--green-800)",
                                fontWeight: "700",
                                fontSize: "0.75rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              title={`Assignee: ${task.assignee}`}
                            >
                              {task.assigneeInitials}
                            </div>
                          </div>

                          {/* Due Date */}
                          <div style={{ fontSize: "0.78rem", color: "var(--text-subtle)", minWidth: "75px" }}>
                            {task.dueDate}
                          </div>

                          {/* Status Tag */}
                          <div style={{ minWidth: "115px", textAlign: "right" }}>
                            {task.status === "done" && (
                              <span
                                style={{
                                  backgroundColor: "var(--green-50)",
                                  color: "var(--green-700)",
                                  border: "1px solid var(--green-200)",
                                  padding: "0.3rem 0.7rem",
                                  borderRadius: "var(--radius-full)",
                                  fontSize: "0.75rem",
                                  fontWeight: "700",
                                }}
                              >
                                ✓ SELESAI
                              </span>
                            )}
                            {task.status === "in_progress" && (
                              <span
                                style={{
                                  backgroundColor: "var(--blue-50)",
                                  color: "var(--blue-500)",
                                  border: "1px solid #bfdbfe",
                                  padding: "0.3rem 0.7rem",
                                  borderRadius: "var(--radius-full)",
                                  fontSize: "0.75rem",
                                  fontWeight: "700",
                                }}
                              >
                                BERJALAN
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* INFRASTRUCTURE & PORT SUMMARY */}
            <div
              style={{
                backgroundColor: "var(--bg-surface)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-light)",
                boxShadow: "var(--shadow-sm)",
                padding: "1.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "var(--text-main)" }}>
                    Sistem & Autentikasi Aktif
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Terhubung ke Go REST API & PostgreSQL melalui Docker Compose WSL (Port terisolasi aman).
                  </p>
                </div>
                <span
                  style={{
                    backgroundColor: "var(--green-50)",
                    color: "var(--green-700)",
                    fontSize: "0.75rem",
                    fontWeight: "600",
                    padding: "0.25rem 0.65rem",
                    borderRadius: "6px",
                    border: "1px solid var(--green-200)",
                  }}
                >
                  Sesi: Aktif ({currentUser?.role_name || "Developer"})
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                <div style={{ padding: "0.85rem", borderRadius: "8px", border: "1px solid var(--border-light)", backgroundColor: "var(--bg-subtle)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "600" }}>PENGGUNA AKTIF</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: "700", color: "var(--green-700)", marginTop: "2px" }}>
                    {currentUser?.full_name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", marginTop: "4px" }}>
                    {currentUser?.email} &bull; {currentUser?.role_name || "SysAdmin"}
                  </div>
                </div>

                <div style={{ padding: "0.85rem", borderRadius: "8px", border: "1px solid var(--border-light)", backgroundColor: "var(--bg-subtle)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "600" }}>HAK AKSES SIDEBAR</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: "700", color: "var(--green-700)", marginTop: "2px" }}>
                    {allowedMenuItems.length} Menu Tersedia
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", marginTop: "4px" }}>
                    Tersaring otomatis berdasarkan role {currentUser?.role_code || "USER"}
                  </div>
                </div>

                <div style={{ padding: "0.85rem", borderRadius: "8px", border: "1px solid var(--border-light)", backgroundColor: "var(--bg-subtle)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "600" }}>DATABASE POSTGRESQL</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: "700", color: "var(--green-700)", marginTop: "2px" }}>
                    localhost:5435
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", marginTop: "4px" }}>
                    Database: devtracker &bull; Tabel: roles & users
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
