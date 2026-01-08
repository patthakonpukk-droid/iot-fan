import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // GET: ดึงข้อมูลไปแสดงหน้าเว็บ
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('fan_state').select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST: รับคำสั่ง
  if (req.method === 'POST') {
    const { temp, motion, from_app, manual_mode, fan_command, set_target_temp } = req.body;

    // 1. ถ้ามาจาก App (คนกดปุ่ม หรือ ตั้งค่าอุณหภูมิ)
    if (from_app) {
      let updateData = { updated_at: new Date() };
      
      // ถ้ามีการส่งค่าโหมดมาให้อัปเดต
      if (manual_mode !== undefined) updateData.manual_mode = manual_mode;
      if (fan_command !== undefined) updateData.fan_command = fan_command;
      
      // *** ถ้ามีการส่งค่าอุณหภูมิเป้าหมายมา ***
      if (set_target_temp !== undefined) updateData.target_temp = set_target_temp;

      const { error } = await supabase.from('fan_state').update(updateData).eq('id', 1);
      
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    // 2. ถ้ามาจาก ESP8266 (ส่งค่า Sensor)
    else {
      // บันทึกค่า Sensor
      await supabase
        .from('fan_state')
        .update({ current_temp: temp, motion_detected: motion, updated_at: new Date() })
        .eq('id', 1);

      // *** อ่านคำสั่ง + อุณหภูมิเป้าหมาย ส่งกลับไปให้ ESP ***
      const { data } = await supabase
        .from('fan_state')
        .select('manual_mode, fan_command, target_temp')
        .single();

      return res.status(200).json({
        manual_mode: data.manual_mode,
        fan_command: data.fan_command,
        target_temp: data.target_temp // ส่งค่านี้เพิ่มไป
      });
    }
  }
}