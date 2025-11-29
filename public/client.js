const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(t || res.statusText); }
  return res.json();
}

// ---- Navbar & Auth guard ----
async function loadNavbar() {
  const res = await fetch('/components/nav.html'); $('#nav').innerHTML = await res.text();
  $('#logout-btn')?.addEventListener('click', async e => { e.preventDefault(); await fetch('/api/logout'); location.href = '/'; });
}
async function protectPage() {
  try { const me = await api('/api/me'); if (!me.user) location.href = '/'; } catch { location.href = '/'; }
}

// ---- Date helpers (dd/mm/yyyy) ----
function fmtDate(iso) { if (!iso) return '-'; const d = new Date(iso); const dd = String(d.getDate()).padStart(2, '0'); const mm = String(d.getMonth() + 1).padStart(2, '0'); const yyyy = d.getFullYear(); return `${dd}/${mm}/${yyyy}`; }
function fmtDateTime(iso) { if (!iso) return '-'; const d = new Date(iso); const dd = String(d.getDate()).padStart(2, '0'); const mm = String(d.getMonth() + 1).padStart(2, '0'); const yyyy = d.getFullYear(); const hh = String(d.getHours()).padStart(2, '0'); const mi = String(d.getMinutes()).padStart(2, '0'); return `${dd}/${mm}/${yyyy} ${hh}:${mi}`; }
function toLocalInputDate(dateStr) { if (!dateStr) return ''; const d = new Date(dateStr); const yyyy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); return `${yyyy}-${mm}-${dd}`; }
function toLocalInputDateTime(dateStr) { if (!dateStr) return ''; const d = new Date(dateStr); const yyyy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); const hh = String(d.getHours()).padStart(2, '0'); const mi = String(d.getMinutes()).padStart(2, '0'); return `${yyyy}-${mm}-${dd}T${hh}:${mi}`; }

// ---- Modal helpers (ปุ่ม ยกเลิก / บันทึก) ----
function openModal(title, innerHTML, onSave) {
  $('#modal-title').textContent = title;
  $('#modal-content').innerHTML = innerHTML;
  $('#modal-backdrop').style.display = 'flex';
  const cancel = () => { $('#modal-backdrop').style.display = 'none'; $('#modal-save').onclick = null; };
  $('#modal-cancel').onclick = cancel;
  $('#modal-save').onclick = async () => { try { await onSave(cancel); } catch (e) { alert('บันทึกไม่สำเร็จ'); } };
}
function closeModal() { $('#modal-backdrop').style.display = 'none'; }

// ------- Owners -------
async function loadOwners() {
  const owners = await api('/api/owners');
  const sel1 = $('#pet-owner'); const sel2 = $('#appt-owner');
  [sel1, sel2].forEach(sel => { if (sel) sel.innerHTML = owners.map(o => `<option value="${o.owner_id}">${o.full_name}</option>`).join(''); });
  return owners;
}
async function loadOwnersTable() {
  const owners = await api('/api/owners');
  const tbody = $('#tbl-owners tbody'); if (!tbody) return;
  tbody.innerHTML = owners.map(o => `
    <tr data-id="${o.owner_id}">
      <td>${o.full_name}</td>
      <td>${o.phone}</td>
      <td>${o.address}</td>
      <td style="white-space:nowrap">
        <button class="ghost btn-edit-owner">แก้ไข</button>
        <button class="danger btn-del-owner">ลบ</button>
      </td>
    </tr>`).join('');

  // Edit
  $$('.btn-edit-owner').forEach(btn => {
    btn.addEventListener('click', e => {
      const tr = e.target.closest('tr'); const id = tr.dataset.id;
      const name = tr.children[0].textContent; const phone = tr.children[1].textContent; const address = tr.children[2].textContent;
      openModal('แก้ไขเจ้าของสัตว์', `
        <div class="grid">
          <label>ชื่อ-สกุล<input id="m-name" value="${name}"></label>
          <label>โทรศัพท์<input id="m-phone" value="${phone}"></label>
          <label>ที่อยู่<input id="m-address" value="${address}"></label>
        </div>
      `, async (done) => {
        const payload = { full_name: $('#m-name').value.trim(), phone: $('#m-phone').value.trim(), address: $('#m-address').value.trim() };
        await api('/api/owners/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        await loadOwnersTable(); done();
      });
    });
  });
  // Delete
  $$('.btn-del-owner').forEach(btn => {
    btn.addEventListener('click', async e => {
      const tr = e.target.closest('tr'); const id = tr.dataset.id;
      if (confirm('ลบเจ้าของสัตว์คนนี้? อาจมีความสัมพันธ์กับข้อมูลอื่น')) { try { await api('/api/owners/' + id, { method: 'DELETE' }); await loadOwnersTable(); } catch (err) { alert('ลบไม่สำเร็จ: อาจติดข้อจำกัดความสัมพันธ์'); } }
    });
  });
}
$('#form-owner')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    full_name: $('#owner-name').value.trim(),
    phone: $('#owner-phone').value.trim(),
    address: $('#owner-address').value.trim()
  };
  await api('/api/owners', { method: 'POST', body: JSON.stringify(payload) });
  e.target.reset(); await loadOwners(); await loadOwnersTable(); alert('เพิ่มเจ้าของแล้ว');
});

