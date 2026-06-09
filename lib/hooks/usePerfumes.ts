import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';

export interface Perfume {
  id: string;
  name: string;
  description: string;
  price_ils: number;
  stock_quantity: number;
  image_url: string | null;
  is_active: boolean;
}

export interface PerfumeOrder {
  id: string;
  quantity: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  perfumes: { name: string; price_ils: number } | null;
}

interface UsePerfumesResult {
  perfumes: Perfume[];
  myOrders: PerfumeOrder[];
  loading: boolean;
  refresh: () => void;
}

export function usePerfumes(): UsePerfumesResult {
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [myOrders, setMyOrders] = useState<PerfumeOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();

    const [perfumesRes, ordersRes] = await Promise.all([
      supabase
        .from('perfumes')
        .select('*')
        .eq('is_active', true)
        .gt('stock_quantity', 0)
        .order('name'),
      user
        ? supabase
            .from('perfume_orders')
            .select('id, quantity, status, created_at, perfumes(name, price_ils)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
    ]);

    setPerfumes(perfumesRes.data ?? []);
    setMyOrders((ordersRes.data ?? []) as PerfumeOrder[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { perfumes, myOrders, loading, refresh: load };
}
