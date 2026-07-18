function render(){
  const cfg=roleConfig[state.role];
  document.getElementById('app').innerHTML=`
  <div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><div class="brand-mark">S</div><div><h1>ScholarOS</h1><p>Student Intelligence Platform</p></div></div>
      <div class="role-switcher"><label>VIEW PRODUCT AS</label><select id="roleSelect">${Object.entries(roleConfig).map(([k,v])=>`<option value="${k}" ${state.role===k?'selected':''}>${v.label}</option>`).join('')}</select></div>
      <div class="nav-group-title">Workspace</div>
      ${cfg.nav.map(([id,label,icon])=>`<button class="nav-btn ${state.page===id?'active':''}" data-page="${id}"><span class="nav-icon">${icon}</span>${label}</button>`).join('')}
      <div class="nav-group-title">Platform</div>
      <button class="nav-btn" data-modal="demo"><span class="nav-icon">◉</span>Demo data guide</button>
      <button class="nav-btn" data-modal="privacy"><span class="nav-icon">⚿</span>Data principles</button>
      <div class="sidebar-footer">Version 1.0 Pilot<br>Grades 8–12 • CBT • Analytics<br><br>Built for schools, teachers, parents and students.</div>
    </aside>
    <main class="main">
      <header class="topbar"><div class="top-actions"><button class="btn btn-outline mobile-menu" id="menuBtn">☰</button><div class="topbar-title"><h2>${cfg.label}</h2><p>${cfg.subtitle}</p></div></div><div class="top-actions"><button class="btn btn-outline btn-sm" data-modal="quick">＋ Quick action</button><div class="avatar">HS</div></div></header>
      <section class="content">${renderPage()}</section>
    </main>
  </div>${renderModal()}`;
  bind();
}

function renderPage(){
  if(state.role==='student') return renderStudent();
  if(state.role==='school') return renderSchool();
  if(state.role==='admin') return renderAdmin();
  return renderSuper();
}

