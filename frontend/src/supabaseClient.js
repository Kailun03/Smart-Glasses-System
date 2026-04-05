import { createClient } from '@supabase/supabase-js';

console.log("React Environment:", process.env.REACT_APP_SUPABASE_URL);

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);