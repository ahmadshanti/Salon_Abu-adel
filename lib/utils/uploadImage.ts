import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../supabase';

export async function uploadImage(
  localUri: string,
  bucket: string,
  prefix = 'img',
): Promise<{ url: string | null; error: string | null }> {
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: 'base64' as any,
    });

    if (!base64) return { url: null, error: 'فشل قراءة الصورة من الجهاز' };

    const arrayBuffer = decode(base64);
    const filename = `${prefix}_${Date.now()}.jpg`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filename, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

    if (error) return { url: null, error: `Storage error: ${error.message}` };
    if (!data) return { url: null, error: 'لم يتم إرجاع بيانات من Storage' };

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return { url: urlData.publicUrl, error: null };
  } catch (e: any) {
    return { url: null, error: e?.message ?? 'خطأ غير معروف' };
  }
}