// ------- Vets -------
async function loadVets() {
  const vets = await api('/api/vets');
  const sel1 = $('#appt-vet'); const sel2 = $('#treat-vet');
  [sel1, sel2].forEach(sel => { if (sel) sel.innerHTML = vets.map(v => `<option value="${v.vet_id}">${v.full_name}</option>`).join(''); });
  return vets;
}

// ------- Pets -------
async function loadPets(owner_id = null) {
  let url = '/api/pets'; if (owner_id) url += `?owner_id=${owner_id}`;
  const pets = await api(url);
  const selAppt = $('#appt-pet'); const selTreat = $('#treat-pet');
  if (selAppt) selAppt.innerHTML = pets.map(p => `<option value="${p.pet_id}">${p.name} (${p.species})</option>`).join('');
  if (selTreat) selTreat.innerHTML = pets.map(p => `<option value="${p.pet_id}">${p.name} (${p.species})</option>`).join('');
  renderPetsTable(pets); return pets;
}
function renderPetsTable(pets) {
  const tbody = $('#tbl-pets tbody'); if (!tbody) return;
  tbody.innerHTML = pets.map(p => `
    <tr data-id="${p.pet_id}" data-owner="${p.owner_id}">
      <td>${p.name}</td><td>${p.species}</td><td>${p.breed || '-'}</td>
      <td>${p.sex}</td><td>${p.birthdate ? fmtDate(p.birthdate) : '-'}</td><td>${p.owner_name}</td>
      <td style="white-space:nowrap">
        <button class="ghost btn-edit-pet">แก้ไข</button>
        <button class="danger btn-del-pet">ลบ</button>
      </td>
    </tr>`).join('');

  $$('.btn-edit-pet').forEach(btn => {
    btn.addEventListener('click', async e => {
      const tr = e.target.closest('tr'); const id = tr.dataset.id; const ownerId = tr.dataset.owner;
      const name = tr.children[0].textContent, species = tr.children[1].textContent, breed = tr.children[2].textContent === '-' ? '' : tr.children[2].textContent, sex = tr.children[3].textContent, birth = tr.children[4].textContent === '-' ? '' : tr.children[4].textContent;
      const owners = await loadOwners();
      openModal('แก้ไขสัตว์เลี้ยง', `
        <div class="grid">
          <label>เจ้าของ
            <select id="m-owner">${owners.map(o => `<option value="${o.owner_id}" ${o.owner_id == ownerId ? 'selected' : ''}>${o.full_name}</option>`).join('')}</select>
          </label>
          <label>ชื่อสัตว์<input id="m-name" value="${name}"></label>
          <label>ชนิด<input id="m-species" value="${species}"></label>
          <label>พันธุ์<input id="m-breed" value="${breed}"></label>
          <label>เพศ
            <select id="m-sex"><option value="M" ${sex === 'M' ? 'selected' : ''}>ผู้</option><option value="F" ${sex === 'F' ? 'selected' : ''}>เมีย</option></select>
          </label>
          <label>วันเกิด<input type="date" id="m-birth" value="${birth ? toLocalInputDate(birth.split('/').reverse().join('-')) : ''}"></label>
        </div>
      `, async (done) => {
        const payload = {
          owner_id: Number($('#m-owner').value), name: $('#m-name').value.trim(), species: $('#m-species').value.trim(),
          breed: $('#m-breed').value.trim() || null, sex: $('#m-sex').value, birthdate: $('#m-birth').value || null
        };
        await api('/api/pets/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        await loadPets(); done();
      });
    });
  });
  $$('.btn-del-pet').forEach(btn => {
    btn.addEventListener('click', async e => {
      const tr = e.target.closest('tr'); const id = tr.dataset.id;
      if (confirm('ลบสัตว์เลี้ยงนี้?')) { try { await api('/api/pets/' + id, { method: 'DELETE' }); await loadPets(); } catch (err) { alert('ลบไม่สำเร็จ: อาจติดนัดหมาย/ความสัมพันธ์'); } }
    });
  });
}
$('#form-pet')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    owner_id: Number($('#pet-owner').value),
    name: $('#pet-name').value.trim(),
    species: $('#pet-species').value.trim(),
    breed: $('#pet-breed').value.trim() || null,
    sex: $('#pet-sex').value,
    birthdate: $('#pet-birth').value || null
  };
  await api('/api/pets', { method: 'POST', body: JSON.stringify(payload) });
  e.target.reset(); await loadPets(); alert('เพิ่มสัตว์เลี้ยงแล้ว');
});

