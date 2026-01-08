// api/device.js
import { createClient } from '@supabase/supabase-js';

// ใส่ค่าจาก Supabase ที่ได้จากขั้นตอนที่ 1
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // 1. กรณี ESP8266 ส่งข้อมูลมา (SYNC)
  if (req.method === 'POST') {
    const { temp, motion, fan_status, from_app } = req.body;

    // ถ้ามาจาก App (คนกดปุ่มสั่งงาน)
    if (from_app) {
      const { manual_mode, fan_command } = req.body;
      const { error } = await supabase
        .from('fan_state')
        .update({ manual_mode, fan_command, updated_at: new Date() })
        .eq('id', 1);
      
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    // ถ้ามาจาก ESP8266 (อัปเดตค่า Sensor)
    else {
      // อัปเดตอุณหภูมิและการเคลื่อนไหวลง Database
      await supabase
        .from('fan_state')
        .update({ current_temp: temp, motion_detected: motion, updated_at: new Date() })
        .eq('id', 1);

      // อ่านค่าคำสั่งล่าสุดจาก Database เพื่อส่งกลับไปให้ ESP8266
      const { data } = await supabase
        .from('fan_state')
        .select('manual_mode, fan_command')
        .single();

      // ส่ง JSON กลับไปตามรูปแบบที่ ESP8266 รอรับ
      return res.status(200).json({
        manual_mode: data.manual_mode,
        fan_command: data.fan_command
      });
    }
  }

  // 2. กรณี App ขอข้อมูลไปแสดงผล (GET)
  if (req.method === 'GET') {
    const { data } = await supabase.from('fan_state').select('*').single();
    return res.status(200).json(data);
  }
}