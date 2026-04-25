import { createClient } from '@supabase/supabase-js';

// The credentials provided by the user
const supabaseUrl = 'https://xyepjzmhsrotypygnuqk.supabase.co';
const supabaseKey = 'sb_publishable_HlgXB652seDLwkoGS1-GMQ_s2dzcE9g';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to get current user ID (for this app we'll store it in localStorage after login)
export const getCurrentUserId = () => {
  return localStorage.getItem('pharmawatch_user_id');
};
