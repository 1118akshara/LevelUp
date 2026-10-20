 "use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Suspense } from "react";
import { Sparkles, ArrowRight, Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(""); setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Email confirmation is enabled for this Supabase project. To create accounts without sending emails, disable Confirm email in Authentication settings, then try again.");
        } else {
          router.replace(safeNext); router.refresh();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace(safeNext); router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  return <main className="auth-shell"><section className="auth-card"><Link className="auth-brand" href="/"><span className="auth-mark"><Sparkles size={19}/></span><span>level<span>up</span></span></Link><div className="auth-eyebrow">YOUR NEXT CHAPTER STARTS HERE</div><h1>{mode === "login" ? "Welcome back." : "Make progress yours."}</h1><p className="auth-subtitle">{mode === "login" ? "Pick up where you left off. Your goals are waiting." : "Create your account and build a rhythm that works for you."}</p>
    <div className="auth-tabs"><button className={mode==="login"?"selected":""} onClick={()=>{setMode("login");setError("");setMessage("");}}>Sign in</button><button className={mode==="signup"?"selected":""} onClick={()=>{setMode("signup");setError("");setMessage("");}}>Create account</button></div>
    <form className="auth-form" onSubmit={submit}>
      {mode === "signup" && <label>Display name<input value={name} onChange={e=>setName(e.target.value)} placeholder="How should we call you?" autoComplete="name" maxLength={80} required/></label>}
      <label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></label>
      <label>Password<div className="password-field"><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==="signup"?"At least 8 characters":"Your password"} autoComplete={mode==="signup"?"new-password":"current-password"} minLength={8} required/><button type="button" onClick={()=>setShowPassword(s=>!s)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
      {mode === "login" && <div className="auth-forgot"><Link href="/auth/reset-password">Forgot password?</Link></div>}
      {error && <div role="alert" className="auth-message error">{error}</div>}
      {message && <div role="status" className="auth-message success">{message}</div>}
      <button className="auth-submit" disabled={busy} type="submit">{busy ? "Please wait..." : mode==="login" ? "Sign in" : "Create account"} <ArrowRight size={16}/></button>
    </form><div className="auth-footnote">Your goals are personal. Your account data is protected by database-level access policies.</div></section><div className="auth-side"><div className="auth-orbit one"/><div className="auth-orbit two"/><div className="auth-side-content"><span className="auth-side-kicker"><Sparkles size={15}/> YOUR SPACE TO GROW</span><h2>Build a life<br/>you feel good<br/><em>showing up for.</em></h2><p>Goals, habits, focused work, and the small wins that add up to something meaningful.</p><div className="auth-quote"><span>“</span><div><strong>Progress over perfection.</strong><small>One intentional step at a time.</small></div></div></div></div></main>;
}
export default function LoginPage() { return <Suspense fallback={<main className="auth-loading">Loading…</main>}><LoginForm/></Suspense>; }
