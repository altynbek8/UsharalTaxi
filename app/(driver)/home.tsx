import { Button, Divider, Icon, Text } from '@rneui/themed';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StatusBar, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getRoute } from '@/lib/map';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useOrderStore } from '@/store/useOrderStore';
import { Order } from '@/types/database';

const USHARAL_REGION = {
    latitude: 46.1687,
    longitude: 80.9431,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
};

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

export default function DriverHome() {
  const { user } = useAuth();
  const { activeOrder, setActiveOrder, resetOrder } = useOrderStore();
  
  const [isOnline, setIsOnline] = useState(false);
  const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
  const [mapRegion, setMapRegion] = useState(USHARAL_REGION);
  const [routeCoords, setRouteCoords] = useState<any[]>([]);
  const locationSub = useRef<any>(null);

  async function handleToggleOnline(val: boolean) {
    if (val === true) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('verification_status, car_number, car_model')
        .eq('id', user?.id)
        .single();

      if (error || !profile) return Alert.alert("Ошибка", "Профиль не найден.");

      if (profile.verification_status !== 'verified') {
        return Alert.alert("Доступ ограничен", "Администратор еще не проверил ваши документы.",
          [{ text: "К проверке", onPress: () => router.push('/(driver)/verification') }]);
      }

      if (!profile.car_number || !profile.car_model) {
        return Alert.alert("Нет данных авто", "Заполните данные о машине в настройках.",
          [{ text: "Настройки", onPress: () => router.push('/settings') }]);
      }
    }
    setIsOnline(val);
    await supabase.from('profiles').update({ is_online: val }).eq('id', user?.id);
  }

  useEffect(() => {
    async function startTracking() {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      if (isOnline) {
        locationSub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10 },
          (loc) => {
            const { latitude, longitude } = loc.coords;
            setMapRegion(prev => ({ ...prev, latitude, longitude }));
            supabase.from('profiles').update({ current_lat: latitude, current_lon: longitude }).eq('id', user?.id).then();
          }
        );
      } else { locationSub.current?.remove(); }
    }
    startTracking();
    return () => locationSub.current?.remove();
  }, [isOnline]);

  useEffect(() => {
    const channel = supabase.channel('new_orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: "status=eq.pending" }, 
      (payload) => { if (!activeOrder && isOnline) setIncomingOrder(payload.new as Order); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeOrder, isOnline]);

  async function acceptOrder() {
    if (!incomingOrder) return;
    const { error } = await supabase.from('orders').update({ status: 'accepted', driver_id: user?.id }).eq('id', incomingOrder.id);
    if (!error) {
      setActiveOrder(incomingOrder);
      setIncomingOrder(null);
      const coords = await getRoute(mapRegion.latitude, mapRegion.longitude, incomingOrder.from_lat, incomingOrder.from_lon);
      setRouteCoords(coords);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <MapView provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} customMapStyle={darkMapStyle} region={mapRegion} showsUserLocation>
        {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeColor="#FFC107" strokeWidth={4} />}
      </MapView>
      <SafeAreaView style={styles.topBar}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/menu')}><Icon name="menu" type="feather" color="white" /></TouchableOpacity>
        <View style={[styles.statusToggle, { backgroundColor: isOnline ? '#4CAF50' : '#1A1A1A' }]}>
          <Text style={styles.statusText}>{isOnline ? 'В СЕТИ' : 'Оффлайн'}</Text>
          <Switch value={isOnline} onValueChange={handleToggleOnline} />
        </View>
      </SafeAreaView>
      {incomingOrder && !activeOrder && (
        <View style={styles.orderAlert}>
          <Text style={styles.alertTitle}>НОВЫЙ ЗАКАЗ!</Text>
          <Text style={styles.priceText}>{incomingOrder.price} ₸</Text>
          <Text style={styles.addrText} numberOfLines={1}>📍 {incomingOrder.from_address}</Text>
          <View style={styles.btnRow}>
             <Button title="ПРОПУСТИТЬ" onPress={() => setIncomingOrder(null)} type="clear" titleStyle={{color: 'gray'}} />
             <Button title="ПРИНЯТЬ" onPress={acceptOrder} buttonStyle={styles.acceptBtn} containerStyle={{flex: 1}} />
          </View>
        </View>
      )}
      {activeOrder && (
        <View style={styles.activeSheet}>
           <Text style={styles.activeStatus}>К КЛИЕНТУ</Text>
           <Text style={styles.activeAddr}>{activeOrder.from_address}</Text>
           <Divider style={{marginVertical: 15, backgroundColor: '#333'}} />
           <Button title="Я НА МЕСТЕ" onPress={() => { supabase.from('orders').update({status: 'completed'}).eq('id', activeOrder.id).then(); resetOrder(); setRouteCoords([]); }} buttonStyle={styles.actionBtn} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { position: 'absolute', top: 10, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menuBtn: { backgroundColor: '#1A1A1A', padding: 12, borderRadius: 15, elevation: 10 },
  statusToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20 },
  statusText: { color: 'white', fontWeight: 'bold', marginRight: 10, fontSize: 12 },
  orderAlert: { position: 'absolute', top: 120, left: 20, right: 20, backgroundColor: '#121212', borderRadius: 25, padding: 20, borderWidth: 2, borderColor: '#FFC107' },
  alertTitle: { color: '#FFC107', fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  priceText: { color: 'white', fontSize: 32, fontWeight: 'bold', textAlign: 'center' },
  addrText: { color: '#aaa', textAlign: 'center', marginBottom: 20 },
  btnRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  acceptBtn: { backgroundColor: '#FFC107', borderRadius: 15, height: 55 },
  activeSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#121212', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 40 },
  activeStatus: { color: '#FFC107', fontWeight: 'bold', fontSize: 12, marginBottom: 5 },
  activeAddr: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  actionBtn: { backgroundColor: '#4CAF50', borderRadius: 15, height: 55, marginTop: 10 }
});