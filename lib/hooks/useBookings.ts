import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';

export interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled';
  notes: string | null;
  services: { name: string; price_ils: number; duration_minutes: number } | null;
}

interface UseBookingsResult {
  bookings: Booking[];
  upcoming: Booking[];
  past: Booking[];
  loading: boolean;
  refresh: () => void;
}

export function useBookings(): UseBookingsResult {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('bookings')
      .select('id, start_time, end_time, status, notes, services(name, price_ils, duration_minutes)')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false })
      .limit(30);

    setBookings((data ?? []) as Booking[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const upcoming = bookings.filter(
    (b) => b.status === 'confirmed' && new Date(b.start_time) >= now,
  );
  const past = bookings.filter(
    (b) => b.status === 'cancelled' || new Date(b.start_time) < now,
  );

  return { bookings, upcoming, past, loading, refresh: load };
}
