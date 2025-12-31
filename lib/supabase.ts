import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// ВСТАВЬ СЮДА КЛЮЧИ ОТ ПРОЕКТА ТАКСИ (TAXI)
const supabaseUrl = 'https://cnhofildnjotidiqmmcn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuaG9maWxkbmpvdGlkaXFtbWNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MjEzMTcsImV4cCI6MjA4MTk5NzMxN30.hD_3g-S94yEOE2NH-IKti7AQSStsNsQdInphhJoWmT8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});