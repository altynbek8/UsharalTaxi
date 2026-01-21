import { supabase } from './supabase';

export async function uploadImage(uri: string) {
  try {
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpeg';
    const fileName = `img_${Date.now()}.${ext}`;
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();

    const { error } = await supabase.storage
      .from('avatars')
      .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    return urlData.publicUrl;
  } catch (error: any) {
    throw error;
  }
}