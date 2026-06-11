/** Shared row types for the Supabase tables used across screens. */

export type BookingStatus = 'confirmed' | 'cancelled';
export type OrderStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Service {
  id: string;
  name: string;
  price_ils: number;
  duration_minutes: number;
  is_active: boolean;
}

export interface Perfume {
  id: string;
  name: string;
  description: string;
  price_ils: number;
  stock_quantity: number;
  image_url: string | null;
  is_active: boolean;
}

export interface GalleryImage {
  id: string;
  image_url: string;
  display_order: number;
}
