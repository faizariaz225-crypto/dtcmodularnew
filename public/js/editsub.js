'use strict';

const EditSub = (() => {

  const open = (token) => {
    const t = Store.tokens[token];
    if (!t) { alert('Token not found in local store. Reload and try again.'); return; }

    document.getElementById('es-token').value   = token;
    document.getElementById('es-name').value    = t.customerName  || '';
    document.getElementById('es-email').value   = t.email         || '';
    document.getElementById('es-wechat').value  = t.wechat        || '';
    document.getElementById('es-package').value = t.packageType   || '';
    document.getElementById('es-price').value   = t.price         || '';
    document.getElementById('es-orgid').value   = t.orgId || t.sessionData || '';
    document.getElementById('es-payment-method').value = t.paymentMethod || '';
    document.getElementById('es-err').classList.remove('show');

    // Set expiry date input
    if (t.subscriptionExpiresAt) {
      const d = new Date(t.subscriptionExpiresAt);
      // Format as YYYY-MM-DD for date input
      const iso = d.toISOString().slice(0, 10);
      document.getElementById('es-expiry').value = iso;
    } else {
      document.getElementById('es-expiry').value = '';
    }

    document.getElementById('edit-sub-modal').classList.add('open');
  };

  const close = () => {
    document.getElementById('edit-sub-modal').classList.remove('open');
  };

  const save = async () => {
    const token   = document.getElementById('es-token').value;
    const errEl   = document.getElementById('es-err');
    errEl.classList.remove('show');

    const expiryVal = document.getElementById('es-expiry').value;
    const subscriptionExpiresAt = expiryVal ? new Date(expiryVal + 'T23:59:59').toISOString() : undefined;

    const payload = {
      adminKey:              Store.adminKey,
      token,
      customerName:          document.getElementById('es-name').value.trim()    || undefined,
      email:                 document.getElementById('es-email').value.trim()   || undefined,
      wechat:                document.getElementById('es-wechat').value.trim()  || undefined,
      packageType:           document.getElementById('es-package').value.trim() || undefined,
      price:                 document.getElementById('es-price').value          || undefined,
      orgId:                 document.getElementById('es-orgid').value.trim()   || undefined,
      paymentMethod:         document.getElementById('es-payment-method').value || undefined,
      subscriptionExpiresAt,
    };

    const d = await api('/admin/token/edit', payload);
    if (!d || !d.success) { errEl.textContent = (d&&d.error)||'Save failed.'; errEl.classList.add('show'); return; }
    close();
    Dashboard.reload();
    if (typeof AllCustomers !== 'undefined') AllCustomers.load();
  };

  return { open, close, save };
})();
