import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ตรวจสอบ JWT Token จาก Browser
function verifyAppToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  try {
    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

// ตรวจสอบ Device Secret จาก ESP8266 (แยกต่อ device_id)
function isDeviceRequest(req, device_id) {
  const secret = process.env[`DEVICE_SECRET_${device_id}`];
  if (!secret) return false;
  return req.headers['x-device-secret'] === secret;
}

export default async function handler(req, res) {
  const device_id = req.query.id || 1;

  // GET (Browser only - ต้องมี JWT Token)
  if (req.method === 'GET') {
    if (!verifyAppToken(req)) return res.status(401).json({ error: 'Unauthorized' });
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
      if (!verifyAppToken(req)) return res.status(401).json({ error: 'Unauthorized' });
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
      // จาก ESP8266 - ต้องมี DEVICE_SECRET header ที่ตรงกับ device_id
      if (!isDeviceRequest(req, device_id)) return res.status(401).json({ error: 'Unauthorized' });
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