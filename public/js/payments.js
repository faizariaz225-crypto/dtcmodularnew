'use strict';

const Payments = (() => {
  let _filter = 'all';
  let _payments = [];

  const PAYMENT_LABELS = {
    alipay:'Alipay', wechat_pay:'WeChat Pay', bank_transfer:'Bank Transfer',
    paypal:'PayPal', crypto:'Crypto', cash:'Cash', other:'Other',
  };
  const PM_ICONS = { alipay:'🔵', wechat_pay:'💚', bank_transfer:'🏦', paypal:'🅿', crypto:'₿', cash:'💵', other:'💳' };

  const load = async () => {
    const d = await api('/admin/payments', null, 'GET');
    _payments = (d || []).slice().reverse(); // newest first
    Store.setPayments(_payments);
    render();
  };

  const setFilter = (f, btn) => {
    _filter = f;
    document.querySelectorAll('#page-payments .fb').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    render();
  };

  const render = () => {
    const wrap = document.getElementById('payments-list');
    if (!wrap) return;

    const filtered = _payments.filter(p => {
      if (_filter === 'all') return true;
      return (p.status || 'paid') === _filter;
    });

    // Summary bar
    const paid     = _payments.filter(p => (p.status||'paid') !== 'refunded').reduce((s,p) => s + (p.amount||0), 0);
    const refunded = _payments.filter(p => p.status === 'refunded').reduce((s,p) => s + (p.amount||0), 0);
    const sym = (Store.settings||{}).currencySymbol || '$';

    const summary = `
      <div class="stats" style="margin-bottom:1rem">
        <div class="stat"><div class="stat-val sv-green">${sym}${paid.toFixed(2)}</div><div class="stat-lbl">Total Paid</div></div>
        <div class="stat"><div class="stat-val sv-red">${sym}${refunded.toFixed(2)}</div><div class="stat-lbl">Refunded</div></div>
        <div class="stat"><div class="stat-val sv-blue">${sym}${(paid-refunded).toFixed(2)}</div><div class="stat-lbl">Net Revenue</div></div>
        <div class="stat"><div class="stat-val">${_payments.length}</div><div class="stat-lbl">Transactions</div></div>
      </div>`;

    if (!filtered.length) {
      wrap.innerHTML = summary + `<div class="empty">No ${_filter} payments.</div>`;
      return;
    }

    wrap.innerHTML = summary + `
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th>Date</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Reference</th>
            <th>Status</th>
            <th>Actions</th>
          </tr></thead>
          <tbody>${filtered.map(_row).join('')}</tbody>
        </table>
      </div>`;
  };

  const _row = (p) => {
    const date = new Date(p.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    const pm   = PAYMENT_LABELS[p.paymentMethod] || p.paymentMethod || '—';
    const icon = PM_ICONS[p.paymentMethod] || '💳';
    const isRefunded = p.status === 'refunded';
    const statusBadge = isRefunded
      ? `<span class="badge b-dec">↩ Refunded</span>`
      : `<span class="badge b-act">✓ Paid</span>`;
    const refundInfo = isRefunded
      ? `<div style="font-size:.65rem;color:var(--muted);margin-top:2px">by ${esc(p.refundedBy||'admin')} · ${new Date(p.refundedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</div>`
      : '';
    return `<tr ${isRefunded ? 'style="opacity:.7"' : ''}>
      <td style="font-size:.75rem;font-family:monospace;white-space:nowrap">${date}</td>
      <td><div style="font-weight:600;font-size:.82rem">${esc(p.customerName||'—')}</div></td>
      <td style="font-weight:700;font-family:monospace;font-size:.85rem;${isRefunded?'color:var(--muted);text-decoration:line-through':''}">${(Store.settings||{}).currencySymbol||'$'}${(p.amount||0).toFixed(2)}</td>
      <td><span style="font-size:.78rem">${icon} ${pm}</span></td>
      <td style="font-size:.7rem;color:var(--muted);font-family:monospace">${esc(p.paymentRef||'—')}</td>
      <td>${statusBadge}${refundInfo}</td>
      <td>
        ${!isRefunded ? `<button class="action-btn deact" onclick="Payments.openRefund('${p.id}','${esc(p.customerName||'')}','${pm}','${(p.amount||0).toFixed(2)}')">↩ Refund</button>` : `<span style="font-size:.7rem;color:var(--muted)">via ${esc(p.refundPaymentMethod||pm)}</span>`}
      </td>
    </tr>`;
  };

  const openRefund = (pid, name, method, amount) => {
    document.getElementById('refund-pid').value = pid;
    document.getElementById('refund-note').value = '';
    document.getElementById('refund-err').classList.remove('show');
    document.getElementById('refund-modal-sub').textContent =
      `Refund $${amount} to ${name} via ${method}. This will be deducted from total revenue.`;
    document.getElementById('refund-modal').classList.add('open');
  };

  const confirmRefund = async () => {
    const pid  = document.getElementById('refund-pid').value;
    const note = document.getElementById('refund-note').value.trim();
    const errEl = document.getElementById('refund-err');
    errEl.classList.remove('show');
    const d = await api('/admin/payments/refund', { adminKey: Store.adminKey, paymentId: pid, refundedBy: 'admin', note });
    if (!d || !d.success) { errEl.textContent = (d&&d.error)||'Refund failed.'; errEl.classList.add('show'); return; }
    document.getElementById('refund-modal').classList.remove('open');
    await load();
    Dashboard.reload();
    // Also reload customers view if it's active
    if (document.getElementById('page-customers').classList.contains('active')) {
      Customers.reload();
    }
  };

  return { load, setFilter, render, openRefund, confirmRefund };
})();