// ------- Appointments -------
async function loadAppointments() {
  const from = $('#filter-from')?.value || ''; const to = $('#filter-to')?.value || '';
  const q = []; if (from) q.push(`from=${from}`); if (to) q.push(`to=${to}`);
  const url = '/api/appointments' + (q.length ? `?${q.join('&')}` : '');
  const rows = await api(url);
  const tbody = $('#tbl-appointments tbody'); if (!tbody) return;
  tbody.innerHTML = rows.map(r => `
    <tr data-id="${r.appointment_id}" data-owner="${r.owner_id}" data-pet="${r.pet_id}" data-vet="${r.vet_id}">
      <td>${fmtDateTime(r.appt_datetime)}</td>
      <td>${r.pet_name} (${r.species})</td>
      <td>${r.owner_name}</td>
      <td>${r.vet_name}</td>
      <td>${r.reason || '-'}</td>
      <td style="white-space:nowrap">
        <button class="ghost btn-edit-appt">แก้ไข</button>
        <button class="danger btn-del-appt">ลบ</button>
      </td>
    </tr>`).join('');

  // Edit
  $$('.btn-edit-appt').forEach(btn => {
    btn.addEventListener('click', async e => {
      const tr = e.target.closest('tr'); const id = tr.dataset.id;
      const ownerId = tr.dataset.owner, petId = tr.dataset.pet, vetId = tr.dataset.vet;
      const reason = tr.children[4].textContent === '-' ? '' : tr.children[4].textContent;
      const owners = await loadOwners(); const vets = await loadVets(); const pets = await loadPets(ownerId);
      openModal('แก้ไขใบนัดหมาย', `
        <div class="grid">
          <label>เจ้าของ
            <select id="m-owner">${owners.map(o => `<option value="${o.owner_id}" ${o.owner_id == ownerId ? 'selected' : ''}>${o.full_name}</option>`).join('')}</select>
          </label>
          <label>สัตว์เลี้ยง
            <select id="m-pet">${pets.map(p => `<option value="${p.pet_id}" ${p.pet_id == petId ? 'selected' : ''}>${p.name} (${p.species})</option>`).join('')}</select>
          </label>
          <label>สัตวแพทย์
            <select id="m-vet">${vets.map(v => `<option value="${v.vet_id}" ${v.vet_id == vetId ? 'selected' : ''}>${v.full_name}</option>`).join('')}</select>
          </label>
          <label>วัน-เวลา<input type="datetime-local" id="m-dt" value=""></label>
          <label>เหตุผล<input id="m-reason" value="${reason}"></label>
        </div>
      `, async (done) => {
        const payload = {
          owner_id: Number($('#m-owner').value),
          pet_id: Number($('#m-pet').value),
          vet_id: Number($('#m-vet').value),
          appt_datetime: $('#m-dt').value,
          reason: $('#m-reason').value.trim() || null
        };
        if (!payload.appt_datetime) { alert('กรุณาเลือกวันเวลา'); return; }
        await api('/api/appointments/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        await loadAppointments(); done();
      });
      // ใส่ค่า datetime ปัจจุบันของแถว (จากเซลล์แรก)
      const dtText = tr.children[0].textContent; // dd/mm/yyyy HH:MM
      const [dStr, tStr] = dtText.split(' ');
      const [dd, mm, yyyy] = dStr.split('/');
      const val = `${yyyy}-${mm}-${dd}T${tStr}`;
      $('#m-dt').value = val;
      // เมื่อเปลี่ยน owner ให้โหลด pets ของ owner นั้น
      $('#m-owner').addEventListener('change', async (ev) => {
        const newOwner = ev.target.value;
        const petsNew = await api('/api/pets?owner_id=' + newOwner);
        $('#m-pet').innerHTML = petsNew.map(p => `<option value="${p.pet_id}">${p.name} (${p.species})</option>`).join('');
      });
    });
  });
  // Delete
  $$('.btn-del-appt').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = e.target.closest('tr').dataset.id;
      if (confirm('ลบใบนัดหมายนี้?')) { await api('/api/appointments/' + id, { method: 'DELETE' }); await loadAppointments(); }
    });
  });
}
$('#form-appointment')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    owner_id: Number($('#appt-owner').value),
    pet_id: Number($('#appt-pet').value),
    vet_id: Number($('#appt-vet').value),
    appt_datetime: $('#appt-datetime').value,
    reason: $('#appt-reason').value.trim() || null
  };
  await api('/api/appointments', { method: 'POST', body: JSON.stringify(payload) });
  e.target.reset(); await loadAppointments(); alert('บันทึกใบนัดแล้ว');
});
$('#btn-filter')?.addEventListener('click', loadAppointments);
$('#btn-clear')?.addEventListener('click', async () => { if ($('#filter-from')) $('#filter-from').value = ''; if ($('#filter-to')) $('#filter-to').value = ''; await loadAppointments(); });
$('#appt-owner')?.addEventListener('change', async (e) => { const ownerId = e.target.value; const pets = await api('/api/pets?owner_id=' + ownerId); $('#appt-pet').innerHTML = pets.map(p => `<option value="${p.pet_id}">${p.name} (${p.species})</option>`).join(''); });

