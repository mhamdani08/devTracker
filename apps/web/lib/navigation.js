export const SIDEBAR_NAVIGATION = [
  // 1. Menu Aktif Saat Ini
  {
    id: "dashboard",
    label: "Dashboard",
    category: "main",
    roles: ["*"],
    icon: "dashboard",
  },
  {
    id: "projects",
    label: "Projects & Portfolio",
    category: "main",
    roles: ["*"],
    icon: "projects",
  },
  {
    id: "general_parameters",
    label: "General Parameter",
    category: "system",
    roles: ["*"],
    systemRoles: ["SYS_ADMIN"],
    icon: "parameters",
  },
  {
    id: "user_management",
    label: "User Managements",
    category: "system",
    roles: ["*"],
    systemRoles: ["SYS_ADMIN"],
    icon: "user_management",
  },

  /* =========================================================================
   * MENU BERIKUTNYA (MENYUSUL SETELAH SETUP ROLE-MENU SELESAI)
   * Aktifkan kembali saat tabel role_menus / hak akses sudah dikonfigurasi:
   * =========================================================================
  {
    id: "tasks",
    label: "Task Tracker",
    category: "main",
    roles: ["*"],
    badge: (counts) => counts.totalTasks || "4",
    icon: "tasks",
  },
  {
    id: "my_tasks",
    label: "Task Milik Saya",
    category: "role",
    roles: ["BACKEND_DEV", "FRONTEND_DEV", "FULLSTACK_DEV"],
    badge: (counts) => counts.myTasks || "2",
    icon: "my_tasks",
  },
  {
    id: "requirements",
    label: "Dokumen & Spesifikasi (BRD)",
    category: "role",
    roles: ["SYSTEM_ANALYST", "TECH_LEAD", "PROJECT_MANAGER"],
    badge: () => "3 Dokumen",
    badgeColor: "var(--blue-500)",
    icon: "requirements",
  },
  {
    id: "testing_queue",
    label: "Antrean Uji (Ready QA)",
    category: "role",
    roles: ["QA_ENGINEER", "TECH_LEAD"],
    badge: () => "2 Siap Uji",
    badgeColor: "var(--amber-500)",
    icon: "testing_queue",
  },
  {
    id: "bugs",
    label: "Bug & Defect Tracker",
    category: "role",
    roles: ["QA_ENGINEER", "BACKEND_DEV", "FRONTEND_DEV", "FULLSTACK_DEV", "TECH_LEAD"],
    badge: () => "1 Terbuka",
    badgeColor: "var(--red-500)",
    icon: "bugs",
  },
  {
    id: "roadmap",
    label: "Roadmap & Timeline",
    category: "role",
    roles: ["PROJECT_MANAGER", "TECH_LEAD", "SYSTEM_ANALYST"],
    icon: "roadmap",
  },
  {
    id: "blockers",
    label: "Blocker & Review",
    category: "role",
    roles: ["*"],
    badge: (counts) => counts.blockers || "0",
    badgeColor: "var(--green-500)",
    icon: "blockers",
  },
  {
    id: "user_management",
    label: "Manajemen Pengguna & Role",
    category: "system",
    systemRoles: ["SYS_ADMIN"],
    icon: "user_management",
  },
  {
    id: "activity",
    label: "Riwayat Aktivitas",
    category: "system",
    roles: ["*"],
    icon: "activity",
  },
  ========================================================================= */
];

export const NAVIGATION_GROUPS = [
  { id: "main", label: "Main Menu" },
  { id: "role", label: "Workflow & Roles" },
  { id: "system", label: "System Management" },
];

/**
 * Groups filtered menu items into corporate sections
 */
export function groupMenuByCategory(allowedItems) {
  return NAVIGATION_GROUPS
    .map((g) => ({
      ...g,
      items: allowedItems.filter(
        (item) => item.category === g.id || (g.id === "system" && (item.category === "admin" || item.category === "general"))
      ),
    }))
    .filter((g) => g.items.length > 0);
}

/**
 * Filter menu items based on current authenticated user
 */
export function filterMenuForUser(menuItems, user) {
  if (!user) return [];

  return menuItems.filter((item) => {
    // 1. Check System Role (e.g. SYS_ADMIN)
    if (item.systemRoles && !item.systemRoles.includes(user.system_role)) {
      return false;
    }

    // 2. Check Application Role
    if (item.roles && !item.roles.includes("*")) {
      const userRoleCode = user.role_code || "";
      if (!userRoleCode || !item.roles.includes(userRoleCode)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Role badge styling helper
 */
export function getRoleBadgeStyle(roleCode) {
  switch (roleCode) {
    case "TECH_LEAD":
      return { bg: "#ecfdf5", color: "#047857", label: "Tech Lead" };
    case "SYSTEM_ANALYST":
      return { bg: "#eff6ff", color: "#1d4ed8", label: "System Analyst" };
    case "BACKEND_DEV":
      return { bg: "#f0fdf4", color: "#15803d", label: "Backend Dev" };
    case "FRONTEND_DEV":
      return { bg: "#fdf4ff", color: "#a21caf", label: "Frontend Dev" };
    case "FULLSTACK_DEV":
      return { bg: "#faf5ff", color: "#7e22ce", label: "Fullstack Dev" };
    case "QA_ENGINEER":
      return { bg: "#fffbeb", color: "#b45309", label: "QA Engineer" };
    case "PROJECT_MANAGER":
      return { bg: "#fff1f2", color: "#be123c", label: "Project Manager" };
    default:
      return { bg: "#f1f5f9", color: "#475569", label: roleCode || "Developer" };
  }
}
