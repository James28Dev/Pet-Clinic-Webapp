-- ===============[ 1) CREATE DATABASE & TABLES ]================
CREATE DATABASE pet_clinic_db CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE pet_clinic_db;

-- เจ้าของสัตว์เลี้ยง
CREATE TABLE owners (
  owner_id     INT AUTO_INCREMENT PRIMARY KEY,
  full_name    VARCHAR(120) NOT NULL,
  phone        VARCHAR(20)  NOT NULL,
  address      VARCHAR(255) NOT NULL,
  UNIQUE KEY uk_owner_phone (phone)
) ENGINE=InnoDB;

-- สัตวแพทย์
CREATE TABLE veterinarians (
  vet_id     INT AUTO_INCREMENT PRIMARY KEY,
  full_name  VARCHAR(120) NOT NULL,
  phone      VARCHAR(20)  NOT NULL,
  UNIQUE KEY uk_vet_phone (phone)
) ENGINE=InnoDB;

-- สัตว์เลี้ยง
CREATE TABLE pets (
  pet_id     INT AUTO_INCREMENT PRIMARY KEY,
  owner_id   INT NOT NULL,
  name       VARCHAR(80)  NOT NULL,
  species    VARCHAR(40)  NOT NULL,       -- ชนิด (สุนัข/แมว/กระต่าย ฯลฯ)
  breed      VARCHAR(80)  NULL,           -- พันธุ์
  sex        ENUM('M','F') NOT NULL,      -- M=ผู้ F=เมีย
  birthdate  DATE NULL,
  CONSTRAINT fk_pets_owner
    FOREIGN KEY (owner_id) REFERENCES owners(owner_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_pets_owner (owner_id)
) ENGINE=InnoDB;

-- ใบนัดหมาย
CREATE TABLE appointments (
  appointment_id   INT AUTO_INCREMENT PRIMARY KEY,
  owner_id         INT NOT NULL,
  pet_id           INT NOT NULL,
  vet_id           INT NOT NULL,
  appt_datetime    DATETIME NOT NULL,
  reason           VARCHAR(200) NULL,
  CONSTRAINT fk_appt_owner FOREIGN KEY (owner_id)
    REFERENCES owners(owner_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_appt_pet FOREIGN KEY (pet_id)
    REFERENCES pets(pet_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_appt_vet FOREIGN KEY (vet_id)
    REFERENCES veterinarians(vet_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_appt_pet (pet_id),
  INDEX idx_appt_vet (vet_id),
  INDEX idx_appt_datetime (appt_datetime)
) ENGINE=InnoDB;

-- ประวัติการรักษา
CREATE TABLE treatments (
  treatment_id   INT AUTO_INCREMENT PRIMARY KEY,
  pet_id         INT NOT NULL,
  vet_id         INT NOT NULL,
  appointment_id INT NULL,               -- อาจมาจากเคสฉุกเฉินที่ไม่มีใบนัดก็ได้
  diagnosis      VARCHAR(255) NOT NULL,  -- การวินิจฉัย
  medication     VARCHAR(255) NULL,      -- ยา/การรักษา
  treatment_date DATE NOT NULL,
  notes          TEXT NULL,
  CONSTRAINT fk_treat_pet FOREIGN KEY (pet_id)
    REFERENCES pets(pet_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_treat_vet FOREIGN KEY (vet_id)
    REFERENCES veterinarians(vet_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_treat_appt FOREIGN KEY (appointment_id)
    REFERENCES appointments(appointment_id) ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_treat_date (treatment_date)
) ENGINE=InnoDB;

-- บัญชีผู้ใช้
CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role ENUM('admin','staff','vet') DEFAULT 'staff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============[ 2) SAMPLE DATA (>=5 ROWS/TABLE) ]================

-- owners (5)
INSERT INTO owners (full_name, phone, address) VALUES
('สมชาย ใจดี',      '081-111-0001', '99/1 ถ.สุขสบาย อ.เมือง นครศรีฯ'),
('กมลพร ศรีสุข',    '082-222-0002', '12 หมู่ 3 ต.ท่าศาลา นครศรีฯ'),
('จิราภรณ์ พิพัฒน์', '083-333-0003', '55/8 ถ.บางกอก อ.หาดใหญ่ สงขลา'),
('ณัฐวุฒิ บุญมี',    '084-444-0004', '88/7 ซ.สวนพลู กทม.'),
('วราภรณ์ แก้วใส',  '085-555-0005', '101/2 ถ.เพชรเกษม อ.พุนพิน สุราษฎร์');

-- veterinarians (5)
INSERT INTO veterinarians (full_name, phone) VALUES
('น.สพ. เอกชัย มงคล',   '090-100-0001'),
('น.สพ. ธีรภัทร ชาญชัย','090-100-0002'),
('น.สพ. พิมพ์ชนก ศิริสุข','090-100-0003'),
('น.สพ. ชนาทิพย์ วัฒน์','090-100-0004'),
('น.สพ. รัตนา รุ่งเรือง','090-100-0005');

-- pets (7 ตัวอย่าง)
INSERT INTO pets (owner_id, name, species, breed, sex, birthdate) VALUES
(1, 'บราวนี่',  'สุนัข', 'ไทยหลังอาน', 'M', '2021-05-12'),
(1, 'มะลิ',     'แมว',   'เปอร์เซีย',   'F', '2022-02-20'),
(2, 'เจ้าทอง',  'สุนัข', 'ชิสุ',        'M', '2020-09-01'),
(3, 'ช็อกโก้',  'สุนัข', 'ปอมเมอเรเนียน','M','2023-01-15'),
(4, 'ข้าวปั้น', 'กระต่าย','ฮอลแลนด์ลอป','F','2022-11-11'),
(5, 'ฝนหลวง',  'แมว',   'ไทย',          'M', '2021-08-08'),
(5, 'ไข่มุก',   'นกแก้ว','เลิฟเบิร์ด',  'F', '2023-06-06');

-- appointments (อย่างน้อย 5)
INSERT INTO appointments (owner_id, pet_id, vet_id, appt_datetime, reason) VALUES
(1, 1, 1, '2025-10-28 09:00:00', 'ตรวจสุขภาพประจำปี'),
(1, 2, 3, '2025-10-28 10:30:00', 'ฉีดวัคซีนรวม'),
(2, 3, 2, '2025-10-29 14:00:00', 'อาเจียน/ถ่ายเหลว'),
(3, 4, 4, '2025-10-30 11:00:00', 'ทำวัคซีนเข็มแรก'),
(5, 6, 5, '2025-10-31 16:30:00', 'ทำหมัน'),
(5, 7, 3, '2025-11-01 13:00:00', 'ตรวจกรงเล็บ/ตัดเล็บ');

-- treatments (อย่างน้อย 5) ผูกกับสัตว์ + สัตวแพทย์ + (บางเคสผูกใบนัด)
INSERT INTO treatments (pet_id, vet_id, appointment_id, diagnosis, medication, treatment_date, notes) VALUES
(1, 1, 1, 'สุขภาพทั่วไปปกติ', 'วิตามินบีรวม 7 วัน', '2025-10-28', 'แนะนำออกกำลังกาย'),
(2, 3, 2, 'ฉีดวัคซีนรวม', 'วัคซีนรวม FELV', '2025-10-28', 'นัดเข็มถัดไปอีก 1 เดือน'),
(3, 2, 3, 'ลำไส้อักเสบเฉียบพลัน', 'ยาฆ่าเชื้อ + ORS', '2025-10-29', 'งดอาหารมัน/ทอด'),
(4, 4, 4, 'สุขภาพดี', 'ถ่ายพยาธิ', '2025-10-30', 'ติดตามน้ำหนัก'),
(6, 5, 5, 'ผ่าตัดทำหมัน', 'ยาลดปวด + ยาปฏิชีวนะ', '2025-10-31', 'พักฟื้น 10 วัน'),
(7, 3, 6, 'ตัดเล็บและขัดจะงอย', 'วิตามินรวม', '2025-11-01', 'ติดตามอีก 3 เดือน');
