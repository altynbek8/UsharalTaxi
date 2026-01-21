import { AirbnbRating, Avatar, Button, Icon, Input, Text } from '@rneui/themed';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

export default function PassengerHome() {
  const { user } = useAuth();
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [price, setPrice] = useState('');
  const [step, setStep] = useState<'idle' | 'active'>('idle');
  
  const [loading, setLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [driverCoords, setDriverCoords] = useState<{lat: number, lon: number} | null>(null);
  const [showRating, setShowRating] = useState(false);

  useEffect(() => {
    updateLocation();
  }, []);

  const updateLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    let loc = await Location.getCurrentPositionAsync({});
    const reg = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    setMapRegion(reg);
    let addressList = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    if (addressList.length > 0) setFromAddress(`${addressList[0].street || ''} ${addressList[0].streetNumber || ''}`);
  };

  useFocusEffect(useCallback(() => {
    if (!user) return;
    supabase.from('orders').select('*').eq('passenger_id', user.id).neq('status', 'completed').neq('status', 'cancelled').single().then(({data}) => {
        if (data) { setActiveOrder(data); setStep('active'); }
    });
  }, [user]));

  // 1. СЛЕЖКА ЗА ВОДИТЕЛЕМ НА КАРТЕ
  useEffect(() => {
    if (!activeOrder?.driver_id) { setDriverCoords(null); return; }

    const channel = supabase.channel('loc_stream')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${activeOrder.driver_id}` }, (p) => {
          if (p.new.current_lat) setDriverCoords({ lat: p.new.current_lat, lon: p.new.current_lon });
      }).subscribe();
    
    // Загружаем начальное положение
    supabase.from('profiles').select('current_lat, current_lon').eq('id', activeOrder.driver_id).single().then(({data}) => {
        if (data?.current_lat) setDriverCoords({ lat: data.current_lat, lon: data.current_lon });
    });

    return () => { supabase.removeChannel(channel); };
  }, [activeOrder?.driver_id]);

  // 2. СЛЕЖКА ЗА СТАТУСОМ ЗАКАЗА (ДЛЯ ОЦЕНКИ)
  useEffect(() => {
    if (!activeOrder) return;
    const channel = supabase.channel(`ord_st_${activeOrder.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${activeOrder.id}` }, (p) => {
          setActiveOrder(p.new);
          if (p.new.status === 'completed') {
              setShowRating(true); // ПОКАЗЫВАЕМ ОЦЕНКУ ПРИ ЗАВЕРШЕНИИ
          }
          if (p.new.driver_id && !driverInfo) {
              supabase.from('profiles').select('*').eq('id', p.new.driver_id).single().then(({data}) => setDriverInfo(data));
          }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeOrder?.id]);

  async function createOrder() {
    if (!fromAddress || !toAddress || !price) return Alert.alert('Заполните все поля');
    setLoading(true);
    const { data, error } = await supabase.from('orders').insert({
        passenger_id: user?.id, from_address: fromAddress, to_address: toAddress, price: parseInt(price),
        from_lat: mapRegion.latitude, from_lon: mapRegion.longitude, status: 'pending'
    }).select().single();
    if (error) Alert.alert('Ошибка', error.message);
    else { setActiveOrder(data); setStep('active'); }
    setLoading(false);
  }

  async function submitReview(rating: number) {
      if (activeOrder) {
          await supabase.from('reviews').insert({
              order_id: activeOrder.id, from_id: user?.id, to_id: activeOrder.driver_id, rating: rating
          });
          setShowRating(false);
          setActiveOrder(null);
          setStep('idle');
          Alert.alert("Спасибо!", "Ваш отзыв важен для нас.");
      }
  }

  return (
    <View style={styles.container}>
      {mapRegion && (
          <MapView style={StyleSheet.absoluteFill} region={mapRegion} showsUserLocation userInterfaceStyle="dark">
              {driverCoords && (
                  <Marker coordinate={{latitude: driverCoords.lat, longitude: driverCoords.lon}} title="Ваше такси">
                      <Icon name="truck" type="feather" color="#FFC107" size={30} />
                  </Marker>
              )}
          </MapView>
      )}

      <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/menu')}>
          <Icon name="menu" type="feather" color="white" />
      </TouchableOpacity>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex:1, justifyContent:'flex-end'}} pointerEvents="box-none">
          <View style={styles.card}>
              {step === 'idle' ? (
                  <>
                    <Text style={styles.cardTitle}>Куда поедем?</Text>
                    <Input placeholder="Откуда?" value={fromAddress} onChangeText={setFromAddress} leftIcon={{name:'map-pin', type:'feather', color:'#FFC107'}} inputStyle={{color:'white'}} />
                    <Input placeholder="Куда?" value={toAddress} onChangeText={setToAddress} leftIcon={{name:'flag', type:'feather', color:'#FFC107'}} inputStyle={{color:'white'}} />
                    <Input placeholder="Цена (₸)" value={price} onChangeText={setPrice} keyboardType="numeric" leftIcon={{name:'dollar-sign', type:'feather', color:'#FFC107'}} inputStyle={{color:'white'}} />
                    <Button title="ЗАКАЗАТЬ ТАКСИ" onPress={createOrder} loading={loading} buttonStyle={styles.mainBtn} titleStyle={{color:'black', fontWeight:'bold'}} />
                  </>
              ) : (
                  <>
                    <Text style={[styles.cardTitle, {color:'#FFC107'}]}>
                        {activeOrder?.status === 'pending' ? 'Ищем водителя...' : 'Водитель едет!'}
                    </Text>
                    {driverInfo && (
                        <View style={styles.driverRow}>
                            <Avatar rounded source={driverInfo.avatar_url ? {uri: driverInfo.avatar_url} : undefined} icon={{name:'user', type:'feather'}} containerStyle={{backgroundColor:'#444'}} />
                            <View style={{flex:1, marginLeft:10}}>
                                <Text style={{color:'white', fontWeight:'bold'}}>{driverInfo.full_name}</Text>
                                <Text style={{color:'gray'}}>{driverInfo.car_model} • {driverInfo.car_number}</Text>
                            </View>
                            <TouchableOpacity onPress={() => router.push({pathname:'/order-chat', params:{id: activeOrder.id}})}>
                                <Icon name="message-square" type="feather" color="#FFC107" />
                            </TouchableOpacity>
                        </View>
                    )}
                    <Button title="ОТМЕНИТЬ" type="outline" titleStyle={{color:'red'}} buttonStyle={{borderColor:'red', borderRadius:10}} onPress={() => { supabase.from('orders').update({status:'cancelled'}).eq('id', activeOrder.id); setActiveOrder(null); setStep('idle'); }} />
                  </>
              )}
          </View>
      </KeyboardAvoidingView>

      <Modal visible={showRating} transparent animationType="fade">
          <View style={styles.modalOverlay}>
              <View style={styles.ratingCard}>
                  <Text h4 style={{marginBottom:10}}>Как прошла поездка?</Text>
                  <AirbnbRating count={5} reviews={["Ужасно", "Плохо", "Ок", "Хорошо", "Супер!"]} defaultRating={5} size={35} onFinishRating={submitReview} />
                  <Button title="Позже" onPress={() => { setShowRating(false); setActiveOrder(null); setStep('idle'); }} type="clear" />
              </View>
          </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor:'#121212' },
  menuBtn: { position:'absolute', top:50, left:20, backgroundColor:'#1E1E1E', padding:12, borderRadius:30, zIndex:100 },
  card: { backgroundColor:'#1E1E1E', padding:20, borderTopLeftRadius:30, borderTopRightRadius:30 },
  cardTitle: { color:'white', fontSize:20, fontWeight:'bold', marginBottom:20 },
  mainBtn: { backgroundColor:'#FFC107', borderRadius:15, height:55 },
  driverRow: { flexDirection:'row', alignItems:'center', backgroundColor:'#222', padding:15, borderRadius:15, marginBottom:15 },
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.8)', justifyContent:'center', alignItems:'center' },
  ratingCard: { backgroundColor:'white', padding:30, borderRadius:25, width:'85%', alignItems:'center' }
});