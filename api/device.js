import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // *** อ่านค่า ID จาก URL (เช่น ?id=2) ถ้าไม่ส่งมาให้ใช้ 1 เป็นค่าเริ่มต้น ***
  const device_id = req.query.id || 1;

  // GET
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('fan_state')
      .select('*')
      .eq('id', device_id) // *** ใช้ตัวแปร device_id แทนเลข 1 ***
      .single();
      
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST
  if (req.method === 'POST') {
    const { temp, motion, from_app, manual_mode, fan_command, set_target_temp, swing_command } = req.body;

    if (from_app) {
      let updateData = { updated_at: new Date() };
      if (manual_mode !== undefined) updateData.manual_mode = manual_mode;
      if (fan_command !== undefined) updateData.fan_command = fan_command;
      if (set_target_temp !== undefined) updateData.target_temp = set_target_temp;
      if (swing_command !== undefined) updateData.swing_command = swing_command;

      const { error } = await supabase
        .from('fan_state')
        .update(updateData)
        .eq('id', device_id); // *** แก้ตรงนี้ ***
      
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    } else {
      // จาก ESP8266
      await supabase
        .from('fan_state')
        .update({ 
            current_temp: temp, 
            motion_detected: motion, 
            updated_at: new Date(),
            device_last_seen: new Date()
        })
        .eq('id', device_id); // *** แก้ตรงนี้ ***

      const { data } = await supabase
        .from('fan_state')
        .select('manual_mode, fan_command, target_temp, swing_command')
        .eq('id', device_id) // *** แก้ตรงนี้ ***
        .single();

      return res.status(200).json({
        manual_mode: data.manual_mode,
        fan_command: data.fan_command,
        target_temp: data.target_temp,
        swing_command: data.swing_command
      });
    }
  }
}