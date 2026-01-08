import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // GET
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('fan_state').select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST
  if (req.method === 'POST') {
    const { temp, motion, from_app, manual_mode, fan_command, set_target_temp, swing_command } = req.body;

    // 1. จาก App (คนกดปุ่ม) -> อัปเดตแค่สถานะ แต่ไม่อัปเดตเวลา device_last_seen
    if (from_app) {
      let updateData = { updated_at: new Date() };
      
      if (manual_mode !== undefined) updateData.manual_mode = manual_mode;
      if (fan_command !== undefined) updateData.fan_command = fan_command;
      if (set_target_temp !== undefined) updateData.target_temp = set_target_temp;
      if (swing_command !== undefined) updateData.swing_command = swing_command;

      const { error } = await supabase.from('fan_state').update(updateData).eq('id', 1);
      
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    // 2. จาก ESP8266 (Heartbeat) -> อัปเดต device_last_seen
    else {
      await supabase
        .from('fan_state')
        .update({ 
            current_temp: temp, 
            motion_detected: motion, 
            updated_at: new Date(),
            device_last_seen: new Date() // *** บันทึกเวลาที่เจออุปกรณ์ ***
        })
        .eq('id', 1);

      const { data } = await supabase
        .from('fan_state')
        .select('manual_mode, fan_command, target_temp, swing_command')
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