const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('Supabase URL or Key not set. Database operations will fail until configured.');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

module.exports = { supabase };
