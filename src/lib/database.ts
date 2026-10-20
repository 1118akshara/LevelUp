import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export type GoalRow = {
  id: string; user_id: string; title: string; description: string; category: string;
  start_date: string; target_date: string | null; progress: number; status: string; created_at: string;
};
export type TaskRow = {
  id: string; user_id: string; goal_id: string | null; title: string; description: string;
  scheduled_date: string; estimated_minutes: number; status: "pending" | "completed" | "skipped";
  completed_at: string | null; created_at: string;
};
export type HabitRow = {
  id: string; user_id: string; title: string; description: string; habit_type: string;
  schedule_days: number[]; status: string; created_at: string;
};
export type HabitLogRow = {
  id: string; user_id: string; habit_id: string; log_date: string;
  status: "completed" | "partial" | "missed"; value: number | null; note: string;
};
export type WeeklyReviewRow = {
  id: string; user_id: string; period_start: string; period_end: string;
  reflection: string; metrics: Record<string, number>; created_at: string;
};

export async function getCurrentUserId(): Promise<string> {
  const client = createSupabaseBrowserClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in to continue.");
  return data.user.id;
}

export async function getCurrentDisplayName(): Promise<string> {
  const client = createSupabaseBrowserClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Please sign in to continue.");
  const { data, error } = await client.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle();
  if (error) throw error;
  return data?.display_name?.trim() || auth.user.user_metadata?.display_name || auth.user.email?.split("@")[0] || "Achiever";
}
export async function updateCurrentDisplayName(displayName: string): Promise<string> {
  const client = createSupabaseBrowserClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Please sign in to update your profile.");
  const { data, error } = await client.from("profiles").upsert({ id: auth.user.id, display_name: displayName.trim() }, { onConflict: "id" }).select("display_name").single();
  if (error) throw error;
  return data.display_name;
}

export async function listGoals() {
  const client = createSupabaseBrowserClient();
  const { data, error } = await client.from("goals").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GoalRow[];
}
export async function createGoal(input: Pick<GoalRow, "title" | "description" | "category" | "target_date">) {
  const client = createSupabaseBrowserClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Please sign in to create a goal.");
  // Let the database apply defaults (including progress=0). This keeps goal
  // creation working if an existing project has not yet applied the progress migration.
  const { data, error } = await client.from("goals").insert({ ...input, user_id: auth.user.id }).select("*").single();
  if (error) throw error;
  return data as GoalRow;
}
export async function updateGoal(id: string, patch: Partial<Pick<GoalRow, "title" | "description" | "category" | "target_date" | "progress" | "status">>) {
  const client = createSupabaseBrowserClient();
  const { data, error } = await client.from("goals").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as GoalRow;
}
export async function deleteGoal(id: string) {
  const client = createSupabaseBrowserClient();
  const { error } = await client.from("goals").delete().eq("id", id);
  if (error) throw error;
}
export function localDateString(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
export async function listTasks(startDate = localDateString(), endDate = startDate) {
  const client = createSupabaseBrowserClient();
  const { data, error } = await client.from("tasks").select("*")
    .gte("scheduled_date", startDate).lte("scheduled_date", endDate)
    .order("scheduled_date").order("created_at");
  if (error) throw error;
  return (data ?? []) as TaskRow[];
}
export async function createTask(input: Pick<TaskRow, "title" | "description" | "scheduled_date" | "estimated_minutes" | "goal_id">) {
  const client = createSupabaseBrowserClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Please sign in to create a task.");
  const { data, error } = await client.from("tasks").insert({ ...input, user_id: auth.user.id }).select("*").single();
  if (error) throw error;
  return data as TaskRow;
}
export async function setTaskStatus(id: string, status: TaskRow["status"]) {
  const client = createSupabaseBrowserClient();
  const { data, error } = await client.from("tasks").update({
    status, completed_at: status === "completed" ? new Date().toISOString() : null,
  }).eq("id", id).select("*").single();
  if (error) throw error;
  return data as TaskRow;
}
export async function updateTask(id: string, patch: Partial<Pick<TaskRow, "title" | "description" | "scheduled_date" | "estimated_minutes" | "goal_id">>) {
  const client = createSupabaseBrowserClient();
  const { data, error } = await client.from("tasks").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as TaskRow;
}
export async function deleteTask(id: string) {
  const client = createSupabaseBrowserClient();
  const { error } = await client.from("tasks").delete().eq("id", id);
  if (error) throw error;
}
export async function listHabits() {
  const client = createSupabaseBrowserClient();
  const { data, error } = await client.from("habits").select("*").eq("status", "active").order("created_at");
  if (error) throw error;
  return (data ?? []) as HabitRow[];
}
export async function listHabitLogs(startDate = localDateString(), endDate = startDate) {
  const client = createSupabaseBrowserClient();
  const { data, error } = await client.from("habit_logs").select("*")
    .gte("log_date", startDate).lte("log_date", endDate);
  if (error) throw error;
  return (data ?? []) as HabitLogRow[];
}
export async function createHabit(input: Pick<HabitRow, "title" | "description" | "habit_type" | "schedule_days">) {
  const client = createSupabaseBrowserClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Please sign in to create a habit.");
  const { data, error } = await client.from("habits").insert({ ...input, user_id: auth.user.id }).select("*").single();
  if (error) throw error;
  return data as HabitRow;
}
export async function updateHabit(id: string, patch: Partial<Pick<HabitRow, "title" | "description" | "habit_type" | "schedule_days" | "status">>) {
  const client = createSupabaseBrowserClient();
  const { data, error } = await client.from("habits").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as HabitRow;
}
export async function logHabit(habitId: string, date: string, status: HabitLogRow["status"]) {
  const client = createSupabaseBrowserClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Please sign in to log a habit.");
  const { data, error } = await client.from("habit_logs").upsert({
    user_id: auth.user.id, habit_id: habitId, log_date: date, status,
  }, { onConflict: "habit_id,log_date" }).select("*").single();
  if (error) throw error;
  return data as HabitLogRow;
}
export async function deleteHabit(id: string) {
  const client = createSupabaseBrowserClient();
  const { error } = await client.from("habits").update({ status: "archived" }).eq("id", id);
  if (error) throw error;
}

export async function saveWeeklyReview(periodStart: string, periodEnd: string, reflection: string, metrics: Record<string, number>) {
  const client = createSupabaseBrowserClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Please sign in to save your review.");
  const { data, error } = await client.from("weekly_reviews").upsert({
    user_id: auth.user.id, period_start: periodStart, period_end: periodEnd, reflection, metrics,
  }, { onConflict: "user_id,period_start,period_end" }).select("*").single();
  if (error) throw error;
  return data as WeeklyReviewRow;
}

export async function getWeeklyReview(periodStart: string, periodEnd: string) {
  const client = createSupabaseBrowserClient();
  const { data, error } = await client.from("weekly_reviews").select("*")
    .eq("period_start", periodStart).eq("period_end", periodEnd).maybeSingle();
  if (error) throw error;
  return data as WeeklyReviewRow | null;
}
