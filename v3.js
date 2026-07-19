/* ScholarOS Version 3: cloud mode UI, secure server scoring and sync controls. */
(() => {
  const cloud = window.scholarCloud;
  let syncTimer = null;
  const baseRender = window.render;
  const baseBind = window.bind;
  const baseRenderSuper = window.renderSuper;
  const baseRenderAdmin = window.renderAdmin;
  const baseRenderStudent = window.renderStudent;

  roleConfig.super.nav.splice(roleConfig.super.nav.length - 1, 0, ['cloud', 'Cloud Operations', '☁']);
  roleConfig.admin.nav.push(['cloud', 'Cloud Operations', '☁']);

  function cloudLabel() {
    if (!cloud.config.loaded) return ['Checking backend', 'checking'];
    if (!cloud.config.configured) return ['Local pilot mode', 'local'];
    if (cloud.status === 'syncing') return ['Syncing…', 'syncing'];
    if (cloud.user && cloud.status === 'connected') return ['Cloud synced', 'connected'];
    if (cloud.status === 'error') return ['Sync attention', 'error'];
    return ['Cloud available', 'available'];
  }

  function formatSyncTime() {
    if (!cloud.lastSyncAt) return 'Not synced yet';
    return new Date(cloud.lastSyncAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function cloudOperationsPage() {
    const [label, cls] = cloudLabel();
    return `<div class="page-head"><div><span class="eyebrow">VERSION 3 BACKEND</span><h3>Cloud operations</h3><p>Shared data, authenticated users, tenant filtering and server-side assessment scoring.</p></div><span class="cloud-pill ${cls}">${label}</span></div>
      <div class="grid grid-4">
        ${metric('☁', cloud.config.configured ? 'Ready' : 'Pending', 'Supabase configuration', cloud.config.configured ? 'Environment detected' : '3 variables needed')}
        ${metric('⚿', cloud.user ? 'Signed in' : 'Local', 'Authenticated session', cloud.user?.email || 'Demo session')}
        ${metric('↺', localStorage.getItem('scholaros-cloud-version') || '0', 'Cloud data version', 'Optimistic locking')}
        ${metric('✓', 'Server', 'Student scoring', 'Answer keys protected')}
      </div>
      <div class="grid grid-2" style="margin-top:18px">
        <div class="card card-pad"><h4 class="card-title">Backend status</h4><div class="cloud-status-list">
          <div><span>Application mode</span><strong>${cloud.config.configured ? 'Hybrid cloud' : 'Operational local pilot'}</strong></div>
          <div><span>Last successful sync</span><strong>${formatSyncTime()}</strong></div>
          <div><span>Cloud account</span><strong>${esc(cloud.user?.email || 'Not signed in')}</strong></div>
          <div><span>Release</span><strong>${esc(cloud.config.release || '3.0')}</strong></div>
        </div><div class="page-actions cloud-actions">
          ${cloud.config.configured && cloud.user ? '<button class="btn btn-primary" data-cloud-action="sync">Sync now</button><button class="btn btn-outline" data-cloud-action="pull">Pull latest</button><button class="btn btn-soft" data-cloud-action="cloud-signout">Sign out cloud</button>' : ''}
          ${!cloud.config.configured ? '<button class="btn btn-outline" data-cloud-action="health">Check backend endpoint</button>' : ''}
        </div>${cloud.error ? `<div class="notice" style="margin-top:14px">${esc(cloud.error)}</div>` : ''}</div>
        <div class="card card-pad"><h4 class="card-title">Production safeguards</h4><div class="action-plan">
          <div class="action-step"><div><strong>Server-side scoring</strong><span>Student cloud payloads receive redacted questions. Correct answers remain on the server.</span></div></div>
          <div class="action-step"><div><strong>Role-filtered snapshots</strong><span>School users receive one school; students receive only their own academic record.</span></div></div>
          <div class="action-step"><div><strong>Conflict protection</strong><span>Every write includes a cloud version so stale devices cannot silently overwrite newer data.</span></div></div>
        </div></div>
      </div>
      <div class="card card-pad" style="margin-top:18px"><h4 class="card-title">Activation checklist</h4><p class="card-sub">The code is deployed now. Shared cloud mode activates when these Vercel variables point to a Supabase project where the Version 3 migration has been applied.</p><div class="env-grid"><code>SUPABASE_URL</code><code>SUPABASE_ANON_KEY</code><code>SUPABASE_SERVICE_ROLE_KEY</code></div><div class="notice blue" style="margin-top:14px">Until credentials exist, all Version 2 workflows remain available and persistent in this browser. No school pilot is blocked.</div></div>`;
  }

  function secureCloudAnalytics() {
    const s = state.db.students.find(x => x.id === (state.session?.studentId || 'st1')) || state.db.students[0];
    const attempts = state.db.attempts.filter(a => a.studentId === s.id).sort((a,b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    const a = state.db.attempts.find(x => x.id === state.lastAttemptId) || attempts[attempts.length - 1];
    if (!a) return '<div class="card card-pad empty-state">Complete an assessment to generate analytics.</div>';
    const review = a.review || [];
    const errors = review.filter(r => !r.correct);
    return `<div class="page-head"><div><span class="eyebrow">SECURE CLOUD RESULT</span><h3>Performance intelligence</h3><p>Scored on the server without delivering answer keys to the test browser.</p></div><button class="btn btn-primary" data-action="restart-test">Take another attempt</button></div>
      <div class="analytics-hero"><div><span class="badge gold">Cloud assessment complete</span><h3 style="margin-top:14px">${a.correct}/${a.total} correct • ${a.percentile}th percentile</h3><p>${a.summary || 'Your next actions are generated from topic, error and response-time evidence.'}</p></div><div class="score-ring"><div style="text-align:center"><strong>${a.score}%</strong><small>score</small></div></div></div>
      <div class="grid grid-4" style="margin-top:18px">${metric('◎',a.percentile+'th','Percentile','Server calculated')}${metric('✓',a.score+'%','Accuracy',a.score>=80?'Strong':'Developing')}${metric('◷',a.avgTime+'s','Avg response time','Captured per item')}${metric('✦',errors.length,'Priority questions','Action ready')}</div>
      <div class="grid grid-2" style="margin-top:18px"><div class="card card-pad"><h4 class="card-title">Professor’s action plan</h4><div class="action-plan">${(a.actions || ['Review each incorrect concept, complete controlled practice and retest after seven days.']).map(x=>`<div class="action-step"><div><strong>${esc(x.title || 'Learning action')}</strong><span>${esc(x.detail || x)}</span></div></div>`).join('')}</div></div>
      <div class="card"><div class="card-head"><div><h4 class="card-title">Question review</h4><p class="card-sub">Released only after submission</p></div></div><div class="list card-pad">${review.map((r,i)=>`<div class="question-review"><div class="rank">${i+1}</div><div><h4>${esc(r.topic)} ${r.correct?'✓':'— Review'}</h4><p>${esc(r.message)}</p></div></div>`).join('') || '<div class="empty-state">Review is not enabled for this assessment.</div>'}</div></div></div>`;
  }

  window.renderSuper = function() {
    if (state.page === 'cloud') return cloudOperationsPage();
    return baseRenderSuper();
  };
  window.renderAdmin = function() {
    if (state.page === 'cloud') return cloudOperationsPage();
    return baseRenderAdmin();
  };
  window.renderStudent = function() {
    if (state.page === 'analytics' && cloud.user && cloud.config.configured) return secureCloudAnalytics();
    return baseRenderStudent();
  };

  function enhanceDom() {
    const [label, cls] = cloudLabel();
    const topActions = document.querySelector('.topbar .top-actions:last-child');
    if (topActions && !document.querySelector('.cloud-pill')) {
      topActions.insertAdjacentHTML('afterbegin', `<button class="cloud-pill ${cls}" data-page="cloud">${label}</button>`);
    }
    const footer = document.querySelector('.sidebar-footer');
    if (footer) footer.innerHTML = `Version 3.0 Hybrid Cloud<br>Server scoring • Tenant filtering<br><br>${cloud.config.configured ? 'Cloud backend detected.' : 'Local pilot remains active.'}`;

    const loginPanel = document.querySelector('.login-panel');
    if (loginPanel && !document.getElementById('cloudLoginPanel')) {
      const content = cloud.config.configured ? `
        <div id="cloudLoginPanel" class="cloud-login-panel"><div class="cloud-login-head"><div><strong>Production cloud account</strong><span>Shared across devices and schools</span></div><span class="cloud-pill ${cls}">${label}</span></div>
        <form id="cloudLoginForm" class="login-form"><div class="field"><label>Email</label><input class="input" type="email" name="email" required></div><div class="field"><label>Password</label><input class="input" type="password" name="password"></div><div class="cloud-login-buttons"><button class="btn btn-primary">Sign in to cloud</button><button type="button" class="btn btn-outline" data-cloud-action="magic">Email magic link</button></div></form></div>` : `
        <div id="cloudLoginPanel" class="cloud-login-panel"><div class="cloud-login-head"><div><strong>Version 3 cloud layer deployed</strong><span>Environment credentials are not configured yet</span></div><span class="cloud-pill local">Local pilot</span></div><p>The current demo accounts and all operational workflows continue to work. Apply the Supabase migration and add the three Vercel variables to activate shared multi-device data.</p></div>`;
      loginPanel.querySelector('.notice')?.insertAdjacentHTML('beforebegin', content);
    }
  }

  window.render = function() {
    baseRender();
    enhanceDom();
  };

  function reloadStateFromStorage() {
    try {
      state.db = JSON.parse(localStorage.getItem('scholaros-v2-db')) || state.db;
      state.session = JSON.parse(localStorage.getItem('scholaros-v2-session')) || state.session;
      if (state.session?.role) state.role = state.session.role;
    } catch (_error) {}
  }

  async function cloudSignIn(form) {
    const data = new FormData(form);
    try {
      await cloud.signIn(String(data.get('email')), String(data.get('password')));
      reloadStateFromStorage();
      state.page = 'dashboard';
      render();
    } catch (error) { alert(error.message); }
  }

  async function submitCloudAttempt() {
    const assessment = state.db.assessments.find(a => a.id === state.activeAssessmentId);
    if (!assessment) return alert('Assessment is unavailable.');
    const unanswered = assessment.questionIds.filter(id => state.answers[id] === undefined);
    if (unanswered.length && !confirm(`${unanswered.length} questions are unanswered. Submit anyway?`)) return;
    try {
      const result = await cloud.submitAttempt({
        assessmentId: assessment.id,
        answers: state.answers,
        times: state.answerTimes,
        baseVersion: Number(localStorage.getItem('scholaros-cloud-version') || 0)
      });
      reloadStateFromStorage();
      state.lastAttemptId = result.attempt.id;
      state.testComplete = true;
      state.page = 'analytics';
      render();
    } catch (error) { alert(error.message); }
  }

  window.bind = function() {
    baseBind();
    const cloudForm = document.getElementById('cloudLoginForm');
    if (cloudForm) cloudForm.onsubmit = event => { event.preventDefault(); cloudSignIn(cloudForm); };

    document.querySelectorAll('[data-cloud-action]').forEach(el => el.onclick = async () => {
      const action = el.dataset.cloudAction;
      try {
        if (action === 'sync') await cloud.push();
        if (action === 'pull') await cloud.pull();
        if (action === 'cloud-signout') await cloud.signOut();
        if (action === 'magic') {
          const email = document.querySelector('#cloudLoginForm [name="email"]')?.value;
          if (!email) return alert('Enter an email address first.');
          await cloud.sendMagicLink(email); alert('Magic-link email requested.');
        }
        if (action === 'health') {
          const health = await fetch('/api/health', { cache: 'no-store' }).then(r => r.json());
          alert(`Backend mode: ${health.mode}. ${health.message}`);
        }
        reloadStateFromStorage(); render();
      } catch (error) { alert(error.message); }
    });

    if (cloud.user && cloud.config.configured && state.role === 'student') {
      document.querySelectorAll('[data-v2-test="submit"]').forEach(el => {
        el.onclick = event => { event.preventDefault(); submitCloudAttempt(); };
      });
    }
  };

  window.addEventListener('scholaros-db-changed', () => {
    if (!cloud.user || !cloud.config.configured || cloud.status === 'syncing') return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => cloud.push().catch(() => {}), 1200);
  });
  ['scholar-cloud-ready','scholar-cloud-auth-changed','scholar-cloud-status'].forEach(eventName => {
    window.addEventListener(eventName, () => render());
  });

  render();
})();
