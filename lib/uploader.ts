import { decode } from 'base64-arraybuffer';
// ИСПРАВЛЕНО: Убрали /legacy
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

export async function uploadImage(uri: string) {
  try {
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpeg';

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    const fileName = `avatar_${Date.now()}.${ext}`;
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, decode(base64), {
        contentType: contentType,
        upsert: true,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error: any) {
    console.log('Upload error:', error.message);
    throw error;
  }
}