import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import {
  CheckCircle2,
  Plus,
  Trash2,
  TrendingUp,
  Calendar,
  Activity,
  Award,
  AlertCircle,
  Pencil,
  X,
  Save,
  Target,
  Moon,
  Sun,
  LayoutGrid,
  Smartphone,
  Copy,
  Download,
  Sparkles,
  Zap,
} from "lucide-react";

// --- 1. YOUR FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyA1a47ar30oHSKSyR_UZFcgwGchfm6Ey84",
  authDomain: "study-planner-360.firebaseapp.com",
  projectId: "study-planner-360",
  storageBucket: "study-planner-360.firebasestorage.app",
  messagingSenderId: "1025330490412",
  appId: "1:1025330490412:web:2b12cfc2cf2b6bc62d3589",
  measurementId: "G-E7ZP69PM4P",
};

// --- 2. INITIALIZE FIREBASE ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "my-bank-prep-app";

// --- 3. HELPER FUNCTIONS ---
const formatDateKey = (date: Date) => {
  return date.toISOString().split("T")[0];
};

const getLast7Days = () => {
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d);
  }
  return dates;
};

// --- 4. MAIN COMPONENT ---
export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Sync State
  const [syncId, setSyncId] = useState<string>("");
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [inputSyncId, setInputSyncId] = useState("");

  // Habits State
  const [habits, setHabits] = useState<any[]>([]);
  const [newHabitTitle, setNewHabitTitle] = useState("");

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // Mock Test State
  const [mockScores, setMockScores] = useState<any[]>([]);
  const [newMockTitle, setNewMockTitle] = useState("");
  const [newMockScore, setNewMockScore] = useState("");
  const [newMockTotal, setNewMockTotal] = useState("100");

  // Removed unused 'newMockDate' state to fix deployment error.
  // We will generate the date inside the submit handler instead.

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth & Sync ID Setup
  useEffect(() => {
    document.title = "Study Planner 360";

    const storedSyncId = localStorage.getItem("bank_prep_sync_id");
    if (storedSyncId) {
      setSyncId(storedSyncId);
    } else {
      const newId = crypto.randomUUID();
      localStorage.setItem("bank_prep_sync_id", newId);
      setSyncId(newId);
    }

    // Check system preference for dark mode
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      setIsDarkMode(true);
    }

    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
        setError("Authentication failed.");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Data Fetching
  useEffect(() => {
    if (!user || !syncId) return;

    const habitsRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "habits"
    );
    const mocksRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "mock_scores"
    );

    const unsubHabits = onSnapshot(
      habitsRef,
      (snapshot) => {
        const allHabits = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const myHabits = allHabits.filter((h: any) => h.ownerId === syncId);
        setHabits(
          myHabits.sort(
            (a: any, b: any) =>
              (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
          )
        );
        setLoading(false);
      },
      (err) => setError(err.message || "Failed to load habits")
    );

    const unsubMocks = onSnapshot(
      mocksRef,
      (snapshot) => {
        const allMocks = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const myMocks = allMocks.filter((m: any) => m.ownerId === syncId);
        setMockScores(
          myMocks.sort(
            (a: any, b: any) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
          )
        );
      },
      (err) => console.error("Failed to load mocks", err)
    );

    return () => {
      unsubHabits();
      unsubMocks();
    };
  }, [user, syncId]);

  // Actions
  const handleSyncLoad = () => {
    if (inputSyncId.trim().length > 0) {
      localStorage.setItem("bank_prep_sync_id", inputSyncId.trim());
      setSyncId(inputSyncId.trim());
      setShowSyncModal(false);
    }
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitTitle.trim() || !user) return;
    try {
      const habitsRef = collection(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "habits"
      );
      await addDoc(habitsRef, {
        title: newHabitTitle,
        completedDates: [],
        ownerId: syncId,
        createdAt: serverTimestamp(),
      });
      setNewHabitTitle("");
    } catch (err) {
      setError("Could not add task.");
    }
  };

  const toggleHabit = async (
    habitId: string,
    dateKey: string,
    isCompleted: boolean
  ) => {
    if (!user) return;
    try {
      const habitRef = doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "habits",
        habitId
      );
      if (isCompleted) {
        await updateDoc(habitRef, { completedDates: arrayRemove(dateKey) });
      } else {
        await updateDoc(habitRef, { completedDates: arrayUnion(dateKey) });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteHabit = async (habitId: string) => {
    if (!user) return;
    if (window.confirm("Delete this task?")) {
      try {
        await deleteDoc(
          doc(db, "artifacts", appId, "public", "data", "habits", habitId)
        );
      } catch (err) {
        console.error(err);
      }
    }
  };

  const startEditing = (habit: any) => {
    setEditingId(habit.id);
    setEditTitle(habit.title);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const saveEdit = async () => {
    if (!user || !editingId || !editTitle.trim()) return;
    try {
      const habitRef = doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "habits",
        editingId
      );
      await updateDoc(habitRef, { title: editTitle });
      setEditingId(null);
      setEditTitle("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMockScore) return;
    try {
      const mocksRef = collection(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "mock_scores"
      );
      await addDoc(mocksRef, {
        title: newMockTitle || "Mock",
        score: Number(newMockScore),
        total: Number(newMockTotal),
        date: formatDateKey(new Date()), // Use current date directly here
        ownerId: syncId,
        createdAt: serverTimestamp(),
      });
      setNewMockScore("");
      setNewMockTitle("");
    } catch (err) {
      console.error(err);
    }
  };

  const deleteMock = async (id: string) => {
    if (!user || !window.confirm("Delete this score?")) return;
    try {
      await deleteDoc(
        doc(db, "artifacts", appId, "public", "data", "mock_scores", id)
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Derived State
  const dateColumns = useMemo(() => getLast7Days(), []);
  const todayKey = formatDateKey(new Date());

  const stats = useMemo(() => {
    if (habits.length === 0)
      return { today: 0, week: 0, total: 0, todayCount: 0, totalCount: 0 };
    let totalChecks = 0;
    let todayChecks = 0;
    let possibleChecksThisWeek = habits.length * 7;
    let actualChecksThisWeek = 0;

    habits.forEach((habit) => {
      const completed = habit.completedDates || [];
      totalChecks += completed.length;
      if (completed.includes(todayKey)) todayChecks++;
      dateColumns.forEach((date) => {
        if (completed.includes(formatDateKey(date))) actualChecksThisWeek++;
      });
    });

    return {
      today: Math.round((todayChecks / habits.length) * 100) || 0,
      week:
        Math.round((actualChecksThisWeek / possibleChecksThisWeek) * 100) || 0,
      total: totalChecks,
      todayCount: todayChecks,
      totalCount: habits.length,
    };
  }, [habits, dateColumns, todayKey]);

  if (loading)
    return (
      <div className='min-h-screen flex items-center justify-center bg-stone-50 dark:bg-[#0B1120] text-indigo-500'>
        <div className='flex flex-col items-center animate-pulse'>
          <Activity className='w-12 h-12 mb-4' />
          <span className='font-bold tracking-widest text-sm uppercase'>
            Loading Prep...
          </span>
        </div>
      </div>
    );

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .font-display { font-family: 'Outfit', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
        .bg-grid-pattern {
          background-image: radial-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px);
          background-size: 24px 24px;
        }
        .dark .bg-grid-pattern {
          background-image: radial-gradient(rgba(99, 102, 241, 0.05) 1px, transparent 1px);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #334155; }
        .glass-panel {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.5);
        }
        .dark .glass-panel {
          background: rgba(30, 41, 59, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
      `}</style>

      <div className='min-h-screen bg-stone-50 dark:bg-[#0F172A] font-body text-slate-800 dark:text-slate-200 transition-colors duration-500 relative selection:bg-indigo-500/30'>
        {/* Background Pattern */}
        <div className='absolute inset-0 bg-grid-pattern pointer-events-none fixed'></div>

        {/* Floating Decorative Elements */}
        <div className='fixed top-20 left-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none'></div>
        <div className='fixed bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none'></div>

        {/* Navbar */}
        <nav className='sticky top-0 z-50 glass-panel px-6 py-4 flex justify-between items-center shadow-sm/50'>
          <div className='flex items-center gap-3 group cursor-pointer'>
            <div className='bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/20 transform group-hover:-rotate-6 transition-all duration-300'>
              <Sparkles
                size={20}
                fill='currentColor'
                className='text-yellow-300'
              />
            </div>
            <div className='flex flex-col'>
              <h1 className='text-xl md:text-2xl font-display font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent leading-none'>
                Study Planner 360
              </h1>
              <span className='text-[10px] font-bold text-slate-400 tracking-widest uppercase ml-0.5'>
                Focus Mode On
              </span>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <button
              onClick={() => setShowSyncModal(true)}
              className='hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:scale-105'
            >
              <Smartphone size={14} />
              <span>Sync</span>
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className='p-2.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-yellow-400 transition-all border border-slate-200 dark:border-slate-700 shadow-sm hover:rotate-12'
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </nav>

        {/* Sync Modal */}
        {showSyncModal && (
          <div className='fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in'>
            <div className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 w-full max-w-md border border-slate-100 dark:border-slate-700 relative overflow-hidden'>
              <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'></div>
              <div className='flex justify-between items-center mb-6'>
                <h3 className='text-2xl font-display font-bold text-slate-800 dark:text-white'>
                  Sync Devices
                </h3>
                <button
                  onClick={() => setShowSyncModal(false)}
                  className='p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors'
                >
                  <X size={20} />
                </button>
              </div>

              <div className='space-y-6'>
                <div className='bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700'>
                  <label className='text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block'>
                    Your ID
                  </label>
                  <div className='flex gap-2'>
                    <code className='flex-1 bg-white dark:bg-slate-800 p-3 rounded-xl text-sm font-mono text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 break-all select-all'>
                      {syncId}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(syncId)}
                      className='bg-white dark:bg-slate-800 hover:text-indigo-600 p-3 rounded-xl border border-slate-200 dark:border-slate-700 transition-all active:scale-95 shadow-sm'
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </div>

                <div className='pt-2'>
                  <label className='text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block'>
                    Load Data
                  </label>
                  <div className='flex gap-2'>
                    <input
                      type='text'
                      value={inputSyncId}
                      onChange={(e) => setInputSyncId(e.target.value)}
                      placeholder='Paste ID...'
                      className='flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all'
                    />
                    <button
                      onClick={handleSyncLoad}
                      className='bg-indigo-600 hover:bg-indigo-700 text-white px-5 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-500/30'
                    >
                      <Download size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className='max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 relative z-10 animate-slide-up'>
          {/* Error Toast */}
          {error && (
            <div className='fixed bottom-6 right-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-center gap-3 border border-red-100 dark:border-red-800/30 shadow-xl animate-fade-in z-50'>
              <AlertCircle size={20} />
              <p className='text-sm font-medium'>{error}</p>
              <button
                onClick={() => setError(null)}
                className='ml-auto hover:bg-red-100 dark:hover:bg-red-900/40 p-1 rounded-full'
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* SECTION 1: The Grid (Study Plan) */}
          <div className='glass-panel rounded-3xl overflow-hidden shadow-xl shadow-indigo-100/20 dark:shadow-none transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-100/40 dark:hover:shadow-none border-t border-white/60 dark:border-slate-600/50'>
            {/* Header */}
            <div className='p-6 md:p-8 border-b border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6'>
              <div>
                <h2 className='text-2xl font-display font-bold text-slate-800 dark:text-white flex items-center gap-2'>
                  <span className='bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-2 rounded-xl'>
                    <Calendar size={20} />
                  </span>
                  Daily Targets
                </h2>
                <p className='text-slate-500 dark:text-slate-400 text-sm mt-1 ml-11'>
                  Build the streak. Trust the process.
                </p>
              </div>

              <form
                onSubmit={handleAddHabit}
                className='flex w-full md:w-auto gap-2 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all'
              >
                <input
                  type='text'
                  value={newHabitTitle}
                  onChange={(e) => setNewHabitTitle(e.target.value)}
                  placeholder='Add new subject...'
                  className='flex-1 md:w-64 px-4 py-2 bg-transparent text-sm font-medium focus:outline-none placeholder:text-slate-400 dark:text-slate-200'
                />
                <button
                  type='submit'
                  className='bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl transition-all active:scale-90 shadow-md'
                >
                  <Plus size={18} strokeWidth={3} />
                </button>
              </form>
            </div>

            {/* Table */}
            <div className='overflow-x-auto'>
              <table className='w-full min-w-[800px]'>
                <thead>
                  <tr className='bg-slate-50/50 dark:bg-slate-800/30'>
                    <th className='text-left py-5 px-6 font-display font-bold text-slate-500 dark:text-slate-400 text-sm w-1/6 sticky left-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-100 dark:border-slate-800 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]'>
                      Subject
                    </th>
                    {dateColumns.map((date) => {
                      const isToday = formatDateKey(date) === todayKey;
                      return (
                        <th
                          key={date.toString()}
                          className='py-4 px-2 text-center w-[9%]'
                        >
                          <div
                            className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 ${
                              isToday
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-110 -translate-y-1"
                                : "text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            <span className='text-[10px] uppercase font-bold tracking-widest opacity-80'>
                              {date.toLocaleDateString("en-US", {
                                weekday: "short",
                              })}
                            </span>
                            <span className='text-lg font-display font-bold'>
                              {date.getDate()}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                    <th className='w-[8%] text-center text-slate-400 text-xs font-bold uppercase tracking-widest'>
                      Edit
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-100 dark:divide-slate-800/50'>
                  {habits.length === 0 ? (
                    <tr>
                      <td colSpan={9} className='py-20 text-center'>
                        <div className='flex flex-col items-center gap-4 opacity-50'>
                          <div className='bg-slate-100 dark:bg-slate-800 p-6 rounded-full animate-float'>
                            <Target size={40} className='text-slate-400' />
                          </div>
                          <p className='font-display font-medium text-slate-500'>
                            Your grid is empty. Start your journey!
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    habits.map((habit) => (
                      <tr
                        key={habit.id}
                        className='group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors'
                      >
                        <td className='py-4 px-6 sticky left-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-100 dark:border-slate-800 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)] transition-colors group-hover:bg-slate-50/95 dark:group-hover:bg-slate-800/95'>
                          {editingId === habit.id ? (
                            <div className='flex gap-2 items-center animate-fade-in'>
                              <input
                                type='text'
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className='flex-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-indigo-400 rounded-lg focus:outline-none shadow-sm'
                                autoFocus
                              />
                              <button
                                onClick={saveEdit}
                                className='text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 p-1.5 rounded-lg transition-colors'
                              >
                                <Save size={16} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className='text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 p-1.5 rounded-lg transition-colors'
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <span className='text-slate-700 dark:text-slate-200 font-display font-semibold text-base block truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors'>
                              {habit.title}
                            </span>
                          )}
                        </td>
                        {dateColumns.map((date) => {
                          const dKey = formatDateKey(date);
                          const isCompleted =
                            habit.completedDates?.includes(dKey);
                          return (
                            <td key={dKey} className='text-center py-3'>
                              <button
                                onClick={() =>
                                  toggleHabit(habit.id, dKey, isCompleted)
                                }
                                className={`
                                  w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 mx-auto
                                  ${
                                    isCompleted
                                      ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 scale-100 rotate-0"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-200 dark:text-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:scale-110"
                                  }
                                `}
                              >
                                {isCompleted ? (
                                  <CheckCircle2
                                    size={20}
                                    strokeWidth={3}
                                    className='animate-fade-in'
                                  />
                                ) : (
                                  <div className='w-2 h-2 rounded-full bg-current'></div>
                                )}
                              </button>
                            </td>
                          );
                        })}
                        <td className='text-center'>
                          <div className='flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0'>
                            <button
                              onClick={() => startEditing(habit)}
                              className='text-slate-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors'
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => deleteHabit(habit.id)}
                              className='text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 2: Bento Grid Stats */}
          <div className='grid grid-cols-1 md:grid-cols-12 gap-6'>
            {/* Box 1: Efficiency (4 Cols) */}
            <div className='md:col-span-4 glass-panel rounded-3xl p-6 relative overflow-hidden group hover:border-indigo-200 dark:hover:border-indigo-800 transition-all'>
              <div className='absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-all transform group-hover:scale-110 duration-500'>
                <Activity size={120} className='text-indigo-600' />
              </div>
              <div className='relative z-10 flex flex-col h-full justify-between'>
                <div>
                  <h3 className='text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-2 flex items-center gap-2'>
                    <Zap
                      size={12}
                      className='text-yellow-500 fill-yellow-500'
                    />{" "}
                    Daily Power
                  </h3>
                  <div className='flex items-baseline gap-2'>
                    <span className='text-5xl font-display font-bold text-slate-800 dark:text-white'>
                      {stats.today}%
                    </span>
                    <span className='text-sm font-medium text-slate-400'>
                      done
                    </span>
                  </div>
                </div>

                <div className='mt-6'>
                  <div className='flex justify-between text-xs font-bold text-slate-500 mb-2'>
                    <span>Progress</span>
                    <span>
                      {stats.todayCount}/{stats.totalCount}
                    </span>
                  </div>
                  <div className='w-full bg-slate-100 dark:bg-slate-700/50 h-4 rounded-full overflow-hidden p-1 border border-slate-100 dark:border-slate-700'>
                    <div
                      className='h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000 ease-out shadow-sm relative overflow-hidden'
                      style={{ width: `${stats.today}%` }}
                    >
                      <div className='absolute inset-0 bg-white/20 animate-pulse-slow'></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Box 2: Consistency (4 Cols) */}
            <div className='md:col-span-4 glass-panel rounded-3xl p-6 relative overflow-hidden group hover:border-purple-200 dark:hover:border-purple-800 transition-all'>
              <div className='absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-all transform group-hover:scale-110 duration-500'>
                <TrendingUp size={120} className='text-purple-600' />
              </div>
              <div className='relative z-10 flex flex-col h-full justify-between'>
                <div>
                  <h3 className='text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-2 flex items-center gap-2'>
                    <CheckCircle2 size={12} className='text-green-500' /> 7-Day
                    Streak
                  </h3>
                  <div className='flex items-baseline gap-2'>
                    <span className='text-5xl font-display font-bold text-slate-800 dark:text-white'>
                      {stats.week}%
                    </span>
                    <span className='text-sm font-medium text-slate-400'>
                      consistency
                    </span>
                  </div>
                </div>

                <div className='mt-6'>
                  <div className='flex justify-between text-xs font-bold text-slate-500 mb-2'>
                    <span>Weekly Avg</span>
                    <span>Last 7 Days</span>
                  </div>
                  <div className='w-full bg-slate-100 dark:bg-slate-700/50 h-4 rounded-full overflow-hidden p-1 border border-slate-100 dark:border-slate-700'>
                    <div
                      className='h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-1000 ease-out shadow-sm'
                      style={{ width: `${stats.week}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Box 3: Total Stats (4 Cols) */}
            <div className='md:col-span-4 glass-panel rounded-3xl p-6 relative overflow-hidden group hover:border-emerald-200 dark:hover:border-emerald-800 transition-all flex flex-col justify-between'>
              <div className='absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-all'>
                <Award size={120} className='text-emerald-600' />
              </div>
              <div>
                <h3 className='text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-2'>
                  Total Impact
                </h3>
                <span className='text-5xl font-display font-bold text-slate-800 dark:text-white'>
                  {stats.total}
                </span>
                <p className='text-sm text-slate-400 font-medium'>
                  Tasks Completed
                </p>
              </div>
              <div className='mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold w-fit'>
                <Award size={14} /> Keep grinding!
              </div>
            </div>

            {/* Bottom: Mock Tests (Full Width) */}
            <div className='md:col-span-12 glass-panel rounded-3xl p-6 md:p-8 border-t border-white/60 dark:border-slate-600/50'>
              <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4'>
                <div>
                  <h3 className='text-lg font-display font-bold text-slate-800 dark:text-white flex items-center gap-2'>
                    <span className='bg-rose-100 dark:bg-rose-900/30 text-rose-500 p-1.5 rounded-lg'>
                      <LayoutGrid size={16} />
                    </span>
                    Mock Test Log
                  </h3>
                  <p className='text-slate-400 text-xs mt-1'>
                    Track your performance over time.
                  </p>
                </div>

                <form
                  onSubmit={handleAddMock}
                  className='flex gap-2 w-full md:w-auto'
                >
                  <div className='flex flex-1 md:flex-initial gap-2 bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700'>
                    <input
                      type='text'
                      placeholder='Subject'
                      value={newMockTitle}
                      onChange={(e) => setNewMockTitle(e.target.value)}
                      className='w-24 md:w-32 px-3 text-xs bg-transparent outline-none font-medium'
                    />
                    <div className='w-px bg-slate-200 dark:bg-slate-700'></div>
                    <input
                      type='number'
                      placeholder='Scr'
                      value={newMockScore}
                      onChange={(e) => setNewMockScore(e.target.value)}
                      className='w-12 px-2 text-xs bg-transparent outline-none text-center font-bold'
                    />
                    <span className='text-slate-300 text-xs py-1.5'>/</span>
                    <input
                      type='number'
                      placeholder='Tot'
                      value={newMockTotal}
                      onChange={(e) => setNewMockTotal(e.target.value)}
                      className='w-12 px-2 text-xs bg-transparent outline-none text-center text-slate-400'
                    />
                  </div>
                  <button
                    type='submit'
                    className='bg-rose-500 hover:bg-rose-600 text-white p-2 rounded-xl transition-all shadow-lg shadow-rose-500/30 active:scale-95'
                  >
                    <Plus size={20} />
                  </button>
                </form>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
                {mockScores.map((mock) => (
                  <div
                    key={mock.id}
                    className='group bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-900/50 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-rose-100/20 relative overflow-hidden'
                  >
                    <div className='flex justify-between items-start mb-2'>
                      <span className='bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-300 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide'>
                        {mock.date}
                      </span>
                      <button
                        onClick={() => deleteMock(mock.id)}
                        className='text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all'
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className='font-display font-bold text-slate-700 dark:text-slate-200 text-sm mb-1'>
                      {mock.title || "General Mock"}
                    </div>
                    <div className='flex items-end gap-1.5'>
                      <span className='text-3xl font-display font-black text-rose-500'>
                        {mock.score}
                      </span>
                      <span className='text-xs font-bold text-slate-300 mb-1.5'>
                        /{mock.total}
                      </span>
                    </div>
                    <div className='absolute bottom-0 left-0 w-full h-1 bg-slate-100 dark:bg-slate-700'>
                      <div
                        className='h-full bg-rose-500'
                        style={{ width: `${(mock.score / mock.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
                {mockScores.length === 0 && (
                  <div className='col-span-full py-8 text-center text-slate-400 text-sm italic dashed border border-slate-200 dark:border-slate-700 rounded-2xl'>
                    No mock scores yet. Add one to start tracking!
                  </div>
                )}
              </div>
            </div>
          </div>

          <footer className='text-center py-8'>
            <p className='text-slate-400 dark:text-slate-600 font-display font-bold text-sm opacity-60'>
              "Success is the sum of small efforts, repeated day in and day
              out."
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
