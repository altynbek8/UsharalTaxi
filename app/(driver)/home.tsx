import { Button, Icon, Switch, Text, AirbnbRating, Avatar, Divider } from '@rneui/themed';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, StyleSheet, TouchableOpacity, View, StatusBar, Modal } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { sendPush } from '../../lib/push';
import { getRoute } from '../../lib/map';

export default function DriverHome() {
  const { user } = useAuth();
  
  const [isOnline, setIsOnline] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('new');
  
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [routeCoords, setRouteCoords] = useState<any[]>([]);

  const currentOrderRef = useRef<any>(null);
  const selectedOrderRef = useRef<any>(null);

  const [showRating, setShowRating] = useState(false);
  const [lastFinishedOrderId, setLastFinishedOrderId] = useState<string | null>(null);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const locationSubscription = useRef<any>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => { currentOrderRef.current = currentOrder; }, [currentOrder]);
  useEffect(() => { selectedOrderRef.current = selectedOrder; }, [selectedOrder]);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    refreshProfile();
    fetchCurrentOrder(); 
  }, [user]));

  async function refreshProfile() {
      const { data } = await supabase.from('profiles').select('is_online, verification_status').eq('id', user?.id).single();
      if (data) {
          setIsOnline(data.is_online);
          setVerificationStatus(data.verification_status);
      }
  }

  // --- ГЛАВНАЯ ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ СТАТУСА ---
  async function handleToggleOnline(value: boolean) {
      // Если выключаем - просто выключаем
      if (!value) {
          setIsOnline(false);
          await supabase.from('profiles').update({ is_online: false }).eq('id', user?.id);
          return;
      }

      // Если включаем - ПРОВЕРЯЕМ ВСЁ
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

      // 1. Проверка верификации
      if (profile.verification_status !== 'verified') {
          Alert.alert("Доступ закрыт", "Сначала пройдите верификацию документов.", [
              { text: "Загрузить документы", onPress: () => router.push('/(driver)/verification') },
              { text: "Отмена", style: "cancel" }
          ]);
          return;
      }

      // 2. Проверка машины (НОВОЕ!)
      if (!profile.car_model || !profile.car_number || !profile.car_color) {
          Alert.alert("Нет данных о машине", "Чтобы выйти на линию, укажите марку, цвет и госномер автомобиля.", [
              { text: "В настройки", onPress: () => router.push('/settings') },
              { text: "Отмена", style: "cancel" }
          ]);
          return;
      }

      // Если все ок - включаем
      setIsOnline(true);
      await supabase.from('profiles').update({ is_online: true }).eq('id', user?.id);
  }

  async function fetchCurrentOrder() {
      if (!user) return;
      
      if (currentOrderRef.current?.id) {
          const { data } = await supabase.from('orders').select('*, passenger:profiles!passenger_id(full_name, phone, avatar_url)').eq('id', currentOrderRef.current.id).single();
          if (data) {
              if (data.status === 'cancelled') {
                  Alert.alert("Инфо", "Пассажир отменил заказ.");
                  setCurrentOrder(null);
                  setSelectedOrder(null);
                  setRouteCoords([]);
              } else if (data.status === 'completed') {
                  setCurrentOrder(null);
                  setRouteCoords([]);
              } else {
                  if (currentOrderRef.current.status !== data.status) setCurrentOrder(data);
                  if (data.from_lat && data.to_lat && routeCoords.length === 0) {
                      const coords = await getRoute(data.from_lat, data.from_lon, data.to_lat, data.to_lon);
                      setRouteCoords(coords);
                  }
              }
          } else { setCurrentOrder(null); setRouteCoords([]); }
      } else {
          const { data } = await supabase.from('orders').select('*, passenger:profiles!passenger_id(full_name, phone, avatar_url)').eq('driver_id', user.id).neq('status', 'completed').neq('status', 'cancelled').maybeSingle();
          if (data) {
              setCurrentOrder(data);
              if (data.from_lat && data.to_lat) {
                  const coords = await getRoute(data.from_lat, data.from_lon, data.to_lat, data.to_lon);
                  setRouteCoords(coords);
              }
          }
      }
  }

  useEffect(() => { const interval = setInterval(fetchCurrentOrder, 5000); return () => clearInterval(interval); }, []);

  useEffect(() => {
    const channel = supabase.channel('driver_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          fetchCurrentOrder();
          if (payload.eventType === 'INSERT' && payload.new.status === 'pending' && !currentOrderRef.current) {
               if (payload.new.passenger_id !== user?.id) { setSelectedOrder(payload.new); playNotificationSound(); }
          }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function updateStatus(newStatus: string) {
      if (!currentOrder) return;
      const { data: check } = await supabase.from('orders').select('status').eq('id', currentOrder.id).single();
      if (!check || check.status === 'cancelled') {
          Alert.alert("Ошибка", "Заказ отменен!"); setCurrentOrder(null); return;
      }
      await supabase.from('orders').update({ status: newStatus }).eq('id', currentOrder.id);
      setCurrentOrder({...currentOrder, status: newStatus});
      if (newStatus === 'completed') { setLastFinishedOrderId(currentOrder.id); setCurrentOrder(null); setShowRating(true); setRouteCoords([]); }
  }

  async function acceptOrder() {
    if (!selectedOrder) return;
    const orderId = selectedOrder.id;
    setSelectedOrder(null);
    const { data: check } = await supabase.from('orders').select('status').eq('id', orderId).single();
    if (check?.status !== 'pending') return Alert.alert("Упс", "Заказ уже забрали");
    const { error } = await supabase.from('orders').update({ status: 'accepted', driver_id: user?.id }).eq('id', orderId);
    if (error) Alert.alert("Ошибка", "Не удалось взять заказ");
    else { fetchCurrentOrder(); sendPush(selectedOrder.passenger_id, "Водитель найден", "Машина выехала"); }
  }

  useEffect(() => { (async () => { let { status } = await Location.requestForegroundPermissionsAsync(); if (status === 'granted') { let loc = await Location.getCurrentPositionAsync({}); setMapRegion({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }); } })(); }, []);
  useEffect(() => { async function track() { locationSubscription.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 50 }, (loc) => { if (isOnline) supabase.from('profiles').update({ current_lat: loc.coords.latitude, current_lon: loc.coords.longitude }).eq('id', user?.id).then(); }); } if (isOnline) track(); else locationSubscription.current?.remove(); return () => locationSubscription.current?.remove(); }, [isOnline]);
  async function playNotificationSound() { try { const { sound } = await Audio.Sound.createAsync({ uri: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3' }); soundRef.current = sound; await sound.playAsync(); } catch (e) {} }

  const renderActiveOrderCard = () => {
      if (!currentOrder) return null;
      let mainBtnTitle = "Я НА МЕСТЕ", mainBtnColor = "#9C27B0", mainAction = () => updateStatus('arrived');
      if (currentOrder.status === 'arrived') { mainBtnTitle = "ПОЕХАЛИ"; mainBtnColor = "#4CAF50"; mainAction = () => updateStatus('in_progress'); }
      else if (currentOrder.status === 'in_progress') { mainBtnTitle = "ЗАВЕРШИТЬ ЗАКАЗ"; mainBtnColor = "#F44336"; mainAction = () => updateStatus('completed'); }

      return (
          <View style={styles.bottomSheet}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
                  <Text h2 style={{color: 'black'}}>{currentOrder.price} ₸</Text>
                  <View style={styles.statusChip}><Text style={{color: 'white', fontWeight: 'bold', fontSize: 12}}>{currentOrder.status === 'accepted' ? 'К КЛИЕНТУ' : currentOrder.status === 'arrived' ? 'ОЖИДАНИЕ' : 'В ПУТИ'}</Text></View>
              </View>
              <View style={styles.passengerRow}><Avatar rounded size={50} source={currentOrder.passenger?.avatar_url ? {uri: currentOrder.passenger.avatar_url} : undefined} icon={{name: 'user', type: 'feather', color: 'gray'}} containerStyle={{backgroundColor: '#eee', marginRight: 15}} /><View style={{flex: 1}}><Text style={{fontWeight: 'bold', fontSize: 18}}>{currentOrder.passenger?.full_name || 'Пассажир'}</Text><Text style={{color: 'gray'}}>Оплата наличными</Text></View><TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${currentOrder.passenger?.phone}`)}><Icon name="phone" type="feather" color="white" size={20} /></TouchableOpacity></View>
              <Divider style={{marginVertical: 15}} />
              <View style={styles.routeRow}><Icon name="map-pin" type="feather" size={16} color="gray" /><Text style={styles.routeText}>{currentOrder.from_address}</Text></View>
              <View style={[styles.routeRow, {marginTop: 10}]}><Icon name="flag" type="feather" size={16} color="black" /><Text style={[styles.routeText, {fontWeight: 'bold'}]}>{currentOrder.to_address}</Text></View>
              {currentOrder.comment ? (<View style={styles.commentBox}><Icon name="message-circle" type="feather" size={18} color="#E65100" style={{marginRight: 10}} /><Text style={{color: '#E65100', fontWeight: 'bold', flex: 1}}>"{currentOrder.comment}"</Text></View>) : null}
              <Button title={mainBtnTitle} onPress={mainAction} buttonStyle={{backgroundColor: mainBtnColor, borderRadius: 12, height: 55, marginTop: 20}} titleStyle={{fontWeight: 'bold', fontSize: 18}} />
              <View style={{flexDirection: 'row', marginTop: 10, justifyContent: 'space-between'}}><Button title="Навигатор" type="clear" icon={{name:'navigation', type:'feather'}} onPress={() => Linking.openURL(`google.navigation:q=${currentOrder.from_lat},${currentOrder.from_lon}`)} /><Button title="Чат" type="clear" icon={{name:'message-circle', type:'feather'}} onPress={() => router.push({ pathname: '/order-chat', params: { id: currentOrder.id } })} /></View>
          </View>
      );
  };

  return (
    <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <MapView ref={mapRef} provider={PROVIDER_GOOGLE} style={{flex:1}} region={mapRegion} showsUserLocation userInterfaceStyle="dark">
             {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeColor="#4285F4" strokeWidth={5} />}
             {currentOrder && <Marker coordinate={{latitude: currentOrder.from_lat, longitude: currentOrder.from_lon}} pinColor="#FFC107" />}
        </MapView>

        <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/menu')}><Icon name="menu" type="feather" color="white" /></TouchableOpacity>
            <View style={[styles.statusBadge, {backgroundColor: isOnline ? '#4CAF50' : '#333'}]}>
                <Text style={{color:'white', fontWeight:'bold', marginRight:10}}>{isOnline ? 'ОНЛАЙН' : 'ОФФ'}</Text>
                
                {/* ИСПОЛЬЗУЕМ НОВУЮ ФУНКЦИЮ ПРОВЕРКИ */}
                <Switch value={isOnline} onValueChange={handleToggleOnline} />
                
            </View>
        </View>

        {selectedOrder && !currentOrder && (
            <View style={[styles.bottomSheet, {borderTopWidth: 5, borderColor: '#FFC107'}]}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}><Text style={{fontWeight: 'bold', color: '#FFC107', textTransform: 'uppercase'}}>🔥 Новый заказ</Text><Text h2>{selectedOrder.price} ₸</Text></View>
                {selectedOrder.comment ? (<View style={[styles.commentBox, {backgroundColor: '#fff8e1', marginBottom: 10}]}><Text style={{fontWeight: 'bold'}}>📝 {selectedOrder.comment}</Text></View>) : null}
                <View style={{marginTop: 10}}><View style={styles.routeRow}><Icon name="map-pin" type="feather" size={14} color="gray"/><Text style={styles.routeText}>{selectedOrder.from_address}</Text></View><View style={[styles.routeRow, {marginTop: 5}]}><Icon name="flag" type="feather" size={14} color="black"/><Text style={[styles.routeText, {fontWeight:'bold'}]}>{selectedOrder.to_address}</Text></View></View>
                <View style={{flexDirection: 'row', gap: 10, marginTop: 20}}><Button title="ПРИНЯТЬ" onPress={acceptOrder} buttonStyle={{backgroundColor:'#FFC107', borderRadius: 10, height: 50}} containerStyle={{flex:1}} titleStyle={{color:'black', fontWeight: 'bold'}} /><Button title="Пропустить" type="outline" onPress={() => setSelectedOrder(null)} buttonStyle={{borderRadius: 10, height: 50, borderColor: '#ddd'}} containerStyle={{flex:1}} titleStyle={{color:'gray'}} /></View>
            </View>
        )}

        {renderActiveOrderCard()}
        <Modal visible={showRating} transparent animationType="slide"><View style={styles.modalOverlay}><View style={styles.ratingCard}><Text h4>Оцените пассажира</Text><AirbnbRating count={5} defaultRating={5} onFinishRating={(r) => { supabase.from('reviews').insert({ order_id: lastFinishedOrderId, from_id: user?.id, rating: r }).then(); setShowRating(false); Alert.alert("Отлично", "Ожидание новых заказов..."); }} /></View></View></Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor:'#121212' },
  topBar: { position:'absolute', top:50, left:20, right:20, flexDirection:'row', justifyContent:'space-between', alignItems:'center', zIndex: 100 },
  iconBtn: { backgroundColor:'#1E1E1E', padding:12, borderRadius:30 },
  statusBadge: { flexDirection:'row', alignItems:'center', paddingHorizontal:15, paddingVertical:5, borderRadius:20 },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, shadowColor: "#000", shadowOffset: {width: 0, height: -2}, shadowOpacity: 0.2, shadowRadius: 5, elevation: 10 },
  statusChip: { backgroundColor: '#333', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  passengerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  callBtn: { backgroundColor: '#4CAF50', padding: 12, borderRadius: 25 },
  routeRow: { flexDirection: 'row', alignItems: 'center' },
  routeText: { marginLeft: 10, fontSize: 16, flex: 1 },
  commentBox: { marginTop: 15, backgroundColor: '#fff3e0', padding: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ffe0b2' },
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'center', alignItems:'center' },
  ratingCard: { backgroundColor:'white', padding:30, borderRadius:20, alignItems:'center', width:'80%' }
});