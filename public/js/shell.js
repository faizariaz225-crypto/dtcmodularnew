/* ─── DTC Admin — App Shell (sidebar navigation) ────────────────────────── */

'use strict';

const Shell = (() => {

  const init = () => {
    document.getElementById('mob-menu-btn')
      .addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  };

  const navigate = (pageId, navEl) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById('page-' + pageId).classList.add('active');
    navEl.classList.add('active');

    document.getElementById('sidebar').classList.remove('open');

    if (pageId === 'customers')    Customers.init();
    if (pageId === 'instructions') Instructions.render();
    if (pageId === 'products')     Products.render();
    if (pageId === 'campaigns')    { BulkEmail.render(); BulkEmail.init(); }
    if (pageId === 'resellers')    Resellers.render();
    if (pageId === 'settings')     Settings.load();
    if (pageId === 'revenue')      Revenue.render();
    if (pageId === 'notifications'){ Notifications.init(); Notifications.load(); }
    if (pageId === 'landing')      Landing.load();
    if (pageId === 'payments')     Payments.load();
    if (pageId === 'admins')       AdminUsers.load();
  };

  return { init, navigate };
})();
