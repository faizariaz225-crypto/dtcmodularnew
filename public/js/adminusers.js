'use strict';

const AdminUsers = (() => {
  const ROLE_LABELS = { superadmin:'Super Admin', admin:'Admin', viewer:'Viewer' };
  const ROLE_COLORS = { superadmin:'background:#fdf4ff;border:1px solid #e9d5ff;color:#7c3aed', admin:'background:var(--blue-light);border:1px solid var(--blue-mid);color:var(--blue)', viewer:'background:#f1f5f9;border:1px solid #e2e8f0;color:#64748b' };

  const load = async () => {
    const d = await api('/admin/admins', null, 'GET');
    render(d || []);
  };

  const render = (list) => {
    const wrap = document.getElementById('admins-list');
    if (!wrap) return;
    if (!list.length) { wrap.innerHTML = '<div class="empty">No admin users found.</div>'; return; }
    wrap.innerHTML = `
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Added</th><th>Actions</th></tr></thead>
          <tbody>${list.map(_row).join('')}</tbody>
        </table>
      </div>`;
  };

  const _row = (a) => {
    const date  = new Date(a.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    const rStyle = ROLE_COLORS[a.role] || ROLE_COLORS.viewer;
    const rLabel = ROLE_LABELS[a.role]  || a.role;
    return `<tr>
      <td style="font-weight:600;font-size:.85rem">${esc(a.name)}</td>
      <td><span class="badge" style="${rStyle}">${rLabel}</span></td>
      <td style="font-size:.75rem;color:var(--muted);font-family:monospace">${date}</td>
      <td>
        <div style="display:flex;gap:.35rem">
          <button class="action-btn react" onclick="AdminUsers.openEdit('${a.id}','${esc(a.name)}','${a.role}')">✏ Edit</button>
          <button class="action-btn deact" onclick="AdminUsers.remove('${a.id}','${esc(a.name)}')">🗑</button>
        </div>
      </td>
    </tr>`;
  };

  const openAdd = () => {
    document.getElementById('aum-title').textContent = 'Add Admin';
    document.getElementById('aum-id').value   = '';
    document.getElementById('aum-name').value = '';
    document.getElementById('aum-role').value = 'admin';
    document.getElementById('aum-err').classList.remove('show');
    document.getElementById('admin-user-modal').classList.add('open');
  };

  const openEdit = (id, name, role) => {
    document.getElementById('aum-title').textContent = 'Edit Admin';
    document.getElementById('aum-id').value   = id;
    document.getElementById('aum-name').value = name;
    document.getElementById('aum-role').value = role;
    document.getElementById('aum-err').classList.remove('show');
    document.getElementById('admin-user-modal').classList.add('open');
  };

  const save = async () => {
    const id   = document.getElementById('aum-id').value;
    const name = document.getElementById('aum-name').value.trim();
    const role = document.getElementById('aum-role').value;
    const errEl = document.getElementById('aum-err');
    errEl.classList.remove('show');
    if (!name) { errEl.textContent = 'Name is required.'; errEl.classList.add('show'); return; }
    const d = await api('/admin/admins/save', { adminKey: Store.adminKey, admin: { id: id || undefined, name, role } });
    if (!d || !d.success) { errEl.textContent = (d&&d.error)||'Failed.'; errEl.classList.add('show'); return; }
    document.getElementById('admin-user-modal').classList.remove('open');
    load();
  };

  const remove = async (id, name) => {
    if (!confirm(`Remove admin "${name}"?`)) return;
    const d = await api('/admin/admins/delete', { adminKey: Store.adminKey, id });
    if (d && d.success) load();
    else alert('Failed: ' + (d&&d.error));
  };

  return { load, openAdd, openEdit, save, remove };
})();
