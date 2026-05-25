/* ─── DTC Admin — Customers Module (directory + detail view) ─────────────── */

'use strict';

const Customers = (() => {

  const PM_LABELS = { alipay:'Alipay', wechat_pay:'WeChat Pay', bank_transfer:'Bank Transfer', paypal:'PayPal', crypto:'Crypto', cash:'Cash', other:'Other' };
  const PM_ICONS  = { alipay:'🔵', wechat_pay:'💚', bank_transfer:'🏦', paypal:'🅿', crypto:'₿', cash:'💵', other:'💳' };
  const AVATAR_COLORS = ['#2563eb','#10a37f','#7c3aed','#d97706','#0891b2','#dc2626','#059669','#db2777'];

  let _tokens   = {};       // raw token map from Store
  let _grouped  = [];       // [{name, email, wechat, color, initials, subs:[]}]
  let _selected = null;     // selected customer name key
  let _detabFilter = 'all'; // active/expired/declined/refunded/all
  let _searchQ  = '';

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const _initials = (name) => {
    const parts = (name || '').trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : (name || '?').slice(0, 2).toUpperCase();
  };

  const _avatarColor = (name) => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  };

  const _daysUntil = (dateStr) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  };

  const _subStatus = (t) => {
    if (t.refunded)   return 'refunded';
    if (t.declined)   return 'declined';
    if (t.deactivated)return 'deactivated';
    if (!t.approved)  return 'pending';
    const d = _daysUntil(t.subscriptionExpiresAt);
    if (d === null)   return 'active';
    return d < 0 ? 'expired' : 'active';
  };

  const _custOverallStatus = (subs) => {
    if (subs.some(s => _subStatus(s) === 'active'))  return 'active';
    if (subs.some(s => _subStatus(s) === 'pending')) return 'pending';
    return 'inactive';
  };

  // ── Group tokens by customer name ────────────────────────────────────────────

  const _buildGroups = () => {
    const map = {};
    for (const [tok, t] of Object.entries(_tokens)) {
      const key = (t.customerName || '').toLowerCase().trim();
      if (!key) continue;
      if (!map[key]) {
        const color = _avatarColor(t.customerName);
        map[key] = {
          key,
          name:     t.customerName,
          email:    t.email    || '',
          wechat:   t.wechat   || '',
          initials: _initials(t.customerName),
          color,
          subs: [],
        };
      }
      // Update contact details from latest approved sub
      if (t.email)   map[key].email  = t.email;
      if (t.wechat)  map[key].wechat = t.wechat;
      map[key].subs.push({ token: tok, ...t });
    }
    // Sort subs newest first
    for (const g of Object.values(map)) {
      g.subs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    // Sort customers: active first, then by name
    return Object.values(map).sort((a, b) => {
      const sa = _custOverallStatus(a.subs), sb = _custOverallStatus(b.subs);
      if (sa === sb) return a.name.localeCompare(b.name);
      if (sa === 'active') return -1;
      if (sb === 'active') return 1;
      return a.name.localeCompare(b.name);
    });
  };

  // ── Stats for a customer ─────────────────────────────────────────────────────

  const _custStats = (subs) => {
    const paid     = subs.filter(s => !s.refunded && s.approved).reduce((a, s) => a + (s.price || 0), 0);
    const refunded = subs.filter(s => s.refunded).reduce((a, s) => a + (s.price || 0), 0);
    const active   = subs.filter(s => _subStatus(s) === 'active').length;
    const total    = subs.length;
    return { paid, refunded, net: paid - refunded, active, total };
  };

  // ── Render list column ────────────────────────────────────────────────────────

  const _renderList = () => {
    const q = _searchQ.toLowerCase();
    const visible = _grouped.filter(g =>
      !q || g.name.toLowerCase().includes(q) || g.email.toLowerCase().includes(q) || g.wechat.toLowerCase().includes(q)
    );

    const wrap = document.getElementById('cust-dir-list');
    const count = document.getElementById('cust-dir-count');
    if (!wrap) return;
    if (count) count.textContent = `${visible.length} of ${_grouped.length} customers`;

    if (!visible.length) {
      wrap.innerHTML = '<div class="empty" style="padding:1.5rem">No customers found.</div>';
      return;
    }

    wrap.innerHTML = visible.map(g => {
      const st    = _custOverallStatus(g.subs);
      const stats = _custStats(g.subs);
      const isSelected = g.key === _selected;
      const statusDot  = st === 'active'
        ? `<span style="width:7px;height:7px;border-radius:50%;background:var(--success);display:inline-block;flex-shrink:0"></span>`
        : st === 'pending'
        ? `<span style="width:7px;height:7px;border-radius:50%;background:var(--warn);display:inline-block;flex-shrink:0"></span>`
        : `<span style="width:7px;height:7px;border-radius:50%;background:var(--muted2);display:inline-block;flex-shrink:0"></span>`;

      return `<div class="cust-dir-row${isSelected ? ' selected' : ''}" onclick="Customers.select('${esc(g.key)}')">
        <div class="cust-avatar" style="background:${g.color}20;color:${g.color}">${esc(g.initials)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:.35rem;margin-bottom:2px">
            ${statusDot}
            <div class="cust-dir-name" style="font-size:.82rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g.name)}</div>
          </div>
          <div style="font-size:.7rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g.email || g.wechat || '—')}</div>
          <div style="display:flex;gap:.5rem;margin-top:2px;align-items:center">
            <span style="font-size:.68rem;color:var(--muted2)">${stats.total} sub${stats.total !== 1 ? 's' : ''}</span>
            <span style="font-size:.68rem;color:var(--muted2)">·</span>
            <span style="font-size:.68rem;font-weight:600;color:${stats.net > 0 ? 'var(--success)' : 'var(--muted2)'}">$${stats.net.toFixed(2)}</span>
          </div>
        </div>
      </div>`;
    }).join('');
  };

  // ── Render detail pane ────────────────────────────────────────────────────────

  const _renderDetail = () => {
    const pane = document.getElementById('cust-detail-pane');
    if (!pane) return;

    const g = _grouped.find(x => x.key === _selected);
    if (!g) {
      pane.innerHTML = `<div class="cust-dir-empty"><div style="font-size:2.5rem;margin-bottom:.5rem;opacity:.3">👤</div><div style="font-size:.85rem;color:var(--muted2)">Select a customer to view their profile</div></div>`;
      return;
    }

    const stats = _custStats(g.subs);
    const activeSub = g.subs.find(s => _subStatus(s) === 'active');
    const overallSt = _custOverallStatus(g.subs);

    const stBadge = overallSt === 'active'
      ? `<span class="badge b-act">✓ Active</span>`
      : overallSt === 'pending'
      ? `<span class="badge b-sub">⏳ Pending</span>`
      : `<span class="badge b-deact">Inactive</span>`;

    pane.innerHTML = `<div class="cust-detail-inner">

      <!-- Header -->
      <div style="display:flex;align-items:flex-start;gap:.9rem;padding-bottom:1rem;border-bottom:1px solid var(--border);margin-bottom:1rem">
        <div class="cust-avatar" style="width:48px;height:48px;font-size:1rem;background:${g.color}1a;color:${g.color}">${esc(g.initials)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.3rem">
            <div style="font-size:1.1rem;font-weight:700;letter-spacing:-.02em">${esc(g.name)}</div>
            ${stBadge}
          </div>
          <div style="display:flex;gap:1rem;flex-wrap:wrap;font-size:.75rem;color:var(--muted)">
            ${g.email  ? `<span>✉ ${esc(g.email)}</span>` : ''}
            ${g.wechat ? `<span>💬 ${esc(g.wechat)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:.4rem;flex-shrink:0">
          <button class="btn btn-outline btn-sm" onclick="EditSub.open('${activeSub ? esc(activeSub.token) : ''}');return false" ${!activeSub ? 'disabled title="No active subscription"' : ''}>✏ Edit</button>
          <button class="btn btn-outline btn-sm" style="border-color:var(--error);color:var(--error)" onclick="Customers.deleteCustomer('${esc(g.key)}')">🗑 Delete</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="cust-stat-grid">
        <div class="cust-stat"><div class="cust-stat-val" style="color:var(--success)">$${stats.paid.toFixed(2)}</div><div class="cust-stat-lbl">Total paid</div></div>
        <div class="cust-stat"><div class="cust-stat-val" style="color:${stats.refunded > 0 ? 'var(--error)' : 'var(--muted2)'}">$${stats.refunded.toFixed(2)}</div><div class="cust-stat-lbl">Refunded</div></div>
        <div class="cust-stat"><div class="cust-stat-val" style="color:var(--blue)">$${stats.net.toFixed(2)}</div><div class="cust-stat-lbl">Net</div></div>
        <div class="cust-stat"><div class="cust-stat-val">${stats.total}</div><div class="cust-stat-lbl">Subscriptions</div></div>
        <div class="cust-stat"><div class="cust-stat-val" style="color:var(--success)">${stats.active}</div><div class="cust-stat-lbl">Active</div></div>
      </div>

      <!-- Active sub highlight -->
      ${activeSub ? _activeSubBanner(activeSub) : ''}

      <!-- Email actions -->
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1rem">
        <button class="btn btn-ghost-blue btn-sm" onclick="Customers.sendReminderByKey('${esc(g.key)}','reminder')">📧 Send 5-day reminder</button>
        <button class="btn btn-outline btn-sm" style="border-color:var(--error-border);color:var(--error)" onclick="Customers.sendReminderByKey('${esc(g.key)}','expired')">📧 Send expiry notice</button>
      </div>

      <!-- Subscription history tabs -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:.4rem">
        <div style="font-size:.78rem;font-weight:600">Subscription history</div>
        <div style="display:flex;gap:.3rem;flex-wrap:wrap" id="sub-tab-bar">
          ${['all','active','expired','declined','refunded'].map(t =>
            `<button class="fb${_detabFilter === t ? ' active' : ''}" onclick="Customers.setSubTab('${t}',this)">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`
          ).join('')}
        </div>
      </div>

      <!-- Sub list -->
      <div id="sub-list"></div>

    </div>`;

    _renderSubList(g);
  };

  const _activeSubBanner = (t) => {
    const d     = _daysUntil(t.subscriptionExpiresAt);
    const total = t.subscriptionDays || t.durationDays || 30;
    const pct   = d !== null ? Math.min(100, Math.max(0, ((total - d) / total) * 100)) : 0;
    const isGpt = t.product === 'chatgpt';
    return `<div style="background:var(--success-bg);border:1.5px solid var(--success-border);border-radius:10px;padding:.8rem 1rem;margin-bottom:1rem;display:flex;align-items:center;gap:.75rem">
      <div style="width:8px;height:8px;border-radius:50%;background:var(--success);flex-shrink:0;animation:dotPulse 1.5s infinite"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.78rem;font-weight:700;color:var(--success);margin-bottom:2px">${esc(t.packageType || '')} ${isGpt ? '· ChatGPT Plus' : '· Claude Pro'}</div>
        <div style="font-size:.7rem;color:var(--success);opacity:.85">${d !== null ? d + ' days remaining' : 'Active'} · expires ${t.subscriptionExpiresAt ? new Date(t.subscriptionExpiresAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</div>
        <div style="height:4px;background:var(--success-border);border-radius:2px;margin-top:5px;overflow:hidden"><div style="height:100%;width:${pct.toFixed(0)}%;background:var(--success);border-radius:2px"></div></div>
      </div>
      <div style="font-size:.9rem;font-weight:700;font-family:monospace;color:var(--success);flex-shrink:0">$${(t.price || 0).toFixed(2)}</div>
    </div>`;
  };

  const _renderSubList = (g) => {
    const wrap = document.getElementById('sub-list');
    if (!wrap) return;

    const subs = g.subs
      .filter(s => {
        if (_detabFilter === 'all') return true;
        return _subStatus(s) === _detabFilter;
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (!subs.length) {
      wrap.innerHTML = `<div class="empty">No ${_detabFilter === 'all' ? '' : _detabFilter + ' '}subscriptions.</div>`;
      return;
    }

    wrap.innerHTML = subs.map(t => _subCard(t)).join('');
  };

  const _subCard = (t) => {
    const st   = _subStatus(t);
    const d    = _daysUntil(t.subscriptionExpiresAt);
    const isGpt = t.product === 'chatgpt';
    const prodTag = isGpt
      ? `<span class="prod-tag prod-chatgpt">ChatGPT Plus</span>`
      : `<span class="prod-tag prod-claude">Claude Pro</span>`;

    let statusBadge = '';
    if (st === 'active')      statusBadge = d !== null && d <= 5 ? `<span class="badge b-sub">⚠ ${d}d left</span>` : `<span class="badge b-act">✓ Active</span>`;
    if (st === 'expired')     statusBadge = `<span class="badge b-exp">✕ Expired</span>`;
    if (st === 'declined')    statusBadge = `<span class="badge b-deact">Declined</span>`;
    if (st === 'refunded')    statusBadge = `<span class="badge" style="background:#fdf4ff;border:1px solid #e9d5ff;color:#7c3aed">↩ Refunded</span>`;
    if (st === 'pending')     statusBadge = `<span class="badge b-sub">⏳ Pending</span>`;
    if (st === 'deactivated') statusBadge = `<span class="badge b-deact">Deactivated</span>`;

    const total = t.subscriptionDays || t.durationDays || 30;
    const pct   = d !== null ? Math.min(100, Math.max(0, ((total - d) / total) * 100)) : 100;
    const barColor = st === 'expired' || st === 'declined' ? '#dc2626' : d !== null && d <= 5 ? '#d97706' : '#16a34a';

    const pm  = PM_LABELS[t.paymentMethod] || t.paymentMethod || '—';
    const pmi = PM_ICONS[t.paymentMethod]  || '💳';

    const extraInfo = st === 'declined'
      ? `<div style="margin-top:.4rem;font-size:.7rem;color:var(--error);background:var(--error-bg);border:1px solid var(--error-border);border-radius:6px;padding:.3rem .6rem">⚠ ${esc(t.declineReason || 'Declined by admin')}</div>`
      : st === 'refunded'
      ? `<div style="margin-top:.4rem;font-size:.7rem;color:#7c3aed;background:#fdf4ff;border:1px solid #e9d5ff;border-radius:6px;padding:.3rem .6rem">↩ Refunded via ${esc(t.refundPaymentMethod || pm)} by ${esc(t.refundedBy || 'admin')}${t.refundNote ? ' · ' + esc(t.refundNote) : ''}</div>`
      : '';

    const approvedDate = t.approvedAt
      ? new Date(t.approvedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
      : '—';
    const expiryDate = t.subscriptionExpiresAt
      ? new Date(t.subscriptionExpiresAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
      : '—';

    return `<div class="sub-card" style="${st === 'refunded' ? 'opacity:.8' : ''}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;margin-bottom:.55rem">
        <div style="min-width:0">
          <div style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;margin-bottom:.2rem">
            ${prodTag}
            <span style="font-size:.8rem;font-weight:600">${esc(t.packageType || '—')}</span>
          </div>
          <div style="font-size:.7rem;color:var(--muted)">Activated ${approvedDate} · Expires ${expiryDate}</div>
          ${extraInfo}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.3rem;flex-shrink:0">
          ${statusBadge}
          <div style="font-size:.82rem;font-weight:700;font-family:'JetBrains Mono',monospace;${st === 'refunded' ? 'text-decoration:line-through;color:var(--muted2)' : ''}">$${(t.price || 0).toFixed(2)}</div>
        </div>
      </div>
      ${st === 'active' ? `<div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin-bottom:.5rem"><div style="height:100%;width:${pct.toFixed(0)}%;background:${barColor};border-radius:2px"></div></div>` : ''}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
        <div style="font-size:.7rem;color:var(--muted2);display:flex;align-items:center;gap:.3rem">
          <span>${pmi}</span><span>${pm}</span>
          ${t.paymentRef ? `<span style="font-family:monospace;font-size:.65rem">· ${esc(t.paymentRef)}</span>` : ''}
        </div>
        <div style="display:flex;gap:.3rem">
          ${st === 'active' ? `<button class="btn btn-ghost-blue btn-sm" onclick="Customers.sendReminder('${esc(t.token)}','reminder')">📧 Reminder</button>` : ''}
          ${st === 'active' || st === 'pending' ? `<button class="btn btn-outline btn-sm" style="border-color:var(--blue);color:var(--blue)" onclick="EditSub.open('${esc(t.token)}')">✏ Edit</button>` : ''}
          ${st !== 'refunded' && t.paymentMethod ? `<button class="btn btn-outline btn-sm" style="border-color:var(--error);color:var(--error)" onclick="Customers.refundSubscription('${esc(t.token)}','${esc(t.customerName||'')}','${pm}','${(t.price||0).toFixed(2)}')">↩ Refund</button>` : ''}
        </div>
      </div>
    </div>`;
  };

  // ── Public API ────────────────────────────────────────────────────────────────

  const init = () => {
    _tokens  = Store.tokens || {};
    _grouped = _buildGroups();
    _selected = null;
    _detabFilter = 'all';
    _searchQ = '';
    const si = document.getElementById('cust-search');
    if (si) si.value = '';
    _renderList();
    const pane = document.getElementById('cust-detail-pane');
    if (pane) pane.innerHTML = `<div class="cust-dir-empty"><div style="font-size:2.5rem;margin-bottom:.5rem;opacity:.3">👤</div><div style="font-size:.85rem;color:var(--muted2)">Select a customer to view their profile</div></div>`;

    // Badge
    const expiring = _grouped.filter(g =>
      g.subs.some(s => { const d = _daysUntil(s.subscriptionExpiresAt); return d !== null && d >= 0 && d <= 30 && s.approved; })
    ).length;
    const nb = document.getElementById('nb-exp');
    if (nb) { nb.textContent = expiring; nb.style.display = expiring > 0 ? '' : 'none'; }
  };

  const select = (key) => {
    _selected    = key;
    _detabFilter = 'all';
    _renderList();
    _renderDetail();
  };

  const search = (q) => {
    _searchQ = q;
    _renderList();
  };

  const setSubTab = (tab, btn) => {
    _detabFilter = tab;
    document.querySelectorAll('#sub-tab-bar .fb').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const g = _grouped.find(x => x.key === _selected);
    if (g) _renderSubList(g);
  };

  const reload = () => {
    _tokens  = Store.tokens || {};
    _grouped = _buildGroups();
    _renderList();
    if (_selected) _renderDetail();
  };

  // Legacy render() called by Dashboard.reload — re-init
  const render = () => reload();

  const setFilter = () => {};  // legacy stub

  const sendReminder = async (token, type) => {
    const d = await api('/admin/send-reminder', { adminKey: Store.adminKey, token, type });
    alert(d && d.ok ? '✓ Email sent successfully.' : '✕ Failed: ' + (d && d.error));
    if (d && d.ok) Dashboard.reload();
  };

  const sendReminderByKey = async (key, type) => {
    const g = _grouped.find(x => x.key === key);
    if (!g) return;
    const activeSub = g.subs.find(s => _subStatus(s) === 'active');
    if (!activeSub) { alert('No active subscription to send reminder for.'); return; }
    sendReminder(activeSub.token, type);
  };

  const deleteCustomer = async (key) => {
    const g = _grouped.find(x => x.key === key);
    if (!g) return;
    if (!confirm(`Delete all records for "${g.name}"? This cannot be undone.`)) return;
    for (const sub of g.subs) {
      await api('/admin/delete-customer', { adminKey: Store.adminKey, token: sub.token });
    }
    _selected = null;
    await Dashboard.reload();
  };

  const refundSubscription = async (token, name, method, amount) => {
    // Find the payment record for this token
    const payments = Store.payments || [];
    const payment = payments.find(p => p.token === token && p.status !== 'refunded');
    
    if (!payment) {
      alert('No payment record found for this subscription. Payment may have been made outside the system.');
      return;
    }
    
    // Open refund modal
    Payments.openRefund(payment.id, name, method, amount);
  };

  return { init, render, select, search, setSubTab, reload, setFilter, sendReminder, sendReminderByKey, deleteCustomer, refundSubscription };
})();
