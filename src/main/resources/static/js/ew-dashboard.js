/**
 * Core Entertainment World Casting Company Dashboard Controller.
 * Preserves all existing dashboard flows and adds Overview KPIs & charts,
 * Actor Profile Verification & Multi-field Search, Full Project Edit/Pause/Close/Delete,
 * Application Review (Accept/Shortlist/Backup/Reject + Ratings & Comments), and AI Match Scoring.
 */
(() => {
  const state = {
    overview: null,
    activeSection: 'dashboard',
    selectedArtistIds: new Set(),
    appProjectId: null,
    appTab: 'ALL',
    appRole: 'ALL',
    myFolderId: 0,
    recTier: 'PLATINUM',
    txViewType: 'CONTACT_VIEW',
    txTier: 'PAID',
    txSort: 'RECENT',
    showPurchaseHistory: false,
    cachedSearchArtists: [],
    cachedProjects: []
  };

  function closeModal(id) {
    document.getElementById(id).classList.remove('open');
  }
  window.closeModal = closeModal;

  function closeArtistModal() {
    const vid = document.querySelector('#am-body video');
    if (vid) vid.pause();
    closeModal('artist-modal');
  }
  window.closeArtistModal = closeArtistModal;

  function showLoading(label = 'Loading...') {
    document.getElementById('dash-view').innerHTML = `
      <div class="card" style="padding:48px; text-align:center;">
        <div class="ew-loader" style="margin-bottom:10px;"></div>
        <div style="font-weight:700;">${EW.esc(label)}</div>
      </div>`;
  }

  async function refreshOverview() {
    try {
      const ov = await EW.api('/api/dashboard/overview');
      state.overview = ov;
      const c = ov.company;
      document.getElementById('hdr-studio-badge').innerHTML = `
        <span>${EW.esc(c.companyName)}</span>
        ${c.verifiedBadge ? '<span class="blue-tick" title="Verified by Entertainment World">✓</span>' : ''}`;
      document.getElementById('notif-badge').textContent = ov.unreadNotifications;
      renderNotificationsDropdown();
      return ov;
    } catch (err) {
      if (err.status === 401) window.location.href = '/login.html';
      else if (err.status === 403) window.location.href = '/company-status.html';
      else if (err.status === 402) window.location.href = '/passes.html';
      else EW.toast(err.message, 'error');
      throw err;
    }
  }

  function renderNotificationsDropdown() {
    const notifs = (state.overview && state.overview.notifications) || [];
    const panel = document.getElementById('notif-panel');
    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <strong>Notifications</strong>
        <button type="button" onclick="markAllRead()" class="btn btn-outline-dark btn-sm" style="padding:3px 9px; font-size:0.72rem;">Mark read</button>
      </div>
      ${notifs.length ? notifs.map(n => `
        <div style="padding:9px; border-radius:10px; margin-bottom:6px; background:${n.readFlag ? '#FAF7F2' : '#FDF0F3'}; font-size:0.82rem;">
          <div style="font-weight:700;">${EW.esc(n.title)}</div>
          <div style="color:var(--text-body);">${EW.esc(n.message)}</div>
        </div>`).join('') : '<div style="color:var(--text-muted); font-size:0.84rem;">No notifications yet.</div>'}`;
  }

  window.toggleNotifications = () => {
    document.getElementById('notif-panel').classList.toggle('open');
  };

  window.markAllRead = async () => {
    await EW.api('/api/dashboard/notifications/read-all', { method: 'POST' });
    await refreshOverview();
  };

  window.switchSection = async (sec) => {
    state.activeSection = sec;
    state.selectedArtistIds.clear();
    document.querySelectorAll('.side-link').forEach(b => b.classList.toggle('active', b.dataset.sec === sec));
    document.getElementById('dash-sidebar').classList.remove('mobile-open');

    if (sec === 'dashboard') await renderDashboardHome();
    else if (sec === 'post-project') renderPostProject();
    else if (sec === 'projects') await renderProjects();
    else if (sec === 'applications') await renderApplications();
    else if (sec === 'auditions') await EWOps.renderAuditions();
    else if (sec === 'selection') await EWOps.renderShortlistSelection();
    else if (sec === 'my-artists') await renderMyArtists();
    else if (sec === 'search') await renderSearchArtists();
    else if (sec === 'recommended') await renderRecommended();
    else if (sec === 'messages') await EWOps.renderMessagesCenter();
    else if (sec === 'reports') await EWOps.renderReports();
    else if (sec === 'team') await EWOps.renderTeam();
    else if (sec === 'contracts') await EWOps.renderContractsAndExpenses();
    else if (sec === 'package') await renderPackagesSection();
    else if (sec === 'transactions') await renderTransactions();
  };

  // ================= 1. DASHBOARD OVERVIEW (KPIs + CHARTS + PROFILE) =================
  async function renderDashboardHome() {
    showLoading('Loading Casting Overview...');
    const ov = await refreshOverview();
    const c = ov.company;
    const k = ov.kpis || {};
    const charts = ov.chartData || {};
    const statusMap = charts.applicationsByStatus || {};
    const catMap = charts.actorsByCategory || {};
    const monthMap = charts.monthlyActivity || {};

    let videos = [];
    let photos = [];
    try { videos = JSON.parse(c.showreelVideosJson || '[]'); } catch (_) {}
    try { photos = JSON.parse(c.portfolioPhotosJson || '[]'); } catch (_) {}

    const maxStatus = Math.max(1, ...Object.values(statusMap));
    const maxCat = Math.max(1, ...Object.values(catMap));
    const monthEntries = Object.entries(monthMap);

    document.getElementById('dash-view').innerHTML = `
      <div class="card" style="padding:14px 18px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; background:var(--gold-soft);">
        <div>
          <strong>🔔 Latest Update:</strong>
          ${ov.notifications.length ? EW.esc(ov.notifications[0].title + ' — ' + ov.notifications[0].message) : 'Welcome to your Entertainment World Casting Company Dashboard!'}
        </div>
        <span class="badge badge-paid">${EW.esc(c.activePassName)} · Expires ${EW.esc(c.subscriptionExpiry)}</span>
      </div>

      <!-- 6 Key Metrics Cards -->
      <div class="kpi-grid-6">
        <div class="kpi-tile" onclick="switchSection('search')">
          <div class="kpi-lbl">Registered Actors</div>
          <div class="kpi-val">${k.totalRegisteredActors ?? 0}</div>
          <div style="font-size:0.75rem; color:var(--emerald); font-weight:700;">${k.verifiedActorsCount ?? 0} Verified</div>
        </div>
        <div class="kpi-tile" onclick="switchSection('projects')">
          <div class="kpi-lbl">Active Projects</div>
          <div class="kpi-val" style="color:var(--crimson);">${k.activeCastingProjects ?? ov.activeProjectsCount}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${k.totalCastingProjects ?? 0} total posted</div>
        </div>
        <div class="kpi-tile" onclick="switchSection('applications')">
          <div class="kpi-lbl">Total Applications</div>
          <div class="kpi-val">${k.totalApplications ?? 0}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">Across all calls</div>
        </div>
        <div class="kpi-tile" onclick="switchSection('auditions')">
          <div class="kpi-lbl">Upcoming Auditions</div>
          <div class="kpi-val">${k.upcomingAuditions ?? 0}</div>
          <div style="font-size:0.75rem; color:var(--crimson-dark); font-weight:700;">Manage schedule →</div>
        </div>
        <div class="kpi-tile" onclick="switchSection('selection')">
          <div class="kpi-lbl">Shortlisted</div>
          <div class="kpi-val">${k.shortlistedActors ?? 0}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${k.backupActors ?? 0} on backup list</div>
        </div>
        <div class="kpi-tile" onclick="switchSection('selection')">
          <div class="kpi-lbl">Selected Actors</div>
          <div class="kpi-val" style="color:var(--emerald);">${k.selectedActors ?? 0}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${k.contractsCount ?? 0} contracts</div>
        </div>
      </div>

      <!-- Statistics & Charts -->
      <div class="charts-row">
        <div class="chart-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="font-size:1rem;">Application Funnel</h3>
            <button class="btn btn-outline-dark btn-sm" onclick="switchSection('applications')">Review →</button>
          </div>
          ${Object.entries(statusMap).map(([st, cnt]) => `
            <div class="bar-row">
              <div class="bar-lbl">${EW.esc(st)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${Math.round((cnt / maxStatus) * 100)}%; background:${st === 'SELECTED' ? 'var(--emerald)' : st === 'REJECTED' ? '#94A3B8' : 'var(--crimson)'};"></div></div>
              <strong class="mono">${cnt}</strong>
            </div>`).join('')}
        </div>

        <div class="chart-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="font-size:1rem;">Monthly Casting Activity</h3>
            <button class="btn btn-outline-dark btn-sm" onclick="switchSection('reports')">Reports →</button>
          </div>
          <div style="display:grid; grid-template-columns:repeat(${Math.max(1, monthEntries.length)}, 1fr); gap:10px; align-items:end; height:150px; padding-top:14px;">
            ${monthEntries.map(([lbl, vals]) => {
              const total = (vals.projects || 0) + (vals.applications || 0) + (vals.auditions || 0);
              const hPct = Math.min(100, Math.max(12, total * 8));
              return `
                <div style="display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end;">
                  <div class="mono" style="font-size:0.72rem; font-weight:800; margin-bottom:4px;">${total}</div>
                  <div style="width:32px; height:${hPct}%; border-radius:8px 8px 0 0; background:linear-gradient(180deg, var(--crimson), var(--gold));"></div>
                  <div style="font-size:0.7rem; color:var(--text-muted); margin-top:6px; font-weight:700;">${EW.esc(lbl)}</div>
                </div>`;
            }).join('')}
          </div>
        </div>

        <div class="chart-card">
          <h3 style="font-size:1rem; margin-bottom:12px;">Actors by Category</h3>
          ${Object.entries(catMap).slice(0, 6).map(([cat, cnt]) => `
            <div class="bar-row">
              <div class="bar-lbl">${EW.esc(cat)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${Math.round((cnt / maxCat) * 100)}%; background:var(--bg-obsidian);"></div></div>
              <strong class="mono">${cnt}</strong>
            </div>`).join('')}
        </div>
      </div>

      <!-- Verified Studio Profile Card -->
      <div class="profile-hero">
        <div style="display:flex; gap:18px; align-items:flex-start; flex:1; min-width:280px;">
          <img src="${EW.esc(c.companyLogoPath)}" alt="Company Logo" class="profile-logo">
          <div>
            <div style="display:flex; align-items:center; gap:9px; flex-wrap:wrap;">
              <h2 style="font-size:1.55rem;">${EW.esc(c.companyName)}</h2>
              ${c.verifiedBadge ? '<span class="blue-tick" title="Verified by Entertainment World Super Admin">✓</span><span class="badge badge-approved">Verified Casting Studio</span>' : ''}
            </div>
            <div style="color:var(--text-muted); font-size:0.88rem; margin:4px 0 10px;">
              ${EW.esc(c.organizationType || 'Casting Studio')} · 📍 ${EW.esc(c.city)}, ${EW.esc(c.state)}
            </div>
            <div style="display:flex; gap:18px; flex-wrap:wrap; font-size:0.86rem;">
              <div><strong class="mono">${c.followersCount}</strong> Followers</div>
              <div><strong class="mono" style="color:var(--crimson);">${ov.activeProjectsCount} Active projects</strong></div>
              <div><strong class="mono">${ov.profilesViewedCount}</strong> Profiles viewed</div>
              <div>📞 <strong>${EW.esc(c.contactNumber)}</strong></div>
              <div>✉️ <strong>${EW.esc(c.companyEmail)}</strong></div>
            </div>
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap;">
          <button type="button" onclick="openEditProfileModal()" class="btn btn-outline-dark btn-sm">✏️ EDIT PROFILE</button>
          <button type="button" onclick="switchSection('post-project')" class="btn btn-primary btn-sm">+ Post A Project</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1.1fr 1fr 1fr; gap:20px; align-items:start;">
        <div class="card" style="padding:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3>Recent Activities</h3>
            <button type="button" onclick="switchSection('messages')" class="btn btn-outline-dark btn-sm">Messages</button>
          </div>
          ${(ov.recentActivities || []).map(act => `
            <div style="padding:10px; border-bottom:1px solid var(--border-light); font-size:0.84rem;">
              <div style="display:flex; justify-content:space-between; gap:6px;">
                <strong>${EW.esc(act.title)}</strong>
                <span class="badge badge-neutral" style="font-size:0.65rem;">${EW.esc(act.type)}</span>
              </div>
              <div style="color:var(--text-muted); font-size:0.78rem;">${EW.esc(act.detail)}</div>
            </div>`).join('') || '<div style="color:var(--text-muted);">No recent activity yet.</div>'}
        </div>

        <div class="card" style="padding:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3>Showreels &amp; Photos</h3>
            <span class="badge badge-neutral">${videos.length} Videos</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
            ${videos.map(v => `
              <div style="border-radius:12px; overflow:hidden; border:1px solid var(--border-light); cursor:pointer;" onclick="playVideoModal('${EW.esc(v.url)}', '${EW.esc(v.title)}')">
                <div style="position:relative; height:90px; background:#14131B;">
                  <img src="${EW.esc(v.thumb || '/assets/images/welcome-poster.jpg')}" style="width:100%; height:100%; object-fit:cover; opacity:0.82;">
                  <div style="position:absolute; inset:0; display:grid; place-items:center;"><span style="width:32px; height:32px; border-radius:50%; background:var(--crimson); color:#FFF; display:grid; place-items:center; font-size:0.8rem;">▶</span></div>
                </div>
                <div style="padding:6px 8px; font-weight:700; font-size:0.76rem;">${EW.esc(v.title)}</div>
              </div>`).join('')}
          </div>
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px;">
            ${photos.map(ph => `<img src="${EW.esc(ph)}" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:8px;">`).join('')}
          </div>
        </div>

        <div class="card" style="padding:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3>Posted Projects</h3>
            <button type="button" onclick="switchSection('projects')" class="btn btn-outline-dark btn-sm">View All</button>
          </div>
          ${(ov.recentProjects || []).map(p => `
            <div style="padding:11px; border:1px solid var(--border-light); border-radius:12px; margin-bottom:10px;">
              <div style="font-weight:800; font-size:0.88rem;">${EW.esc(p.projectTitle)}</div>
              <div style="font-size:0.76rem; color:var(--text-muted); margin:3px 0 8px;">${EW.esc(p.status)} · ${p.applicationsCount} Applications</div>
              <div style="display:flex; gap:6px;">
                <button type="button" onclick="openProjectApplications(${p.id})" class="btn btn-dark btn-sm" style="padding:4px 9px; font-size:0.72rem;">Apps</button>
                <button type="button" onclick="openProjectBriefModal(${p.id})" class="btn btn-outline-dark btn-sm" style="padding:4px 9px; font-size:0.72rem;">Brief</button>
              </div>
            </div>`).join('') || '<p style="color:var(--text-muted);">No projects posted yet.</p>'}
        </div>
      </div>`;
  }

  window.playVideoModal = (url, title) => {
    document.getElementById('am-title').textContent = title || 'Video Preview';
    document.getElementById('am-body').innerHTML = `<video controls autoplay style="width:100%; border-radius:14px; background:#000;" src="${EW.esc(url)}"></video>`;
    document.getElementById('artist-modal').classList.add('open');
  };

  window.openEditProfileModal = () => {
    const c = state.overview.company;
    document.getElementById('ep-rep').value = c.representativeName || '';
    document.getElementById('ep-phone').value = c.contactNumber || '';
    document.getElementById('ep-city').value = c.city || '';
    document.getElementById('ep-web').value = c.website || '';
    document.getElementById('ep-looking').value = c.talentSought || '';
    document.getElementById('ep-desc').value = c.companyDescription || '';
    document.getElementById('edit-profile-modal').classList.add('open');
  };

  document.getElementById('edit-profile-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await EW.api('/api/dashboard/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        representativeName: document.getElementById('ep-rep').value,
        contactNumber: document.getElementById('ep-phone').value,
        city: document.getElementById('ep-city').value,
        website: document.getElementById('ep-web').value,
        talentSought: document.getElementById('ep-looking').value,
        companyDescription: document.getElementById('ep-desc').value
      })
    });
    closeModal('edit-profile-modal');
    EW.toast('Recruiter profile updated!');
    renderDashboardHome();
  });

  // ================= 2. POST PROJECT (8-SECTION CASTING BRIEF + MEDIA) =================
  function renderPostProject() {
    const c = state.overview.company;
    const secHead = (num, title, subtitle) => `
      <div id="pp-sec-${num}" style="grid-column:span 2; margin-top:14px; padding:10px 14px; background:var(--bg-ivory); border-left:4px solid var(--crimson); border-radius:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <strong style="font-size:1rem; color:var(--bg-obsidian);">${num}. ${title}</strong>
        <span style="font-size:0.76rem; color:var(--text-muted); font-weight:600;">${subtitle}</span>
      </div>`;

    document.getElementById('dash-view').innerHTML = `
      <div style="display:grid; grid-template-columns:1.65fr 0.75fr; gap:22px; align-items:start;">
        <div class="card" style="padding:28px;">
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid var(--border-light); font-size:0.78rem; font-weight:700;">
            ${[
              [1, '1. Basic Info'], [2, '2. Talent'], [3, '3. Location & Schedule'], [4, '4. Payment'],
              [5, '5. Audition'], [6, '6. Application'], [7, '7. Contact'], [8, '8. Media']
            ].map(([n, lbl]) => `<a href="#pp-sec-${n}" class="badge badge-neutral" style="text-decoration:none;">${lbl}</a>`).join('')}
          </div>
          <h2 style="margin-bottom:6px;">Add Your Project Details</h2>
          <p style="margin:0 0 18px; color:var(--text-muted); font-size:0.88rem;">Complete all 8 casting post sections below to publish a verified brief with media and script attachments.</p>

          <form id="post-project-form" enctype="multipart/form-data">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
              ${secHead(1, 'Basic Project Information', 'Required')}
              <div style="grid-column:span 2;"><label class="form-label">Project title <span class="req">*</span></label><input class="form-control" name="projectTitle" required placeholder="e.g. Royal Horizon Feature Film"></div>
              <div><label class="form-label">Project type <span class="req">*</span></label>
                <select class="form-select" name="projectType" required><option>Movie</option><option>Short Film</option><option>Web Series</option><option>TV Serial</option><option>Advertisement</option><option>Music Video</option><option>Photoshoot</option><option>Casting Call</option><option>Audition</option><option>Event</option><option>Freelance Project</option></select>
              </div>
              <div><label class="form-label">Project language <span class="req">*</span></label>
                <select class="form-select" name="projectLanguage" required><option>Kannada</option><option>Tamil</option><option>Telugu</option><option>Hindi</option><option>English</option><option>Malayalam</option><option>Marathi</option><option>Bengali</option><option>Punjabi</option><option>Multi-lingual</option></select>
              </div>
              <div><label class="form-label">Production house / Banner name <span class="req">*</span></label><input class="form-control" name="productionHouseName" required placeholder="e.g. Starlight Pictures Banner"></div>
              <div><label class="form-label">Casting company name <span class="req">*</span></label><input class="form-control" name="castingCompanyName" required value="${EW.esc(c.companyName)}"></div>
              <div><label class="form-label">Project status <span class="req">*</span></label>
                <select class="form-select" name="projectStage" required><option>Pre-production</option><option selected>Casting Open</option><option>Shooting Started</option></select>
              </div>
              <div><label class="form-label">Tags <span class="opt">(Optional)</span></label><input class="form-control" name="tags" placeholder="e.g. ott, lead, drama"></div>
              <div style="grid-column:span 2;"><label class="form-label">Project description <span class="req">*</span></label><textarea class="form-textarea" name="projectDetails" required placeholder="Describe story premise, production scale, shooting schedule..."></textarea></div>

              ${secHead(2, 'Talent Requirements', 'Role & Artist Criteria')}
              <div><label class="form-label">Required talent <span class="req">*</span></label>
                <select class="form-select" name="targetCategory" required><option>Actor</option><option>Actress</option><option>Model</option><option>Dancer</option><option>Singer</option><option>Child Artist</option><option>Supporting Artist</option><option>Voice-over Artist</option><option>Stand-up Comedian</option><option>Musician</option><option>Writer</option><option>Photographer</option><option>Filmmaker</option></select>
              </div>
              <div><label class="form-label">Gender <span class="req">*</span></label>
                <select class="form-select" name="targetGender" required><option>Any</option><option>Male</option><option>Female</option></select>
              </div>
              <div><label class="form-label">Age range (Min – Max) <span class="req">*</span></label>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                  <input type="number" class="form-control" name="ageMin" min="1" max="90" value="18" required>
                  <input type="number" class="form-control" name="ageMax" min="1" max="95" value="25" required>
                </div>
              </div>
              <div><label class="form-label">Height <span class="opt">(Optional)</span></label><input class="form-control" name="heightRequirement" placeholder="e.g. 5'6&quot; - 6'0&quot;"></div>
              <div><label class="form-label">Preferred appearance <span class="req">*</span></label><input class="form-control" name="preferredAppearance" required placeholder="e.g. Expressive screen presence"></div>
              <div><label class="form-label">Experience <span class="req">*</span></label>
                <select class="form-select" name="experienceLevel" required><option>Fresher</option><option>Experienced</option><option selected>Both</option></select>
              </div>
              <div><label class="form-label">Number of artists required <span class="req">*</span></label><input type="number" class="form-control" name="artistsRequiredCount" min="1" value="1" required></div>
              <div><label class="form-label">Character name <span class="opt">(Optional)</span></label><input class="form-control" name="characterName" placeholder="e.g. Arjun"></div>
              <div style="grid-column:span 2;"><label class="form-label">Role description <span class="req">*</span></label><textarea class="form-textarea" name="roleDescription" required placeholder="Describe character arc, skills, dialect..."></textarea></div>

              ${secHead(3, 'Project Location and Schedule', 'Dates & Availability')}
              <div><label class="form-label">Shooting location <span class="req">*</span></label><input class="form-control" name="location" required value="${EW.esc(c.city)}"></div>
              <div><label class="form-label">Audition location <span class="req">*</span></label><input class="form-control" name="auditionLocation" required placeholder="e.g. Online / Studio Hub"></div>
              <div><label class="form-label">Audition date <span class="req">*</span></label><input type="date" class="form-control" name="auditionDate" required></div>
              <div><label class="form-label">Audition type <span class="req">*</span></label><select class="form-select" name="auditionType" required><option>Online</option><option>Offline</option></select></div>
              <div><label class="form-label">Shooting start date <span class="req">*</span></label><input type="date" class="form-control" name="shootingStartDate" required></div>
              <div><label class="form-label">Shooting end date <span class="opt">(Optional)</span></label><input type="date" class="form-control" name="shootingEndDate"></div>
              <div><label class="form-label">Shooting duration <span class="req">*</span></label><input class="form-control" name="shootingDuration" required placeholder="e.g. 20 Days"></div>
              <div><label class="form-label">Schedule type</label><select class="form-select" name="durationType"><option>Full-Time</option><option>Part-Time</option><option>Date-specific</option></select></div>
              <div style="grid-column:span 2;"><label class="form-label">Availability requirements <span class="req">*</span></label><input class="form-control" name="availabilityRequirements" required placeholder="e.g. Full-day shoot schedule"></div>

              ${secHead(4, 'Payment Details', 'Compensation & Logistics')}
              <div><label class="form-label">Payment type <span class="req">*</span></label><select class="form-select" name="paymentType" required><option>Paid</option><option>Unpaid</option></select></div>
              <div><label class="form-label">Salary / Compensation <span class="req">*</span></label><input class="form-control" name="budget" required placeholder="e.g. Rs. 25,000"></div>
              <div><label class="form-label">Payment basis <span class="req">*</span></label><select class="form-select" name="paymentBasis" required><option>Per day</option><option>Per project</option><option>Per episode</option></select></div>
              <div><label class="form-label">Accommodation provided <span class="req">*</span></label><select class="form-select" name="accommodationProvided" required><option>Yes</option><option>No</option></select></div>
              <div><label class="form-label">Food provided <span class="req">*</span></label><select class="form-select" name="foodProvided" required><option>Yes</option><option>No</option></select></div>
              <div><label class="form-label">Travel expenses covered <span class="req">*</span></label><select class="form-select" name="travelExpensesCovered" required><option>Yes</option><option>No</option></select></div>

              ${secHead(5, 'Audition Details', 'Process & Instructions')}
              <div style="grid-column:span 2;"><label class="form-label">Audition process <span class="req">*</span></label><input class="form-control" name="auditionProcess" required placeholder="e.g. Self-tape screening + Look test"></div>
              <div style="grid-column:span 2;"><label class="form-label">Audition instructions <span class="req">*</span></label><textarea class="form-textarea" name="auditionInstructions" required placeholder="Framing & lighting instructions..."></textarea></div>
              <div><label class="form-label">Self-introduction video required <span class="req">*</span></label><select class="form-select" name="selfIntroVideoRequired" required><option>Yes</option><option>No</option></select></div>
              <div><label class="form-label">Portfolio required <span class="req">*</span></label><select class="form-select" name="portfolioRequired" required><option>Yes</option><option>No</option></select></div>
              <div><label class="form-label">Last date to apply <span class="req">*</span></label><input type="date" class="form-control" name="lastDateToApply" required></div>
              <div style="display:flex; align-items:flex-end; padding-bottom:10px;"><label style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.86rem;"><input type="checkbox" name="onlineAuditionEnabled" value="true" checked> Accept Online Video Auditions</label></div>
              <div style="grid-column:span 2;"><label class="form-label">Audition script / Dialogue <span class="opt">(Optional)</span></label><textarea class="form-textarea" name="auditionScript" placeholder="Paste audition script lines..."></textarea></div>

              ${secHead(6, 'Application Requirements', 'What Artists Must Submit')}
              <div><label class="form-label">Required photographs <span class="req">*</span></label><input class="form-control" name="requiredPhotographs" required placeholder="e.g. 2 Headshots + 1 Full-length"></div>
              <div><label class="form-label">Introduction video <span class="req">*</span></label><input class="form-control" name="introVideoRequirement" required placeholder="e.g. 30-45 sec slate"></div>
              <div><label class="form-label">Acting portfolio <span class="req">*</span></label><input class="form-control" name="actingPortfolioRequirement" required placeholder="e.g. PDF portfolio or reel"></div>
              <div><label class="form-label">Previous work links <span class="req">*</span></label><input class="form-control" name="previousWorkLinksReq" required placeholder="e.g. YouTube / IMDb link"></div>
              <div><label class="form-label">Contact information <span class="req">*</span></label><input class="form-control" name="applicantContactReq" required placeholder="e.g. Phone, WhatsApp & Email"></div>
              <div><label class="form-label">Additional documents <span class="opt">(Optional)</span></label><input class="form-control" name="additionalDocumentsReq" placeholder="e.g. Passport / NOC"></div>

              ${secHead(7, 'Contact Information', 'Casting Desk Details')}
              <div><label class="form-label">Casting director name <span class="req">*</span></label><input class="form-control" name="castingDirectorName" required value="${EW.esc(c.representativeName)}"></div>
              <div><label class="form-label">Official email <span class="req">*</span></label><input type="email" class="form-control" name="contactEmail" required value="${EW.esc(c.companyEmail)}"></div>
              <div><label class="form-label">Contact number <span class="req">*</span></label><input type="tel" class="form-control" name="contactNumber" required value="${EW.esc(c.contactNumber)}"></div>
              <div><label class="form-label">WhatsApp number <span class="req">*</span></label><input type="tel" class="form-control" name="whatsappNumber" required value="${EW.esc(c.contactNumber)}"></div>
              <div style="grid-column:span 2;"><label class="form-label">Website / Social media links <span class="opt">(Optional)</span></label><input class="form-control" name="websiteOrSocialLinks" value="${EW.esc(c.website || '')}"></div>

              ${secHead(8, 'Media and Attachments', 'Posters, Looks & Script PDF')}
              <div><label class="form-label">Project poster</label><input type="file" class="form-control" name="projectPoster" accept="image/*"></div>
              <div><label class="form-label">Project promotional image</label><input type="file" class="form-control" name="projectPromotionalImage" accept="image/*"></div>
              <div><label class="form-label">Reference images</label><input type="file" class="form-control" name="referenceImages" accept="image/*" multiple></div>
              <div><label class="form-label">Character look references</label><input type="file" class="form-control" name="characterLookReferences" accept="image/*" multiple></div>
              <div style="grid-column:span 2;"><label class="form-label">Audition script PDF</label><input type="file" class="form-control" name="auditionScriptPdf" accept=".pdf,.doc,.docx,image/*"></div>
            </div>

            <div style="display:flex; justify-content:flex-end; margin-top:22px;">
              <button type="submit" id="publish-project-btn" class="btn btn-primary" style="padding:13px 28px;">Publish Casting Call →</button>
            </div>
          </form>
        </div>

        <div class="card" style="padding:22px; position:sticky; top:90px;">
          <h3 style="margin-bottom:12px;">Posted Projects</h3>
          ${(state.overview.recentProjects || []).map(p => `
            <div style="padding:12px; border:1px solid var(--border-light); border-radius:12px; margin-bottom:10px; cursor:pointer;" onclick="openProjectBriefModal(${p.id})">
              <div style="font-weight:700;">${EW.esc(p.projectTitle)}</div>
              <div style="font-size:0.78rem; color:var(--text-muted);">${EW.esc(p.projectType)} · ${EW.esc(p.projectLanguage || '')} · ${p.applicationsCount} apps</div>
            </div>`).join('')}
        </div>
      </div>`;

    document.getElementById('post-project-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = document.getElementById('publish-project-btn');
      btn.disabled = true;
      btn.textContent = 'Publishing Casting Call...';
      try {
        const fd = new FormData(ev.target);
        if (!fd.has('onlineAuditionEnabled')) fd.set('onlineAuditionEnabled', 'false');
        await EW.api('/api/dashboard/projects', { method: 'POST', body: fd });
        EW.toast('Casting project published!');
        await refreshOverview();
        switchSection('projects');
      } catch (err) {
        EW.toast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Publish Casting Call →';
      }
    });
  }

  // ================= 3. CASTING PROJECT MANAGEMENT (EDIT / PAUSE / CLOSE / DELETE) =================
  async function renderProjects(filter = 'ALL') {
    showLoading('Loading Casting Projects...');
    const projects = await EW.api(`/api/dashboard/projects?filter=${encodeURIComponent(filter)}`);
    state.cachedProjects = projects;
    document.getElementById('dash-view').innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:12px;">
        <div>
          <h2>Casting Project Management</h2>
          <p style="margin:4px 0 0; color:var(--text-muted); font-size:0.88rem;">Create, edit, publish, pause, close, promote, share, or delete your casting calls.</p>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <select class="form-select" style="width:160px;" onchange="renderProjectsFilter(this.value)">
            ${['ALL', 'ACTIVE', 'PAUSED', 'CLOSED', 'PROMOTED'].map(f => `<option value="${f}" ${filter === f ? 'selected' : ''}>Filter: ${f}</option>`).join('')}
          </select>
          <button type="button" onclick="switchSection('post-project')" class="btn btn-primary btn-sm">+ Post Project</button>
        </div>
      </div>
      ${projects.map(p => `
        <div class="card" style="padding:24px; margin-bottom:16px;">
          <div style="display:grid; grid-template-columns:1.7fr 0.85fr; gap:18px;">
            <div>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
                <span class="badge ${EW.badgeClass(p.status === 'ACTIVE' ? 'approved' : p.status === 'PAUSED' ? 'pending' : 'rejected')}">${EW.esc(p.status)}</span>
                <span class="badge badge-neutral">${EW.esc(p.projectType)}</span>
                <span class="badge badge-neutral">${EW.esc(p.targetCategory)}</span>
                ${p.projectLanguage ? `<span class="badge badge-neutral">${EW.esc(p.projectLanguage)}</span>` : ''}
                ${p.promoted ? '<span class="badge badge-showcase">★ PROMOTED</span>' : ''}
              </div>
              <h3 style="font-size:1.35rem; margin-bottom:6px;">${EW.esc(p.projectTitle)}</h3>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:10px;">
                Posted: ${EW.esc(p.postedDate)} | Apply by: ${EW.esc(p.lastDateToApply || p.expiryDate)} | Stage: ${EW.esc(p.projectStage || 'Casting Open')}
              </div>
              <p style="font-size:0.9rem; color:var(--text-body); margin-bottom:10px;">${EW.esc(p.projectDetails)}</p>
              <div style="font-size:0.82rem; color:var(--text-muted);">
                Banner: <strong style="color:var(--text-dark);">${EW.esc(p.productionHouseName || p.companyName)}</strong>
                · Casting: <strong style="color:var(--text-dark);">${EW.esc(p.castingCompanyName || p.companyName)}</strong>
              </div>
            </div>
            <div style="border-left:1px solid var(--border-light); padding-left:18px; font-size:0.86rem;">
              ${p.projectPosterPath ? `<img src="${EW.esc(p.projectPosterPath)}" style="width:100%; height:92px; object-fit:cover; border-radius:10px; margin-bottom:8px;">` : ''}
              <strong>${EW.esc(p.targetCategory)} (${p.artistsRequiredCount || 1} needed)</strong>
              <div style="color:var(--text-muted);">${EW.esc(p.targetGender)}, ${p.ageMin} - ${p.ageMax} Yrs · ${EW.esc(p.experienceLevel || 'Both')}</div>
              <div style="color:var(--text-muted); margin-top:4px;">📍 ${EW.esc(p.location || 'Pan-India')} · ${EW.esc(p.auditionType || 'Online')}</div>
              <div style="color:var(--crimson-dark); font-weight:700; margin-top:4px;">${EW.esc(p.paymentType || 'Paid')}: ${EW.esc(p.budget || 'Negotiable')}</div>
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:16px; padding-top:14px; border-top:1px solid var(--border-light);">
            <button type="button" onclick="openProjectApplications(${p.id})" class="btn btn-outline-dark btn-sm">Applications (${p.applicationsCount})</button>
            <button type="button" onclick="openProjectBriefModal(${p.id})" class="btn btn-dark btn-sm">Full Brief</button>
            <button type="button" onclick="openEditProjectModal(${p.id})" class="btn btn-outline-dark btn-sm">✏️ Edit</button>
            ${p.status !== 'ACTIVE' ? `<button type="button" onclick="changeProjectStatus(${p.id}, 'ACTIVE')" class="btn btn-outline-dark btn-sm">▶ Publish</button>` : ''}
            ${p.status === 'ACTIVE' ? `<button type="button" onclick="changeProjectStatus(${p.id}, 'PAUSED')" class="btn btn-outline-dark btn-sm">⏸ Pause</button>` : ''}
            ${p.status !== 'CLOSED' ? `<button type="button" onclick="changeProjectStatus(${p.id}, 'CLOSED')" class="btn btn-outline-dark btn-sm">🔒 Close</button>` : ''}
            <button type="button" onclick="promoteProject(${p.id})" class="btn btn-outline-dark btn-sm">${p.promoted ? '✓ Promoted' : '★ Promote'}</button>
            <button type="button" onclick="openShareModal(${p.id}, '${EW.esc(p.projectTitle)}')" class="btn btn-outline-dark btn-sm">Share</button>
            <button type="button" onclick="deleteProject(${p.id})" class="btn btn-outline-dark btn-sm" style="color:var(--crimson); margin-left:auto;">🗑 Delete</button>
          </div>
        </div>`).join('') || '<div class="card" style="padding:32px; text-align:center;">No projects found for this filter.</div>'}`;
  }
  window.renderProjectsFilter = renderProjects;

  window.openEditProjectModal = (pid) => {
    const p = state.cachedProjects.find(x => x.id === pid);
    if (!p) return;
    document.getElementById('eproj-id').value = p.id;
    document.getElementById('eproj-title').value = p.projectTitle || '';
    document.getElementById('eproj-type').value = p.projectType || '';
    document.getElementById('eproj-lang').value = p.projectLanguage || '';
    document.getElementById('eproj-cat').value = p.targetCategory || '';
    document.getElementById('eproj-stage').value = p.projectStage || 'Casting Open';
    document.getElementById('eproj-loc').value = p.location || '';
    document.getElementById('eproj-budget').value = p.budget || '';
    document.getElementById('eproj-agemin').value = p.ageMin || 18;
    document.getElementById('eproj-agemax').value = p.ageMax || 35;
    document.getElementById('eproj-auddate').value = p.auditionDate || '';
    document.getElementById('eproj-lastdate').value = p.lastDateToApply || p.expiryDate || '';
    document.getElementById('eproj-desc').value = p.projectDetails || '';
    document.getElementById('edit-project-modal').classList.add('open');
  };

  document.getElementById('edit-project-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const pid = document.getElementById('eproj-id').value;
    await EW.api(`/api/dashboard/projects/${pid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectTitle: document.getElementById('eproj-title').value,
        projectType: document.getElementById('eproj-type').value,
        projectLanguage: document.getElementById('eproj-lang').value,
        targetCategory: document.getElementById('eproj-cat').value,
        projectStage: document.getElementById('eproj-stage').value,
        location: document.getElementById('eproj-loc').value,
        budget: document.getElementById('eproj-budget').value,
        ageMin: Number(document.getElementById('eproj-agemin').value),
        ageMax: Number(document.getElementById('eproj-agemax').value),
        auditionDate: document.getElementById('eproj-auddate').value,
        lastDateToApply: document.getElementById('eproj-lastdate').value,
        projectDetails: document.getElementById('eproj-desc').value
      })
    });
    closeModal('edit-project-modal');
    EW.toast('Project updated!');
    renderProjects();
  });

  window.changeProjectStatus = async (pid, status) => {
    const res = await EW.api(`/api/dashboard/projects/${pid}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
    });
    EW.toast(res.message);
    renderProjects();
  };

  window.deleteProject = async (pid) => {
    if (!confirm('Delete this casting project and its applications?')) return;
    await EW.api(`/api/dashboard/projects/${pid}`, { method: 'DELETE' });
    EW.toast('Project deleted');
    await refreshOverview();
    renderProjects();
  };

  window.openProjectBriefModal = async (pid) => {
    if (!state.cachedProjects.length) state.cachedProjects = await EW.api('/api/dashboard/projects?filter=ALL');
    const p = state.cachedProjects.find(x => x.id === pid) || (state.overview.recentProjects || []).find(x => x.id === pid);
    if (!p) return;
    let refImgs = [];
    let lookImgs = [];
    try { refImgs = JSON.parse(p.referenceImagePathsJson || '[]'); } catch (_) {}
    try { lookImgs = JSON.parse(p.characterLookPathsJson || '[]'); } catch (_) {}
    const kv = (k, v) => `<div style="padding:8px 10px; background:var(--bg-ivory); border-radius:8px; font-size:0.84rem;"><div style="font-size:0.72rem; color:var(--text-muted); font-weight:700;">${k}</div><strong>${EW.esc(v || '—')}</strong></div>`;
    document.getElementById('am-title').textContent = p.projectTitle;
    document.getElementById('am-body').innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          ${kv('Type / Language / Stage', `${p.projectType} · ${p.projectLanguage || '—'} · ${p.projectStage || '—'}`)}
          ${kv('Banner / Casting Company', `${p.productionHouseName || '—'} / ${p.castingCompanyName || p.companyName}`)}
          ${kv('Required Talent', `${p.targetCategory} (${p.artistsRequiredCount || 1}) · ${p.targetGender} · ${p.ageMin}-${p.ageMax} yrs`)}
          ${kv('Height / Appearance / Exp', `${p.heightRequirement || 'Any'} · ${p.preferredAppearance || '—'} · ${p.experienceLevel || 'Both'}`)}
          ${kv('Character & Role', `${p.characterName ? p.characterName + ' — ' : ''}${p.roleDescription || p.projectDetails}`)}
          ${kv('Location & Schedule', `Shoot: ${p.location || '—'} (${p.shootingStartDate || 'TBD'} to ${p.shootingEndDate || 'TBD'}, ${p.shootingDuration || '—'}) | Audition: ${p.auditionType || 'Online'} @ ${p.auditionLocation || '—'} on ${p.auditionDate || 'TBD'}`)}
          ${kv('Payment & Perks', `${p.paymentType || 'Paid'} · ${p.budget || '—'} (${p.paymentBasis || '—'}) | Stay: ${p.accommodationProvided || 'No'}, Food: ${p.foodProvided || 'No'}, Travel: ${p.travelExpensesCovered || 'No'}`)}
          ${kv('Contact Info', `${p.castingDirectorName || '—'} | ${p.contactEmail || '—'} | ${p.contactNumber || '—'} | WhatsApp: ${p.whatsappNumber || '—'}`)}
        </div>
        ${p.auditionScript ? `<div style="padding:12px; background:#FAF7F2; border:1px solid var(--border-light); border-radius:10px; font-size:0.86rem;"><strong>Audition Script:</strong><br>${EW.esc(p.auditionScript)}</div>` : ''}
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          ${p.projectPosterPath ? `<a href="${EW.esc(p.projectPosterPath)}" target="_blank" class="btn btn-outline-dark btn-sm">Project Poster ↗</a>` : ''}
          ${p.projectPromotionalImagePath ? `<a href="${EW.esc(p.projectPromotionalImagePath)}" target="_blank" class="btn btn-outline-dark btn-sm">Promotional Image ↗</a>` : ''}
          ${p.auditionScriptPdfPath ? `<a href="${EW.esc(p.auditionScriptPdfPath)}" target="_blank" class="btn btn-primary btn-sm">Audition Script PDF ↗</a>` : ''}
        </div>
        ${refImgs.length ? `<div><strong style="font-size:0.85rem;">Reference Images:</strong><div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">${refImgs.map(u => `<a href="${EW.esc(u)}" target="_blank"><img src="${EW.esc(u)}" style="width:76px; height:76px; object-fit:cover; border-radius:8px;"></a>`).join('')}</div></div>` : ''}
        ${lookImgs.length ? `<div><strong style="font-size:0.85rem;">Character Look References:</strong><div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">${lookImgs.map(u => `<a href="${EW.esc(u)}" target="_blank"><img src="${EW.esc(u)}" style="width:76px; height:76px; object-fit:cover; border-radius:8px;"></a>`).join('')}</div></div>` : ''}
      </div>`;
    document.getElementById('artist-modal').classList.add('open');
  };

  window.openProjectApplications = (pid) => { state.appProjectId = pid; switchSection('applications'); };
  window.promoteProject = async (pid) => {
    try {
      const res = await EW.api(`/api/dashboard/projects/${pid}/promote`, { method: 'POST' });
      EW.toast(res.message);
      await renderProjects();
    } catch (err) { EW.toast(err.message, 'error'); }
  };
  window.openShareModal = (pid, title) => {
    const link = `${window.location.origin}/?casting=${pid}`;
    document.getElementById('share-proj-name').textContent = title;
    document.getElementById('share-link-input').value = link;
    document.getElementById('share-x').href = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Audition open on Entertainment World: ' + title + ' ' + link)}`;
    document.getElementById('share-fb').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
    document.getElementById('share-wa').href = `https://wa.me/?text=${encodeURIComponent('Casting Call on Entertainment World: ' + title + ' ' + link)}`;
    document.getElementById('share-modal').classList.add('open');
  };
  window.copyShareLink = () => {
    const inp = document.getElementById('share-link-input');
    inp.select();
    navigator.clipboard.writeText(inp.value).catch(() => {});
    EW.toast('Casting link copied to clipboard!');
  };

  // ================= 4. APPLICATION MANAGEMENT (ACCEPT / REJECT / RATE / COMMENT) =================
  async function renderApplications() {
    showLoading('Loading Actor Applications...');
    const qs = new URLSearchParams({ tab: state.appTab, role: state.appRole });
    if (state.appProjectId) qs.set('projectId', state.appProjectId);
    const data = await EW.api(`/api/dashboard/applications?${qs}`);
    const projects = data.projects || [];
    const active = data.activeProject;
    const apps = data.applications || [];
    const counts = data.countsByStatus || {};

    document.getElementById('dash-view').innerHTML = `
      <div class="split-2">
        <div class="filter-panel">
          <h3 style="margin-bottom:12px;">Projects</h3>
          ${projects.map(p => `
            <div onclick="selectAppProject(${p.id})" style="padding:12px; border-radius:12px; margin-bottom:8px; cursor:pointer; border:1px solid ${active && active.id === p.id ? 'var(--crimson)' : 'var(--border-light)'}; background:${active && active.id === p.id ? 'var(--crimson-soft)' : '#FFF'};">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                <strong style="font-size:0.86rem;">${EW.esc(p.projectTitle)}</strong>
                <span class="badge badge-rejected">${p.applicationsCount}</span>
              </div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Posted ${EW.esc(p.postedDate)}</div>
            </div>`).join('')}
        </div>

        <div>
          <div style="background:linear-gradient(90deg, #16151E, #321C2A); color:#FFFFFF; border-radius:16px; padding:18px 22px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="font-size:0.72rem; color:var(--gold); font-weight:800;">APPLICATION REVIEW WORKSPACE</div>
              <div style="font-size:1.15rem; font-weight:800;">${active ? EW.esc(active.projectTitle) : 'No Active Project'}</div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" onclick="downloadSelectedExcel()" class="btn btn-gold btn-sm">Download Excel</button>
              <button type="button" onclick="bulkInviteSelected(${active ? active.id : null})" class="btn btn-primary btn-sm">Invite Selected</button>
            </div>
          </div>

          <div style="display:flex; gap:7px; flex-wrap:wrap; margin-bottom:14px;">
            ${['ALL', 'APPLIED', 'SHORTLISTED', 'INVITED', 'SELECTED', 'BACKUP', 'REJECTED', 'SUGGESTED'].map(t => `
              <button class="btn btn-sm ${state.appTab === t ? 'btn-dark' : 'btn-outline-dark'}" onclick="setAppTab('${t}')">
                ${t} (${counts[t] ?? 0})
              </button>`).join('')}
          </div>

          <div class="artists-grid">
            ${apps.map(item => renderArtistCard(item.artist, item)).join('') || '<div class="card" style="grid-column:span 4; padding:28px; text-align:center;">No applications in this status tab yet.</div>'}
          </div>
        </div>
      </div>`;
  }

  window.selectAppProject = (pid) => { state.appProjectId = pid; renderApplications(); };
  window.setAppTab = (t) => { state.appTab = t; renderApplications(); };

  window.quickAppAction = async (appId, nextStatus) => {
    await EW.api(`/api/dashboard/applications/${appId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus, notifyActor: nextStatus === 'SELECTED' || nextStatus === 'REJECTED' })
    });
    EW.toast(`Application updated to ${nextStatus}`);
    renderApplications();
  };

  window.openAppReviewModal = (item) => {
    document.getElementById('ar-app-id').value = item.applicationId;
    document.getElementById('ar-title').textContent = `Review — ${item.artist ? item.artist.fullName : 'Applicant'}`;
    document.getElementById('ar-status').value = item.applicationStatus || 'SHORTLISTED';
    document.getElementById('ar-rating').value = String(item.rating || 5);
    document.getElementById('ar-role').value = item.assignedRole || item.roleName || '';
    document.getElementById('ar-comment').value = item.internalComment || '';
    document.getElementById('app-review-modal').classList.add('open');
  };

  document.getElementById('app-review-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const id = document.getElementById('ar-app-id').value;
    await EW.api(`/api/dashboard/applications/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: document.getElementById('ar-status').value,
        rating: Number(document.getElementById('ar-rating').value),
        assignedRole: document.getElementById('ar-role').value,
        internalComment: document.getElementById('ar-comment').value,
        notifyActor: document.getElementById('ar-notify').checked
      })
    });
    closeModal('app-review-modal');
    EW.toast('Application review & rating saved!');
    if (state.activeSection === 'selection') EWOps.renderShortlistSelection();
    else renderApplications();
  });

  // ================= 2. ACTOR MANAGEMENT & SMART SEARCH =================
  async function renderSearchArtists(customFilters = null) {
    showLoading('Searching Registered Actors...');
    const filters = customFilters || {
      sortBy: 'Relevant', name: '', category: 'All', gender: 'All', agency: 'All',
      ageMin: 0, ageMax: 75, city: '', expertise: 'All', language: '', skills: '',
      keyword: '', videoOnly: false, verifiedOnly: false
    };
    const res = await EW.api('/api/dashboard/artists/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters)
    });
    state.cachedSearchArtists = res.artists || [];

    document.getElementById('dash-view').innerHTML = `
      <div class="split-2">
        <form id="artist-search-form" class="filter-panel">
          <h3 style="margin-bottom:14px;">Actor Search &amp; Filters</h3>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div><label class="form-label">Actor Name</label><input name="name" class="form-control" value="${EW.esc(filters.name || '')}" placeholder="Search by name..."></div>
            <div><label class="form-label">Sort By</label>
              <select name="sortBy" class="form-select">
                <option ${filters.sortBy === 'Relevant' ? 'selected' : ''}>Relevant</option>
                <option ${filters.sortBy === 'Most Viewed' ? 'selected' : ''}>Most Viewed</option>
                <option ${filters.sortBy === 'Newest' ? 'selected' : ''}>Newest</option>
              </select>
            </div>
            <div><label class="form-label">Category</label>
              <select name="category" class="form-select">
                ${['All', 'Actor', 'Model', 'Singer', 'Dancer', 'Voice-over Artist', 'Photographer', 'Musician', 'Writer', 'Stand-up Comedian', 'Filmmaker'].map(c =>
                  `<option ${filters.category === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div><label class="form-label">Gender</label>
              <select name="gender" class="form-select">
                <option ${filters.gender === 'All' ? 'selected' : ''}>All</option>
                <option ${filters.gender === 'Male' ? 'selected' : ''}>Male</option>
                <option ${filters.gender === 'Female' ? 'selected' : ''}>Female</option>
              </select>
            </div>
            <div><label class="form-label">Age Range (${filters.ageMin} - ${filters.ageMax})</label>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <input type="number" name="ageMin" class="form-control" min="0" max="75" value="${filters.ageMin}">
                <input type="number" name="ageMax" class="form-control" min="0" max="75" value="${filters.ageMax}">
              </div>
            </div>
            <div><label class="form-label">Location</label><input name="city" class="form-control" value="${EW.esc(filters.city || '')}" placeholder="e.g. Mumbai, Delhi"></div>
            <div><label class="form-label">Language</label><input name="language" class="form-control" value="${EW.esc(filters.language || '')}" placeholder="e.g. Hindi, Kannada"></div>
            <div><label class="form-label">Skills</label><input name="skills" class="form-control" value="${EW.esc(filters.skills || '')}" placeholder="e.g. drama, action, dubbing"></div>
            <div><label class="form-label">Experience</label>
              <select name="expertise" class="form-select">
                <option ${filters.expertise === 'All' ? 'selected' : ''}>All</option>
                <option ${filters.expertise === 'Professional' ? 'selected' : ''}>Professional</option>
                <option ${filters.expertise === 'Intermediate' ? 'selected' : ''}>Intermediate</option>
                <option ${filters.expertise === 'Fresher' ? 'selected' : ''}>Fresher</option>
              </select>
            </div>
            <label style="display:flex; align-items:center; gap:8px; font-size:0.84rem; font-weight:600;"><input type="checkbox" name="videoOnly" ${filters.videoOnly ? 'checked' : ''}> With video showreel only</label>
            <label style="display:flex; align-items:center; gap:8px; font-size:0.84rem; font-weight:600;"><input type="checkbox" name="verifiedOnly" ${filters.verifiedOnly ? 'checked' : ''}> Verified actors only</label>
            <div style="display:flex; gap:8px; margin-top:6px;">
              <button type="submit" class="btn btn-primary btn-sm" style="flex:1;">SEARCH</button>
              <button type="button" onclick="renderSearchReset()" class="btn btn-outline-dark btn-sm">RESET</button>
            </div>
          </div>
        </form>

        <div>
          ${renderBulkActionBar(res.total)}
          <div class="artists-grid">
            ${state.cachedSearchArtists.map(a => renderArtistCard(a)).join('') || '<div class="card" style="grid-column:span 4; padding:28px; text-align:center;">No actors matched your filters.</div>'}
          </div>
        </div>
      </div>`;

    document.getElementById('artist-search-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      renderSearchArtists({
        sortBy: fd.get('sortBy'),
        name: fd.get('name'),
        category: fd.get('category'),
        gender: fd.get('gender'),
        agency: 'All',
        ageMin: Number(fd.get('ageMin') || 0),
        ageMax: Number(fd.get('ageMax') || 75),
        city: fd.get('city'),
        expertise: fd.get('expertise'),
        language: fd.get('language'),
        skills: fd.get('skills'),
        keyword: fd.get('skills'),
        videoOnly: fd.has('videoOnly'),
        verifiedOnly: fd.has('verifiedOnly'),
        recordHistory: true
      });
    });
  }
  window.renderSearchReset = () => renderSearchArtists();

  function renderBulkActionBar(count) {
    return `
      <div class="card" style="padding:12px 16px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <button type="button" onclick="toggleSelectAllVisible()" class="btn btn-outline-dark btn-sm">SELECT ALL</button>
          <button type="button" onclick="EWOps.compareCheckedActors(Array.from(window.getSelectedActorIds()))" class="btn btn-dark btn-sm">⚖️ Compare (2-4)</button>
          <select id="bulk-action-select" class="form-select" style="width:190px; padding:7px 12px;" onchange="handleBulkSelect(this)">
            <option value="">Bulk Actions...</option>
            <option value="INVITE_AUDITION">Invite to Audition</option>
            <option value="DOWNLOAD_EXCEL">Download Excel</option>
            <option value="TAG_FOLDER">Tag Artists to Folder</option>
          </select>
        </div>
        <div style="font-size:0.86rem; font-weight:700; color:var(--text-muted);">${count} Actors Found</div>
      </div>`;
  }
  window.getSelectedActorIds = () => state.selectedArtistIds;

  window.toggleSelectAllVisible = () => {
    const checkboxes = document.querySelectorAll('.artist-check');
    const allChecked = checkboxes.length && Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => {
      cb.checked = !allChecked;
      const id = Number(cb.dataset.id);
      if (cb.checked) state.selectedArtistIds.add(id);
      else state.selectedArtistIds.delete(id);
    });
  };
  window.onArtistCheck = (cb) => {
    const id = Number(cb.dataset.id);
    if (cb.checked) state.selectedArtistIds.add(id);
    else state.selectedArtistIds.delete(id);
  };
  window.handleBulkSelect = async (sel) => {
    const val = sel.value;
    sel.value = '';
    if (!val) return;
    if (val === 'DOWNLOAD_EXCEL') downloadSelectedExcel();
    else if (val === 'INVITE_AUDITION') await bulkInviteSelected(state.appProjectId);
    else if (val === 'TAG_FOLDER') await openTagFolderModal();
  };
  window.downloadSelectedExcel = () => {
    const ids = Array.from(state.selectedArtistIds).join(',');
    window.location.href = `/api/dashboard/artists/export-excel${ids ? '?ids=' + encodeURIComponent(ids) : ''}`;
    EW.toast('Downloading Excel roster...');
  };
  window.bulkInviteSelected = async (projectId = null) => {
    const ids = Array.from(state.selectedArtistIds);
    if (!ids.length) return EW.toast('Select at least one actor checkbox first.', 'error');
    try {
      const res = await EW.api('/api/dashboard/artists/bulk-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'INVITE_AUDITION', artistIds: ids, projectId })
      });
      EW.toast(res.message);
      await refreshOverview();
    } catch (err) { EW.toast(err.message, 'error'); }
  };
  async function openTagFolderModal() {
    const ids = Array.from(state.selectedArtistIds);
    if (!ids.length) return EW.toast('Select at least one actor checkbox first.', 'error');
    const data = await EW.api('/api/dashboard/folders');
    document.getElementById('tag-folder-select').innerHTML = data.folders.map(f =>
      `<option value="${f.id}">${EW.esc(f.folderName)} (${f.count})</option>`).join('');
    document.getElementById('tag-folder-modal').classList.add('open');
  }
  window.confirmTagArtists = async () => {
    const ids = Array.from(state.selectedArtistIds);
    const folderId = Number(document.getElementById('tag-folder-select').value);
    const res = await EW.api('/api/dashboard/artists/bulk-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'TAG_FOLDER', artistIds: ids, folderId })
    });
    closeModal('tag-folder-modal');
    EW.toast(res.message);
  };

  // ================= 6B. MY ARTISTS (FOLDERS) =================
  async function renderMyArtists(category = 'All', city = '') {
    showLoading('Loading My Artists Folders...');
    const qs = new URLSearchParams({ folderId: state.myFolderId || 0, category, city });
    const data = await EW.api(`/api/dashboard/folders?${qs}`);

    document.getElementById('dash-view').innerHTML = `
      <div class="split-2">
        <div class="filter-panel">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3>MY ARTISTS</h3>
            <button type="button" onclick="promptNewFolder()" class="btn btn-primary btn-sm">+ Folder</button>
          </div>
          <div class="folder-item ${state.myFolderId === 0 ? 'active' : ''}" onclick="selectMyFolder(0)">
            <span>📁 All Artists</span><span>${data.totalSaved}</span>
          </div>
          ${data.folders.map(f => `
            <div class="folder-item ${state.myFolderId === f.id ? 'active' : ''}" onclick="selectMyFolder(${f.id})">
              <span>📂 ${EW.esc(f.folderName)}</span>
              <div style="display:flex; gap:8px; align-items:center;">
                <span>${f.count}</span>
                <button type="button" onclick="event.stopPropagation(); deleteFolder(${f.id})" style="border:none; background:transparent; cursor:pointer; color:var(--text-muted);">🗑</button>
              </div>
            </div>`).join('')}
        </div>

        <div>
          <div class="card" style="padding:14px 18px; margin-bottom:16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
            <select id="my-cat-filter" class="form-select" style="width:180px;">
              ${['All', 'Actor', 'Model', 'Singer', 'Dancer', 'Voice-over Artist', 'Photographer'].map(c =>
                `<option ${category === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
            <input id="my-city-filter" class="form-control" style="width:180px;" value="${EW.esc(city)}" placeholder="Filter by location">
            <button type="button" onclick="applyMyArtistsFilter()" class="btn btn-dark btn-sm">FILTER</button>
            <button type="button" onclick="downloadSelectedExcel()" class="btn btn-outline-dark btn-sm">Download Excel</button>
          </div>
          <div class="artists-grid">
            ${data.artists.map(a => renderArtistCard(a)).join('') || '<div class="card" style="grid-column:span 4; padding:28px; text-align:center;">No favorite artists in this folder yet.</div>'}
          </div>
        </div>
      </div>`;
  }
  window.selectMyFolder = (fid) => { state.myFolderId = fid; renderMyArtists(); };
  window.applyMyArtistsFilter = () => renderMyArtists(document.getElementById('my-cat-filter').value, document.getElementById('my-city-filter').value);
  window.promptNewFolder = async () => {
    const name = prompt('Enter new folder name (e.g. Lead Villains):');
    if (!name || !name.trim()) return;
    await EW.api('/api/dashboard/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderName: name.trim() }) });
    EW.toast('Folder created!');
    renderMyArtists();
  };
  window.deleteFolder = async (fid) => {
    await EW.api(`/api/dashboard/folders/${fid}`, { method: 'DELETE' });
    if (state.myFolderId === fid) state.myFolderId = 0;
    EW.toast('Folder removed');
    renderMyArtists();
  };

  // ================= 7. AI RECOMMENDATIONS =================
  async function renderRecommended() {
    showLoading('Computing AI Casting Recommendations...');
    const data = await EW.api(`/api/dashboard/artists/recommended?tier=${state.recTier}`);
    const r = data.risingStar;
    document.getElementById('dash-view').innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:12px;">
        <div>
          <h2>AI Actor Recommendations &amp; Platinum Talent</h2>
          <p style="margin:4px 0 0; color:var(--text-muted); font-size:0.88rem;">Smart match scores calculated from your active casting calls and search signals.</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" onclick="setRecTier('PLATINUM')" class="btn btn-sm ${state.recTier === 'PLATINUM' ? 'btn-dark' : 'btn-outline-dark'}">PLATINUM</button>
          <button type="button" onclick="setRecTier('FEATURED')" class="btn btn-sm ${state.recTier === 'FEATURED' ? 'btn-dark' : 'btn-outline-dark'}">FEATURED</button>
          <button type="button" onclick="setRecTier('ALL')" class="btn btn-sm ${state.recTier === 'ALL' ? 'btn-dark' : 'btn-outline-dark'}">ALL TOP MATCHES</button>
        </div>
      </div>

      <div class="split-2">
        <div class="card" style="overflow:hidden;">
          <div style="background:var(--bg-obsidian); color:var(--gold); padding:10px 14px; font-weight:800; font-size:0.8rem;">★ RISING STAR · ${r.matchScore || 92}% MATCH</div>
          <img src="${EW.esc(r.avatarUrl)}" style="width:100%; aspect-ratio:1/1; object-fit:cover;">
          <div style="padding:16px;">
            <h3 style="color:var(--crimson);">${EW.esc(r.fullName)}</h3>
            <div style="font-size:0.84rem; color:var(--text-muted); margin-bottom:8px;">${EW.esc(r.category)} · ${EW.esc(r.city)}</div>
            <p style="font-size:0.85rem; color:var(--text-body);">${EW.esc(r.bio)}</p>
            <button type="button" onclick="viewArtistPortfolio(${r.id})" class="btn btn-primary btn-sm" style="width:100%;">Inspect Portfolio</button>
          </div>
        </div>

        <div class="artists-grid" style="grid-template-columns:repeat(3, 1fr);">
          ${data.artists.map(a => renderArtistCard(a, null, true)).join('')}
        </div>
      </div>`;
  }
  window.setRecTier = (t) => { state.recTier = t; renderRecommended(); };

  // ================= 8. GET PACKAGE =================
  async function renderPackagesSection() {
    const res = await EW.api('/api/subscription/passes');
    const c = res.company;
    document.getElementById('dash-view').innerHTML = `
      <div class="card" style="padding:26px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
        <div>
          <span class="badge badge-paid">ACTIVE PASS</span>
          <h2 style="margin-top:6px;">${EW.esc(c.activePassName)}</h2>
          <div style="color:var(--text-muted); font-size:0.9rem;">Valid until <strong class="mono">${EW.esc(c.subscriptionExpiry)}</strong> · ${c.contactViewsRemaining} Contact Views Remaining</div>
        </div>
        <a href="/passes.html" class="btn btn-primary">Upgrade or Renew Pass →</a>
      </div>
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:18px;">
        ${res.passes.map(p => `
          <div class="card" style="padding:24px; ${p.passCode === c.activePassCode ? 'border:2px solid var(--crimson);' : ''}">
            <h3 style="margin-bottom:6px;">${EW.esc(p.passName)}</h3>
            <div style="font-size:1.7rem; font-weight:900; color:var(--crimson); margin-bottom:10px;">${EW.formatInr(p.basePriceInr)} <span style="font-size:0.82rem; color:var(--text-muted);">/ ${p.defaultMonths} mo</span></div>
            <div style="font-size:0.86rem; color:var(--text-body); display:flex; flex-direction:column; gap:6px; margin-bottom:16px;">
              <div>• Contact Views: <strong>${EW.esc(p.contactViewsLabel)}</strong></div>
              <div>• Portfolio Views: <strong>${EW.esc(p.portfolioViewsLabel)}</strong></div>
              <div>• Audition Invites: <strong>${p.inviteAuditionLimit}</strong></div>
              <div>• Project Promotions: <strong>${EW.esc(p.projectPromotionLabel)}</strong></div>
            </div>
            <a href="/passes.html" class="btn btn-dark btn-sm" style="width:100%;">Select / Upgrade</a>
          </div>`).join('')}
      </div>`;
  }

  // ================= 9. TRANSACTION HISTORY =================
  async function renderTransactions() {
    showLoading('Loading Transaction History...');
    const qs = new URLSearchParams({ viewType: state.txViewType, tier: state.txTier, sort: state.txSort });
    const data = await EW.api(`/api/dashboard/transactions?${qs}`);
    const c = data.company;
    const total = Math.max(1, c.contactViewsTotal);
    const rem = c.contactViewsRemaining;
    const pct = Math.min(100, Math.round((rem / total) * 100));

    document.getElementById('dash-view').innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:12px;">
        <h2>Transaction History</h2>
        <label style="display:flex; align-items:center; gap:8px; font-weight:700; font-size:0.88rem; cursor:pointer; background:#FFF; padding:8px 14px; border-radius:999px; border:1px solid var(--border-light);">
          <input type="checkbox" ${state.showPurchaseHistory ? 'checked' : ''} onchange="togglePurchaseHistory(this.checked)">
          SHOW PURCHASE HISTORY
        </label>
      </div>

      ${state.showPurchaseHistory ? `
        <div class="ew-table-wrap" style="margin-bottom:20px;">
          <div style="padding:14px 18px; border-bottom:1px solid var(--border-light);"><h3>Pass Purchase History &amp; Invoices</h3></div>
          <table class="ew-tbl">
            <thead><tr><th>Transaction Ref</th><th>Pass</th><th>Duration</th><th>Total Paid</th><th>Method</th><th>Validity</th><th>Status</th></tr></thead>
            <tbody>
              ${data.purchaseHistory.map(p => `
                <tr>
                  <td class="mono">${EW.esc(p.transactionRef)}</td>
                  <td><strong>${EW.esc(p.passName)}</strong></td>
                  <td>${p.durationMonths} mo</td>
                  <td><strong>${EW.formatInr(p.totalPaidInr)}</strong></td>
                  <td>${EW.esc(p.paymentMethod)}</td>
                  <td class="mono">${EW.esc(p.validFrom)} → ${EW.esc(p.validUntil)}</td>
                  <td><span class="badge badge-paid">${EW.esc(p.paymentStatus)}</span></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}

      <div class="card" style="padding:24px; margin-bottom:20px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
          <button class="btn ${state.txViewType === 'PORTFOLIO_VIEW' ? 'btn-primary' : 'btn-outline-dark'}" onclick="setTxViewType('PORTFOLIO_VIEW')">Portfolio Views</button>
          <button class="btn ${state.txViewType === 'CONTACT_VIEW' ? 'btn-primary' : 'btn-outline-dark'}" onclick="setTxViewType('CONTACT_VIEW')">Contact Views</button>
        </div>

        <div style="display:flex; gap:8px; margin-bottom:16px;">
          <button class="btn btn-sm ${state.txTier === 'FREE' ? 'btn-dark' : 'btn-outline-dark'}" onclick="setTxTier('FREE')">Free</button>
          <button class="btn btn-sm ${state.txTier === 'PAID' ? 'btn-primary' : 'btn-outline-dark'}" onclick="setTxTier('PAID')">Paid</button>
          <button class="btn btn-sm ${state.txTier === 'ALL' ? 'btn-dark' : 'btn-outline-dark'}" onclick="setTxTier('ALL')">All</button>
        </div>

        <div style="text-align:center;">
          <div style="font-weight:800; font-size:1.05rem;">${rem} contact views remaining of ${c.contactViewsTotal}</div>
          <div class="quota-track"><div class="quota-fill" style="width:${pct}%;"></div></div>
          <a href="/passes.html" class="btn btn-primary btn-sm">UPGRADE PACKAGE</a>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3>${state.txViewType === 'CONTACT_VIEW' ? 'Viewed Contact' : 'Viewed Portfolios'}</h3>
        <select class="form-select" style="width:190px;" onchange="setTxSort(this.value)">
          <option value="RECENT" ${state.txSort === 'RECENT' ? 'selected' : ''}>Sort By: Recently viewed</option>
          <option value="OLDEST" ${state.txSort === 'OLDEST' ? 'selected' : ''}>Sort By: Oldest first</option>
        </select>
      </div>
      <div class="artists-grid">
        ${data.viewedItems.map(item => renderArtistCard(item.artist)).join('') || '<div class="card" style="grid-column:span 4; padding:26px; text-align:center;">No view history in this filter yet.</div>'}
      </div>`;
  }
  window.togglePurchaseHistory = (v) => { state.showPurchaseHistory = v; renderTransactions(); };
  window.setTxViewType = (v) => { state.txViewType = v; renderTransactions(); };
  window.setTxTier = (v) => { state.txTier = v; renderTransactions(); };
  window.setTxSort = (v) => { state.txSort = v; renderTransactions(); };

  // ================= SHARED ARTIST CARD & PROFILE MODAL =================
  function renderArtistCard(a, appMeta = null, showMatch = false) {
    const checked = state.selectedArtistIds.has(a.id) ? 'checked' : '';
    return `
      <div class="artist-card">
        <div class="artist-img-wrap">
          <input type="checkbox" class="artist-check" data-id="${a.id}" ${checked} onchange="onArtistCheck(this)">
          <img src="${EW.esc(a.avatarUrl)}" alt="${EW.esc(a.fullName)}">
          ${a.profileVerified ? '<span class="verified-pill">✓ Verified</span>' : ''}
          ${a.showcaseBadge ? '<span class="showcase-ribbon">SHOWCASE</span>' : ''}
          ${a.hasVideo ? `<button type="button" class="video-pill" onclick="playVideoModal('${EW.esc(a.videoUrl)}', '${EW.esc(a.fullName)} — ${EW.esc(a.videoTitle || 'Audition')}')">▶ Video</button>` : ''}
        </div>
        <div class="artist-body">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:4px;">
            <div style="font-weight:800; font-size:0.96rem; color:var(--crimson-dark); cursor:pointer;" onclick="viewArtistPortfolio(${a.id})">${EW.esc(a.fullName)}</div>
            ${showMatch && a.matchScore ? `<span class="badge badge-approved">${a.matchScore}%</span>` : ''}
          </div>
          <div style="font-size:0.78rem; color:var(--text-muted);">${EW.esc(a.secondaryRoles || a.category)}</div>
          <div style="font-size:0.78rem; font-weight:600;">${EW.esc(a.city)} · ${a.age} yrs · ${EW.esc(a.expertise)}</div>
          ${showMatch && a.matchReasons ? `<div style="font-size:0.72rem; color:var(--emerald); font-weight:600;">${EW.esc(a.matchReasons.join(' · '))}</div>` : ''}
          ${appMeta ? `
            <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap; margin-top:2px;">
              <span class="badge ${EW.badgeClass(appMeta.applicationStatus)}">${EW.esc(appMeta.applicationStatus)}</span>
              ${appMeta.rating ? `<span style="font-size:0.74rem; color:#B45309; font-weight:800;">★ ${appMeta.rating}</span>` : ''}
            </div>
            ${appMeta.internalComment ? `<div style="font-size:0.72rem; color:var(--text-muted);">"${EW.esc(appMeta.internalComment)}"</div>` : ''}
            <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">
              <button type="button" class="icon-btn" onclick="quickAppAction(${appMeta.applicationId}, 'SELECTED')" title="Accept/Select">✓ Select</button>
              <button type="button" class="icon-btn" onclick="quickAppAction(${appMeta.applicationId}, 'SHORTLISTED')" title="Shortlist">★</button>
              <button type="button" class="icon-btn" onclick="quickAppAction(${appMeta.applicationId}, 'REJECTED')" title="Reject">✕</button>
              <button type="button" class="icon-btn" onclick='openAppReviewModal(${JSON.stringify({ applicationId: appMeta.applicationId, applicationStatus: appMeta.applicationStatus, rating: appMeta.rating || 5, roleName: appMeta.roleName, assignedRole: appMeta.assignedRole || "", internalComment: appMeta.internalComment || "", artist: a }).replace(/'/g, "&#39;")})'>Review</button>
            </div>` : ''}
          <div class="artist-actions">
            <button type="button" class="icon-btn ${a.saved ? 'active' : ''}" onclick="toggleSaveArtist(${a.id}, this)" title="Favorite">♥</button>
            <button type="button" class="icon-btn" onclick="viewArtistPortfolio(${a.id})">Portfolio</button>
            <button type="button" class="icon-btn" onclick="EWOps.openAuditionModal(${a.id}, ${appMeta ? appMeta.projectId : 'null'})" title="Schedule Audition">🎬</button>
            <button type="button" class="icon-btn ${a.contactUnlocked ? 'active' : ''}" onclick="unlockArtistContact(${a.id})">${a.contactUnlocked ? 'Unlocked' : '📞'}</button>
          </div>
        </div>
      </div>`;
  }

  window.toggleSaveArtist = async (artistId, btn) => {
    const res = await EW.api(`/api/dashboard/folders/toggle/${artistId}`, { method: 'POST' });
    btn.classList.toggle('active', res.saved);
    EW.toast(res.saved ? `Saved to ${res.folderName}` : `Removed from ${res.folderName}`);
  };
  window.viewArtistPortfolio = async (artistId) => {
    try {
      const res = await EW.api(`/api/dashboard/artists/${artistId}/view-portfolio`, { method: 'POST' });
      showArtistDetailModal(res.artist);
    } catch (err) { EW.toast(err.message, 'error'); }
  };
  window.unlockArtistContact = async (artistId) => {
    try {
      const res = await EW.api(`/api/dashboard/artists/${artistId}/unlock-contact`, { method: 'POST' });
      EW.toast(`Contact unlocked! ${res.company.contactViewsRemaining} views remaining.`);
      showArtistDetailModal(res.artist);
    } catch (err) { EW.toast(err.message, 'error'); }
  };
  window.verifyArtistFromModal = async (artistId, verified) => {
    const res = await EW.api(`/api/dashboard/artists/${artistId}/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileVerified: verified, verificationStatus: verified ? 'Verified' : 'Rejected', verificationNotes: verified ? 'Verified by casting team' : 'Pending updates' })
    });
    EW.toast(res.message);
    showArtistDetailModal(res.artist);
    if (state.activeSection === 'search') renderSearchArtists();
  };

  function showArtistDetailModal(a) {
    document.getElementById('am-title').textContent = `${a.fullName} — ${a.category}`;
    document.getElementById('am-body').innerHTML = `
      <div style="display:flex; gap:18px; flex-wrap:wrap; margin-bottom:16px;">
        <img src="${EW.esc(a.avatarUrl)}" style="width:140px; height:140px; border-radius:16px; object-fit:cover;">
        <div style="flex:1; min-width:220px;">
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
            ${a.profileVerified ? '<span class="badge badge-approved">✓ Profile Verified</span>' : '<span class="badge badge-pending">Verification Pending</span>'}
            ${a.showcaseBadge ? '<span class="badge badge-showcase">SHOWCASE</span>' : ''}
            <span class="badge badge-neutral">${EW.esc(a.expertise)}</span>
            <span class="badge badge-neutral">${EW.esc(a.city)}</span>
          </div>
          <p style="margin:6px 0 8px; font-size:0.9rem;">${EW.esc(a.bio)}</p>
          <div style="font-size:0.84rem;"><strong>Languages:</strong> ${EW.esc(a.languages)} · <strong>Skills:</strong> ${EW.esc(a.skills || '—')}</div>
          <div style="margin-top:10px; padding:10px 12px; border-radius:10px; background:var(--bg-ivory); font-size:0.86rem;">
            <div><strong>Email:</strong> <span class="mono">${EW.esc(a.email)}</span></div>
            <div><strong>Phone:</strong> <span class="mono">${EW.esc(a.phone)}</span></div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
            ${!a.contactUnlocked ? `<button type="button" onclick="unlockArtistContact(${a.id})" class="btn btn-primary btn-sm">Unlock Contact</button>` : ''}
            <button type="button" onclick="verifyArtistFromModal(${a.id}, ${!a.profileVerified})" class="btn btn-outline-dark btn-sm">${a.profileVerified ? 'Revoke Verification' : '✓ Verify Actor Profile'}</button>
            <button type="button" onclick="closeArtistModal(); EWOps.openAuditionModal(${a.id})" class="btn btn-dark btn-sm">🎬 Schedule Audition</button>
          </div>
        </div>
      </div>
      ${a.hasVideo && a.videoUrl ? `
        <h4 style="margin-bottom:8px;">Self-Tape Audition: ${EW.esc(a.videoTitle)}</h4>
        <video controls style="width:100%; border-radius:14px; background:#000;" src="${EW.esc(a.videoUrl)}"></video>` : ''}`;
    document.getElementById('artist-modal').classList.add('open');
  }

  // Expose helper for ops module
  window.viewArtistPortfolio = window.viewArtistPortfolio;
  window.openAppReviewModal = window.openAppReviewModal;

  switchSection('dashboard');
})();
