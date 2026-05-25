'use strict';

const AllCustomers = (() => {
  let _tab = 'active';
  let _data = [];

  const PAYMENT_LABELS = { alipay:'Alipay', wechat_pay:'WeChat Pay', bank_transfer:'Bank Transfer', paypal:'PayPal', crypto:'Crypto', cash:'Cash', other:'Other' };

  const load = async () => {
    const d = await api('/admin/customers/all', null, 'GET');
    _data = d || [];
    render();
  };

  const setTab = (tab, btn) => {
    _tab = tab;
    document.querySelectorAll('#ac-tabs .fb').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    render();
  };

  const render = () => {
    const wrap = document.getElementById('ac-list');
    if (!wrap) return;

    // Flatten all subscriptions and filter by tab
    const rows = [];
    for (const cust of _data) {
      for (const sub of cust.subscriptions) {
        const status = _subStatus(sub);
        rows.push({ cust, sub, status });
      }
    }

    const filtered = rows.filter(r => {
      if (_tab === 'all') return true;
      if (_tab === 'active')   return r.status === 'active';
      if (_tab === 'expired')  return r.status === 'expired';
      if (_tab === 'declined') return r.sub.declined;
      if (_tab === 'refunded') return r.sub.refunded;
      return true;
    });

    if (!filtered.length) {
      wrap.innerHTML = `<div class="empty">No ${_tab} subscriptions found.</div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th>Customer</th>
            <th>Product / Package</th>
            <th>Status</th>
            <th>Payment</th>
            <th>Expiry</th>
            <th>Actions</th>
          </tr></thead>
          <tbody>
            ${filtered.map(r => _row(r.cust, r.sub)).join('')}
          </tbody>
        </table>
      </div>`;
  };

  const _subStatus = (sub) => {
    if (sub.refunded) return 'refunded';
    if (sub.declined) return 'declined';
    if (!sub.approved) return 'pending';
    if (!sub.subscriptionExpiresAt) return 'active';
    const days = Math.ceil((new Date(sub.subscriptionExpiresAt) - new Date()) / 86400000);
    return days < 0 ? 'expired' : 'active';
  };

  const _statusBadge = (sub) => {
    const st = _subStatus(sub);
    if (st === 'refunded') return '<span class="badge b-dec">↩ Refunded</span>';
    if (st === 'declined') return '<span class="badge b-dec">✕ Declined</span>';
    if (st === 'pending')  return '<span class="badge b-pend">⏳ Pending</span>';
    if (st === 'expired')  return '<span class="badge b-exp">✕ Expired</span>';
    return '<span class="badge b-act">✓ Active</span>';
  };

  const _row = (cust, sub) => {
    const expDate = sub.subscriptionExpiresAt
      ? new Date(sub.subscriptionExpiresAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
      : '—';
    const pm = PAYMENT_LABELS[sub.paymentMethod] || sub.paymentMethod || '—';
    const prodTag = sub.product === 'chatgpt'
      ? `<span class="prod-tag prod-chatgpt">ChatGPT</span>`
      : `<span class="prod-tag prod-claude">Claude</span>`;
    const refundNote = sub.refunded
      ? `<div style="font-size:.65rem;color:var(--error);margin-top:2px">↩ Refunded via ${sub.refundPaymentMethod||pm} by ${sub.refundedBy||'admin'}</div>`
      : '';
    return `<tr>
      <td>
        <div style="font-weight:600;font-size:.82rem">${esc(cust.name)}</div>
        <div style="font-size:.7rem;color:var(--muted)">${esc(cust.email||'')}</div>
      </td>
      <td>${prodTag}<div style="font-size:.72rem;color:var(--muted);margin-top:2px">${esc(sub.packageType||'')}</div></td>
      <td>${_statusBadge(sub)}${refundNote}</td>
      <td>
        <div style="font-size:.78rem;font-weight:600">$${(sub.price||0).toFixed(2)}</div>
        <div style="font-size:.68rem;color:var(--muted)">${pm}</div>
      </td>
      <td style="font-size:.75rem;font-family:monospace">${expDate}</td>
      <td>
        <div style="display:flex;flex-direction:column;gap:.3rem">
          <button class="action-btn react" onclick="EditSub.open('${sub.token}')">✏ Edit</button>
          ${!sub.refunded && sub.approved ? `<button class="action-btn deact" onclick="Customers.deleteCustomer('${sub.token}','${esc(cust.name)}')">🗑 Delete</button>` : ''}
        </div>
      </td>
    </tr>`;
  };

  return { load, setTab, render };
})();
