from pathlib import Path


def must_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing expected snippet: {label}")
    return text.replace(old, new, 1)


# 1) First-login/private-password gate shared by students, teachers and admins.
path = Path("src/components/evidara/credential-security-gate.tsx")
text = path.read_text()
old = """  const passwordReady = useMemo(() => (
    password.length >= 12
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\\d/.test(password)
    && /[^A-Za-z0-9]/.test(password)
    && password === confirmPassword
  ), [confirmPassword, password]);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !userId || !passwordReady) return;
    setSavingPassword(true);
    setError('');
"""
new = """  const passwordProblems = useMemo(() => {
    const problems: string[] = [];
    if (password.length < 12) problems.push('Use at least 12 characters.');
    if (!/[A-Z]/.test(password)) problems.push('Add an uppercase letter.');
    if (!/[a-z]/.test(password)) problems.push('Add a lowercase letter.');
    if (!/\\d/.test(password)) problems.push('Add a number.');
    if (!/[^A-Za-z0-9]/.test(password)) problems.push('Add a symbol.');
    if (confirmPassword && password !== confirmPassword) problems.push('The passwords do not match.');
    return problems;
  }, [confirmPassword, password]);
  const canAttemptPasswordChange = Boolean(accessToken && userId && password && confirmPassword) && !savingPassword;

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !userId) {
      setError('Your secure session is not ready. Sign in again and retry.');
      return;
    }
    if (!password || !confirmPassword) {
      setError('Enter the new password in both fields.');
      return;
    }
    if (passwordProblems.length) {
      setError(passwordProblems.join(' '));
      return;
    }
    setSavingPassword(true);
    setError('');
"""
text = must_replace(text, old, new, "shared credential gate validation")
old = """            <div className=\"rounded-xl bg-[#F7F9F7] p-4 text-xs leading-5 text-[#5E6E74]\">Use at least 12 characters with uppercase, lowercase, a number and a symbol. Do not use your name, email or common passwords.</div>
            {error && <div className=\"rounded-xl border border-[#E5B5B5] bg-[#FFF4F4] px-4 py-3 text-sm text-[#A33A3A]\">{error}</div>}
            <Button type=\"submit\" disabled={!passwordReady || savingPassword} className=\"w-full bg-[#0E5A5A] text-white hover:bg-[#0A4747]\">{savingPassword ? <LoaderCircle className=\"mr-2 h-4 w-4 animate-spin\" /> : <LockKeyhole className=\"mr-2 h-4 w-4\" />}Set password and continue</Button>
"""
new = """            <div className=\"rounded-xl bg-[#F7F9F7] p-4 text-xs leading-5 text-[#5E6E74]\">
              <p>Use at least 12 characters with uppercase, lowercase, a number and a symbol. Do not use your name, email or common passwords.</p>
              {(password || confirmPassword) && passwordProblems.length > 0 && <p className=\"mt-2 font-medium text-[#8A5F00]\">Still needed: {passwordProblems.join(' ')}</p>}
            </div>
            {error && <div className=\"rounded-xl border border-[#E5B5B5] bg-[#FFF4F4] px-4 py-3 text-sm text-[#A33A3A]\">{error}</div>}
            <Button type=\"submit\" disabled={!canAttemptPasswordChange} className=\"w-full bg-[#0E5A5A] text-white hover:bg-[#0A4747]\">{savingPassword ? <LoaderCircle className=\"mr-2 h-4 w-4 animate-spin\" /> : <LockKeyhole className=\"mr-2 h-4 w-4\" />}Set password and continue</Button>
"""
text = must_replace(text, old, new, "credential gate action button")
path.write_text(text)


# 2) School Admin student drawer: align UI with server's 8-character managed-password rule.
path = Path("src/components/school/StudentLifecycleManager.tsx")
text = path.read_text()
old = """  async function setPassword() {
    if (!detail || newPassword.length < 12) { setActionError(\"Use a password with at least 12 characters.\"); return; }
    const ok = await runAction(`password-${detail.membershipId}`, \"Student password updated.\", () => execute(\"setStudentPassword\", { membershipId: detail.membershipId, password: newPassword }));
    if (ok) setNewPassword(\"\");
  }
"""
new = """  async function setPassword() {
    if (!detail) return;
    setActionMessage(null);
    if (!newPassword) { setActionError(\"Enter a password first.\"); return; }
    if (newPassword.length < 8) { setActionError(\"Password must contain at least 8 characters.\"); return; }
    const ok = await runAction(`password-${detail.membershipId}`, \"Student password updated.\", () => execute(\"setStudentPassword\", { membershipId: detail.membershipId, password: newPassword }));
    if (ok) setNewPassword(\"\");
  }
"""
text = must_replace(text, old, new, "student managed password handler")
old = """<div className=\"flex gap-2\"><Input type=\"password\" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder=\"12+ character password\" /><Button variant=\"outline\" disabled={newPassword.length < 12 || syncing} onClick={() => void setPassword()}>Set password</Button></div>"""
new = """<div className=\"flex gap-2\"><Input type=\"password\" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} onInput={(event) => setNewPassword((event.target as HTMLInputElement).value)} placeholder=\"8+ character password\" /><Button variant=\"outline\" disabled={!newPassword || syncing || pendingAction === `password-${detail.membershipId}`} onClick={() => void setPassword()}>{pendingAction === `password-${detail.membershipId}` && <LoaderCircle className=\"mr-2 h-4 w-4 animate-spin\" />}Set password</Button></div>{actionError && <p className=\"rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700\">{actionError}</p>}"""
text = must_replace(text, old, new, "student managed password controls")
path.write_text(text)


