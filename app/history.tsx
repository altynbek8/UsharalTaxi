import { Badge, Card, Icon, Text, useTheme } from '@rneui/themed';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';

export default function HistoryScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`passenger_id.eq.${user?.id},driver_id.eq.${user?.id}`)
        // ИСПРАВЛЕНИЕ: Теперь показываем всё, не только завершенные, чтобы видеть историю целиком
        .order('created_at', { ascending: false });

    if (!error && data) {
        setOrders(data);
    }
    setLoading(false);
  }

  const renderItem = ({ item }: { item: any }) => {
      // ИСПРАВЛЕНИЕ: Логика цветов и текста
      let statusText = 'В пути';
      let statusColor = 'warning'; 

      if (item.status === 'cancelled') {
          statusText = 'Отменен';
          statusColor = 'error';
      } else if (item.status === 'completed') {
          statusText = 'Завершен';
          statusColor = 'success';
      } else if (item.status === 'pending') {
          statusText = 'Поиск...';
          statusColor = 'primary';
      }

      return (
        <Card containerStyle={styles.card}>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 10}}>
                <Text style={{color: 'gray', fontSize: 12}}>
                    {new Date(item.created_at).toLocaleDateString()} • {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </Text>
                <Badge 
                    value={statusText} 
                    status={statusColor as any} 
                />
            </View>
            
            <View style={styles.row}>
                {/* Защита, если цена 0 или null */}
                <Text h4 style={{color: item.status === 'cancelled' ? 'gray' : 'green'}}>
                    {item.price ? item.price + ' ₸' : '---'}
                </Text>
            </View>

            <View style={{marginTop: 10}}>
                <Text style={styles.address}>📍 {item.from_address || 'Адрес не указан'}</Text>
                <Text style={styles.address}>🏁 {item.to_address}</Text>
            </View>
        </Card>
      );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
              <Icon name="arrow-left" type="feather" size={24} />
          </TouchableOpacity>
          <Text h3 style={{marginLeft: 20}}>История поездок</Text>
      </View>

      {loading ? (
          <ActivityIndicator size="large" color="#FFC107" style={{marginTop: 50}} />
      ) : (
          <FlatList 
            data={orders}
            keyExtractor={item => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
                <Text style={{textAlign:'center', marginTop: 50, color:'gray'}}>Поездок пока нет</Text>
            }
          />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  card: { borderRadius: 15, padding: 15, marginBottom: 5, elevation: 2, borderWidth: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  address: { fontSize: 16, marginBottom: 5, color: '#333' }
});