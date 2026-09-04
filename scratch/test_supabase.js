import { supabase } from '../src/js/supabase.js';

async function testSupabase() {
  try {
    console.log("Testing Supabase connection...");
    const { data, error } = await supabase.from('users').select('*').limit(1);
    
    if (error) {
      console.error("SUPABASE ERROR:", error.message || error);
      console.debug("Full error:", error);
    } else {
      console.log("SUPABASE SUCCESS! Data received:", data);
    }
  } catch (err) {
    console.error("SUPABASE TEST FAILED:", err);
  }
}

testSupabase();
