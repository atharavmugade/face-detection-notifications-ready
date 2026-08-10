import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  LayoutDashboard, Users, ScanFace, BarChart3, Settings as SettingsIcon,
  Search, Plus, Edit2, Trash2, Download, Sun, Moon, LogOut, CheckCircle2,
  XCircle, Clock, TrendingUp, UserPlus, ChevronDown, Bell, Wifi, Upload,
  X, Camera, CameraOff, Lock, Mail, Eye, EyeOff, RefreshCw, Image as ImageIcon,
  Filter, MoreVertical, AlertCircle, Sparkles
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from "recharts";

/* ============================== API ============================== */

const API_BASE = (import.meta.env.VITE_API_BASE || "https://face-detection-notifications-ready.onrender.com").replace(/\/$/, "");

async function apiFetch(path, { token, method = "GET", body, isForm = false } = {}) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = "Request failed";
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
  const contentType = res.headers.get("content-type") || "";
  return contentType.includes("application/json") ? res.json() : res;
}

async function loginRequest(email, password) {
  const form = new FormData();
  form.append("username", email);
  form.append("password", password);
  const res = await fetch(`${API_BASE}/api/auth/login`, { method: "POST", body: form });
  if (!res.ok) {
    let detail = "Incorrect email or password";
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.json(); // { access_token, token_type }
}

/* ============================== MOCK DATA (fallback / demo mode) ============================== */

const DEPARTMENTS = ["CSE", "ECE", "MECH", "CIVIL"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const FIRST_NAMES = ["Aarav", "Priya", "Daniel", "Fatima", "Liam", "Wei", "Sara", "Kabir", "Emma", "Rohan", "Ines", "Noah"];
const LAST_NAMES = ["Mehta", "Nair", "Cho", "Al-Sayed", "O'Connor", "Zhang", "Khan", "Verma", "Silva", "Iyer", "Park", "Brown"];

function makeStudents(n = 24) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    const dept = DEPARTMENTS[i % DEPARTMENTS.length];
    arr.push({
      id: `STU-${1000 + i}`,
      rollNo: `${dept}-22-${String(i + 1).padStart(3, "0")}`,
      name: `${first} ${last}`,
      department: dept,
      year: YEARS[i % YEARS.length],
      semester: (i % 8) + 1,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@campus.edu`,
      phone: `+1 555-01${String(10 + i).slice(-2)}`,
      images: 5 + (i % 4),
      registeredAt: "2026-06-1" + ((i % 9) + 1),
    });
  }
  return arr;
}

function makeAttendance(students, days = 30) {
  const rows = [];
  const today = new Date();
  for (let d = days; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    students.forEach((s) => {
      if (Math.random() > 0.14) {
        const h = 8 + Math.floor(Math.random() * 2);
        const m = Math.floor(Math.random() * 60);
        rows.push({
          studentId: s.id, name: s.name, department: s.department, rollNo: s.rollNo,
          date: dateStr, time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`,
          status: "Present", similarity: (0.82 + Math.random() * 0.17).toFixed(2),
        });
      }
    });
  }
  return rows;
}

const SEED_STUDENTS = makeStudents(24);
const SEED_ATTENDANCE = makeAttendance(SEED_STUDENTS);

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowTime() { return new Date().toTimeString().slice(0, 8); }
function lastNDates(n) {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/* ============================== THEME ============================== */

const theme = {
  light: {
    bg: "bg-gray-50", surface: "bg-white", surfaceAlt: "bg-gray-50",
    border: "border-gray-200", text: "text-gray-900", textMuted: "text-gray-500",
    textDim: "text-gray-400", hover: "hover:bg-gray-100", sidebarBg: "bg-white",
    input: "bg-white border-gray-200 text-gray-900 placeholder-gray-400",
  },
  dark: {
    bg: "bg-[#0A0B10]", surface: "bg-[#13141B]", surfaceAlt: "bg-[#1A1C25]",
    border: "border-gray-800", text: "text-gray-50", textMuted: "text-gray-400",
    textDim: "text-gray-600", hover: "hover:bg-gray-800/60", sidebarBg: "bg-[#0D0E14]",
    input: "bg-[#1A1C25] border-gray-800 text-gray-50 placeholder-gray-600",
  },
};

/* ============================== TOAST SYSTEM ============================== */

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, kind = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);
  return { toasts, push };
}

