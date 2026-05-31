/**
 * 프론트엔드 Supabase 클라이언트 (Auth 전용)
 * signUp, onAuthStateChange, updateUser 등 Auth 기능에 사용
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nwqfdjzjmbbwhlbxsypj.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_TfN19fvsZw0SigJxs5dXhQ_iISuE1_-';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
