 "use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowRight, Bell, CalendarDays, Check, CheckCircle2,
  CircleHelp, Clock3, Flame, Goal, LayoutDashboard, ListChecks,
  Menu, Moon, MoreHorizontal, Plus, Search, Settings2, Sparkles, Sun, Target,
  TrendingUp, Trophy, X, Zap, BookOpen, Heart
} from "lucide-react";
import {
  createGoal, createHabit, createTask, deleteGoal, deleteHabit, deleteTask,
  getCurrentDisplayName, getWeeklyReview, listGoals, listHabitLogs, listHabits, listTasks,
  localDateString, logHabit, saveWeeklyReview, setTaskStatus, updateGoal, updateTask, updateHabit,
  updateCurrentDisplayName, type GoalRow, type HabitLogRow, type HabitRow, type TaskRow, type WeeklyReviewRow,
} from "@/lib/database";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Task = { id: string; title: string; description: string; time: string; category: string; done: boolean; scheduledDate: string; goalId: string | null; estimatedMinutes: number };
type Habit = { id: string; title: string; detail: string; icon: string; done: boolean; streak: number; scheduleDays: number[] };
type GoalItem = { id: string; title: string; description: string; category: string; due: string; targetDate: string | null; progress: number; color: string; status: string };

const addDays = (date: string, amount: number) => {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(year, month - 1, day);
  result.setDate(result.getDate() + amount);
  return localDateString(result);
};

const errorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    const code = "code" in error && typeof error.code === "string" ? ` (${error.code})` : "";
    return `${error.message}${code}`;
  }
  return error instanceof Error ? error.message : fallback;
};

const mapGoal = (row: GoalRow): GoalItem => ({
  id: row.id, title: row.title, description: row.description, category: row.category, due: row.target_date || "No deadline",
  targetDate: row.target_date, progress: row.progress ?? 0, status: row.status,
  color: row.category.toLowerCase().includes("health") ? "green" : row.category.toLowerCase().includes("exam") ? "violet" : "blue",
});
const mapTask = (row: TaskRow): Task => ({
  id: row.id, title: row.title, description: row.description,
  time: `${row.estimated_minutes} min · ${row.scheduled_date}`,
  category: "Personal", done: row.status === "completed", scheduledDate: row.scheduled_date,
  goalId: row.goal_id, estimatedMinutes: row.estimated_minutes,
});
const mapHabit = (row: HabitRow, logs: HabitLogRow[]): Habit => ({
  id: row.id, title: row.title, detail: row.description || "Daily habit · just begin",
  icon: row.habit_type === "duration" ? "focus" : row.habit_type === "count" ? "heart" : "book",
  done: logs.some(log => log.habit_id === row.id && log.log_date === localDateString() && log.status === "completed"),
  streak: 0, scheduleDays: row.schedule_days,
});

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "My Goals", icon: Target },
  { label: "Habits", icon: Activity },
  { label: "My Plan", icon: ListChecks },
  { label: "Calendar", icon: CalendarDays },
  { label: "Focus Mode", icon: Clock3 },
  { label: "Analytics", icon: TrendingUp },
  { label: "Weekly Review", icon: Trophy },
];
const iconFor = (key: string) => key === "book" ? <BookOpen size={17}/> : key === "heart" ? <Heart size={17}/> : <Zap size={17}/>;

