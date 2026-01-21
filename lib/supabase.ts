import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// ВСТАВЬ СЮДА КЛЮЧИ ОТ ПРОЕКТА ТАКСИ (TAXI)
const supabaseUrl = 'https://gzxrlohpzhzbfvtcjotm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6eHJsb2hwemh6YmZ2dGNqb3RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTQ4MjAsImV4cCI6MjA4MzE5MDgyMH0.P7xTD-i_Tfe6lEH6pewZxzGsG_GUp7iNSzC1fmutCkk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});