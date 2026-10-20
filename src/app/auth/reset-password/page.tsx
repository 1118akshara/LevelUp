 "use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function ResetPasswordPage() {
  const [email,setEmail] = useState("");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  async function submit(e:FormEvent) {
    e.preventDefault();setBusy(true);setMessage("");setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const {error} = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if(error) throw error;
      setMessage("If an account exists for that email, a password reset link will be sent.");
    } catch(err) { setError(err instanceof Error ? err.message : "Unable to request a reset link."); }
    finally { setBusy(false); }
  }
  return <main className="auth-reset-shell"><section className="auth-card reset-card"><Link className="auth-brand" href="/login"><span className="auth-mark"><Sparkles size={19}/></span><span>level<span>up</span></span></Link><div className="auth-eyebrow">ACCOUNT RECOVERY</div><h1>Reset your password.</h1><p className="auth-subtitle">Enter the email address associated with your account. We'll send a recovery link if an account exists.</p><form className="auth-form" onSubmit={submit}><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></label>{error&&<div className="auth-message error" role="alert">{error}</div>}{message&&<div className="auth-message success" role="status">{message}</div>}<button className="auth-submit" type="submit" disabled={busy}>{busy?"Sending...":"Send reset link"}</button></form><Link className="back-link" href="/login"><ArrowLeft size={15}/> Back to sign in</Link></section></main>;
}
