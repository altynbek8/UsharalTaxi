import { Button, Icon, Switch, Text } from '@rneui/themed';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { sendPush } from '../../lib/push';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

const { width } = Dimensions.get('window');

const DARK_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
];

export default function DriverHome() {
  const { user } = useAuth();
  
  const [isOnline, setIsOnline] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [verifStatus, setVerifStatus] = useState('new'); 

  const [orders, setOrders] = useState<any[]>([]); 
  const [selectedOrder, setSelectedOrder] = useState<any>(null); 
  const [currentOrder, setCurrentOrder] = useState<any>(null); 
  
  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchDriverStatus();
    }, [])
  );

  useEffect(() => {
    (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
            let loc = await Location.getCurrentPositionAsync({});
            setLocation(loc);
        }
    })();

    checkCurrentOrder();
    fetchOrders();

    const channel = supabase.channel('driver_main')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          if (payload.eventType === 'INSERT' && payload.new.status === 'pending') {
             setOrders(prev => [payload.new, ...prev]);
          }
          if (payload.eventType === 'UPDATE') {
             if (payload.new.driver_id === user?.id) {
                 if (payload.new.status === 'completed' || payload.new.status === 'cancelled') {
                     setCurrentOrder(null);
                     fetchOrders(); 
                 } else {
                     setCurrentOrder(payload.new);
                 }
             }
             if (payload.new.status !== 'pending') {
                setOrders(prev => prev.filter(o => o.id !== payload.new.id));
                if (selectedOrder?.id === payload.new.id) setSelectedOrder(null);
             }
          }
      })
      .subscribe();

    return () => { 
        supabase.removeChannel(channel);
        stopLocationTracking();
    };
  }, [selectedOrder]);

  useEffect(() => {
      if (isOnline) startLocationTracking();
      else stopLocationTracking();
  }, [isOnline]);

  async function startLocationTracking() {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
          setIsOnline(false);
          return Alert.alert('Ошибка', 'Нужен GPS');
      }
      
      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 3000 }, 
        (loc) => {
            setLocation(loc);
            supabase.from('profiles').update({ 
                latitude: loc.coords.latitude, 
                longitude: loc.coords.longitude 
            }).eq('id', user?.id).then();
        }
      );
  }

  function stopLocationTracking() {
      if (locationSubscription.current) {
          locationSubscription.current.remove();
          locationSubscription.current = null;
      }
  }

  async function fetchDriverStatus() {
    const { data } = await supabase.from('profiles').select('is_online, verification_status').eq('id', user?.id).single();
    if (data) {
        setIsOnline(data.is_online);
        setVerifStatus(data.verification_status || 'new');
    }
  }

  async function checkCurrentOrder() {
      const { data } = await supabase.from('orders')
        .select('*, passenger:profiles!passenger_id(full_name, phone)')
        .eq('driver_id', user?.id)
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .single();
      
      if (data) setCurrentOrder(data);
  }

  async function fetchOrders() {
    const { data } = await supabase.from('orders').select('*').eq('status', 'pending');
    if (data) setOrders(data);
  }

  async function toggleOnline() {
    // Проверка статуса
    const { data: freshProfile } = await supabase.from('profiles').select('verification_status').eq('id', user?.id).single();
    const actualStatus = freshProfile?.verification_status || 'new';

    if (actualStatus !== 'verified') {
        Alert.alert('Доступ запрещен', 'Ваши документы на проверке.', [
            { text: 'Ок', style: 'cancel' },
            { text: 'Проверить', onPress: () => router.push('/(driver)/verification') }
        ]);
        setIsOnline(false);
        setVerifStatus(actualStatus); 
        return;
    }

    const newState = !isOnline;
    setIsOnline(newState);
    await supabase.from('profiles').update({ is_online: newState }).eq('id', user?.id);
  }

  async function acceptOrder() {
    if (!selectedOrder) return;
    const { error } = await supabase.from('orders').update({ status: 'accepted', driver_id: user?.id }).eq('id', selectedOrder.id).eq('status', 'pending');
    if (error) Alert.alert('Опоздали', 'Заказ забрали');
    else {
        const order = orders.find(o => o.id === selectedOrder.id);
        if (order && order.passenger_id) await sendPush(order.passenger_id, 'Водитель найден! ✅', 'К вам выехала машина.');
        setSelectedOrder(null);
    }
  }

  async function updateStatus(status: string) {
      await supabase.from('orders').update({ status }).eq('id', currentOrder.id);
      if (currentOrder.passenger_id) {
          if (status === 'arrived') await sendPush(currentOrder.passenger_id, 'Такси прибыло! 🚖', 'Ваша машина ожидает вас.');
          if (status === 'in_progress') await sendPush(currentOrder.passenger_id, 'Поехали! 🚀', 'Приятной поездки.');
      }
      if (status === 'completed') Alert.alert('Поездка завершена', `+${currentOrder.price} ₸`);
  }

  const openMaps = async () => {
      if (!currentOrder || !currentOrder.from_lat) return;
      const lat = currentOrder.from_lat;
      const lon = currentOrder.from_lon;
      
      // Открываем Google Maps в браузере или приложении
      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
      Linking.openURL(url);
  };

  // --- ЭКРАН ПОЕЗДКИ ---
  if (currentOrder) {
      return (
          <View style={{flex: 1}}>
              <MapView 
                style={StyleSheet.absoluteFillObject}
                customMapStyle={DARK_MAP_STYLE}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                    latitude: currentOrder.from_lat,
                    longitude: currentOrder.from_lon,
                    latitudeDelta: 0.05, // Чуть дальше зум, чтобы влез маршрут
                    longitudeDelta: 0.05
                }}
                showsUserLocation={true}
              >
                  {/* Точка А: Где забрать (Зеленая) */}
                  <Marker coordinate={{latitude: currentOrder.from_lat, longitude: currentOrder.from_lon}} title="Пассажир" pinColor="green" />
                  
                  {/* Точка Б: Куда везти (Красная) */}
                  {currentOrder.to_lat && <Marker coordinate={{latitude: currentOrder.to_lat, longitude: currentOrder.to_lon}} title="Финиш" pinColor="red" />}

                  {/* ЛИНИЯ 1: От Водителя до Пассажира (Желтая) */}
                  {location && (
                      <Polyline
                          coordinates={[
                              { latitude: location.coords.latitude, longitude: location.coords.longitude },
                              { latitude: currentOrder.from_lat, longitude: currentOrder.from_lon }
                          ]}
                          strokeColor="#FFC107" // Желтый
                          strokeWidth={4}
                          lineDashPattern={[0]} 
                      />
                  )}

                  {/* ЛИНИЯ 2: От Пассажира до Финиша (Синяя) */}
                  {currentOrder.to_lat && (
                      <Polyline
                          coordinates={[
                              { latitude: currentOrder.from_lat, longitude: currentOrder.from_lon },
                              { latitude: currentOrder.to_lat, longitude: currentOrder.to_lon }
                          ]}
                          strokeColor="#4285F4" // Синий
                          strokeWidth={4}
                      />
                  )}
              </MapView>

              <View style={styles.bottomSheet}>
                  <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 10}}>
                      <Text style={{color:'gray', fontWeight:'bold'}}>{currentOrder.status.toUpperCase()}</Text>
                      <Text h3 style={{color:'green'}}>{currentOrder.price} ₸</Text>
                  </View>
                  <Text style={{fontSize: 18, fontWeight:'bold', marginBottom: 5}}>📍 {currentOrder.from_address}</Text>
                  <Text style={{fontSize: 16, color:'gray', marginBottom: 20}}>🏁 {currentOrder.to_address}</Text>
                  
                  <View style={{flexDirection: 'row', gap: 10, marginBottom: 15}}>
                      <Button icon={<Icon name="navigation" type="feather" color="white" />} onPress={openMaps} containerStyle={{flex: 1}} buttonStyle={{backgroundColor: '#4285F4', borderRadius: 10}} />
                      <Button icon={<Icon name="phone" type="feather" color="white" />} onPress={() => currentOrder.passenger?.phone && Linking.openURL(`tel:${currentOrder.passenger.phone}`)} containerStyle={{flex: 1}} buttonStyle={{backgroundColor: 'green', borderRadius: 10}} />
                      <Button icon={<Icon name="message-circle" type="feather" color="white" />} onPress={() => router.push({ pathname: '/order-chat', params: { id: currentOrder.id } })} containerStyle={{flex: 1}} buttonStyle={{backgroundColor: '#FFA000', borderRadius: 10}} />
                  </View>

                  {currentOrder.status === 'accepted' && <Button title="Я ПРИЕХАЛ" onPress={() => updateStatus('arrived')} buttonStyle={{backgroundColor:'#2089dc', borderRadius:10, height: 50}} />}
                  {currentOrder.status === 'arrived' && <Button title="НАЧАТЬ ПОЕЗДКУ" onPress={() => updateStatus('in_progress')} buttonStyle={{backgroundColor:'green', borderRadius:10, height: 50}} />}
                  {currentOrder.status === 'in_progress' && <Button title="ЗАВЕРШИТЬ" onPress={() => updateStatus('completed')} buttonStyle={{backgroundColor:'black', borderRadius:10, height: 50}} />}
              </View>
          </View>
      );
  }

  // --- СПИСОК (РАДАР) ---
  return (
    <View style={styles.container}>
        <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            customMapStyle={DARK_MAP_STYLE}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
                latitude: location?.coords.latitude || 43.238949,
                longitude: location?.coords.longitude || 76.889709,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05
            }}
            showsUserLocation={true}
            onPress={() => setSelectedOrder(null)}
        >
            {isOnline && !currentOrder && orders.map((order) => (
                <Marker
                    key={order.id}
                    coordinate={{ latitude: order.from_lat, longitude: order.from_lon }}
                    onPress={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                >
                    <View style={[styles.priceMarker, selectedOrder?.id === order.id && styles.selectedMarker]}>
                        <Text style={styles.priceText}>{order.price}₸</Text>
                    </View>
                </Marker>
            ))}
        </MapView>

        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings')}>
            <Icon name="settings" type="feather" size={24} color="black" />
        </TouchableOpacity>

        {!currentOrder && (
            <View style={styles.onlineToggle}>
                <Text style={{fontWeight: 'bold', marginRight: 10}}>{isOnline ? 'На линии' : 'Оффлайн'}</Text>
                <Switch value={isOnline} onValueChange={toggleOnline} color="green" />
            </View>
        )}

        {!isOnline && (
            <View style={styles.bottomSheet}>
                <View style={{alignItems:'center'}}>
                    <Icon name="power" type="feather" size={40} color="gray" style={{marginBottom: 10}} />
                    <Text h4 style={{color:'gray'}}>Вы не на линии</Text>
                    <Text style={{color:'#888', marginTop: 5}}>Включите статус, чтобы видеть заказы</Text>
                </View>
            </View>
        )}

        {isOnline && !selectedOrder && !currentOrder && (
            <View style={styles.bottomSheet}>
                <ActivityIndicator color="#FFC107" style={{marginBottom: 10}} />
                <Text h4 style={{textAlign:'center'}}>Поиск заказов...</Text>
                <Text style={{textAlign:'center', color:'gray'}}>Заказов рядом: {orders.length}</Text>
            </View>
        )}

        {selectedOrder && (
            <View style={styles.bottomSheet}>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 5}}>
                    <Text style={{color:'gray'}}>Новый заказ</Text>
                    <TouchableOpacity onPress={() => setSelectedOrder(null)}><Icon name="x" type="feather" color="gray"/></TouchableOpacity>
                </View>
                <Text h2 style={{color:'green', marginBottom: 10}}>{selectedOrder.price} ₸</Text>
                <Text style={{fontSize: 16, fontWeight:'bold', marginBottom: 5}}>📍 {selectedOrder.from_address}</Text>
                <Text style={{fontSize: 16, color:'gray', marginBottom: 20}}>🏁 {selectedOrder.to_address}</Text>
                <Button title="ВЗЯТЬ ЗАКАЗ" onPress={acceptOrder} buttonStyle={{ backgroundColor: '#FFC107', borderRadius: 10, height: 50 }} titleStyle={{ color: 'black', fontWeight: 'bold', fontSize: 18 }} />
            </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  settingsBtn: { position: 'absolute', top: 50, left: 20, backgroundColor: 'white', padding: 10, borderRadius: 25, elevation: 5, zIndex: 10 },
  onlineToggle: { position: 'absolute', top: 50, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, elevation: 5, zIndex: 10 },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, elevation: 20, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
  priceMarker: { backgroundColor: 'green', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 15, borderWidth: 2, borderColor: 'white', elevation: 5 },
  selectedMarker: { backgroundColor: '#FFC107', transform: [{ scale: 1.2 }] },
  priceText: { color: 'white', fontWeight: 'bold', fontSize: 12 }
});