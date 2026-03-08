import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/database';
import { useEffect, useState } from 'react';

export function useNearbyDrivers() {
  const [drivers, setDrivers] = useState<Profile[]>([]);

  useEffect(() => {
    // 1. Сразу загружаем тех, кто онлайн
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'driver')
        .eq('is_online', true);
      if (data) setDrivers(data as Profile[]);
    };
    fetchInitial();

    // 2. Слушаем перемещения в реальном времени
    const channel = supabase.channel('drivers-map')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles',
        filter: "role=eq.driver" 
      }, (payload) => {
        const updatedDriver = payload.new as Profile;
        
        setDrivers(current => {
          const exists = current.find(d => d.id === updatedDriver.id);
          if (updatedDriver.is_online) {
            if (exists) {
              return current.map(d => d.id === updatedDriver.id ? updatedDriver : d);
            }
            return [...current, updatedDriver];
          } else {
            return current.filter(d => d.id !== updatedDriver.id);
          }
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return drivers;
}