export default function Home() {
  const router = useRouter();
  const today = useMemo(() => localDateString(), []);
  const reviewStart = useMemo(() => addDays(localDateString(), -6), []);
  const planEnd = useMemo(() => addDays(localDateString(), 6), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [displayName, setDisplayName] = useState("Achiever");
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReviewRow | null>(null);
  const [reviewReflection, setReviewReflection] = useState("");
  const [habitLogs, setHabitLogs] = useState<HabitLogRow[]>([]);
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [dark, setDark] = useState(true);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalCategory, setGoalCategory] = useState("Skill development");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskEditId, setTaskEditId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskMinutes, setTaskMinutes] = useState(30);
  const [taskDate, setTaskDate] = useState(() => localDateString());
  const [taskGoalId, setTaskGoalId] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [notice, setNotice] = useState("Your progress is yours. Start small, keep going.");
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const results = await Promise.allSettled([
          listGoals(), listTasks(reviewStart, planEnd), listHabits(), listHabitLogs(reviewStart, today),
          getWeeklyReview(reviewStart, today), getCurrentDisplayName(),
        ]);
        if (!active) return;
        const [goalResult, taskResult, habitResult, logResult, reviewResult, nameResult] = results;
        const errors: string[] = [];
        if (goalResult.status === "fulfilled") setGoals(goalResult.value.map(mapGoal));
        else errors.push(`Goals: ${errorMessage(goalResult.reason, "could not load")}`);
        if (taskResult.status === "fulfilled") setTasks(taskResult.value.map(mapTask));
        else errors.push(`Tasks: ${errorMessage(taskResult.reason, "could not load")}`);
        if (logResult.status === "fulfilled") setHabitLogs(logResult.value);
        else errors.push(`Habit check-ins: ${errorMessage(logResult.reason, "could not load")}`);
        if (habitResult.status === "fulfilled") {
          const logs = logResult.status === "fulfilled" ? logResult.value : [];
          setHabits(habitResult.value.map(row => mapHabit(row, logs)));
        } else errors.push(`Habits: ${errorMessage(habitResult.reason, "could not load")}`);
        if (reviewResult.status === "fulfilled") {
          setWeeklyReview(reviewResult.value);
          setReviewReflection(reviewResult.value?.reflection ?? "");
        } else errors.push(`Weekly review: ${errorMessage(reviewResult.reason, "could not load")}`);
        if (nameResult.status === "fulfilled") setDisplayName(nameResult.value);
        else errors.push(`Profile: ${errorMessage(nameResult.reason, "could not load")}`);
        if (errors.length) setNotice(errors.join(" | "));
      } catch (error) {
      if (active) setNotice(errorMessage(error, "Could not load your Supabase data."));
      } finally {
        if (active) setLoadingData(false);
      }
    }
    void loadData();
    return () => { active = false; };
  }, [planEnd, reviewStart, today]);
  useEffect(() => {
    if (!focusRunning) return;
    const id = window.setInterval(() => setFocusSeconds(s => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [focusRunning]);
  useEffect(() => {
    if (focusSeconds === 0) { setFocusRunning(false); setNotice("Focus session complete. Take a short break."); }
  }, [focusSeconds]);

  const todayTasks = tasks.filter(task => task.scheduledDate === today);
  const planTasks = tasks.filter(task => task.scheduledDate >= today && task.scheduledDate <= planEnd);
  const weekTasks = tasks.filter(task => task.scheduledDate >= reviewStart && task.scheduledDate <= today);
  const completedTasks = todayTasks.filter(t => t.done).length;
  const completion = todayTasks.length ? Math.round(completedTasks / todayTasks.length * 100) : 0;
  const completedHabits = habits.filter(h => h.done).length;
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return [
      ...goals.map(item => ({ id: `goal-${item.id}`, title: item.title, detail: `Goal · ${item.category}`, section: "My Goals" })),
      ...tasks.map(item => ({ id: `task-${item.id}`, title: item.title, detail: `Task · ${item.scheduledDate}`, section: "My Plan" })),
      ...habits.map(item => ({ id: `habit-${item.id}`, title: item.title, detail: "Habit", section: "Habits" })),
    ].filter(item => `${item.title} ${item.detail}`.toLowerCase().includes(query)).slice(0, 8);
  }, [goals, habits, tasks, searchQuery]);
  const activityTrend = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(reviewStart, index);
    return { day: new Date(`${date}T00:00:00`).toLocaleDateString("en", { weekday: "short" }), completed: weekTasks.filter(task => task.scheduledDate === date && task.done).length };
  });
  const weeklyHabitOpportunities = habits.reduce((count, habit) => count + Array.from({ length: 7 }, (_, index) => {
    const date = addDays(reviewStart, index);
    const day = new Date(`${date}T00:00:00`).getDay() || 7;
    return habit.scheduleDays.includes(day) ? 1 : 0;
  }).reduce<number>((sum, scheduled) => sum + scheduled, 0), 0);
  const completedWeeklyHabitLogs = habitLogs.filter(log => {
    if (log.status !== "completed" || log.log_date < reviewStart || log.log_date > today) return false;
    const habit = habits.find(item => item.id === log.habit_id);
    const day = new Date(`${log.log_date}T00:00:00`).getDay() || 7;
    return !!habit && habit.scheduleDays.includes(day);
  }).length;
  const weeklyMetrics = {
    tasks_completed: weekTasks.filter(task => task.done).length,
    tasks_total: weekTasks.length,
    habits_scheduled: weeklyHabitOpportunities,
    habits_completed: completedWeeklyHabitLogs,
  };
  const weeklyHabitRate = weeklyMetrics.habits_scheduled
    ? Math.round(weeklyMetrics.habits_completed / weeklyMetrics.habits_scheduled * 100)
    : 0;
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }, []);
  const addGoal = async () => {
    if (!goalTitle.trim()) return;
    setSaving(true);
    try {
      const row = await createGoal({ title: goalTitle.trim(), description: goalDescription.trim(), category: goalCategory, target_date: goalTargetDate || null });
      setGoals(g => [...g, mapGoal(row)]);
      setGoalTitle(""); setGoalDescription(""); setGoalTargetDate(""); setShowGoalModal(false); setActiveNav("My Goals"); setNotice("Goal saved to your account.");
    } catch (error) {
      setNotice(`Could not save the goal: ${errorMessage(error, "unknown Supabase error")}`);
    } finally { setSaving(false); }
  };
  const addTask = async () => {
    if (!taskTitle.trim()) return;
    setSaving(true);
    try {
      if (taskEditId) {
        const row = await updateTask(taskEditId, { title: taskTitle.trim(), description: taskDescription.trim(), scheduled_date: taskDate, estimated_minutes: taskMinutes, goal_id: taskGoalId || null });
        setTasks(items => items.map(item => item.id === taskEditId ? mapTask(row) : item));
        setNotice("Task details updated.");
      } else {
        const row = await createTask({ title: taskTitle.trim(), description: taskDescription.trim(), scheduled_date: taskDate, estimated_minutes: taskMinutes, goal_id: taskGoalId || null });
        setTasks(items => [...items, mapTask(row)]);
        setNotice("Task saved to your account.");
      }
      setTaskTitle(""); setTaskDescription(""); setTaskMinutes(30); setTaskDate(today); setTaskGoalId(""); setTaskEditId(""); setShowTaskModal(false);
    } catch (error) {
      setNotice(`Could not save the task: ${errorMessage(error, "unknown Supabase error")}`);
    } finally { setSaving(false); }
  };
  const openTaskModal = (task?: Task) => {
    setTaskEditId(task?.id ?? "");
    setTaskTitle(task?.title ?? "");
    setTaskDescription(task?.description ?? "");
    setTaskMinutes(task?.estimatedMinutes ?? 30);
    setTaskDate(task?.scheduledDate ?? today);
    setTaskGoalId(task?.goalId ?? "");
    setShowTaskModal(true);
  };
  const navClick = (label: string) => { setActiveNav(label); setMobileNav(false); };
  const signOut = async () => {
    try {
      const { error } = await createSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setNotice(`Could not sign out: ${errorMessage(error, "unknown authentication error")}`);
    }
  };
  const toggleTask = async (id: string) => {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    try {
      const row = await setTaskStatus(id, task.done ? "pending" : "completed");
      setTasks(items => items.map(item => item.id === id ? mapTask(row) : item));
    } catch (error) { setNotice(`Could not update the task: ${errorMessage(error, "unknown Supabase error")}`); }
  };
  const removeTask = async (id: string) => {
    try { await deleteTask(id); setTasks(items => items.filter(item => item.id !== id)); setNotice("Task deleted."); }
    catch (error) { setNotice(`Could not delete the task: ${errorMessage(error, "unknown Supabase error")}`); }
  };
  const toggleHabit = async (id: string) => {
    const habit = habits.find(item => item.id === id);
    if (!habit) return;
    try {
      const row = await logHabit(id, today, habit.done ? "missed" : "completed");
      setHabitLogs(logs => [...logs.filter(log => log.habit_id !== id || log.log_date !== today), row]);
      setHabits(items => items.map(item => item.id === id ? { ...item, done: !item.done } : item));
    } catch (error) { setNotice(`Could not update the habit: ${errorMessage(error, "unknown Supabase error")}`); }
  };
  const addHabit = async (title: string) => {
    const row = await createHabit({ title, description: "Daily habit · just begin", habit_type: "boolean", schedule_days: [1, 2, 3, 4, 5, 6, 7] });
    setHabits(items => [...items, mapHabit(row, [])]);
  };
  const removeHabit = async (id: string) => {
    try { await deleteHabit(id); setHabits(items => items.filter(item => item.id !== id)); setNotice("Habit archived."); }
    catch (error) { setNotice(`Could not archive the habit: ${errorMessage(error, "unknown Supabase error")}`); }
  };
  const saveGoalProgress = async (id: string, progress: number) => {
    try {
      const row = await updateGoal(id, { progress });
      setGoals(items => items.map(item => item.id === id ? mapGoal(row) : item));
      setNotice("Goal progress saved.");
    } catch (error) { setNotice(`Could not save goal progress: ${errorMessage(error, "unknown Supabase error")}`); }
  };
  const removeGoal = async (id: string) => {
    try { await deleteGoal(id); setGoals(items => items.filter(item => item.id !== id)); setNotice("Goal deleted."); }
    catch (error) { setNotice(`Could not delete the goal: ${errorMessage(error, "unknown Supabase error")}`); }
  };
  const saveGoalDetails = async (id: string, patch: Pick<GoalRow, "title" | "description" | "category" | "target_date">) => {
    try {
      const row = await updateGoal(id, patch);
      setGoals(items => items.map(item => item.id === id ? mapGoal(row) : item));
      setNotice("Goal details updated.");
    } catch (error) { setNotice(`Could not update the goal: ${errorMessage(error, "unknown Supabase error")}`); }
  };
  const saveTaskDetails = async (id: string, patch: Pick<TaskRow, "title" | "description" | "scheduled_date" | "estimated_minutes" | "goal_id">) => {
    try {
      const row = await updateTask(id, patch);
      setTasks(items => items.map(item => item.id === id ? mapTask(row) : item));
      setNotice("Task details updated.");
    } catch (error) { setNotice(`Could not update the task: ${errorMessage(error, "unknown Supabase error")}`); }
  };
  const saveHabitDetails = async (id: string, patch: Pick<HabitRow, "title" | "description">) => {
    try {
      const row = await updateHabit(id, patch);
      setHabits(items => items.map(item => item.id === id ? mapHabit(row, habitLogs) : item));
      setNotice("Habit details updated.");
    } catch (error) { setNotice(`Could not update the habit: ${errorMessage(error, "unknown Supabase error")}`); }
  };
  const generateWeeklyPlan = async () => {
    const goalsWithoutSteps = goals.filter(goal => goal.status !== "completed" && goal.status !== "archived" && !planTasks.some(task => task.goalId === goal.id && !task.done));
    if (!goalsWithoutSteps.length) {
      setNotice(goals.length ? "Your active goals already have tasks planned this week." : "Add a goal first, then build your weekly plan.");
      return;
    }
    setSaving(true);
    const created: Task[] = [];
    try {
      for (const [index, goal] of goalsWithoutSteps.entries()) {
        const row = await createTask({
          title: `Next step: ${goal.title}`,
          description: goal.description || `A focused work session for your goal: ${goal.title}`,
          scheduled_date: addDays(today, index % 7), estimated_minutes: 45, goal_id: goal.id,
        });
        created.push(mapTask(row));
      }
      setTasks(items => [...items, ...created]);
      setNotice(`Added ${created.length} goal-based task${created.length === 1 ? "" : "s"} to your plan.`);
    } catch (error) {
      if (created.length) setTasks(items => [...items, ...created]);
      setNotice(created.length
        ? `Plan partially saved: ${errorMessage(error, "unknown Supabase error")}`
        : `Could not finish generating your plan: ${errorMessage(error, "unknown Supabase error")}`);
    } finally { setSaving(false); }
  };
  const saveReview = async () => {
    try {
      const row = await saveWeeklyReview(reviewStart, today, reviewReflection.trim(), weeklyMetrics);
      setWeeklyReview(row);
      setNotice("Your weekly review is saved to your account.");
    } catch (error) { setNotice(`Could not save your weekly review: ${errorMessage(error, "unknown Supabase error")}`); }
  };
  const saveDisplayName = async (name: string) => {
    if (!name.trim()) return;
    try {
      const savedName = await updateCurrentDisplayName(name);
      setDisplayName(savedName);
      setNotice("Your profile name is saved.");
    } catch (error) { setNotice(`Could not update your profile: ${errorMessage(error, "unknown Supabase error")}`); }
  };

  return (
    <main className={dark ? "app dark" : "app light"}>
      <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Sparkles size={19}/></div><span>level<span className="brand-accent">up</span></span><button className="mobile-close icon-btn" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18}/></button></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          {navItems.map(item => { const Icon = item.icon; return <button key={item.label} className={`nav-item ${activeNav === item.label ? "active" : ""}`} onClick={() => navClick(item.label)}><Icon size={18}/><span>{item.label}</span>{item.label === "Weekly Review" && <span className="nav-dot"/>}</button>; })}
        </nav>
        <div className="sidebar-bottom">
          <div className="streak-card"><div className="streak-top"><span className="streak-icon"><Flame size={16}/></span><span>THIS WEEK</span></div><div className="streak-number">{weeklyMetrics.tasks_completed} <small>tasks</small></div><div className="streak-copy">{weeklyMetrics.habits_completed} habit check-ins completed.</div><div className="streak-dots">{activityTrend.map((day,i)=><span key={day.day} className={day.completed ? "filled" : ""}>{day.completed ? <Check size={11}/> : i + 1}</span>)}</div></div>
          <button className={`nav-item ${activeNav === "Settings" ? "active" : ""}`} onClick={() => navClick("Settings")}><Settings2 size={18}/><span>Settings</span></button>
          <div className="account-menu-wrap"><div className="profile-row"><div className="avatar">{displayName.slice(0,1).toUpperCase()}</div><div className="profile-text"><strong>{displayName}</strong><span>Personal account</span></div><button className="dots-btn account-menu-trigger" type="button" aria-label="Open account menu" aria-expanded={accountMenuOpen} onClick={()=>setAccountMenuOpen(open=>!open)}><MoreHorizontal size={18}/></button></div>{accountMenuOpen&&<div className="account-menu" role="menu"><button type="button" role="menuitem" onClick={()=>{setActiveNav("Settings");setAccountMenuOpen(false);}}>Account settings</button><button type="button" role="menuitem" onClick={()=>void signOut()}>Sign out</button></div>}</div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar"><button className="icon-btn mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20}/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{activeNav}</strong></div><div className="top-actions"><div className="today-pill"><CalendarDays size={15}/>{new Date(`${today}T00:00:00`).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div><div className="header-search"><button className="icon-btn" aria-label={searchOpen?"Close search":"Search goals, tasks, and habits"} aria-expanded={searchOpen} onClick={() => {setSearchOpen(open=>!open);setSearchQuery("");}}><Search size={18}/></button>{searchOpen&&<div className="search-popover"><label className="header-search-input"><Search size={16}/><input autoFocus value={searchQuery} onChange={event=>setSearchQuery(event.target.value)} onKeyDown={event=>{if(event.key==="Escape")setSearchOpen(false);}} placeholder="Search goals, tasks, habits…"/><button type="button" aria-label="Close search" onClick={()=>setSearchOpen(false)}><X size={15}/></button></label><div className="search-results">{!searchQuery.trim()?<p>Type to search your saved items.</p>:searchResults.length?searchResults.map(result=><button type="button" key={result.id} onClick={()=>{setActiveNav(result.section);setSearchOpen(false);setSearchQuery("");}}><strong>{result.title}</strong><span>{result.detail}</span></button>):<p>No matching goals, tasks, or habits.</p>}</div></div>}</div><button className="icon-btn notification" aria-label="Notifications" onClick={() => setNotice("You're all caught up. No new notifications.")}><Bell size={18}/><i/></button><button className="icon-btn" aria-label="Toggle theme" onClick={() => setDark(d => !d)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><div className="avatar small">{displayName.slice(0,1).toUpperCase()}</div></div></header>

        <div className="content">
          <div className="notice-strip" role="status"><Sparkles size={16}/><span>{loadingData ? "Loading your Supabase data…" : notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")} disabled={loadingData}><X size={15}/></button></div>
          {activeNav === "Dashboard" ? <>
            <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> YOUR PERSONAL WORKSPACE <span className="eyebrow-line"/></div><h1>{greeting}, <span>{displayName}.</span></h1><p>Small steps today. A different life tomorrow.</p></div><button className="primary-btn" onClick={() => setShowGoalModal(true)}><Plus size={17}/> New goal</button></section>
            <section className="stats-grid">
              <StatCard label="TASKS COMPLETED" value={`${completedTasks}/${todayTasks.length}`} sub={`${completion}% of today's plan`} icon={<CheckCircle2 size={18}/>} accent="purple" progress={completion}/>
              <StatCard label="THIS WEEK" value={`${weeklyMetrics.tasks_completed}/${weeklyMetrics.tasks_total}`} sub="Tasks completed in the last 7 days" icon={<Clock3 size={18}/>} accent="blue" />
              <StatCard label="HABITS TODAY" value={`${completedHabits}/${habits.length}`} sub={`${weeklyHabitRate}% scheduled check-ins this week`} icon={<Activity size={18}/>} accent="green" progress={weeklyHabitRate}/>
              <StatCard label="ACTIVE GOALS" value={String(goals.length)} sub="Keep your why close" icon={<Target size={18}/>} accent="orange"/>
            </section>
            <section className="dashboard-grid">
              <div className="panel tasks-panel"><PanelHeading title="Today's focus" subtitle="Make room for what matters" right={<button className="text-btn" onClick={() => setActiveNav("My Plan")}>View plan <ArrowRight size={14}/></button>}/><div className="task-list">{todayTasks.map(task => <div className={`task-row ${task.done ? "task-done" : ""}`} key={task.id}><button className={`check-control ${task.done ? "checked" : ""}`} aria-label={task.done ? "Mark task incomplete" : "Complete task"} onClick={() => toggleTask(task.id)}>{task.done && <Check size={13}/>}</button><div className="task-main"><strong>{task.title}</strong><span><Clock3 size={12}/>{task.time}</span></div><span className={`category-tag ${task.category.toLowerCase()}`}>{task.category}</span><button className="dots-btn" aria-label={`Edit ${task.title}`} onClick={() => openTaskModal(task)}><MoreHorizontal size={17}/></button></div>)}{todayTasks.length === 0 && <Empty text={loadingData ? "Loading your saved tasks…" : "No tasks planned for today."}/>}</div><button className="add-row" onClick={() => openTaskModal()}><Plus size={15}/> Add a task</button></div>
              <div className="panel habits-panel"><PanelHeading title="Daily rituals" subtitle="Consistency is built in the small things" right={<button className="subtle-icon" onClick={() => setActiveNav("Habits")} aria-label="View habits"><ArrowRight size={16}/></button>}/><div className="habit-list">{habits.map(h => <div className={`habit-row ${h.done ? "habit-done" : ""}`} key={h.id}><div className={`habit-icon ${h.icon}`}>{iconFor(h.icon)}</div><div className="habit-main"><strong>{h.title}</strong><span>{h.detail}</span></div><button className={`habit-check ${h.done ? "checked" : ""}`} onClick={() => toggleHabit(h.id)} aria-label={h.done ? "Mark habit incomplete" : "Complete habit"}>{h.done ? <Check size={14}/> : <Plus size={14}/>}</button></div>)}{habits.length === 0 && <Empty text="Add a habit to build your rhythm."/>}</div><div className="habit-footer"><span><Flame size={14}/> Your rhythm, your pace</span><button className="text-btn" onClick={() => setActiveNav("Habits")}>All habits <ArrowRight size={14}/></button></div></div>
            </section>
            <section className="lower-grid"><div className="panel chart-panel"><PanelHeading title="Tasks completed this week" subtitle="Based on tasks saved to your account" right={<span className="chart-legend"><i/> Completed tasks</span>}/><div className="chart-summary"><strong>{weeklyMetrics.tasks_completed}</strong><span>in the last 7 days</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={activityTrend} margin={{top:10,right:8,left:-20,bottom:0}}><defs><linearGradient id="focusFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b7cff" stopOpacity={0.28}/><stop offset="95%" stopColor="#8b7cff" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:"var(--muted)",fontSize:11}}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill:"var(--muted)",fontSize:11}}/><Tooltip contentStyle={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:12,color:"var(--text)"}}/><Area type="monotone" dataKey="completed" name="Completed tasks" stroke="#8b7cff" strokeWidth={2.5} fill="url(#focusFill)"/></AreaChart></ResponsiveContainer></div></div>
              <div className="panel goals-panel"><PanelHeading title="Goals in motion" subtitle="Keep the bigger picture in sight" right={<button className="text-btn" onClick={() => setActiveNav("My Goals")}>See all <ArrowRight size={14}/></button>}/><div className="goal-list">{goals.slice(0,3).map(g => <div className="goal-row" key={g.id}><div className={`goal-symbol ${g.color}`}><Goal size={17}/></div><div className="goal-info"><div className="goal-title-line"><strong>{g.title}</strong><span>{g.progress}%</span></div><div className="progress-track"><i className={g.color} style={{width:`${g.progress}%`}}/></div><span className="goal-meta">{g.category} · {g.due}</span></div></div>)}{goals.length === 0 && <Empty text="Your next chapter starts with one goal."/>}</div><button className="goal-add" onClick={() => setShowGoalModal(true)}><Plus size={15}/> Create a goal</button></div>
            </section>
            <section className="bottom-callout"><div className="callout-icon"><Sparkles size={19}/></div><div><strong>Progress over perfection.</strong><p>You don't need a perfect day. Just one meaningful next step.</p></div><button onClick={() => setActiveNav("Weekly Review")}>Reflect on my week <ArrowRight size={15}/></button></section>
          </> : <SectionPage name={activeNav} goals={goals} habits={habits} habitLogs={habitLogs} tasks={planTasks} weekTasks={weekTasks} weeklyMetrics={weeklyMetrics} weeklyHabitRate={weeklyHabitRate} weeklyReview={weeklyReview} reviewReflection={reviewReflection} setReviewReflection={setReviewReflection} onSaveReview={saveReview} onGeneratePlan={generateWeeklyPlan} onSaveGoalProgress={saveGoalProgress} onDeleteGoal={removeGoal} onAddHabit={addHabit} onToggleHabit={toggleHabit} onDeleteHabit={removeHabit} onToggleTask={toggleTask} onDeleteTask={removeTask} onOpenTaskModal={openTaskModal} onSaveGoalDetails={saveGoalDetails} onSaveHabitDetails={saveHabitDetails} displayName={displayName} onSaveDisplayName={saveDisplayName} dark={dark} setDark={setDark} setShowGoalModal={setShowGoalModal} focusRunning={focusRunning} setFocusRunning={setFocusRunning} focusSeconds={focusSeconds} setFocusSeconds={setFocusSeconds} notice={setNotice} />}
        </div>
        <footer className="footer"><span>LEVELUP <b>•</b> YOUR JOURNEY, YOUR PACE</span><span><span className="footer-dot"/> Goals, tasks, and habits sync to your account</span></footer>
      </section>

      {(showGoalModal || showTaskModal) && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) {setShowGoalModal(false);setShowTaskModal(false);setTaskEditId("");} }}><div className="modal"><div className="modal-head"><div><span className="eyebrow">MAKE IT REAL</span><h2>{showGoalModal ? "Create a new goal" : taskEditId ? "Edit task details" : "Add a task"}</h2><p>{showGoalModal ? "Give your next chapter a name." : "Plan a clear next step for your goal."}</p></div><button className="icon-btn" onClick={() => {setShowGoalModal(false);setShowTaskModal(false);setTaskEditId("")}} aria-label="Close"><X size={18}/></button></div>{showGoalModal ? <form onSubmit={e => {e.preventDefault();void addGoal()}}><label>Goal name<input autoFocus value={goalTitle} onChange={e=>setGoalTitle(e.target.value)} placeholder="e.g. Learn React in 8 weeks" required maxLength={160}/></label><label>Details (optional)<textarea value={goalDescription} onChange={e=>setGoalDescription(e.target.value)} placeholder="Why this goal matters and what success looks like" maxLength={1000}/></label><label>Category<select value={goalCategory} onChange={e=>setGoalCategory(e.target.value)}><option>Exam preparation</option><option>Academics</option><option>Career</option><option>Skill development</option><option>Health</option><option>Personal growth</option></select></label><label>Target date (optional)<input type="date" min={today} value={goalTargetDate} onChange={e=>setGoalTargetDate(e.target.value)}/></label><button className="primary-btn full" type="submit" disabled={saving}>{saving ? "Saving…" : <><Plus size={16}/> Create goal</>}</button></form> : <form onSubmit={e=>{e.preventDefault();void addTask()}}><label>Task<input autoFocus value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="What will you work on?" required maxLength={200}/></label><label>Details (optional)<textarea value={taskDescription} onChange={e=>setTaskDescription(e.target.value)} placeholder="Add a note or next step" maxLength={1000}/></label><label>Estimated minutes<input type="number" min={0} max={1440} value={taskMinutes} onChange={e=>setTaskMinutes(Number(e.target.value))} required/></label><label>Plan for<input type="date" min={today} value={taskDate} onChange={e=>setTaskDate(e.target.value)} required/></label><label>Related goal<select value={taskGoalId} onChange={e=>setTaskGoalId(e.target.value)}><option value="">No linked goal</option>{goals.map(goal=><option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label><button className="primary-btn full" type="submit" disabled={saving}>{saving ? "Saving…" : <><Plus size={16}/>{taskEditId ? "Save changes" : "Add task"}</>}</button></form>}</div></div>}
    </main>
  );
}