# 3) Access Control password reset used by Super Admin, Evidara Admin and School Admin
# for the teacher/student accounts each role is allowed to manage.
path = Path("src/components/evidara/access-control-view.tsx")
text = path.read_text()
old = """  async function resetPassword() {
    if (!passwordAccount || !accountCanBeManaged(passwordAccount)) return;
    await mutate({
"""
new = """  async function resetPassword() {
    if (!passwordAccount || !accountCanBeManaged(passwordAccount)) return;
    if (!temporaryPassword) { setError('Enter or generate a temporary password first.'); return; }
    if (temporaryPassword.length < 8) { setError('Temporary password must contain at least 8 characters.'); return; }
    await mutate({
"""
text = must_replace(text, old, new, "access control reset handler")
old = """            <p className=\"text-xs text-[var(--muted-foreground)]\">Share it securely and ask the account owner to change it after signing in.</p>
          </div>
          <DialogFooter>
            <Button variant=\"outline\" onClick={() => setPasswordAccount(null)} className=\"border-[var(--line)]\">Cancel</Button>
            <Button onClick={() => void resetPassword()} disabled={temporaryPassword.length < 8 || Boolean(passwordAccount && savingKey === `password:${passwordAccount.id}`)} className=\"bg-[var(--teal)] text-white\">
"""
new = """            <p className=\"text-xs text-[var(--muted-foreground)]\">Share it securely and ask the account owner to change it after signing in. Minimum: 8 characters.</p>
            {error && <p className=\"rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700\">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant=\"outline\" onClick={() => setPasswordAccount(null)} className=\"border-[var(--line)]\">Cancel</Button>
            <Button onClick={() => void resetPassword()} disabled={!temporaryPassword || Boolean(passwordAccount && savingKey === `password:${passwordAccount.id}`)} className=\"bg-[var(--teal)] text-white\">
"""
text = must_replace(text, old, new, "access control reset button")
path.write_text(text)


# 4) Super Admin demo-student password control: same interaction rule, server remains authoritative.
path = Path("src/components/evidara/admin-demo-student-accounts.tsx")
text = path.read_text()
old = """  async function resetPassword() {
    if (!selected) return;
    setWorking(true); setError(''); setMessage('');
"""
new = """  async function resetPassword() {
    if (!selected) return;
    if (!newPassword) { setError('Enter a new password first.'); return; }
    if (newPassword.length < 12) { setError('Use a password with at least 12 characters.'); return; }
    setWorking(true); setError(''); setMessage('');
"""
text = must_replace(text, old, new, "demo student reset handler")
old = """<p className=\"mt-2 text-xs text-[var(--muted-foreground)]\">The new password goes directly to Supabase Auth. Evidara does not store a readable copy.</p><div className=\"mt-5 flex justify-end gap-2\"><Button variant=\"outline\" onClick={() => { setSelected(null); setNewPassword(''); }}>Cancel</Button><Button disabled={working || newPassword.length < 12} onClick={() => void resetPassword()}>{working && <LoaderCircle className=\"mr-2 h-4 w-4 animate-spin\" />}Set new password</Button></div>"""
new = """<p className=\"mt-2 text-xs text-[var(--muted-foreground)]\">The new password goes directly to Supabase Auth. Evidara does not store a readable copy.</p>{error && <p className=\"mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700\">{error}</p>}<div className=\"mt-5 flex justify-end gap-2\"><Button variant=\"outline\" onClick={() => { setSelected(null); setNewPassword(''); setError(''); }}>Cancel</Button><Button disabled={working || !newPassword} onClick={() => void resetPassword()}>{working && <LoaderCircle className=\"mr-2 h-4 w-4 animate-spin\" />}Set new password</Button></div>"""
text = must_replace(text, old, new, "demo student reset controls")
path.write_text(text)

print("Applied password-action UX fixes across shared credential gate and managed account surfaces.")
