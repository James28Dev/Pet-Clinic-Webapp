require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const mysql = require('mysql2/promise');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'pet-clinic-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000*60*60 } // 1 ชม.
}));

app.use(express.static(path.join(__dirname, 'public')));

// MySQL pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pet_clinic_db',
  connectionLimit: 10,
  namedPlaceholders: true
});
async function q(sql, params={}) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

// Auth middleware
function requireLogin(req, res, next){
  if(!req.session.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  next();
}

// Pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public/register.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html')));
app.get('/owners', (req, res) => res.sendFile(path.join(__dirname, 'public/owners.html')));
app.get('/pets', (req, res) => res.sendFile(path.join(__dirname, 'public/pets.html')));
app.get('/appointments', (req, res) => res.sendFile(path.join(__dirname, 'public/appointments.html')));
app.get('/treatments', (req, res) => res.sendFile(path.join(__dirname, 'public/treatments.html')));

// Auth APIs
app.post('/api/register', async (req, res)=>{
  try{
    const { username, password, full_name, role='staff' } = req.body;
    if(!username || !password || !full_name) return res.status(400).json({ error: 'กรอกข้อมูลไม่ครบ' });
    const hash = await bcrypt.hash(password, 10);
    await q(`INSERT INTO users(username, password_hash, full_name, role)
             VALUES(:username,:hash,:full_name,:role)`,
             { username, hash, full_name, role });
    res.json({ ok:true });
  }catch(err){ res.status(500).json({ error: err.message }); }
});
app.post('/api/login', async (req, res)=>{
  const { username, password } = req.body;
  const rows = await q(`SELECT * FROM users WHERE username=:username`, { username });
  const user = rows[0];
  if(!user) return res.status(400).json({ error: 'ไม่พบผู้ใช้' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if(!ok) return res.status(400).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
  req.session.user = { id:user.user_id, name:user.full_name, role:user.role };
  res.json({ ok:true, user:req.session.user });
});
app.get('/api/logout', (req, res)=>{ req.session.destroy(()=> res.json({ ok:true })); });
app.get('/api/me', (req,res)=> res.json({ user: req.session.user || null }));

// ---- Owners CRUD ----
app.get('/api/owners', requireLogin, async (req,res)=>{
  try{ res.json(await q(`SELECT owner_id, full_name, phone, address FROM owners ORDER BY owner_id DESC`)); }
  catch(e){ res.status(500).json({ error:e.message }); }
});
app.post('/api/owners', requireLogin, async (req,res)=>{
  try{
    const { full_name, phone, address } = req.body;
    if(!full_name || !phone || !address) return res.status(400).json({ error:'ข้อมูลไม่ครบ' });
    const result = await q(`INSERT INTO owners(full_name,phone,address) VALUES(:full_name,:phone,:address)`,
      { full_name, phone, address });
    const [row] = await q(`SELECT owner_id, full_name, phone, address FROM owners WHERE owner_id=:id`, { id: result.insertId });
    res.status(201).json(row);
  }catch(e){ res.status(500).json({ error:e.message }); }
});
app.put('/api/owners/:id', requireLogin, async (req,res)=>{
  try{
    const { id } = req.params;
    const { full_name, phone, address } = req.body;
    await q(`UPDATE owners SET full_name=:full_name, phone=:phone, address=:address WHERE owner_id=:id`,
      { full_name, phone, address, id });
    const [row] = await q(`SELECT owner_id, full_name, phone, address FROM owners WHERE owner_id=:id`, { id });
    res.json(row);
  }catch(e){ res.status(500).json({ error:e.message }); }
});
app.delete('/api/owners/:id', requireLogin, async (req,res)=>{
  try{
    await q(`DELETE FROM owners WHERE owner_id=:id`, { id: req.params.id });
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:e.message }); }
});

// ---- Vets (read only) ----
app.get('/api/vets', requireLogin, async (req,res)=>{
  try{ res.json(await q(`SELECT vet_id, full_name, phone FROM veterinarians ORDER BY full_name ASC`)); }
  catch(e){ res.status(500).json({ error:e.message }); }
});

// ---- Pets CRUD ----
app.get('/api/pets', requireLogin, async (req,res)=>{
  try{
    const { owner_id } = req.query;
    let sql = `SELECT p.pet_id, p.owner_id, p.name, p.species, p.breed, p.sex, p.birthdate,
                      o.full_name AS owner_name
               FROM pets p JOIN owners o ON p.owner_id=o.owner_id `;
    const params={};
    if(owner_id){ sql += `WHERE p.owner_id=:owner_id `; params.owner_id = owner_id; }
    sql += `ORDER BY p.pet_id DESC`;
    res.json(await q(sql, params));
  }catch(e){ res.status(500).json({ error:e.message }); }
});
app.post('/api/pets', requireLogin, async (req,res)=>{
  try{
    const { owner_id, name, species, breed=null, sex, birthdate=null } = req.body;
    if(!owner_id || !name || !species || !sex) return res.status(400).json({ error:'ข้อมูลไม่ครบ' });
    const result = await q(`INSERT INTO pets(owner_id,name,species,breed,sex,birthdate)
                            VALUES(:owner_id,:name,:species,:breed,:sex,:birthdate)`,
                            { owner_id, name, species, breed, sex, birthdate });
    const [row] = await q(`SELECT p.*, o.full_name AS owner_name
                           FROM pets p JOIN owners o ON p.owner_id=o.owner_id
                           WHERE p.pet_id=:id`, { id: result.insertId });
    res.status(201).json(row);
  }catch(e){ res.status(500).json({ error:e.message }); }
});
app.put('/api/pets/:id', requireLogin, async (req,res)=>{
  try{
    const { id } = req.params;
    const { owner_id, name, species, breed=null, sex, birthdate=null } = req.body;
    await q(`UPDATE pets SET owner_id=:owner_id, name=:name, species=:species, breed=:breed, sex=:sex, birthdate=:birthdate
             WHERE pet_id=:id`, { owner_id, name, species, breed, sex, birthdate, id });
    const [row] = await q(`SELECT p.*, o.full_name AS owner_name
                           FROM pets p JOIN owners o ON p.owner_id=o.owner_id
                           WHERE p.pet_id=:id`, { id });
    res.json(row);
  }catch(e){ res.status(500).json({ error:e.message }); }
});
app.delete('/api/pets/:id', requireLogin, async (req,res)=>{
  try{ await q(`DELETE FROM pets WHERE pet_id=:id`, { id: req.params.id }); res.json({ ok:true }); }
  catch(e){ res.status(500).json({ error:e.message }); }
});

// ---- Appointments CRUD ----
app.get('/api/appointments', requireLogin, async (req,res)=>{
  try{
    const { from, to } = req.query;
    let sql = `
      SELECT a.appointment_id, a.appt_datetime, a.reason,
             o.owner_id, o.full_name AS owner_name,
             p.pet_id, p.name AS pet_name, p.species, p.sex,
             v.vet_id, v.full_name AS vet_name
      FROM appointments a
      JOIN owners o ON a.owner_id=o.owner_id
      JOIN pets p ON a.pet_id=p.pet_id
      JOIN veterinarians v ON a.vet_id=v.vet_id
    `;
    const params = {};
    const conds = [];
    if(from){ conds.push(`DATE(a.appt_datetime) >= :from`); params.from = from; }
    if(to){ conds.push(`DATE(a.appt_datetime) <= :to`); params.to = to; }
    if(conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' ORDER BY a.appt_datetime DESC';
    res.json(await q(sql, params));
  }catch(e){ res.status(500).json({ error:e.message }); }
});
app.post('/api/appointments', requireLogin, async (req,res)=>{
  try{
    const { owner_id, pet_id, vet_id, appt_datetime, reason=null } = req.body;
    if(!owner_id || !pet_id || !vet_id || !appt_datetime) return res.status(400).json({ error:'ข้อมูลไม่ครบ' });
    const result = await q(`INSERT INTO appointments(owner_id,pet_id,vet_id,appt_datetime,reason)
                            VALUES(:owner_id,:pet_id,:vet_id,:appt_datetime,:reason)`,
                            { owner_id, pet_id, vet_id, appt_datetime, reason });
    const [row] = await q(`
      SELECT a.*, o.full_name AS owner_name, p.name AS pet_name, v.full_name AS vet_name
      FROM appointments a
      JOIN owners o ON a.owner_id=o.owner_id
      JOIN pets p ON a.pet_id=p.pet_id
      JOIN veterinarians v ON a.vet_id=v.vet_id
      WHERE a.appointment_id=:id
    `, { id: result.insertId });
    res.status(201).json(row);
  }catch(e){ res.status(500).json({ error:e.message }); }
});
app.put('/api/appointments/:id', requireLogin, async (req,res)=>{
  try{
    const { id } = req.params;
    const { owner_id, pet_id, vet_id, appt_datetime, reason=null } = req.body;
    await q(`UPDATE appointments SET owner_id=:owner_id, pet_id=:pet_id, vet_id=:vet_id,
             appt_datetime=:appt_datetime, reason=:reason WHERE appointment_id=:id`,
             { owner_id, pet_id, vet_id, appt_datetime, reason, id });
    const [row] = await q(`
      SELECT a.*, o.full_name AS owner_name, p.name AS pet_name, v.full_name AS vet_name
      FROM appointments a
      JOIN owners o ON a.owner_id=o.owner_id
      JOIN pets p ON a.pet_id=p.pet_id
      JOIN veterinarians v ON a.vet_id=v.vet_id
      WHERE a.appointment_id=:id
    `, { id });
    res.json(row);
  }catch(e){ res.status(500).json({ error:e.message }); }
});
app.delete('/api/appointments/:id', requireLogin, async (req,res)=>{
  try{ await q(`DELETE FROM appointments WHERE appointment_id=:id`, { id: req.params.id }); res.json({ ok:true }); }
  catch(e){ res.status(500).json({ error:e.message }); }
});

// ---- Treatments CRUD ----
app.get('/api/treatments', requireLogin, async (req,res)=>{
  try{
    const rows = await q(`
      SELECT t.treatment_id, t.diagnosis, t.medication, t.treatment_date, t.notes,
             p.pet_id, p.name AS pet_name, p.species,
             v.vet_id, v.full_name AS vet_name,
             t.appointment_id
      FROM treatments t
      JOIN pets p ON t.pet_id=p.pet_id
      JOIN veterinarians v ON t.vet_id=v.vet_id
      ORDER BY t.treatment_date DESC, t.treatment_id DESC
    `);
    res.json(rows);
  }catch(e){ res.status(500).json({ error:e.message }); }
});
app.post('/api/treatments', requireLogin, async (req,res)=>{
  try{
    const { pet_id, vet_id, appointment_id=null, diagnosis, medication=null, treatment_date, notes=null } = req.body;
    if(!pet_id || !vet_id || !diagnosis || !treatment_date) return res.status(400).json({ error:'ข้อมูลไม่ครบ' });
    const result = await q(`
      INSERT INTO treatments(pet_id,vet_id,appointment_id,diagnosis,medication,treatment_date,notes)
      VALUES(:pet_id,:vet_id,:appointment_id,:diagnosis,:medication,:treatment_date,:notes)
    `, { pet_id, vet_id, appointment_id, diagnosis, medication, treatment_date, notes });
    const [row] = await q(`
      SELECT t.*, p.name AS pet_name, v.full_name AS vet_name
      FROM treatments t
      JOIN pets p ON t.pet_id=p.pet_id
      JOIN veterinarians v ON t.vet_id=v.vet_id
      WHERE t.treatment_id=:id
    `, { id: result.insertId });
    res.status(201).json(row);
  }catch(e){ res.status(500).json({ error:e.message }); }
});
app.put('/api/treatments/:id', requireLogin, async (req,res)=>{
  try{
    const { id } = req.params;
    const { pet_id, vet_id, appointment_id=null, diagnosis, medication=null, treatment_date, notes=null } = req.body;
    await q(`
      UPDATE treatments SET pet_id=:pet_id, vet_id=:vet_id, appointment_id=:appointment_id,
      diagnosis=:diagnosis, medication=:medication, treatment_date=:treatment_date, notes=:notes
      WHERE treatment_id=:id
    `, { pet_id, vet_id, appointment_id, diagnosis, medication, treatment_date, notes, id });
    const [row] = await q(`
      SELECT t.*, p.name AS pet_name, v.full_name AS vet_name
      FROM treatments t
      JOIN pets p ON t.pet_id=p.pet_id
      JOIN veterinarians v ON t.vet_id=v.vet_id
      WHERE t.treatment_id=:id
    `, { id });
    res.json(row);
  }catch(e){ res.status(500).json({ error:e.message }); }
});
app.delete('/api/treatments/:id', requireLogin, async (req,res)=>{
  try{ await q(`DELETE FROM treatments WHERE treatment_id=:id`, { id: req.params.id }); res.json({ ok:true }); }
  catch(e){ res.status(500).json({ error:e.message }); }
});

// Health
app.get('/api/health', async (req,res)=>{
  try{ const r = await q('SELECT 1 AS ok'); res.json({ ok:true, db:r[0].ok===1 }); }
  catch(e){ res.status(500).json({ ok:false, error:e.message }); }
});

app.listen(PORT, ()=> console.log(`✅ Server: http://localhost:${PORT}`));