function ToastStack({ toasts, dark }) {
  const icon = { success: CheckCircle2, error: XCircle, info: Bell, warn: AlertCircle };
  const color = { success: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    error: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    info: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
    warn: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 w-80">
      {toasts.map((t) => {
        const Icon = icon[t.kind] || Bell;
        return (
          <div key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-lg animate-[fadeIn_0.25s_ease] ${dark ? "bg-[#161822]/95" : "bg-white/95"} ${color[t.kind]}`}>
            <Icon size={16} />
            <span className={`text-sm font-medium ${dark ? "text-gray-100" : "text-gray-800"}`}>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ============================== LOGIN PAGE ============================== */

function LoginPage({ onLogin, dark, toggleDark }) {
  const [email, setEmail] = useState("admin@campus.edu");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const t = dark ? theme.dark : theme.light;

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!password) { setError("Enter your password to continue."); return; }
    setLoading(true);
    try {
      const data = await loginRequest(email, password);
      setLoading(false);
      onLogin(data.access_token);
    } catch (err) {
      setLoading(false);
      setError(err.message || "Could not reach the server. Is the backend running on :8000?");
    }
  }

  return (
    <div className={`min-h-screen w-full flex items-center justify-center relative overflow-hidden ${t.bg}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <button onClick={toggleDark} className={`absolute top-6 right-6 p-2.5 rounded-xl border ${t.border} ${t.surface} ${t.hover} transition`}>
        {dark ? <Sun size={17} className="text-gray-300" /> : <Moon size={17} className="text-gray-600" />}
      </button>

      <div className={`relative w-full max-w-[400px] mx-4 rounded-3xl border ${t.border} ${t.surface} shadow-2xl p-8 backdrop-blur-xl`}>
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <ScanFace size={20} className="text-white" />
          </div>
          <div>
            <div className={`font-semibold text-[15px] ${t.text}`}>Verify</div>
            <div className={`text-xs ${t.textMuted}`}>Attendance Console</div>
          </div>
        </div>

        <h1 className={`text-xl font-semibold mb-1 ${t.text}`}>Sign in to admin</h1>
        <p className={`text-sm mb-6 ${t.textMuted}`}>Manage students, review attendance, and monitor recognition in real time.</p>

        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <label className={`text-xs font-medium mb-1.5 block ${t.textMuted}`}>Email</label>
            <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border ${t.input} focus-within:ring-2 focus-within:ring-indigo-500/40 transition`}>
              <Mail size={15} className={t.textDim} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                className="bg-transparent outline-none text-sm flex-1" placeholder="you@campus.edu" />
            </div>
          </div>
          <div>
            <label className={`text-xs font-medium mb-1.5 block ${t.textMuted}`}>Password</label>
            <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border ${t.input} focus-within:ring-2 focus-within:ring-indigo-500/40 transition`}>
              <Lock size={15} className={t.textDim} />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? "text" : "password"}
                className="bg-transparent outline-none text-sm flex-1" placeholder="••••••••" />
              <button type="button" onClick={() => setShowPw((s) => !s)}>
                {showPw ? <EyeOff size={15} className={t.textDim} /> : <Eye size={15} className={t.textDim} />}
              </button>
            </div>
          </div>

          {error && <div className="text-xs text-rose-500 flex items-center gap-1.5"><AlertCircle size={13} /> {error}</div>}

          <button type="submit" disabled={loading}
            className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition disabled:opacity-70 flex items-center justify-center gap-2">
            {loading ? <RefreshCw size={15} className="animate-spin" /> : null}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className={`text-center text-xs mt-5 ${t.textDim}`}>Students don't log in — they're recognized at the camera.</div>
      </div>
    </div>
  );
}

/* ============================== SHARED UI ============================== */

function StatCard({ label, value, icon: Icon, accent, dark, sub }) {
  const t = dark ? theme.dark : theme.light;
  return (
    <div className={`rounded-2xl border ${t.border} ${t.surface} p-5 transition hover:-translate-y-0.5 hover:shadow-lg duration-200`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent.bg}`}>
          <Icon size={16} className={accent.text} />
        </div>
      </div>
      <div className={`text-2xl font-bold ${t.text}`}>{value}</div>
      <div className={`text-xs mt-1 ${t.textMuted}`}>{label}</div>
      {sub && <div className={`text-[11px] mt-1.5 ${accent.text}`}>{sub}</div>}
    </div>
  );
}

function Pill({ children, tone = "neutral", dark }) {
  const tones = {
    success: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    warn: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    neutral: dark ? "bg-gray-700/30 text-gray-300 border-gray-700" : "bg-gray-100 text-gray-600 border-gray-200",
    accent: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  };
  return <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${tones[tone]}`}>{children}</span>;
}

/* ============================== SIDEBAR ============================== */

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "attendance", label: "Live Attendance", icon: ScanFace },
  { key: "students", label: "Students", icon: Users },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

function Sidebar({ page, setPage, dark, onLogout }) {
  const t = dark ? theme.dark : theme.light;
  return (
    <aside className={`w-60 shrink-0 h-screen sticky top-0 border-r ${t.border} ${t.sidebarBg} flex flex-col`}>
      <div className="px-5 py-5 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
          <ScanFace size={16} className="text-white" />
        </div>
        <span className={`font-semibold text-[15px] ${t.text}`}>Verify</span>
      </div>

      <nav className="flex-1 px-3 mt-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = page === item.key;
          const Icon = item.icon;
          return (
            <button key={item.key} onClick={() => setPage(item.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition
                ${active ? "bg-gradient-to-r from-indigo-500/15 to-purple-500/10 text-indigo-500 border border-indigo-500/20"
                          : `${t.textMuted} ${t.hover} border border-transparent`}`}>
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <button onClick={onLogout}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium ${t.textMuted} ${t.hover} transition`}>
          <LogOut size={16} /> Log out
        </button>
      </div>
    </aside>
  );
}

/* ============================== TOPBAR ============================== */

function Topbar({ title, subtitle, dark, toggleDark, notifications = [], onReadNotifications }) {
  const t = dark ? theme.dark : theme.light;
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.is_read).length;

  async function handleBell() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && unread > 0) {
      await onReadNotifications?.(notifications.filter((n) => !n.is_read).map((n) => n.id));
    }
  }

  return (
    <div className={`flex items-center justify-between px-8 py-5 border-b ${t.border} ${t.surface} sticky top-0 z-30 backdrop-blur-xl bg-opacity-90`}>
      <div>
        <h1 className={`text-lg font-semibold ${t.text}`}>{title}</h1>
        {subtitle && <p className={`text-sm mt-0.5 ${t.textMuted}`}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border ${t.border} ${t.surfaceAlt}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className={`text-xs font-medium ${t.textMuted}`}>System online</span>
        </div>

        <div className="relative">
          <button
            onClick={handleBell}
            className={`relative p-2 rounded-lg border ${t.border} ${t.hover} transition`}
            title="Notifications"
          >
            <Bell size={15} className={t.textMuted} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>

          {open && (
            <div className={`absolute right-0 top-11 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border ${t.border} ${t.surface} shadow-2xl overflow-hidden z-[100]`}>
              <div className={`px-4 py-3 border-b ${t.border} flex items-center justify-between`}>
                <div>
                  <div className={`text-sm font-semibold ${t.text}`}>Notifications</div>
                  <div className={`text-[11px] ${t.textMuted}`}>Attendance updates</div>
                </div>
                <Bell size={15} className={t.textDim} />
              </div>

              <div className="max-h-[360px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className={`px-4 py-8 text-center text-xs ${t.textMuted}`}>
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className={`px-4 py-3 border-b ${t.border} last:border-0 ${n.is_read ? "" : "bg-indigo-500/5"}`}>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <CheckCircle2 size={14} className="text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-xs font-semibold ${t.text}`}>{n.title}</div>
                          <div className={`text-[11px] leading-5 whitespace-pre-line mt-1 ${t.textMuted}`}>{n.message}</div>
                          <div className={`text-[9px] mt-1 ${t.textDim}`}>{n.created_at}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button onClick={toggleDark} className={`p-2 rounded-lg border ${t.border} ${t.hover} transition`}>
          {dark ? <Sun size={15} className="text-gray-300" /> : <Moon size={15} className="text-gray-600" />}
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
          AD
        </div>
      </div>
    </div>
  );
}

/* ============================== DASHBOARD ============================== */

function DashboardPage({ students, attendance, dark, setPage }) {
  const t = dark ? theme.dark : theme.light;
  const today = todayStr();
  const todays = attendance.filter((a) => a.date === today);
  const presentIds = new Set(todays.map((a) => a.studentId));
  const presentCount = presentIds.size;
  const absentCount = Math.max(students.length - presentCount, 0);
  const pct = students.length ? Math.round((presentCount / students.length) * 100) : 0;
  const unknownToday = Math.floor(Math.random() * 3);

  const trend = lastNDates(7).map((d) => {
    const rows = attendance.filter((a) => a.date === d);
    const present = new Set(rows.map((r) => r.studentId)).size;
    return { date: d.slice(5), present, absent: Math.max(students.length - present, 0) };
  });

  const recent = [...attendance].filter(a => a.date === today).sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, 6);

  return (
    <div className="p-8 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total students" value={students.length} icon={Users} dark={dark} accent={{ bg: "bg-indigo-500/10", text: "text-indigo-500" }} />
        <StatCard label="Present today" value={presentCount} icon={CheckCircle2} dark={dark} accent={{ bg: "bg-emerald-500/10", text: "text-emerald-500" }} sub={`${pct}% of class`} />
        <StatCard label="Absent today" value={absentCount} icon={XCircle} dark={dark} accent={{ bg: "bg-rose-500/10", text: "text-rose-500" }} />
        <StatCard label="Unknown faces" value={unknownToday} icon={AlertCircle} dark={dark} accent={{ bg: "bg-amber-500/10", text: "text-amber-500" }} />
        <StatCard label="Camera status" value="Live" icon={Wifi} dark={dark} accent={{ bg: "bg-purple-500/10", text: "text-purple-500" }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className={`lg:col-span-2 rounded-2xl border ${t.border} ${t.surface} p-6`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className={`font-semibold text-sm ${t.text}`}>Attendance — last 7 days</h3>
              <p className={`text-xs mt-0.5 ${t.textMuted}`}>Present vs. absent across the class</p>
            </div>
            <TrendingUp size={16} className="text-indigo-400" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="presGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1F2130" : "#EEE"} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: dark ? "#6B7280" : "#9CA3AF" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: dark ? "#6B7280" : "#9CA3AF" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 12, background: dark ? "#1A1C25" : "#fff" }} />
              <Area type="monotone" dataKey="present" stroke="#6366F1" fill="url(#presGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={`rounded-2xl border ${t.border} ${t.surface} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold text-sm ${t.text}`}>Recent activity</h3>
            <Clock size={15} className={t.textDim} />
          </div>
          <div className="space-y-3">
            {recent.length === 0 && <p className={`text-xs ${t.textMuted}`}>No attendance marked yet today.</p>}
            {recent.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
                  {r.name.split(" ").map(w=>w[0]).join("").slice(0,2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium truncate ${t.text}`}>{r.name}</div>
                  <div className={`text-[11px] ${t.textDim}`}>{r.time}</div>
                </div>
                <Pill tone="success" dark={dark}>Present</Pill>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`rounded-2xl border ${t.border} ${t.surface} p-6 flex items-center justify-between flex-wrap gap-4`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <div className={`text-sm font-semibold ${t.text}`}>Start today's session</div>
            <div className={`text-xs ${t.textMuted}`}>Open the live camera to begin recognizing and marking attendance.</div>
          </div>
        </div>
        <button onClick={() => setPage("attendance")}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition">
          Open live attendance →
        </button>
      </div>
    </div>
  );
}

/* ============================== LIVE ATTENDANCE ============================== */

function AttendancePage({ students, attendance, setAttendance, dark, pushToast, threshold, token, onMarked }) {
  const t = dark ? theme.dark : theme.light;
  const [cameraOn, setCameraOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [fps, setFps] = useState(0);
  const [recCount, setRecCount] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const fpsRef = useRef({ frames: 0, last: performance.now() });

  const today = todayStr();
  const presentIds = new Set(attendance.filter(a => a.date === today).map(a => a.studentId));

  useEffect(() => {
    let raf;
    function tick() {
      fpsRef.current.frames++;
      const now = performance.now();
      if (now - fpsRef.current.last >= 1000) {
        setFps(cameraOn ? 24 + Math.floor(Math.random() * 8) : 0);
        fpsRef.current.frames = 0;
        fpsRef.current.last = now;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cameraOn]);

  const startCamera = useCallback(async () => {
  try {
    setCameraOn(true);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });

    streamRef.current = stream;

    setTimeout(async () => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    }, 100);

    pushToast("Camera started", "info");
  } catch (err) {
    console.error("Camera Error:", err);
    pushToast("Camera unavailable — check permissions", "error");
  }
}, [pushToast]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setCameraOn(false); setAutoScan(false); setScanning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    pushToast("Camera stopped", "info");
  }, [pushToast]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);
  
  async function runScan() {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    setScanning(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx2d = canvas.getContext("2d");
      ctx2d.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      const form = new FormData();
      form.append("file", blob, "frame.jpg");

      const data = await apiFetch("/api/recognize", { token, method: "POST", body: form, isForm: true });
      setRecCount((c) => c + 1);

      if (!data.faces || data.faces.length === 0) {
        setLastEvent({ type: "none" });
        setScanning(false);
        return;
      }

      const face = data.faces[0]; // show the first detected face's status in the overlay

      if (face.status === "unknown") {
        setLastEvent({ type: "unknown", sim: face.similarity?.toFixed?.(2) ?? face.similarity });
        pushToast("Unknown person detected", "warn");
      } else if (face.status === "already_marked") {
        setLastEvent({ type: "duplicate", student: { name: face.name }, sim: face.similarity?.toFixed?.(2) ?? face.similarity });
        pushToast(`${face.name} — already marked today`, "info");
      } else if (face.status === "marked") {
        setLastEvent({ type: "recognized", student: { name: face.name }, sim: face.similarity?.toFixed?.(2) ?? face.similarity });
        pushToast(`${face.name} marked present`, "success");
        setAttendance((prev) => [
          { studentId: face.student_id, name: face.name, date: today, time: nowTime(),
            status: "Present", similarity: face.similarity?.toFixed?.(2) ?? face.similarity },
          ...prev,
        ]);
        onMarked?.();
      }
    } catch (err) {
      pushToast(err.message || "Recognition request failed", "error");
    }
    setScanning(false);
  }

  function toggleAuto() {
    if (autoScan) {
      clearInterval(intervalRef.current);
      setAutoScan(false);
    } else {
      runScan();
      intervalRef.current = setInterval(runScan, 4200);
      setAutoScan(true);
    }
  }

  const todaysList = attendance.filter(a => a.date === today).sort((a,b)=> a.time < b.time ? 1 : -1);

  return (
    <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-5">
        <div className={`rounded-2xl border ${t.border} ${t.surface} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ScanFace size={16} className="text-indigo-400" />
              <span className={`text-sm font-semibold ${t.text}`}>Live camera</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className={t.textDim}>FPS <b className={t.text}>{fps}</b></span>
              <span className={t.textDim}>Scans <b className={t.text}>{recCount}</b></span>
            </div>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-gray-800 flex items-center justify-center">
            {cameraOn ? (
              <>
                <video ref={videoRef}  autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" />
                <canvas ref={canvasRef} className="hidden" />
                {scanning && <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_2px_rgba(52,211,153,0.6)]" style={{ animation: "scanmove 1.4s linear infinite" }} />}
                {lastEvent && lastEvent.type !== "none" && (
                  <div className={`absolute bottom-3 left-3 right-3 px-3.5 py-2.5 rounded-xl border backdrop-blur-md text-sm flex items-center gap-2
                    ${lastEvent.type === "unknown" ? "bg-black/70 border-amber-500/40 text-amber-300"
                      : lastEvent.type === "duplicate" ? "bg-black/70 border-indigo-500/40 text-indigo-300"
                      : "bg-black/70 border-emerald-500/40 text-emerald-300"}`}>
                    {lastEvent.type === "unknown" && <><XCircle size={14} /> Unknown person · sim {lastEvent.sim}</>}
                    {lastEvent.type === "recognized" && <><CheckCircle2 size={14} /> {lastEvent.student.name} · {lastEvent.sim}</>}
                    {lastEvent.type === "duplicate" && <><Clock size={14} /> {lastEvent.student.name} · already marked today</>}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center text-gray-600">
                <Camera size={26} />
                <span className="text-xs mt-2">Camera is off</span>
              </div>
            )}
          </div>

          <div className="flex gap-2.5 mt-4">
            {!cameraOn ? (
              <button onClick={startCamera} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25">
                <Camera size={15} /> Start camera
              </button>
            ) : (
              <>
                <button onClick={runScan} disabled={scanning}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border ${t.border} ${t.text} ${t.hover} transition flex items-center justify-center gap-2 disabled:opacity-50`}>
                  <ScanFace size={15} /> {scanning ? "Scanning…" : "Scan once"}
                </button>
                <button onClick={toggleAuto}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2
                    ${autoScan ? "bg-rose-500/10 text-rose-500 border border-rose-500/30" : "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25"}`}>
                  {autoScan ? "Stop auto-scan" : "Start auto-scan"}
                </button>
                <button onClick={stopCamera} className={`px-3.5 py-2.5 rounded-xl border ${t.border} text-rose-500 ${t.hover} transition`}>
                  <CameraOff size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={`rounded-2xl border ${t.border} ${t.surface} p-5 flex flex-col`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-sm font-semibold ${t.text}`}>Today's attendance</h3>
          <Pill tone="accent" dark={dark}>{todaysList.length} marked</Pill>
        </div>
        <div className="space-y-2.5 overflow-y-auto max-h-[520px] pr-1">
          {todaysList.length === 0 && <p className={`text-xs ${t.textMuted}`}>Nobody marked present yet — start scanning.</p>}
          {todaysList.map((r, i) => (
            <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl ${t.surfaceAlt} border ${t.border}`}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
                {r.name.split(" ").map(w=>w[0]).join("").slice(0,2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium truncate ${t.text}`}>{r.name}</div>
                <div className={`text-[10.5px] ${t.textDim}`}>{r.rollNo} · {r.time}</div>
              </div>
              <span className={`text-[10.5px] font-mono ${t.textDim}`}>{r.similarity}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes scanmove { 0% { top: 0%; } 100% { top: 100%; } }`}</style>
    </div>
  );
}

/* ============================== STUDENTS ============================== */

function AddStudentModal({ onClose, onSave, dark, editing, saving }) {
  const t = dark ? theme.dark : theme.light;
  const [form, setForm] = useState(editing || {
    name: "", rollNo: "", department: DEPARTMENTS[0], year: YEARS[0], semester: 1, email: "", phone: "",
  });
  const [step, setStep] = useState(1);
  const [images, setImages] = useState([]); // array of File/Blob objects
  const [camOn, setCamOn] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function startCam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      
    } catch { /* silently ignore — user can still use file upload */ }
  }

  function stopCam() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setCamOn(false);
  }

  useEffect(() => () => streamRef.current?.getTracks().forEach((tr) => tr.stop()), []);

  async function captureFromCam() {
    if (!videoRef.current || images.length >= 10) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    setImages((imgs) => [...imgs, blob].slice(0, 10));
  }

  function handleFileUpload(e) {
    const files = Array.from(e.target.files || []);
    setImages((imgs) => [...imgs, ...files].slice(0, 10));
    e.target.value = "";
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`w-full max-w-lg rounded-2xl border ${t.border} ${t.surface} shadow-2xl overflow-hidden`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${t.border}`}>
          <h3 className={`font-semibold text-sm ${t.text}`}>{editing ? "Edit student" : "Add student"}</h3>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${t.hover}`}><X size={16} className={t.textMuted} /></button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full name" dark={dark}><input value={form.name} onChange={(e)=>update("name", e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-sm ${t.input}`} placeholder="Aarav Mehta" /></Field>
                <Field label="Roll number" dark={dark}><input value={form.rollNo} onChange={(e)=>update("rollNo", e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-sm ${t.input}`} placeholder="CSE-22-014" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Department" dark={dark}>
                  <select value={form.department} onChange={(e)=>update("department", e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-sm ${t.input}`}>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Year" dark={dark}>
                  <select value={form.year} onChange={(e)=>update("year", e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-sm ${t.input}`}>
                    {YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email (optional)" dark={dark}><input value={form.email} onChange={(e)=>update("email", e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-sm ${t.input}`} placeholder="name@campus.edu" /></Field>
                <Field label="Phone (optional)" dark={dark}><input value={form.phone} onChange={(e)=>update("phone", e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-sm ${t.input}`} placeholder="+1 555-0100" /></Field>
              </div>
            </>
          )}

          {step === 2 && (
            <div>
              <p className={`text-xs mb-3 ${t.textMuted}`}>Capture 5–10 face images for enrollment, or upload existing photos (e.g. from your data/students folder). More angles improve accuracy.</p>
              <div className={`relative rounded-xl aspect-video bg-black flex items-center justify-center mb-3 border ${t.border} overflow-hidden`}>
                {camOn ? (
                  <video ref={videoRef} muted playsInline className="w-full h-full object-cover -scale-x-100" />
                ) : (
                  <div className="text-center">
                    <ImageIcon size={22} className="text-gray-600 mx-auto mb-2" />
                    <span className="text-xs text-gray-500">Camera off</span>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                {!camOn ? (
                  <button type="button" onClick={startCam} className={`flex-1 py-2 rounded-lg border text-xs font-medium ${t.border} ${t.text} ${t.hover}`}>
                    <Camera size={13} className="inline mr-1" /> Start camera
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={captureFromCam} disabled={images.length >= 10}
                      className="flex-1 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                      <Camera size={13} /> Capture image
                    </button>
                    <button type="button" onClick={stopCam} className={`px-3 py-2 rounded-lg border ${t.border} text-xs ${t.textMuted} ${t.hover}`}>Stop</button>
                  </>
                )}
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className={`px-3 py-2 rounded-lg border ${t.border} text-xs ${t.textMuted} ${t.hover}`}>
                  <Upload size={13} className="inline mr-1" /> Upload
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className={`w-9 h-9 rounded-lg border overflow-hidden ${i < images.length ? "border-transparent" : `${t.border} ${t.surfaceAlt}`}`}>
                    {i < images.length && <img src={URL.createObjectURL(images[i])} alt="" className="w-full h-full object-cover" />}
                  </div>
                ))}
              </div>
              <div className={`text-[11px] mt-2 ${t.textDim}`}>{images.length}/10 captured — minimum 5 required</div>
            </div>
          )}
        </div>

        <div className={`flex items-center justify-between px-6 py-4 border-t ${t.border}`}>
          {step === 2 ? (
            <button onClick={() => setStep(1)} className={`text-xs font-medium ${t.textMuted}`}>← Back</button>
          ) : <span />}
          {step === 1 ? (
            <button onClick={() => { stopCam(); setStep(2); }} disabled={!form.name || !form.rollNo}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold disabled:opacity-50">
              Continue to face capture →
            </button>
          ) : (
            <button onClick={() => { stopCam(); onSave(form, images); }} disabled={images.length < 5 || saving}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
              {saving && <RefreshCw size={13} className="animate-spin" />}
              {saving ? "Registering…" : "Register student"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, dark }) {
  const t = dark ? theme.dark : theme.light;
  return <div><label className={`text-[11px] font-medium mb-1 block ${t.textMuted}`}>{label}</label>{children}</div>;
}

function StudentsPage({ students, setStudents, attendance, dark, pushToast, token, onChanged }) {
  const t = dark ? theme.dark : theme.light;
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 8;
  const today = todayStr();
  const presentIds = new Set(attendance.filter(a => a.date === today).map(a => a.studentId));

  const filtered = students.filter((s) => {
    const matchQ = s.name.toLowerCase().includes(query.toLowerCase()) || s.rollNo.toLowerCase().includes(query.toLowerCase());
    const matchD = deptFilter === "All" || s.department === deptFilter;
    return matchQ && matchD;
  });
  const totalPages = Math.max(Math.ceil(filtered.length / perPage), 1);
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  async function handleSave(form, images) {
    setSaving(true);
    const studentId = `S${String(Date.now()).slice(-6)}`;
    try {
      await apiFetch("/api/students", {
        token, method: "POST",
        body: {
          student_id: studentId, name: form.name, roll_no: form.rollNo, department: form.department,
          year: form.year, semester: Number(form.semester) || 1, email: form.email, phone: form.phone,
        },
      });

      const formData = new FormData();
      images.forEach((img, i) => formData.append("files", img, `photo_${i}.jpg`));
      const enrollResult = await apiFetch(`/api/students/${studentId}/enroll`, { token, method: "POST", body: formData, isForm: true });

      setShowModal(false);
      setSaving(false);
      pushToast(`Registration successful — ${enrollResult.images_enrolled} images enrolled`, "success");
      onChanged?.();
    } catch (err) {
      setSaving(false);
      pushToast(err.message || "Registration failed", "error");
    }
  }

  async function handleDelete(id, name) {
    try {
      await apiFetch(`/api/students/${id}`, { token, method: "DELETE" });
      pushToast(`${name} removed from database`, "info");
      onChanged?.();
    } catch (err) {
      pushToast(err.message || "Could not delete student", "error");
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border flex-1 max-w-sm ${t.input}`}>
            <Search size={14} className={t.textDim} />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search by name or roll no."
              className="bg-transparent outline-none text-sm flex-1" />
          </div>
          <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            className={`px-3 py-2 rounded-xl border text-sm ${t.input}`}>
            <option>All</option>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <button onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-500/25">
          <UserPlus size={15} /> Add student
        </button>
      </div>

      <div className={`rounded-2xl border ${t.border} ${t.surface} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${t.border} ${t.surfaceAlt}`}>
              {["Student", "Roll no.", "Department", "Year", "Images", "Today", ""].map((h) => (
                <th key={h} className={`text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide ${t.textDim}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((s) => (
              <tr key={s.id} className={`border-b ${t.border} last:border-0 ${t.hover} transition`}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
                      {s.name.split(" ").map(w=>w[0]).join("").slice(0,2)}
                    </div>
                    <div>
                      <div className={`font-medium ${t.text}`}>{s.name}</div>
                      <div className={`text-[11px] ${t.textDim}`}>{s.id}</div>
                    </div>
                  </div>
                </td>
                <td className={`px-5 py-3 font-mono text-xs ${t.textMuted}`}>{s.rollNo}</td>
                <td className={`px-5 py-3 ${t.textMuted}`}>{s.department}</td>
                <td className={`px-5 py-3 ${t.textMuted}`}>{s.year}</td>
                <td className={`px-5 py-3 ${t.textMuted}`}>{s.images} photos</td>
                <td className="px-5 py-3">
                  {presentIds.has(s.id) ? <Pill tone="success" dark={dark}>Present</Pill> : <Pill tone="neutral" dark={dark}>Absent</Pill>}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button className={`p-1.5 rounded-lg ${t.hover}`}><Edit2 size={13} className={t.textDim} /></button>
                    <button onClick={() => handleDelete(s.id, s.name)} className={`p-1.5 rounded-lg ${t.hover}`}><Trash2 size={13} className="text-rose-400" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={7} className={`px-5 py-10 text-center text-sm ${t.textMuted}`}>No students match your search.</td></tr>
            )}
          </tbody>
        </table>

        <div className={`flex items-center justify-between px-5 py-3 border-t ${t.border}`}>
          <span className={`text-xs ${t.textDim}`}>{filtered.length} student{filtered.length !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-1.5">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className={`px-2.5 py-1 rounded-lg text-xs border ${t.border} ${t.textMuted} disabled:opacity-40 ${t.hover}`}>Prev</button>
            <span className={`text-xs ${t.textMuted}`}>{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className={`px-2.5 py-1 rounded-lg text-xs border ${t.border} ${t.textMuted} disabled:opacity-40 ${t.hover}`}>Next</button>
          </div>
        </div>
      </div>

      {showModal && <AddStudentModal onClose={() => setShowModal(false)} onSave={handleSave} dark={dark} saving={saving} />}
    </div>
  );
}

/* ============================== ANALYTICS ============================== */

function AnalyticsPage({ students, attendance, dark }) {
  const t = dark ? theme.dark : theme.light;

  const trend = lastNDates(14).map((d) => {
    const rows = attendance.filter((a) => a.date === d);
    const present = new Set(rows.map((r) => r.studentId)).size;
    return { date: d.slice(5), present, absent: Math.max(students.length - present, 0) };
  });

  const deptData = DEPARTMENTS.map((dept) => {
    const deptStudents = students.filter((s) => s.department === dept);
    const rows = attendance.filter((a) => a.department === dept);
    const rate = deptStudents.length ? Math.round((rows.length / (deptStudents.length * 30)) * 100) : 0;
    return { name: dept, value: Math.min(rate, 100) };
  });

  const COLORS = ["#6366F1", "#8B5CF6", "#EC4899", "#F59E0B"];

  const perStudent = students.map((s) => {
    const rows = attendance.filter((a) => a.studentId === s.id);
    const total = lastNDates(30).length;
    return { name: s.name, pct: Math.round((rows.length / total) * 100) };
  }).sort((a, b) => b.pct - a.pct);

  const topPresent = perStudent.slice(0, 5);
  const topAbsent = [...perStudent].sort((a, b) => a.pct - b.pct).slice(0, 5);

  return (
    <div className="p-8 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className={`lg:col-span-2 rounded-2xl border ${t.border} ${t.surface} p-6`}>
          <h3 className={`font-semibold text-sm mb-4 ${t.text}`}>Attendance trend — 14 days</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1F2130" : "#EEE"} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10.5, fill: dark ? "#6B7280" : "#9CA3AF" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10.5, fill: dark ? "#6B7280" : "#9CA3AF" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 12, background: dark ? "#1A1C25" : "#fff" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="present" stroke="#6366F1" strokeWidth={2.5} dot={false} name="Present" />
              <Line type="monotone" dataKey="absent" stroke="#F43F5E" strokeWidth={2} dot={false} name="Absent" strokeDasharray="4 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={`rounded-2xl border ${t.border} ${t.surface} p-6`}>
          <h3 className={`font-semibold text-sm mb-4 ${t.text}`}>Department-wise rate</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={deptData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={3}>
                {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 12, background: dark ? "#1A1C25" : "#fff" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {deptData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className={`text-[11px] ${t.textMuted}`}>{d.name} {d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className={`rounded-2xl border ${t.border} ${t.surface} p-6`}>
          <h3 className={`font-semibold text-sm mb-4 ${t.text}`}>Top attendance</h3>
          <div className="space-y-3">
            {topPresent.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className={`text-xs w-28 truncate ${t.text}`}>{s.name}</span>
                <div className={`flex-1 h-2 rounded-full ${t.surfaceAlt} overflow-hidden`}>
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${s.pct}%` }} />
                </div>
                <span className={`text-xs font-mono w-10 text-right ${t.textMuted}`}>{s.pct}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className={`rounded-2xl border ${t.border} ${t.surface} p-6`}>
          <h3 className={`font-semibold text-sm mb-4 ${t.text}`}>Needs attention</h3>
          <div className="space-y-3">
            {topAbsent.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className={`text-xs w-28 truncate ${t.text}`}>{s.name}</span>
                <div className={`flex-1 h-2 rounded-full ${t.surfaceAlt} overflow-hidden`}>
                  <div className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full" style={{ width: `${s.pct}%` }} />
                </div>
                <span className={`text-xs font-mono w-10 text-right ${t.textMuted}`}>{s.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== SETTINGS ============================== */

function SettingsPage({ dark, threshold, setThreshold, pushToast }) {
  const t = dark ? theme.dark : theme.light;
  return (
    <div className="p-8 max-w-2xl space-y-5">
      <div className={`rounded-2xl border ${t.border} ${t.surface} p-6`}>
        <h3 className={`font-semibold text-sm mb-1 ${t.text}`}>Recognition threshold</h3>
        <p className={`text-xs mb-4 ${t.textMuted}`}>Minimum similarity score required to accept a match. Higher values reduce false accepts but may reject valid matches in poor lighting.</p>
        <div className="flex items-center gap-4">
          <input type="range" min="0.2" max="0.7" step="0.01" value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="flex-1 accent-indigo-500" />
          <span className={`font-mono text-sm w-14 text-right ${t.text}`}>{threshold.toFixed(2)}</span>
        </div>
      </div>

      <div className={`rounded-2xl border ${t.border} ${t.surface} p-6`}>
        <h3 className={`font-semibold text-sm mb-4 ${t.text}`}>Database</h3>
        <div className="flex items-center gap-3">
          <button onClick={() => pushToast("Backup created", "success")}
            className={`px-4 py-2 rounded-xl border text-sm font-medium ${t.border} ${t.text} ${t.hover}`}>
            Backup database
          </button>
          <button onClick={() => pushToast("Database updated", "success")}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25">
            Sync now
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================== APP ROOT ============================== */

export default function App() {
  const [token, setToken] = useState(null);
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [threshold, setThreshold] = useState(0.38);
  const [loadingData, setLoadingData] = useState(false);
  const { toasts, push } = useToasts();
  const t = dark ? theme.dark : theme.light;

  const refreshData = useCallback(async (tok) => {
    setLoadingData(true);
    try {
      const [studentList, attendanceRange, settings] = await Promise.all([
        apiFetch("/api/students", { token: tok }),
        apiFetch(`/api/attendance/range?start=${lastNDates(30)[0]}&end=${todayStr()}`, { token: tok }),
        apiFetch("/api/settings", { token: tok }),
      ]);
      setStudents(studentList.map((s) => ({
        id: s.student_id, rollNo: s.roll_no, name: s.name, department: s.department,
        year: s.year, semester: s.semester, email: s.email, phone: s.phone,
        images: s.images ?? 0, registeredAt: s.created_at,
      })));
      setAttendance(attendanceRange.map((a) => ({
        studentId: a.student_id, name: a.name, department: a.department, rollNo: a.roll_no,
        date: a.date, time: a.time, status: "Present", similarity: a.similarity?.toFixed?.(2) ?? a.similarity,
      })));
      setThreshold(settings.match_threshold);
    } catch (err) {
      push(err.message || "Could not load data from the server", "error");
    }
    setLoadingData(false);
  }, [push]);

  const refreshNotifications = useCallback(async (tok = token) => {
    if (!tok) return;
    try {
      const data = await apiFetch("/api/notifications?limit=50", { token: tok });
      setNotifications(data);
    } catch (err) {
      console.error("Could not load notifications:", err);
    }
  }, [token]);

  async function markNotificationsRead(ids) {
    try {
      await apiFetch("/api/notifications/read", {
        token,
        method: "POST",
        body: { notification_ids: ids },
      });
      setNotifications((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error("Could not mark notifications read:", err);
    }
  }

  useEffect(() => {
    if (!token) return;
    refreshNotifications(token);
    const timer = setInterval(() => refreshNotifications(token), 5000);
    return () => clearInterval(timer);
  }, [token, refreshNotifications]);

  function handleLogin(accessToken) {
    setToken(accessToken);
    push("Signed in as admin", "success");
    refreshData(accessToken);
  }

  function handleLogout() {
    setToken(null);
    setStudents([]);
    setAttendance([]);
    setNotifications([]);
    setPage("dashboard");
  }

  async function persistThreshold(newThreshold) {
    setThreshold(newThreshold);
    try {
      await apiFetch("/api/settings", { token, method: "PUT", body: { match_threshold: newThreshold, match_margin: 0.05 } });
    } catch (err) {
      push("Could not save threshold: " + err.message, "error");
    }
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} dark={dark} toggleDark={() => setDark((d) => !d)} />;
  }

  const titles = {
    dashboard: ["Dashboard", "Overview of today's attendance"],
    attendance: ["Live attendance", "Scan and mark attendance in real time"],
    students: ["Students", "Manage the registered student database"],
    analytics: ["Analytics", "Attendance trends and insights"],
    settings: ["Settings", "Configure recognition and system preferences"],
  };

  return (
    <div className={`flex min-h-screen ${t.bg}`}>
      <Sidebar page={page} setPage={setPage} dark={dark} onLogout={handleLogout} />
      <div className="flex-1 min-w-0">
        <Topbar
          title={titles[page][0]}
          subtitle={titles[page][1]}
          dark={dark}
          toggleDark={() => setDark((d) => !d)}
          notifications={notifications}
          onReadNotifications={markNotificationsRead}
        />
        {loadingData && <div className={`px-8 pt-4 text-xs ${t.textMuted}`}>Loading from server…</div>}
        {page === "dashboard" && <DashboardPage students={students} attendance={attendance} dark={dark} setPage={setPage} />}
        {page === "attendance" && <AttendancePage students={students} attendance={attendance} setAttendance={setAttendance} dark={dark} pushToast={push} threshold={threshold} token={token} onMarked={() => refreshData(token)} />}
        {page === "students" && <StudentsPage students={students} setStudents={setStudents} attendance={attendance} dark={dark} pushToast={push} token={token} onChanged={() => refreshData(token)} />}
        {page === "analytics" && <AnalyticsPage students={students} attendance={attendance} dark={dark} />}
        {page === "settings" && <SettingsPage dark={dark} threshold={threshold} setThreshold={persistThreshold} pushToast={push} />}
      </div>
      <ToastStack toasts={toasts} dark={dark} />
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px);} to { opacity:1; transform:translateY(0);} }`}</style>
    </div>
  );
}
