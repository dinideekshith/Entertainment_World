/**
 * Entertainment World — Casting Company Operations Modules:
 * Audition Management, Shortlist & Comparison, Messages & Alerts,
 * Reports & Analytics (with Excel + PDF Export), Team Management, and Contracts & Expenses.
 */
window.EWOps = (() => {
  const dash = () => document.getElementById('dash-view');

  async function fetchDropdownRefs() {
    const [artists, projects] = await Promise.all([
      EW.api('/api/dashboard/artists/all'),
      EW.api('/api/dashboard/projects?filter=ALL')
    ]);
    return { artists, projects };
  }

  function showLoading(label = 'Loading...') {
    dash().innerHTML = `<div class="card" style="padding:48px; text-align:center;"><div class="ew-loader" style="margin-bottom:10px;"></div><div style="font-weight:700;">${EW.esc(label)}</div></div>`;
  }

  // ================= 5. AUDITION MANAGEMENT =================
  let audFilter = { status: 'ALL', type: 'ALL', projectId: '' };

  async function renderAuditions() {
    showLoading('Loading Audition Schedules...');
    const qs = new URLSearchParams({ status: audFilter.status, type: audFilter.type });
    if (audFilter.projectId) qs.set('projectId', audFilter.projectId);
    const [{ auditions }, refs] = await Promise.all([
      EW.api(`/api/dashboard/auditions?${qs}`),
      fetchDropdownRefs()
    ]);

    dash().innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
        <div>
          <h2>Audition Management</h2>
          <p style="margin:4px 0 0; color:var(--text-muted); font-size:0.88rem;">Schedule online &amp; offline auditions, watch self-tapes, record feedback ratings, reschedule or cancel.</p>
        </div>
        <button type="button" onclick="EWOps.openAuditionModal()" class="btn btn-primary btn-sm">+ Schedule Audition</button>
      </div>

      <div class="card" style="padding:14px 18px; margin-bottom:18px; display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
        <select class="form-select" style="width:180px;" onchange="EWOps.setAudFilter('status', this.value)">
          ${['ALL', 'SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED'].map(s => `<option value="${s}" ${audFilter.status === s ? 'selected' : ''}>Status: ${s}</option>`).join('')}
        </select>
        <select class="form-select" style="width:170px;" onchange="EWOps.setAudFilter('type', this.value)">
          ${['ALL', 'Online', 'Offline'].map(t => `<option value="${t}" ${audFilter.type === t ? 'selected' : ''}>Type: ${t}</option>`).join('')}
        </select>
        <select class="form-select" style="width:240px;" onchange="EWOps.setAudFilter('projectId', this.value)">
          <option value="">All Casting Projects</option>
          ${refs.projects.map(p => `<option value="${p.id}" ${String(audFilter.projectId) === String(p.id) ? 'selected' : ''}>${EW.esc(p.projectTitle)}</option>`).join('')}
        </select>
      </div>

      <div class="ew-table-wrap">
        <table class="ew-tbl">
          <thead>
            <tr>
              <th>Artist</th>
              <th>Project</th>
              <th>Type &amp; Date/Time</th>
              <th>Location / Link</th>
              <th>Status &amp; Rating</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${auditions.map(au => `
              <tr>
                <td>
                  <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${EW.esc(au.artistAvatar)}" style="width:40px; height:40px; border-radius:10px; object-fit:cover;">
                    <div><strong>${EW.esc(au.artistName)}</strong><div style="font-size:0.76rem; color:var(--text-muted);">${EW.esc(au.artistCategory)}</div></div>
                  </div>
                </td>
                <td><strong>${EW.esc(au.projectTitle)}</strong></td>
                <td>
                  <span class="badge badge-neutral">${EW.esc(au.auditionType)}</span>
                  <div class="mono" style="font-size:0.8rem; margin-top:4px;">${EW.esc(au.scheduledDate)} · ${EW.esc(au.scheduledTime)}</div>
                </td>
                <td style="max-width:220px; font-size:0.82rem;">${EW.esc(au.locationOrLink)}${au.feedback ? `<div style="color:var(--text-muted); margin-top:3px;">💬 ${EW.esc(au.feedback)}</div>` : ''}</td>
                <td>
                  <span class="badge ${EW.badgeClass(au.status === 'COMPLETED' ? 'verified' : au.status === 'CANCELLED' ? 'rejected' : 'pending')}">${EW.esc(au.status)}</span>
                  ${au.rating ? `<div style="color:#B45309; font-weight:800; margin-top:4px;">${'★'.repeat(au.rating)}${'☆'.repeat(5 - au.rating)}</div>` : ''}
                </td>
                <td>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${au.auditionVideoUrl ? `<button type="button" class="btn btn-dark btn-sm" onclick="playVideoModal('${EW.esc(au.auditionVideoUrl)}', '${EW.esc(au.artistName)} — Audition Video')">▶ Video</button>` : ''}
                    <button type="button" class="btn btn-outline-dark btn-sm" onclick='EWOps.openAuditionEdit(${JSON.stringify(au).replace(/'/g, "&#39;")})'>Reschedule / Rate</button>
                    ${au.status !== 'CANCELLED' ? `<button type="button" class="btn btn-outline-dark btn-sm" style="color:var(--crimson);" onclick="EWOps.cancelAudition(${au.id})">Cancel</button>` : ''}
                  </div>
                </td>
              </tr>`).join('') || '<tr><td colspan="6" style="text-align:center; padding:34px; color:var(--text-muted);">No auditions scheduled yet. Click "+ Schedule Audition" to invite an actor.</td></tr>'}
          </tbody>
        </table>
      </div>`;
  }

  function setAudFilter(k, v) { audFilter[k] = v; renderAuditions(); }

  async function openAuditionModal(presetArtistId = null, presetProjectId = null) {
    const refs = await fetchDropdownRefs();
    if (!refs.projects.length) return EW.toast('Create a casting project first.', 'error');
    document.getElementById('aud-id').value = '';
    document.getElementById('aud-modal-title').textContent = 'Schedule Online / Offline Audition';
    document.getElementById('aud-project').innerHTML = refs.projects.map(p => `<option value="${p.id}">${EW.esc(p.projectTitle)}</option>`).join('');
    document.getElementById('aud-artist').innerHTML = refs.artists.map(a => `<option value="${a.id}">${EW.esc(a.fullName)} (${EW.esc(a.category)})</option>`).join('');
    if (presetProjectId) document.getElementById('aud-project').value = presetProjectId;
    if (presetArtistId) document.getElementById('aud-artist').value = presetArtistId;
    document.getElementById('aud-project').disabled = false;
    document.getElementById('aud-artist').disabled = false;
    document.getElementById('aud-type').value = 'Online';
    document.getElementById('aud-date').value = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);
    document.getElementById('aud-time').value = '11:30';
    document.getElementById('aud-status').value = 'SCHEDULED';
    document.getElementById('aud-loc').value = 'https://meet.entertainmentworld.in/room/ew-live';
    document.getElementById('aud-notes').value = '';
    document.getElementById('audition-modal').classList.add('open');
  }

  async function openAuditionEdit(au) {
    const refs = await fetchDropdownRefs();
    document.getElementById('aud-id').value = au.id;
    document.getElementById('aud-modal-title').textContent = `Manage Audition — ${au.artistName}`;
    document.getElementById('aud-project').innerHTML = refs.projects.map(p => `<option value="${p.id}">${EW.esc(p.projectTitle)}</option>`).join('');
    document.getElementById('aud-artist').innerHTML = refs.artists.map(a => `<option value="${a.id}">${EW.esc(a.fullName)}</option>`).join('');
    document.getElementById('aud-project').value = au.projectId;
    document.getElementById('aud-artist').value = au.artistId;
    document.getElementById('aud-project').disabled = true;
    document.getElementById('aud-artist').disabled = true;
    document.getElementById('aud-type').value = au.auditionType;
    document.getElementById('aud-date').value = au.scheduledDate;
    document.getElementById('aud-time').value = au.scheduledTime;
    document.getElementById('aud-status').value = au.status === 'SCHEDULED' ? 'RESCHEDULED' : au.status;
    document.getElementById('aud-loc').value = au.locationOrLink;
    document.getElementById('aud-notes').value = au.feedback || au.notes || '';
    document.getElementById('audition-modal').classList.add('open');
  }

  async function cancelAudition(id) {
    await EW.api(`/api/dashboard/auditions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' })
    });
    EW.toast('Audition cancelled');
    renderAuditions();
  }

  function wireAuditionForm() {
    const f = document.getElementById('audition-form');
    if (!f || f.dataset.wired) return;
    f.dataset.wired = '1';
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const id = document.getElementById('aud-id').value;
      const payload = {
        projectId: Number(document.getElementById('aud-project').value),
        artistId: Number(document.getElementById('aud-artist').value),
        auditionType: document.getElementById('aud-type').value,
        scheduledDate: document.getElementById('aud-date').value,
        scheduledTime: document.getElementById('aud-time').value,
        status: document.getElementById('aud-status').value,
        locationOrLink: document.getElementById('aud-loc').value,
        notes: document.getElementById('aud-notes').value,
        feedback: document.getElementById('aud-notes').value,
        rating: document.getElementById('aud-status').value === 'COMPLETED' ? 5 : null
      };
      if (id) {
        await EW.api(`/api/dashboard/auditions/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        EW.toast('Audition updated!');
      } else {
        await EW.api('/api/dashboard/auditions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        EW.toast('Audition scheduled & invitation sent to actor!');
      }
      closeModal('audition-modal');
      if (typeof window.switchSection === 'function') renderAuditions();
    });
  }

  // ================= 6. SHORTLIST & SELECTION STUDIO + COMPARISON =================
  async function renderShortlistSelection() {
    showLoading('Loading Shortlist & Final Selections...');
    const data = await EW.api('/api/dashboard/selection-summary');
    const renderList = (items, emptyText, accent) => items.length ? items.map(it => `
      <div class="card" style="padding:14px; margin-bottom:10px; border-left:4px solid ${accent};">
        <div style="display:flex; gap:12px; align-items:center;">
          <input type="checkbox" class="compare-pick" value="${it.artist.id}" style="width:18px; height:18px; accent-color:var(--crimson);">
          <img src="${EW.esc(it.artist.avatarUrl)}" style="width:52px; height:52px; border-radius:12px; object-fit:cover;">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:800;">${EW.esc(it.artist.fullName)} ${it.artist.profileVerified ? '<span class="badge badge-approved" style="font-size:0.65rem;">✓ Verified</span>' : ''}</div>
            <div style="font-size:0.78rem; color:var(--text-muted);">${EW.esc(it.roleName)} · ${EW.esc(it.projectTitle)}</div>
            ${it.rating ? `<div style="font-size:0.78rem; color:#B45309; font-weight:800;">${'★'.repeat(it.rating)} (${it.rating}/5)</div>` : ''}
            ${it.internalComment ? `<div style="font-size:0.76rem; color:var(--text-body); margin-top:2px;">"${EW.esc(it.internalComment)}"</div>` : ''}
          </div>
          <div style="display:flex; flex-direction:column; gap:5px;">
            <button type="button" class="btn btn-outline-dark btn-sm" onclick="viewArtistPortfolio(${it.artist.id})">Portfolio</button>
            <button type="button" class="btn btn-dark btn-sm" onclick='openAppReviewModal(${JSON.stringify({ applicationId: it.applicationId, applicationStatus: it.status, rating: it.rating || 5, assignedRole: it.roleName, internalComment: it.internalComment || "", artist: it.artist }).replace(/'/g, "&#39;")})'>Change Role</button>
          </div>
        </div>
      </div>`).join('') : `<div class="card" style="padding:22px; text-align:center; color:var(--text-muted); font-size:0.86rem;">${emptyText}</div>`;

    dash().innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
        <div>
          <h2>Actor Shortlisting, Comparison &amp; Selection</h2>
          <p style="margin:4px 0 0; color:var(--text-muted); font-size:0.88rem;">Check 2–4 actors to compare side-by-side, assign roles for final selection, or maintain backup lists.</p>
        </div>
        <button type="button" onclick="EWOps.compareCheckedActors()" class="btn btn-primary btn-sm">⚖️ Compare Selected Actors</button>
      </div>

      <div id="compare-stage"></div>

      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:18px; align-items:start;">
        <div>
          <h3 style="margin-bottom:10px; color:var(--emerald);">✓ Final Selections (${data.selected.length})</h3>
          ${renderList(data.selected, 'No final selections locked yet.', 'var(--emerald)')}
        </div>
        <div>
          <h3 style="margin-bottom:10px; color:#B45309;">🛡️ Backup Actor List (${data.backup.length})</h3>
          ${renderList(data.backup, 'No backup candidates saved yet.', 'var(--gold)')}
        </div>
        <div>
          <h3 style="margin-bottom:10px; color:var(--crimson);">⭐ Shortlisted Pool (${data.shortlisted.length})</h3>
          ${renderList(data.shortlisted, 'No shortlisted actors yet.', 'var(--crimson)')}
        </div>
      </div>`;
  }

  async function compareCheckedActors(explicitIds = null) {
    const ids = explicitIds || Array.from(document.querySelectorAll('.compare-pick:checked')).map(c => Number(c.value));
    if (ids.length < 2) return EW.toast('Check 2 to 4 actors first to compare side-by-side.', 'error');
    const res = await EW.api('/api/dashboard/artists/compare', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artistIds: ids })
    });
    const actors = res.actors || [];
    const html = `
      <div class="card" style="padding:20px; margin-bottom:20px; overflow-x:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3>Side-by-Side Actor Comparison</h3>
          <button type="button" onclick="document.getElementById('compare-stage').innerHTML=''" class="btn btn-outline-dark btn-sm">Close</button>
        </div>
        <table class="ew-tbl">
          <thead>
            <tr>
              <th>Attribute</th>
              ${actors.map(a => `<th><img src="${EW.esc(a.avatarUrl)}" style="width:54px; height:54px; border-radius:12px; object-fit:cover; margin-bottom:6px;"><br>${EW.esc(a.fullName)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr><td><strong>Category &amp; Age</strong></td>${actors.map(a => `<td>${EW.esc(a.category)} · ${a.age} yrs (${EW.esc(a.gender)})</td>`).join('')}</tr>
            <tr><td><strong>City &amp; Languages</strong></td>${actors.map(a => `<td>${EW.esc(a.city)}<br><small>${EW.esc(a.languages)}</small></td>`).join('')}</tr>
            <tr><td><strong>Experience &amp; Skills</strong></td>${actors.map(a => `<td><strong>${EW.esc(a.expertise)}</strong><br><small>${EW.esc(a.skills || '—')}</small></td>`).join('')}</tr>
            <tr><td><strong>Verified &amp; Rating</strong></td>${actors.map(a => `<td>${a.profileVerified ? '✓ Verified' : 'Pending'} · ${a.avgRating ? '★ ' + a.avgRating : 'Unrated'}</td>`).join('')}</tr>
            <tr><td><strong>Showreel / Portfolio</strong></td>${actors.map(a => `<td>${a.videoUrl ? `<button class="btn btn-dark btn-sm" onclick="playVideoModal('${EW.esc(a.videoUrl)}', '${EW.esc(a.fullName)}')">▶ Play Reel</button>` : 'Photos Only'}</td>`).join('')}</tr>
          </tbody>
        </table>
      </div>`;
    const stage = document.getElementById('compare-stage');
    if (stage) {
      stage.innerHTML = html;
    } else {
      document.getElementById('am-title').textContent = 'Compare Actors';
      document.getElementById('am-body').innerHTML = html;
      document.getElementById('artist-modal').classList.add('open');
    }
  }

  // ================= 7. COMMUNICATION & NOTIFICATIONS =================
  async function renderMessagesCenter() {
    showLoading('Loading Messages & Communication History...');
    const [msgData, refs] = await Promise.all([EW.api('/api/dashboard/messages'), fetchDropdownRefs()]);
    dash().innerHTML = `
      <div style="display:grid; grid-template-columns:0.95fr 1.4fr; gap:20px; align-items:start;">
        <div class="card" style="padding:22px;">
          <h3 style="margin-bottom:14px;">Send Message / Notice to Actor</h3>
          <form id="msg-send-form">
            <div style="display:flex; flex-direction:column; gap:12px;">
              <div>
                <label class="form-label">Select Actor</label>
                <select id="msg-artist" class="form-select" required>
                  ${refs.artists.map(a => `<option value="${a.id}">${EW.esc(a.fullName)} (${EW.esc(a.category)})</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="form-label">Related Project</label>
                <select id="msg-project" class="form-select">
                  <option value="">General Communication</option>
                  ${refs.projects.map(p => `<option value="${p.id}">${EW.esc(p.projectTitle)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="form-label">Message Type</label>
                <select id="msg-type" class="form-select">
                  <option value="DIRECT_MESSAGE">Direct Message</option>
                  <option value="AUDITION_INVITE">Audition Invitation</option>
                  <option value="SELECTION_NOTICE">Selection Notification</option>
                  <option value="REJECTION_NOTICE">Rejection Notification</option>
                </select>
              </div>
              <div>
                <label class="form-label">Subject</label>
                <input id="msg-subject" class="form-control" required placeholder="e.g. Callback Confirmation for Lead Role">
              </div>
              <div>
                <label class="form-label">Message</label>
                <textarea id="msg-body" class="form-textarea" required placeholder="Write audition instructions, selection details, or direct message..."></textarea>
              </div>
              <button type="submit" class="btn btn-primary">Send Message →</button>
            </div>
          </form>
        </div>

        <div class="card" style="padding:22px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3>Communication History (${msgData.messages.length})</h3>
            <button type="button" onclick="markAllRead()" class="btn btn-outline-dark btn-sm">Mark Bell Alerts Read</button>
          </div>
          ${msgData.messages.map(m => `
            <div style="padding:14px; border:1px solid var(--border-light); border-radius:14px; margin-bottom:10px; background:var(--bg-ivory);">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px;">
                <strong>${EW.esc(m.subject)}</strong>
                <span class="badge badge-neutral">${EW.esc(m.messageType)}</span>
              </div>
              <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:6px;">
                To: <strong>${EW.esc(m.artistName)}</strong> · Project: ${EW.esc(m.projectTitle)} · <span class="mono">${EW.esc(String(m.sentAt).replace('T', ' ').slice(0, 16))}</span>
              </div>
              <p style="margin:0; font-size:0.86rem; color:var(--text-body);">${EW.esc(m.body)}</p>
            </div>`).join('') || '<div style="text-align:center; padding:32px; color:var(--text-muted);">No messages sent yet.</div>'}
        </div>
      </div>`;

    document.getElementById('msg-send-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await EW.api('/api/dashboard/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId: Number(document.getElementById('msg-artist').value),
          projectId: document.getElementById('msg-project').value ? Number(document.getElementById('msg-project').value) : null,
          messageType: document.getElementById('msg-type').value,
          subject: document.getElementById('msg-subject').value,
          body: document.getElementById('msg-body').value
        })
      });
      EW.toast('Message sent and logged to communication history!');
      renderMessagesCenter();
    });
  }

  // ================= 8. REPORTS & ANALYTICS =================
  async function renderReports() {
    showLoading('Generating Real-Time Casting Reports...');
    const rep = await EW.api('/api/dashboard/reports');
    const au = rep.auditionStats;
    const catEntries = Object.entries(rep.actorCategoryCounts || {});
    const maxCat = Math.max(1, ...catEntries.map(([, v]) => v));

    dash().innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
        <div>
          <h2>Reports &amp; Analytics</h2>
          <p style="margin:4px 0 0; color:var(--text-muted); font-size:0.88rem;">Live MySQL reports for actor registrations, project funnels, audition outcomes, and finances.</p>
        </div>
        <div style="display:flex; gap:10px;">
          <a href="/api/dashboard/reports/export-excel" class="btn btn-outline-dark btn-sm">📥 Export Excel (.xls)</a>
          <a href="/api/dashboard/reports/export-pdf" class="btn btn-primary btn-sm">📄 Export PDF Report</a>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:14px; margin-bottom:20px;">
        <div class="card" style="padding:18px;"><div class="kpi-lbl">Registered Actors</div><div class="kpi-val">${rep.totalRegisteredActors}</div><small>${rep.verifiedActorsCount} verified</small></div>
        <div class="card" style="padding:18px;"><div class="kpi-lbl">Audition Statistics</div><div class="kpi-val">${au.total}</div><small>${au.online} Online · ${au.offline} Offline · Avg ★ ${au.avgRating}</small></div>
        <div class="card" style="padding:18px;"><div class="kpi-lbl">Production Expenses</div><div class="kpi-val">${EW.formatInr(rep.totalExpensesInr)}</div><small>Tracked studio &amp; artist fees</small></div>
        <div class="card" style="padding:18px;"><div class="kpi-lbl">Pass Subscriptions</div><div class="kpi-val">${EW.formatInr(rep.totalSubscriptionSpendInr)}</div><small>Verified pass ledger</small></div>
      </div>

      <div style="display:grid; grid-template-columns:1.5fr 0.9fr; gap:20px; align-items:start;">
        <div class="ew-table-wrap">
          <div style="padding:16px 18px; border-bottom:1px solid var(--border-light);"><h3>Project-Wise Application &amp; Selection Report</h3></div>
          <table class="ew-tbl">
            <thead>
              <tr><th>Project</th><th>Status</th><th>Apps</th><th>Shortlisted</th><th>Invited</th><th>Selected</th><th>Backup</th><th>Rejected</th></tr>
            </thead>
            <tbody>
              ${rep.projectReports.map(r => `
                <tr>
                  <td><strong>${EW.esc(r.projectTitle)}</strong><div style="font-size:0.74rem; color:var(--text-muted);">${EW.esc(r.targetCategory)}</div></td>
                  <td><span class="badge ${EW.badgeClass(r.status === 'ACTIVE' ? 'approved' : 'pending')}">${EW.esc(r.status)}</span></td>
                  <td><strong>${r.totalApplications}</strong></td>
                  <td>${r.shortlisted}</td>
                  <td>${r.invited}</td>
                  <td style="color:var(--emerald); font-weight:800;">${r.selected}</td>
                  <td>${r.backup}</td>
                  <td>${r.rejected}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="chart-card">
          <h3 style="margin-bottom:14px;">Actor Registration by Category</h3>
          ${catEntries.map(([cat, count]) => `
            <div class="bar-row">
              <div class="bar-lbl">${EW.esc(cat)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${Math.round((count / maxCat) * 100)}%; background:var(--bg-obsidian);"></div></div>
              <strong class="mono">${count}</strong>
            </div>`).join('')}
        </div>
      </div>`;
  }

  // ================= 9. TEAM MANAGEMENT =================
  async function renderTeam() {
    showLoading('Loading Casting Team...');
    const data = await EW.api('/api/dashboard/team');
    const members = data.members || [];
    const projects = data.projects || [];
    const projNameById = Object.fromEntries(projects.map(p => [String(p.id), p.projectTitle]));
    const permsList = ['Manage Projects', 'Verify Actors', 'Schedule Auditions', 'Approve Selections', 'View Reports', 'Manage Contracts'];

    dash().innerHTML = `
      <div style="display:grid; grid-template-columns:0.95fr 1.4fr; gap:20px; align-items:start;">
        <div class="card" style="padding:22px;">
          <h3 style="margin-bottom:14px;">Add Casting Assistant / Coordinator</h3>
          <form id="team-add-form">
            <div style="display:flex; flex-direction:column; gap:10px;">
              <div><label class="form-label">Full Name</label><input id="tm-name" class="form-control" required placeholder="e.g. Aarohi Kulkarni"></div>
              <div><label class="form-label">Email</label><input id="tm-email" type="email" class="form-control" required placeholder="aarohi@yourstudio.in"></div>
              <div><label class="form-label">Phone</label><input id="tm-phone" class="form-control" placeholder="+91 98XXXXXXXX"></div>
              <div><label class="form-label">Role</label>
                <select id="tm-role" class="form-select">
                  <option>Casting Assistant</option>
                  <option>Talent Coordinator</option>
                  <option>Casting Director</option>
                  <option>Finance &amp; Contracts</option>
                </select>
              </div>
              <div>
                <label class="form-label">Assign Projects</label>
                <div style="max-height:110px; overflow-y:auto; padding:8px; border:1px solid var(--border-light); border-radius:10px;">
                  ${projects.map(p => `<label style="display:flex; gap:6px; font-size:0.82rem; margin-bottom:4px;"><input type="checkbox" class="tm-proj-cb" value="${p.id}"> ${EW.esc(p.projectTitle)}</label>`).join('')}
                </div>
              </div>
              <div>
                <label class="form-label">Permissions</label>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; font-size:0.78rem;">
                  ${permsList.map(pm => `<label style="display:flex; gap:5px; align-items:center;"><input type="checkbox" class="tm-perm-cb" value="${pm}" checked> ${pm}</label>`).join('')}
                </div>
              </div>
              <button type="submit" class="btn btn-primary" style="margin-top:6px;">+ Add Team Member</button>
            </div>
          </form>
        </div>

        <div class="ew-table-wrap">
          <div style="padding:16px 18px; border-bottom:1px solid var(--border-light);"><h3>Casting Team &amp; Project Assignments (${members.length})</h3></div>
          <table class="ew-tbl">
            <thead><tr><th>Member</th><th>Role &amp; Permissions</th><th>Assigned Projects</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${members.map(m => {
                const projLabels = (m.assignedProjectIds || '').split(',').filter(Boolean).map(id => projNameById[id.trim()] || `#${id}`).join(', ') || 'Unassigned';
                return `
                <tr>
                  <td><strong>${EW.esc(m.fullName)}</strong><div style="font-size:0.78rem; color:var(--text-muted);">${EW.esc(m.email)}</div></td>
                  <td><span class="badge badge-neutral">${EW.esc(m.roleTitle)}</span><div style="font-size:0.74rem; color:var(--text-muted); margin-top:4px;">${EW.esc(m.permissions)}</div></td>
                  <td style="font-size:0.8rem;">${EW.esc(projLabels)}</td>
                  <td><span class="badge ${EW.badgeClass(m.status === 'ACTIVE' ? 'active' : 'suspended')}">${EW.esc(m.status)}</span></td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-outline-dark btn-sm" onclick="EWOps.toggleTeamStatus(${m.id}, '${m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}')">${m.status === 'ACTIVE' ? 'Pause' : 'Activate'}</button>
                      <button class="btn btn-outline-dark btn-sm" style="color:var(--crimson);" onclick="EWOps.deleteTeamMember(${m.id})">Remove</button>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    document.getElementById('team-add-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const assignedProjectIds = Array.from(document.querySelectorAll('.tm-proj-cb:checked')).map(c => c.value).join(',');
      const permissions = Array.from(document.querySelectorAll('.tm-perm-cb:checked')).map(c => c.value).join(',');
      await EW.api('/api/dashboard/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: document.getElementById('tm-name').value,
          email: document.getElementById('tm-email').value,
          phone: document.getElementById('tm-phone').value,
          roleTitle: document.getElementById('tm-role').value,
          assignedProjectIds,
          permissions
        })
      });
      EW.toast('Team member added!');
      renderTeam();
    });
  }

  async function toggleTeamStatus(id, status) {
    await EW.api(`/api/dashboard/team/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
    });
    renderTeam();
  }
  async function deleteTeamMember(id) {
    await EW.api(`/api/dashboard/team/${id}`, { method: 'DELETE' });
    EW.toast('Team member removed');
    renderTeam();
  }

  // ================= 10. CONTRACTS, DOC VERIFICATION & EXPENSES =================
  async function renderContractsAndExpenses() {
    showLoading('Loading Contracts & Production Expenses...');
    const [cData, eData, refs] = await Promise.all([
      EW.api('/api/dashboard/contracts'),
      EW.api('/api/dashboard/expenses'),
      fetchDropdownRefs()
    ]);

    dash().innerHTML = `
      <h2 style="margin-bottom:16px;">Contracts, Actor Document Verification &amp; Expense Tracking</h2>

      <div style="display:grid; grid-template-columns:0.9fr 1.5fr; gap:20px; align-items:start; margin-bottom:24px;">
        <div class="card" style="padding:20px;">
          <h3 style="margin-bottom:12px;">Create Artist Contract</h3>
          <form id="contract-form" enctype="multipart/form-data">
            <div style="display:flex; flex-direction:column; gap:10px;">
              <select name="projectId" class="form-select" required>${refs.projects.map(p => `<option value="${p.id}">${EW.esc(p.projectTitle)}</option>`).join('')}</select>
              <select name="artistId" class="form-select" required>${refs.artists.map(a => `<option value="${a.id}">${EW.esc(a.fullName)} (${EW.esc(a.category)})</option>`).join('')}</select>
              <input name="contractTitle" class="form-control" required placeholder="Contract title (e.g. Lead Actor Agreement)">
              <input name="roleName" class="form-control" required placeholder="Assigned character / role">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <input name="compensationInr" type="number" class="form-control" required placeholder="Amount (INR)">
                <select name="paymentBasis" class="form-select"><option>Per project</option><option>Per day</option><option>Per episode</option></select>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <select name="contractStatus" class="form-select"><option value="DRAFT">Draft</option><option value="SENT">Sent</option><option value="SIGNED">Signed</option></select>
                <select name="documentVerificationStatus" class="form-select"><option value="PENDING">Docs Pending</option><option value="VERIFIED">Docs Verified</option></select>
              </div>
              <input type="file" name="contractFile" class="form-control" accept=".pdf,image/*">
              <button type="submit" class="btn btn-primary btn-sm">Create Contract</button>
            </div>
          </form>
        </div>

        <div class="ew-table-wrap">
          <div style="padding:14px 18px; border-bottom:1px solid var(--border-light);"><h3>Artist Contracts &amp; KYC Verification</h3></div>
          <table class="ew-tbl">
            <thead><tr><th>Contract &amp; Actor</th><th>Compensation</th><th>Contract Status</th><th>KYC Verification</th><th>Action</th></tr></thead>
            <tbody>
              ${cData.contracts.map(c => `
                <tr>
                  <td><strong>${EW.esc(c.contractTitle)}</strong><div style="font-size:0.78rem; color:var(--text-muted);">${EW.esc(c.artistName)} · ${EW.esc(c.roleName)}</div></td>
                  <td><strong>${EW.formatInr(c.compensationInr)}</strong><div style="font-size:0.74rem; color:var(--text-muted);">${EW.esc(c.paymentBasis)}</div></td>
                  <td><span class="badge ${EW.badgeClass(c.contractStatus === 'SIGNED' || c.contractStatus === 'COMPLETED' ? 'approved' : 'pending')}">${EW.esc(c.contractStatus)}</span></td>
                  <td><span class="badge ${EW.badgeClass(c.documentVerificationStatus)}">${EW.esc(c.documentVerificationStatus)}</span></td>
                  <td>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">
                      ${c.contractFilePath ? `<a href="${EW.esc(c.contractFilePath)}" target="_blank" class="btn btn-outline-dark btn-sm">File ↗</a>` : ''}
                      <button class="btn btn-dark btn-sm" onclick="EWOps.updateContract(${c.id}, 'SIGNED', 'VERIFIED')">Mark Signed &amp; Verified</button>
                    </div>
                  </td>
                </tr>`).join('') || '<tr><td colspan="5" style="text-align:center; padding:26px; color:var(--text-muted);">No artist contracts created yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:0.9fr 1.5fr; gap:20px; align-items:start;">
        <div class="card" style="padding:20px;">
          <h3 style="margin-bottom:12px;">Log Payment / Expense</h3>
          <form id="expense-form">
            <div style="display:flex; flex-direction:column; gap:10px;">
              <select id="exp-cat" class="form-select"><option>Artist Fee</option><option>Audition Studio</option><option>Travel &amp; Stay</option><option>Crew &amp; Gear</option><option>Other</option></select>
              <input id="exp-desc" class="form-control" required placeholder="Expense description">
              <input id="exp-amt" type="number" class="form-control" required placeholder="Amount (INR)">
              <select id="exp-status" class="form-select"><option value="PAID">PAID</option><option value="PENDING">PENDING</option></select>
              <button type="submit" class="btn btn-dark btn-sm">+ Log Expense</button>
            </div>
          </form>
        </div>

        <div class="ew-table-wrap">
          <div style="padding:14px 18px; border-bottom:1px solid var(--border-light); display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <h3>Production Payment &amp; Expense Ledger</h3>
            <div style="font-size:0.84rem;">Paid: <strong style="color:var(--emerald);">${EW.formatInr(eData.paidSpend)}</strong> · Pending: <strong style="color:var(--crimson);">${EW.formatInr(eData.pendingSpend)}</strong></div>
          </div>
          <table class="ew-tbl">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              ${eData.expenses.map(e => `
                <tr>
                  <td class="mono">${EW.esc(e.expenseDate)}</td>
                  <td><span class="badge badge-neutral">${EW.esc(e.category)}</span></td>
                  <td>${EW.esc(e.description)}</td>
                  <td><strong>${EW.formatInr(e.amountInr)}</strong></td>
                  <td>
                    <button class="btn btn-sm ${e.paymentStatus === 'PAID' ? 'btn-outline-dark' : 'btn-primary'}" onclick="EWOps.toggleExpense(${e.id}, '${e.paymentStatus === 'PAID' ? 'PENDING' : 'PAID'}')">${EW.esc(e.paymentStatus)}</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    document.getElementById('contract-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await EW.api('/api/dashboard/contracts', { method: 'POST', body: new FormData(ev.target) });
      EW.toast('Contract saved!');
      renderContractsAndExpenses();
    });

    document.getElementById('expense-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await EW.api('/api/dashboard/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: document.getElementById('exp-cat').value,
          description: document.getElementById('exp-desc').value,
          amountInr: document.getElementById('exp-amt').value,
          paymentStatus: document.getElementById('exp-status').value
        })
      });
      EW.toast('Expense logged!');
      renderContractsAndExpenses();
    });
  }

  async function updateContract(id, contractStatus, documentVerificationStatus) {
    await EW.api(`/api/dashboard/contracts/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractStatus, documentVerificationStatus })
    });
    EW.toast('Contract marked Signed & KYC Verified!');
    renderContractsAndExpenses();
  }

  async function toggleExpense(id, paymentStatus) {
    await EW.api(`/api/dashboard/expenses/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentStatus })
    });
    renderContractsAndExpenses();
  }

  wireAuditionForm();

  return {
    renderAuditions,
    setAudFilter,
    openAuditionModal,
    openAuditionEdit,
    cancelAudition,
    renderShortlistSelection,
    compareCheckedActors,
    renderMessagesCenter,
    renderReports,
    renderTeam,
    toggleTeamStatus,
    deleteTeamMember,
    renderContractsAndExpenses,
    updateContract,
    toggleExpense
  };
})();
