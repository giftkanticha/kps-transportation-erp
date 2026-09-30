-- โลเคชั่นเบื้องต้น (ชื่อ + ลิงก์ Google Maps) ที่ผู้ใช้ส่งมา
-- เพิ่มถ้ายังไม่มี; ถ้ามีชื่อนี้อยู่แล้วจะอัปเดตเฉพาะ maps_url (ไม่แตะหมวด/จังหวัด/ลูกค้า)
-- หมายเหตุ: ลิงก์ย่อ maps.app.goo.gl ไม่มีพิกัดฝังใน URL — ระบบใช้เปิดแผนที่ได้ แต่ยังคำนวณ
-- เส้นทางจากพิกัดไม่ได้ ถ้าต้องการให้แม่นยำ ให้วางลิงก์เต็มทีหลังในหน้าจัดการสถานที่
-- Production tables live in the `kps` schema (see 0047).

INSERT INTO kps.locations (name, maps_url) VALUES
  ('ฟาร์มเกษตรชัย',  'https://maps.app.goo.gl/orgpATZzfGChT8nW8'),
  ('PPF',            'https://maps.app.goo.gl/c12XNe1iUERQgcYaA'),
  ('CP-TR',          'https://maps.app.goo.gl/cr52yhMXk2WRC3LG7'),
  ('CP-RB',          'https://maps.app.goo.gl/YjxuAGNjScArwBpU9'),
  ('CP-SR',          'https://maps.app.goo.gl/rXSyXBJHPzB5mESe7'),
  ('CP-BP',          'https://maps.app.goo.gl/TSUNyHPkHFLEz9sB8'),
  ('CP-KB',          'https://maps.app.goo.gl/SHm8HyvhHZLxfDqR7'),
  ('TFG-KB',         'https://maps.app.goo.gl/smCoviGX8S1ZQEe26'),
  ('TFG-SP',         'https://maps.app.goo.gl/DsVykAnvDjfakSgi8'),
  ('CNF',            'https://maps.app.goo.gl/61ECajqRxMwYCDYE9'),
  ('กรุงไทยบ้านบึง', 'https://maps.app.goo.gl/G27gbHy6EQAeDKKX6'),
  ('ปพน',            'https://maps.app.goo.gl/FTPd3ahKpkxUvVsH8'),
  ('KPS',            'https://maps.app.goo.gl/5rABS9zSVn9Jdvvn9'),
  ('JJ',             'https://maps.app.goo.gl/a5rKeCFuCY8oAk2k8')
ON CONFLICT (name) DO UPDATE SET maps_url = EXCLUDED.maps_url;