// ------- Treatments -------
async function loadTreatments() {
  const rows = await api('/api/treatments');
  const tbody = $('#tbl-treatments tbody'); if (!tbody) return;
  tbody.innerHTML = rows.map(r => `
    <tr data-id="${r.treatment_id}" data-pet="${r.pet_id}" data-vet="${r.vet_id}" data-appt="${r.appointment_id || ''}">
      <td>${fmtDate(r.treatment_date)}</td>
      <td>${r.pet_name} (${r.species})</td>
      <td>${r.vet_name}</td>
      <td>${r.diagnosis}</td>
      <td>${r.medication || '-'}</td>
      <td>${r.appointment_id || '-'}</td>
      <td style="white-space:nowrap">
        <button class="ghost btn-edit-treat">แก้ไข</button>
        <button class="danger btn-del-treat">ลบ</button>
      </td>
    </tr>`).join('');

  $$('.btn-edit-treat').forEach(btn => {
    btn.addEventListener('click', async e => {
      const tr = e.target.closest('tr'); const id = tr.dataset.id;
      const petId = tr.dataset.pet, vetId = tr.dataset.vet, apptId = tr.dataset.appt;
      const dx = tr.children[3].textContent; const med = tr.children[4].textContent === '-' ? '' : tr.children[4].textContent;
      const ddate = tr.children[0].textContent; // dd/mm/yyyy
      const owners = await loadOwners(); const pets = await loadPets(); const vets = await loadVets();
      openModal('แก้ไขประวัติการรักษา', `
        <div class="grid">
          <label>สัตว์เลี้ยง
            <select id="m-pet">${pets.map(p => `<option value="${p.pet_id}" ${p.pet_id == petId ? 'selected' : ''}>${p.name} (${p.species})</option>`).join('')}</select>
          </label>
          <label>สัตวแพทย์
            <select id="m-vet">${vets.map(v => `<option value="${v.vet_id}" ${v.vet_id == vetId ? 'selected' : ''}>${v.full_name}</option>`).join('')}</select>
          </label>
          <label>ใบนัด (ถ้ามี)<input id="m-appt" type="number" min="1" value="${apptId}"></label>
          <label>วินิจฉัย<input id="m-dx" value="${dx}"></label>
          <label>ยา/การรักษา<input id="m-med" value="${med}"></label>
          <label>วันที่รักษา<input id="m-date" type="date" value="${toLocalInputDate(ddate.split('/').reverse().join('-'))}"></label>
          <label>บันทึกเพิ่มเติม<input id="m-notes" value=""></label>
        </div>
      `, async (done) => {
        const payload = {
          pet_id: Number($('#m-pet').value), vet_id: Number($('#m-vet').value),
          appointment_id: ($('#m-appt').value.trim() ? Number($('#m-appt').value) : null),
          diagnosis: $('#m-dx').value.trim(), medication: $('#m-med').value.trim() || null,
          treatment_date: $('#m-date').value, notes: $('#m-notes').value.trim() || null
        };
        if (!payload.treatment_date || !payload.diagnosis) { alert('กรอกข้อมูลให้ครบ'); return; }
        await api('/api/treatments/' + id, { method: 'PUT', body: JSON.stringify(payload) });
        await loadTreatments(); done();
      });
    });
  });
  $$('.btn-del-treat').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = e.target.closest('tr').dataset.id;
      if (confirm('ลบประวัติการรักษานี้?')) { await api('/api/treatments/' + id, { method: 'DELETE' }); await loadTreatments(); }
    });
  });
}
$('#form-treatment')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const apptIdRaw = $('#treat-appt').value.trim();
  const payload = {
    pet_id: Number($('#treat-pet').value),
    vet_id: Number($('#treat-vet').value),
    appointment_id: apptIdRaw ? Number(apptIdRaw) : null,
    diagnosis: $('#treat-dx').value.trim(),
    medication: $('#treat-med').value.trim() || null,
    treatment_date: $('#treat-date').value,
    notes: $('#treat-notes').value.trim() || null
  };
  await api('/api/treatments', { method: 'POST', body: JSON.stringify(payload) });
  e.target.reset(); await loadTreatments(); alert('บันทึกการรักษาแล้ว');
});