function StatCard({label,value,sub,icon,accent,progress}:{label:string;value:string;sub:string;icon:React.ReactNode;accent:string;progress?:number}) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className={`stat-icon ${accent}`}>{icon}</div></div><div className="stat-value">{value}</div><div className="stat-sub">{sub}</div>{progress !== undefined && <div className="mini-progress"><i style={{width:`${progress}%`}}/></div>}</div>;
}
function PanelHeading({title,subtitle,right}:{title:string;subtitle:string;right?:React.ReactNode}) {
  return <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{right}</div>;
}
function Empty({text}:{text:string}) { return <div className="empty-state"><CircleHelp size={18}/><span>{text}</span></div>; }

function SectionPage({name,goals,habits,habitLogs,tasks,weekTasks,weeklyMetrics,weeklyHabitRate,weeklyReview,reviewReflection,setReviewReflection,onSaveReview,onGeneratePlan,onSaveGoalProgress,onDeleteGoal,onAddHabit,onToggleHabit,onDeleteHabit,onToggleTask,onDeleteTask,onOpenTaskModal,onSaveGoalDetails,onSaveHabitDetails,displayName,onSaveDisplayName,dark,setDark,setShowGoalModal,focusRunning,setFocusRunning,focusSeconds,setFocusSeconds,notice}:{name:string;goals:GoalItem[];habits:Habit[];habitLogs:HabitLogRow[];tasks:Task[];weekTasks:Task[];weeklyMetrics:{tasks_completed:number;tasks_total:number;habits_scheduled:number;habits_completed:number};weeklyHabitRate:number;weeklyReview:WeeklyReviewRow|null;reviewReflection:string;setReviewReflection:(value:string)=>void;onSaveReview:()=>void;onGeneratePlan:()=>void;onSaveGoalProgress:(id:string,progress:number)=>void;onDeleteGoal:(id:string)=>void;onAddHabit:(title:string)=>Promise<void>;onToggleHabit:(id:string)=>void;onDeleteHabit:(id:string)=>void;onToggleTask:(id:string)=>void;onDeleteTask:(id:string)=>void;onOpenTaskModal:(task?:Task)=>void;onSaveGoalDetails:(id:string,patch:Pick<GoalRow,"title"|"description"|"category"|"target_date">)=>void;onSaveHabitDetails:(id:string,patch:Pick<HabitRow,"title"|"description">)=>void;displayName:string;onSaveDisplayName:(name:string)=>void;dark:boolean;setDark:React.Dispatch<React.SetStateAction<boolean>>;setShowGoalModal:(v:boolean)=>void;focusRunning:boolean;setFocusRunning:(v:boolean)=>void;focusSeconds:number;setFocusSeconds:(v:number)=>void;notice:(v:string)=>void}) {
  const [newHabit,setNewHabit] = useState("");
  const [query,setQuery] = useState("");
  const [timerLength,setTimerLength] = useState(25);
  const [settingsName,setSettingsName] = useState(displayName);
  useEffect(() => setSettingsName(displayName), [displayName]);
  const [editingGoalId,setEditingGoalId] = useState("");
  const [goalDraft,setGoalDraft] = useState({title:"",description:"",category:"",target_date:""});
  const [editingHabitId,setEditingHabitId] = useState("");
  const [habitDraft,setHabitDraft] = useState({title:"",description:""});
  const filteredGoals = goals.filter(g=>g.title.toLowerCase().includes(query.toLowerCase()));
  useEffect(()=>setSettingsName(displayName),[displayName]);
  const editGoal = (goal:GoalItem) => { setEditingGoalId(goal.id); setGoalDraft({title:goal.title,description:goal.description,category:goal.category,target_date:goal.targetDate||""}); };
  const saveGoalDraft = (event:React.FormEvent) => { event.preventDefault(); const goal=goals.find(item=>item.id===editingGoalId); if(!goal||!goalDraft.title.trim()) return; onSaveGoalDetails(goal.id,{title:goalDraft.title.trim(),description:goalDraft.description.trim(),category:goalDraft.category,target_date:goalDraft.target_date||null}); setEditingGoalId(""); };
  const editHabit = (habit:Habit) => { setEditingHabitId(habit.id); setHabitDraft({title:habit.title,description:habit.detail}); };
  const saveHabitDraft = (event:React.FormEvent) => { event.preventDefault(); if(!habitDraft.title.trim()) return; onSaveHabitDetails(editingHabitId,{title:habitDraft.title.trim(),description:habitDraft.description.trim()}); setEditingHabitId(""); };
  if (name === "My Goals") return <><PageTitle eyebrow="YOUR BIG PICTURE" title="Goals that move you forward." subtitle="Ambition becomes manageable when you can see the next step." action={<button className="primary-btn" onClick={()=>setShowGoalModal(true)}><Plus size={16}/> New goal</button>}/><div className="search-field"><Search size={16}/><input placeholder="Search your goals..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="goals-page-grid">{filteredGoals.map(g=><div className="panel goal-detail-card" key={g.id}><div className={`goal-symbol ${g.color}`}><Target size={19}/></div>{editingGoalId===g.id?<form className="entity-edit-form" onSubmit={saveGoalDraft}><label>Goal name<input value={goalDraft.title} onChange={e=>setGoalDraft({...goalDraft,title:e.target.value})} required maxLength={160}/></label><label>Details<textarea value={goalDraft.description} onChange={e=>setGoalDraft({...goalDraft,description:e.target.value})} maxLength={1000}/></label><label>Category<input value={goalDraft.category} onChange={e=>setGoalDraft({...goalDraft,category:e.target.value})} required maxLength={80}/></label><label>Target date<input type="date" value={goalDraft.target_date} onChange={e=>setGoalDraft({...goalDraft,target_date:e.target.value})}/></label><button className="primary-btn" type="submit">Save details</button><button className="secondary-btn" type="button" onClick={()=>setEditingGoalId("")}>Cancel</button></form>:<><span className="category-tag">{g.category}</span><h2>{g.title}</h2>{g.description&&<p>{g.description}</p>}<p>Target: {g.due}</p><div className="goal-title-line"><span>Measured progress</span><strong>{g.progress}%</strong></div><div className="progress-track large"><i className={g.color} style={{width:`${g.progress}%`}}/></div><div className="goal-card-actions"><button className="secondary-btn" onClick={()=>onSaveGoalProgress(g.id,Math.min(100,g.progress+10))}>Log progress +10%</button><button className="text-btn" onClick={()=>editGoal(g)}>Edit details</button><button className="dots-btn" onClick={()=>onDeleteGoal(g.id)} aria-label="Delete goal"><X size={16}/></button></div></>}</div>)}</div>{!filteredGoals.length&&<Empty text="No goals saved yet. Create a goal to get started."/>}</>;
  if (name === "Habits") return <><PageTitle eyebrow="SHOW UP FOR YOURSELF" title="Build your daily rhythm." subtitle="A habit isn't about a perfect streak. It's about returning."/><form className="inline-add" onSubmit={async e=>{e.preventDefault();if(newHabit.trim()){try{await onAddHabit(newHabit.trim());setNewHabit("");notice("Habit saved to your account.");}catch(error){notice(`Could not save the habit: ${errorMessage(error, "unknown Supabase error")}`);}}}}><input value={newHabit} onChange={e=>setNewHabit(e.target.value)} placeholder="Add a habit you want to build..." maxLength={120}/><button className="primary-btn" type="submit"><Plus size={16}/> Add habit</button></form><div className="panel full-panel"><PanelHeading title="Today's habits" subtitle={`${habits.filter(h=>h.done).length} of ${habits.length} completed`}/>{habits.map(h=><div className="habit-row habit-page-row" key={h.id}><div className={`habit-icon ${h.icon}`}>{iconFor(h.icon)}</div>{editingHabitId===h.id?<form className="entity-edit-form" onSubmit={saveHabitDraft}><label>Habit<input value={habitDraft.title} onChange={e=>setHabitDraft({...habitDraft,title:e.target.value})} required maxLength={120}/></label><label>Details<input value={habitDraft.description} onChange={e=>setHabitDraft({...habitDraft,description:e.target.value})} maxLength={500}/></label><button className="primary-btn" type="submit">Save habit</button><button className="secondary-btn" type="button" onClick={()=>setEditingHabitId("")}>Cancel</button></form>:<><div className="habit-main"><strong>{h.title}</strong><span>{h.detail} · {h.streak} day streak</span></div><button className={`habit-check ${h.done?"checked":""}`} onClick={()=>onToggleHabit(h.id)} aria-label={h.done?"Mark habit incomplete":"Complete habit"}>{h.done?<Check size={14}/>:<Plus size={14}/>}</button><button className="text-btn" onClick={()=>editHabit(h)}>Edit</button><button className="dots-btn" aria-label="Archive habit" onClick={()=>onDeleteHabit(h.id)}><X size={16}/></button></>}</div>)}</div></>;
  if (name === "My Plan") return <><PageTitle eyebrow="YOUR NEXT STEPS" title="A plan that fits your life." subtitle="Plan focused steps from your own goals for the next seven days." action={<div className="inline-actions"><button className="secondary-btn" onClick={onGeneratePlan} disabled={!goals.length}><Sparkles size={15}/> Build my week</button><button className="primary-btn" onClick={()=>onOpenTaskModal()}><Plus size={16}/> Add task</button></div>}/><div className="panel full-panel"><PanelHeading title="Next seven days" subtitle="Tasks are saved to your account and linked goals appear below."/>{tasks.map(t=><div className="task-row" key={t.id}><button className={`check-control ${t.done?"checked":""}`} onClick={()=>onToggleTask(t.id)} aria-label={t.done?"Mark task incomplete":"Complete task"}>{t.done&&<Check size={13}/>}</button><div className="task-main"><strong>{t.title}</strong><span>{t.time}{t.goalId?` · ${goals.find(goal=>goal.id===t.goalId)?.title||"Goal"}`:""}</span></div><span className="category-tag">{t.category}</span><button className="text-btn" onClick={()=>onOpenTaskModal(t)}>Edit</button><button className="dots-btn" onClick={()=>onDeleteTask(t.id)} aria-label="Delete task"><X size={16}/></button></div>)}{!tasks.length&&<Empty text="No tasks planned for the next seven days. Add tasks or build a week from your goals."/>}</div><div className="panel full-panel"><PanelHeading title="Recurring habits" subtitle="These routines are part of your weekly plan."/>{habits.map(habit=>{const completed=habitLogs.filter(log=>log.habit_id===habit.id&&log.status==="completed").length;const weekdays=["","Mon","Tue","Wed","Thu","Fri","Sat","Sun"];return <div className="habit-row" key={habit.id}><div className={`habit-icon ${habit.icon}`}>{iconFor(habit.icon)}</div><div className="habit-main"><strong>{habit.title}</strong><span>{weekdays.filter((_,index)=>habit.scheduleDays.includes(index)).join(", ")||"No days scheduled"}</span></div><span className="category-tag">{completed} check-ins</span></div>;})}{!habits.length&&<Empty text="Add habits to include your routines here."/>}</div><div className="panel info-panel"><Sparkles size={18}/><div><strong>How weekly planning works</strong><p>Build my week adds one 45 minute step for each active goal that has no unfinished task scheduled this week. Your habit schedule stays alongside those goal tasks.</p></div></div></>;
  if (name === "Focus Mode") return <><PageTitle eyebrow="PROTECT YOUR ATTENTION" title="One thing at a time." subtitle="Give one task your full attention. The rest can wait."/><div className="focus-layout"><div className="panel timer-panel"><div className="timer-orbit"><div className="timer-inner"><span>FOCUS SESSION</span><strong>{String(Math.floor(focusSeconds/60)).padStart(2,"0")}:{String(focusSeconds%60).padStart(2,"0")}</strong><span>{focusRunning?"YOU'RE IN THE ZONE":"READY WHEN YOU ARE"}</span></div></div><div className="timer-controls"><button className="primary-btn" onClick={()=>setFocusRunning(!focusRunning)}>{focusRunning?"Pause session":"Start focusing"}</button><button className="secondary-btn" onClick={()=>{setFocusRunning(false);setFocusSeconds(timerLength*60)}}>Reset</button></div><div className="duration-options">{[25,50,60].map(n=><button className={timerLength===n?"selected":""} key={n} onClick={()=>{setTimerLength(n);setFocusRunning(false);setFocusSeconds(n*60)}}>{n} min</button>)}</div></div><div className="panel focus-note"><div className="stat-icon purple"><Zap size={18}/></div><h2>Make space for deep work</h2><p>Choose one task, silence distractions, and let the timer hold the boundary. Breaks are part of the process.</p><div className="focus-tip"><CheckCircle2 size={16}/> Start with a task you can name clearly.</div><div className="focus-tip"><CheckCircle2 size={16}/> A completed session is progress.</div></div></div></>;
  if (name === "Analytics") return <><PageTitle eyebrow="NOTICE YOUR PROGRESS" title="The data behind your effort." subtitle="Your summary uses your saved tasks and habit check-ins from the last seven days."/><div className="stats-grid analytics-stats"><StatCard label="TASKS COMPLETED" value={`${weeklyMetrics.tasks_completed}/${weeklyMetrics.tasks_total}`} sub="Tasks scheduled in the last seven days" icon={<CheckCircle2 size={18}/>} accent="purple"/><StatCard label="HABIT ADHERENCE" value={`${weeklyHabitRate}%`} sub={`${weeklyMetrics.habits_completed} completed check-ins`} icon={<Activity size={18}/>} accent="green" progress={weeklyHabitRate}/><StatCard label="ACTIVE GOALS" value={String(goals.length)} sub="Your current goals" icon={<Target size={18}/>} accent="blue"/></div><div className="panel full-panel"><PanelHeading title="This week's task record" subtitle="Completed tasks are counted by their scheduled day."/>{weekTasks.map(task=><div className="task-row" key={task.id}><span className={`calendar-status ${task.done?"done":""}`}/><div className="task-main"><strong>{task.title}</strong><span>{task.scheduledDate} · {task.done?"Completed":"Not completed"}</span></div></div>)}{!weekTasks.length&&<Empty text="Your task history will appear here as you plan and complete tasks."/>}</div></>;
  if (name === "Calendar") { const calendarDays=Array.from({length:7},(_,index)=>addDays(localDateString(),index)); return <><PageTitle eyebrow="SEE YOUR TIME" title="Your week, at a glance." subtitle="Your tasks, arranged by their scheduled date."/><div className="panel calendar-panel"><PanelHeading title="Next seven days" subtitle="Based on your saved task schedule"/><div className="calendar-week">{calendarDays.map(date=>{const dayTasks=tasks.filter(task=>task.scheduledDate===date);const dateObject=new Date(`${date}T00:00:00`);return <div className="calendar-day" key={date}><span>{dateObject.toLocaleDateString("en",{weekday:"short"})}</span><strong>{dateObject.getDate()}</strong><div className="calendar-markers">{dayTasks.map(task=><i key={task.id} title={task.title}/>)}</div></div>;})}</div><div className="calendar-task-list">{tasks.map(t=><div className="task-row" key={t.id}><span className={`calendar-status ${t.done?"done":""}`}/><div className="task-main"><strong>{t.title}</strong><span>{t.time}</span></div><span className="category-tag">{t.category}</span></div>)}{!tasks.length&&<Empty text="No tasks planned for the next seven days."/>}</div></div></>; }
  if (name === "Weekly Review") return <><PageTitle eyebrow="REFLECT WITHOUT JUDGMENT" title="Look back. Learn. Begin again." subtitle="Your last seven days, saved from your tasks and habit check-ins."/><div className="review-grid"><div className="panel review-card"><div className="stat-icon purple"><CheckCircle2 size={18}/></div><span>Tasks completed</span><strong>{weeklyMetrics.tasks_completed} / {weeklyMetrics.tasks_total}</strong><p>Scheduled tasks completed over the last seven days.</p></div><div className="panel review-card"><div className="stat-icon green"><Activity size={18}/></div><span>Habit check-ins</span><strong>{weeklyMetrics.habits_completed} / {weeklyMetrics.habits_scheduled}</strong><p>{weeklyHabitRate}% of scheduled habit check-ins completed.</p></div></div><div className="panel review-prompt"><h2>One question to carry forward</h2><p>What helped you make progress this week, and what would you like to adjust next week?</p><textarea placeholder="Write a few notes for your future self..." value={reviewReflection} onChange={event=>setReviewReflection(event.target.value)} maxLength={3000}/><button className="primary-btn" onClick={onSaveReview}><Check size={15}/>{weeklyReview?"Update weekly review":"Save weekly review"}</button></div><div className="panel full-panel"><PanelHeading title="Completed and planned tasks" subtitle="Review the tasks that shaped this week."/>{weekTasks.map(task=><div className="task-row" key={task.id}><span className={`calendar-status ${task.done?"done":""}`}/><div className="task-main"><strong>{task.title}</strong><span>{task.scheduledDate} · {task.done?"Completed":"Not completed"}</span></div></div>)}{!weekTasks.length&&<Empty text="Your weekly activity will appear here once you add tasks."/>}</div></>;
  if (name === "Settings") return <><PageTitle eyebrow="MAKE IT YOURS" title="Your space, your settings." subtitle="A supportive system should adapt to you."/><div className="panel settings-panel"><form className="settings-section" onSubmit={event=>{event.preventDefault();onSaveDisplayName(settingsName)}}><div><strong>Display name</strong><p>Saved on your Supabase profile.</p></div><input value={settingsName} onChange={e=>setSettingsName(e.target.value)} maxLength={80} required/><button className="secondary-btn" type="submit">Save name</button></form><div className="settings-section"><div><strong>Appearance</strong><p>Switch between calm dark and light themes.</p></div><button className="secondary-btn" type="button" onClick={()=>setDark(value=>!value)}>Switch to {dark?"light":"dark"} theme</button></div><div className="settings-section"><div><strong>Data & privacy</strong><p>Your goals, tasks, and habits are stored in your Supabase account and protected by row-level security.</p></div><button className="secondary-btn" type="button" onClick={()=>{const blob=new Blob([JSON.stringify({goals,habits,tasks},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="levelup-data.json";a.click();URL.revokeObjectURL(url)}}>Export data</button></div></div></>;
  return <><PageTitle eyebrow="YOUR NEXT CHAPTER" title="Make progress, every day." subtitle="Choose a small action and let momentum build." action={<button className="primary-btn" onClick={()=>setShowGoalModal(true)}><Plus size={16}/> New goal</button>}/><div className="panel info-panel"><Sparkles size={18}/><div><strong>{name}</strong><p>This workspace section is ready to be connected to your personal plan and cloud data. Use the Dashboard, Goals, Habits, and Focus Mode to explore the starter interactions.</p></div></div></>;
}
function PageTitle({eyebrow,title,subtitle,action}:{eyebrow:string;title:string;subtitle:string;action?:React.ReactNode}) { return <div className="page-title-row"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>; }
