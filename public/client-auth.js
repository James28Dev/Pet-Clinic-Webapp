async function api(url, opts={}){
  const res = await fetch(url, { headers:{'Content-Type':'application/json'}, ...opts });
  if(!res.ok){ const t = await res.text().catch(()=> 'Error'); throw new Error(t); }
  return res.json();
}
const $ = s => document.querySelector(s);

$('#btn-login')?.addEventListener('click', async ()=>{
  try{
    const username = $('#login-username').value.trim();
    const password = $('#login-password').value.trim();
    const data = await api('/api/login', { method:'POST', body: JSON.stringify({ username, password }) });
    if(data.ok) location.href = '/dashboard';
  }catch(e){ alert('เข้าสู่ระบบไม่สำเร็จ'); }
});

$('#btn-register')?.addEventListener('click', async ()=>{
  try{
    const payload = {
      full_name: $('#reg-fullname').value.trim(),
      username: $('#reg-username').value.trim(),
      password: $('#reg-password').value.trim(),
      role: $('#reg-role').value
    };
    await api('/api/register', { method:'POST', body: JSON.stringify(payload) });
    alert('สมัครสมาชิกสำเร็จ'); location.href = '/';
  }catch(e){ alert('สมัครสมาชิกไม่สำเร็จ'); }
});
