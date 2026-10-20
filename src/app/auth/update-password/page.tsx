 "use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Sparkles } from "lucide-react";

export default function UpdatePasswordPage() {
  const router=useRouter();
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  async function submit(e:FormEvent) {
    e.preventDefault();setError("");setMessage("");
    if(password!==confirm){setError("Passwords do not match.");return;}
    setBusy(true);
    try {
      const supabase=createSupabaseBrowserClient();
      const {error}=await supabase.auth.updateUser({password});
      if(error) throw error;
      setMessage("Password updated. Redirecting to your dashboard…");
      window.setTimeout(()=>router.replace("/"),800);
    } catch(err){setError(err instanceof Error?err.message:"Unable to update password. Please request a new reset link.");}
    finally{setBusy(false);}
  }
  return <main className="auth-reset-shell"><section className="auth-card reset-card"><Link className="auth-brand" href="/"><span className="auth-mark"><Sparkles size={19}/></span><span>level<span>up</span></span></Link><div className="auth-eyebrow">SECURE YOUR ACCOUNT</div><h1>Choose a new password.</h1><p className="auth-subtitle">Use at least 8 characters and choose something unique.</p><form className="auth-form" onSubmit={submit}><label>New password<input type="password" minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><label>Confirm new password<input type="password" minLength={8} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>{error&&<div className="auth-message error" role="alert">{error}</div>}{message&&<div className="auth-message success" role="status">{message}</div>}<button className="auth-submit" disabled={busy} type="submit">{busy?"Updating…":"Update password"}</button></form></section></main>;
}
