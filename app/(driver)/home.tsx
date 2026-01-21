import { Button, Icon, Switch, Text, AirbnbRating } from '@rneui/themed';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
    Alert, 
    Linking, 
    Platform, 
    StyleSheet, 
    TouchableOpacity, 
    View, 
    StatusBar,
    Modal
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { sendPush } from '../../lib/push';

export default function DriverHome() {
  const { user } = useAuth();
  
  const [isOnline, setIsOnline] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null); 
  const [currentOrder, setCurrentOrder] = useState<any>(null);   
  const [showRating, setShowRating] = useState(false);
  const [lastFinishedOrderId, setLastFinishedOrderId] = useState<string | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);
  const locationSubscription = useRef<any>(null);

  // 1. ЗВУК И СТАТУС
  async function playNotificationSound() {
    try {
        const { sound } = await Audio.Sound.createAsync(
            { uri: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3' }
        );
        soundRef.current = sound;
        await sound.playAsync();
    } catch (e) { console.log('Ошибка звука', e); }
  }

  useFocusEffect(useCallback(() => {
    if (!user) return;
    supabase.from('profiles').select('is_online').eq('id', user.id).single().then(({data}) => {
        if (data) setIsOnline(data.is_online);
    });
    checkCurrentOrder();
  }, [user]));

  // 2. ОТСЛЕЖИВАНИЕ ГЕОПОЗИЦИИ (ДЛЯ ПАССАЖИРА)
  useEffect(() => {
    async function startTracking() {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        locationSubscription.current = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, distanceInterval: 10 },
            async (loc) => {
                if (isOnline) {
                    await supabase.from('profiles').update({ 
                        current_lat: loc.coords.latitude, 
                        current_lon: loc.coords.longitude 
                    }).eq('id', user?.id);
                }
            }
        );
    }

    if (isOnline) startTracking();
    else locationSubscription.current?.remove();

    return () => locationSubscription.current?.remove();
  }, [isOnline]);

  // 3. ПОДПИСКА НА ЗАКАЗЫ
  useEffect(() => {
    const channel = supabase.channel('dr_main').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
          if (payload.new.candidate_id === user?.id && payload.new.status === 'pending') {
              setSelectedOrder(payload.new);
              playNotificationSound(); 
          }
          if (payload.new.driver_id === user?.id) {
              if (payload.new.status === 'completed' || payload.new.status === 'cancelled') {
                  setCurrentOrder(null);
                  setSelectedOrder(null);
              } else { 
                  setCurrentOrder(payload.new); 
              }
          }
      }).subscribe();
    return () => { supabase.removeChannel(channel); soundRef.current?.unloadAsync().catch(()=>{}); };
  }, [user?.id]);

  async function checkCurrentOrder() {
      const { data } = await supabase.from('orders').select('*, passenger:profiles!passenger_id(full_name, phone)').eq('driver_id', user?.id).neq('status', 'completed').neq('status', 'cancelled').single();
      if (data) setCurrentOrder(data);
  }

  async function toggleOnline(val: boolean) {
    if (val === true) {
        const { data: profile } = await supabase.from('profiles').select('car_model, car_number, verification_status').eq('id', user?.id).single();
        if (profile?.verification_status !== 'verified') {
            Alert.alert('Доступ закрыт', 'Ваш аккаунт еще не прошел проверку администратором.');
            return setIsOnline(false);
        }
        if (!profile?.car_model) {
            Alert.alert('Ошибка', 'Укажите данные машины в настройках.');
            return setIsOnline(false);
        }
    }
    setIsOnline(val);
    await supabase.from('profiles').update({ is_online: val }).eq('id', user?.id);
  }

  async function acceptOrder() {
    if (!selectedOrder) return;
    const { error } = await supabase.from('orders').update({ status: 'accepted', driver_id: user?.id }).eq('id', selectedOrder.id).eq('status', 'pending');
    if (error) { Alert.alert('Упс', 'Заказ уже взял другой водитель'); setSelectedOrder(null); }
    else {
        sendPush(selectedOrder.passenger_id, "Водитель в пути!", "Такси выехало к вам.");
        setSelectedOrder(null); checkCurrentOrder(); 
    }
  }

  async function completeTrip() {
      if (!currentOrder) return;
      const orderId = currentOrder.id;
      const { error } = await supabase.from('orders').update({status:'completed'}).eq('id', orderId);
      if (!error) {
          setLastFinishedOrderId(orderId);
          setCurrentOrder(null);
          setShowRating(true); // Показываем окно оценки пассажира
      }
  }

  async function submitRating(rating: number) {
      if (lastFinishedOrderId) {
          // Здесь можно добавить запись в таблицу reviews (from водитель -> to пассажир)
          setShowRating(false);
          Alert.alert("Готово", "Поездка завершена!");
      }
  }

  return (
    <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <MapView style={{flex:1}} showsUserLocation userInterfaceStyle="dark">
            {currentOrder && <Marker coordinate={{latitude: currentOrder.from_lat, longitude: currentOrder.from_lon}} pinColor="#FFC107" />}
        </MapView>

        <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/menu')}>
                <Icon name="menu" type="feather" color="white" />
            </TouchableOpacity>
            <View style={[styles.statusBadge, {backgroundColor: isOnline ? '#4CAF50' : '#333'}]}>
                <Text style={{color:'white', fontWeight:'bold', marginRight:10}}>{isOnline ? 'НА ЛИНИИ' : 'ЗАНЯТ'}</Text>
                <Switch value={isOnline} onValueChange={toggleOnline} />
            </View>
        </View>

        {selectedOrder && !currentOrder && (
            <View style={styles.orderCard}>
                <Text style={{color:'#FFC107', fontWeight:'bold', textAlign:'center', marginBottom:10}}>НОВЫЙ ЗАКАЗ! 🔔</Text>
                <Text h2 style={{color:'white', textAlign:'center'}}>{selectedOrder.price} ₸</Text>
                <Text style={{color:'white', marginTop:10}}>От: {selectedOrder.from_address}</Text>
                <Text style={{color:'white'}}>Куда: {selectedOrder.to_address}</Text>
                <View style={styles.actions}>
                    <Button title="ПРИНЯТЬ" onPress={acceptOrder} buttonStyle={styles.acceptBtn} containerStyle={{flex:1}} titleStyle={{color:'black', fontWeight:'bold'}} />
                    <Button title="Пропустить" type="clear" onPress={() => setSelectedOrder(null)} titleStyle={{color:'gray'}} />
                </View>
            </View>
        )}

        {currentOrder && (
            <View style={styles.orderCard}>
                <Text h3 style={{color:'white', textAlign:'center'}}>{currentOrder.price} ₸</Text>
                <Text style={{color:'white', marginVertical:10}}>Клиент: {currentOrder.passenger?.full_name}</Text>
                <View style={styles.actions}>
                    <Button icon={{name:'phone', type:'feather', color:'white'}} onPress={() => Linking.openURL(`tel:${currentOrder.passenger?.phone}`)} buttonStyle={{backgroundColor:'#4CAF50', borderRadius:10}} containerStyle={{flex:1}} />
                    <Button icon={{name:'navigation', type:'feather', color:'white'}} onPress={() => Linking.openURL(`google.navigation:q=${currentOrder.from_lat},${currentOrder.from_lon}`)} buttonStyle={{backgroundColor:'#2196F3', borderRadius:10}} containerStyle={{flex:1}} />
                </View>
                <Button title="ЗАВЕРШИТЬ ПОЕЗДКУ" onPress={completeTrip} buttonStyle={styles.completeBtn} containerStyle={{marginTop:15}} />
            </View>
        )}

        {/* МОДАЛКА ОЦЕНКИ ПАССАЖИРА */}
        <Modal visible={showRating} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={styles.ratingCard}>
                    <Text h4>Оцените пассажира</Text>
                    <AirbnbRating count={5} reviews={["Плохо", "Так себе", "Норм", "Хорошо", "Отлично"]} defaultRating={5} size={30} onFinishRating={submitRating} />
                    <Button title="Завершить" onPress={() => setShowRating(false)} type="clear" />
                </View>
            </View>
        </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor:'#121212' },
  topBar: { position:'absolute', top:50, left:20, right:20, flexDirection:'row', justifyContent:'space-between', alignItems:'center', zIndex: 100 },
  iconBtn: { backgroundColor:'#1E1E1E', padding:12, borderRadius:30 },
  statusBadge: { flexDirection:'row', alignItems:'center', paddingHorizontal:15, paddingVertical:5, borderRadius:20 },
  orderCard: { position:'absolute', bottom:30, left:20, right:20, backgroundColor:'#1E1E1E', padding:20, borderRadius:20 },
  actions: { flexDirection:'row', gap:10, marginTop:15 },
  acceptBtn: { backgroundColor:'#FFC107', borderRadius:10, height:50 },
  completeBtn: { backgroundColor:'#333', borderRadius:10, height:50, borderWidth:1, borderColor:'white' },
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'center', alignItems:'center' },
  ratingCard: { backgroundColor:'white', padding:30, borderRadius:20, alignItems:'center', width:'80%' }
});