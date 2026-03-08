import { supabase } from './supabase';

export async function uploadImage(uri: string, bucket: 'avatars' | 'documents' = 'avatars') {
  try {
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpeg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

    // 1. Преобразуем файл в "двоичные данные" (ArrayBuffer)
    // Это стандартный способ, который работает везде
    const response = await fetch(uri);
    const fileData = await response.arrayBuffer();

    // 2. Загружаем в Supabase
    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileData, {
        contentType: `image/${ext}`,
        upsert: true,
      });

    if (error) throw error;

    // 3. Получаем ссылку
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;

  } catch (error: any) {
    console.log("Ошибка загрузки:", error.message);
    throw error;
  }
}