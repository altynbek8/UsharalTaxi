import { Badge, Card, Icon, Text, useTheme } from '@rneui/themed';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';

export default function HistoryScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    fetchHistory();
  }, []));

  async function fetchHistory() {
    setLoading(true);
    // Загружаем заказы, где я был ИЛИ пассажиром, ИЛИ водителем
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`passenger_id.eq.${user?.id},driver_id.eq.${user?.id}`)
        .order('created_at', { ascending: false }); // Сначала новые

    if (!error && data) {
        setOrders(data);
    }
    setLoading(false);
  }

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'completed': return 'success';
          case 'cancelled': return 'error';
          case 'pending': return 'warning';
          default: return 'primary';
      }
  };

  const getStatusText = (status: string) => {
      switch(status) {
          case 'completed': return 'Завершен';
          case 'cancelled': return 'Отменен';
          case 'pending': return 'Поиск...';
          case 'in_progress': return 'В пути';
          default: return status;
      }
  };

  const renderItem = ({ item }: { item: any }) => {
      const isMyDriverOrder = item.driver_id === user?.id;
      const date = new Date(item.created_at);
      const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      return (
        <TouchableOpacity disabled={true} style={styles.cardContainer}>
            <View style={styles.cardHeader}>
                <Text style={styles.dateText}>{dateStr} • {timeStr}</Text>
                <Badge 
                    value={getStatusText(item.status)} 
                    status={getStatusColor(item.status) as any} 
                    badgeStyle={{height: 25, paddingHorizontal: 10}}
                />
            </View>
            
            <View style={styles.row}>
                <View>
                    <Text style={styles.roleText}>
                        {isMyDriverOrder ? 'Вы везли 🚕' : 'Вы ехали 👤'}
                    </Text>
                    <Text h4 style={{marginTop: 5}}>
                        {item.price} ₸
                    </Text>
                </View>
                <Icon 
                    name={item.status === 'completed' ? 'check-circle' : 'x-circle'} 
                    type="feather" 
                    color={item.status === 'completed' ? '#4CAF50' : '#ccc'} 
                    size={30}
                />
            </View>

            <View style={styles.addressContainer}>
                <View style={styles.addrRow}>
                    <Icon name="map-pin" type="feather" size={14} color="gray" />
                    <Text style={styles.addrText} numberOfLines={1}>{item.from_address || 'Точка А'}</Text>
                </View>
                <View style={[styles.addrRow, {marginTop: 5}]}>
                    <Icon name="flag" type="feather" size={14} color="gray" />
                    <Text style={styles.addrText} numberOfLines={1}>{item.to_address || 'Точка Б'}</Text>
                </View>
            </View>
        </TouchableOpacity>
      );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Icon name="arrow-left" type="feather" size={24} />
          </TouchableOpacity>
          <Text h4 style={{marginLeft: 15}}>Мои поездки</Text>
      </View>

      {loading ? (
          <ActivityIndicator size="large" color="#FFC107" style={{marginTop: 50}} />
      ) : (
          <FlatList 
            data={orders}
            keyExtractor={item => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
            ListEmptyComponent={
                <View style={{alignItems:'center', marginTop: 100}}>
                    <Icon name="clock" type="feather" size={50} color="#ddd" />
                    <Text style={{color:'gray', marginTop: 20, fontSize: 16}}>Истории поездок пока нет</Text>
                </View>
            }
          />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9', paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#eee', backgroundColor: 'white' },
  backBtn: { padding: 5 },
  cardContainer: { backgroundColor: 'white', borderRadius: 15, padding: 15, marginBottom: 15, shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  dateText: { color: 'gray', fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  roleText: { color: '#666', fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold' },
  addressContainer: { backgroundColor: '#f5f5f5', padding: 10, borderRadius: 10 },
  addrRow: { flexDirection: 'row', alignItems: 'center' },
  addrText: { marginLeft: 10, color: '#333', flex: 1 }
});