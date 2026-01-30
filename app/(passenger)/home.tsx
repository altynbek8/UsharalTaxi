import { AirbnbRating, Avatar, Button, Icon, Input, Text, Divider } from '@rneui/themed';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
    Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet, TouchableOpacity, View, ActivityIndicator, StatusBar, Image, ScrollView, Linking
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { getRoute } from '../../lib/map';

// Координаты Ушарала (центр)
const USHARAL_REGION = {
    latitude: 46.1687,
    longitude: 80.9431,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
};

export default function PassengerHome() {
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);
  
  // КАРТА
  const [region, setRegion] = useState(USHARAL_REGION);
  const [routeCoords, setRouteCoords] = useState<any[]>([]); 
  
  // ДАННЫЕ
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState(''); 

  // РЕЖИМ ВЫБОРА (PIN)
  const [isPickingMode, setIsPickingMode] = useState<'from' | 'to' | null>(null);
  const [centerCoords, setCenterCoords] = useState(USHARAL_REGION);
  const [isMapMoving, setIsMapMoving] = useState(false);

  // СТАТУСЫ
  const [step, setStep] = useState<'idle' | 'active'>('idle');
  const [loading, setLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([]);
  const [showRating, setShowRating] = useState(false);

  // 1. ГЕОЛОКАЦИЯ
  useEffect(() => { getCurrentLocation(); }, []);

  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    
    try {
        let loc = await Location.getCurrentPositionAsync({});
        const newRegion = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005
        };
        mapRef.current?.animateToRegion(newRegion, 1000);
        reverseGeocode(loc.coords.latitude, loc.coords.longitude, 'from');
    } catch (e) {}
  };

  // 2. АДРЕС ПО КООРДИНАТАМ
  const reverseGeocode = async (lat: number, lon: number, field: 'from' | 'to') => {
      try {
          let addressList = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          if (addressList.length > 0) {
              const street = addressList[0].street || '';
              const name = addressList[0].name || ''; 
              const fullAddr = street ? `${street} ${name}`.trim() : `Координаты: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
              if (field === 'from') setFromAddress(fullAddr);
              else setToAddress(fullAddr);
          }
      } catch (e) {}
  };

  const onRegionChangeComplete = (reg: any) => {
      setCenterCoords(reg);
      setIsMapMoving(false);
  };

  const confirmLocation = async () => {
      if (!isPickingMode) return;
      await reverseGeocode(centerCoords.latitude, centerCoords.longitude, isPickingMode);
      setIsPickingMode(null);
  };

  // --- ЛОГИКА ЗАКАЗОВ ---
  useFocusEffect(useCallback(() => { if (user) checkActiveOrder(); }, [user]));

  function checkActiveOrder() {
    supabase.from('orders').select('*').eq('passenger_id', user?.id).neq('status', 'completed').neq('status', 'cancelled').single()
        .then(async ({data}) => {
            if (data) { 
                setActiveOrder(data); setStep('active'); 
                if (data.driver_id) fetchDriverInfo(data.driver_id);
                if (data.from_lat && data.to_lat) {
                    const coords = await getRoute(data.from_lat, data.from_lon, data.to_lat, data.to_lon);
                    setRouteCoords(coords);
                    setTimeout(() => {
                        mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 50, right: 50, bottom: 300, left: 50 }, animated: true });
                    }, 1000);
                }
            } else fetchNearbyDrivers();
        });
  }

  function fetchNearbyDrivers() {
      supabase.channel('drivers_loc').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (p) => {
          if (p.new.role === 'driver' && p.new.is_online) {
              setNearbyDrivers(prev => {
                  const idx = prev.findIndex(d => d.id === p.new.id);
                  if (idx > -1) { const n = [...prev]; n[idx] = p.new; return n; }
                  return [...prev, p.new];
              });
          }
      }).subscribe();
      supabase.from('profiles').select('id, current_lat, current_lon').eq('role', 'driver').eq('is_online', true).then(({data}) => { if (data) setNearbyDrivers(data); });
  }

  useEffect(() => {
    if (!activeOrder) return;
    const channel = supabase.channel(`ord_upd_${activeOrder.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${activeOrder.id}` }, (p) => {
          if (p.new.status === 'cancelled') { Alert.alert("Заказ отменен"); setActiveOrder(null); setStep('idle'); setRouteCoords([]); } 
          else if (p.new.status === 'completed') setShowRating(true);
          else { setActiveOrder(p.new); if (p.new.driver_id && !driverInfo) fetchDriverInfo(p.new.driver_id); }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeOrder?.id]);

  async function fetchDriverInfo(driverId: string) {
      const { data } = await supabase.from('profiles').select('*').eq('id', driverId).single();
      setDriverInfo(data);
  }

  async function createOrder() {
    if (!fromAddress || !toAddress || !price) return Alert.alert('Ошибка', 'Заполните адреса и цену');
    setLoading(true);
    
    let toLat = 0, toLon = 0;
    try { const geocode = await Location.geocodeAsync(toAddress); if (geocode.length > 0) { toLat = geocode[0].latitude; toLon = geocode[0].longitude; } } catch (e) {}
    if (toLat === 0) { toLat = centerCoords.latitude; toLon = centerCoords.longitude; }

    const { data, error } = await supabase.from('orders').insert({
        passenger_id: user?.id, from_address: fromAddress, to_address: toAddress, price: parseInt(price), comment: comment,
        from_lat: region.latitude, from_lon: region.longitude, to_lat: toLat, to_lon: toLon, status: 'pending'
    }).select().single();

    setLoading(false);
    if (error) Alert.alert('Ошибка', error.message);
    else { 
        setActiveOrder(data); setStep('active'); 
        const coords = await getRoute(region.latitude, region.longitude, toLat, toLon);
        setRouteCoords(coords);
    }
  }

  // --- ТОНКИЙ КРАСИВЫЙ ПИН ---
  const renderPin = () => (
      // pointerEvents="none" ВАЖЕН, чтобы сквозь пин можно было двигать карту
      <View style={styles.pinOverlay} pointerEvents="none">
          <View style={styles.thinCrossVertical} />
          <View style={styles.thinCrossHorizontal} />
          <View style={styles.centerDot} />
          
          {isMapMoving && (
             <View style={styles.movingLabel}>
                 <Text style={{fontSize: 10, fontWeight: 'bold', color: 'white'}}>Выбор...</Text>
             </View>
          )}
      </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* 1. КАРТА (Самый нижний слой) */}
      <MapView 
        ref={mapRef}
        provider={PROVIDER_GOOGLE} 
        style={StyleSheet.absoluteFill} 
        initialRegion={USHARAL_REGION}
        showsUserLocation
        onRegionChange={() => setIsMapMoving(true)}
        onRegionChangeComplete={onRegionChangeComplete}
      >
          {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeColor="#4285F4" strokeWidth={4} />}
          
          {step === 'idle' && !isPickingMode && nearbyDrivers.map(d => (
             <Marker key={d.id} coordinate={{latitude: d.current_lat, longitude: d.current_lon}}>
                 <Image source={require('../../assets/images/icon.png')} style={{width: 30, height: 30}} />
             </Marker>
          ))}
          {driverInfo?.current_lat && (
              <Marker coordinate={{latitude: driverInfo.current_lat, longitude: driverInfo.current_lon}}>
                  <Image source={require('../../assets/images/icon.png')} style={{width: 40, height: 40}} />
              </Marker>
          )}
      </MapView>
      
      {/* 2. ПИН (Только при выборе) */}
      {isPickingMode && renderPin()}

      {/* 3. КНОПКИ ВЫБОРА (Поверх карты) */}
      {isPickingMode && (
          <View style={styles.confirmBtnContainer}>
              <Text style={styles.pickLabel}>
                  {isPickingMode === 'from' ? 'Откуда вас забрать?' : 'Куда поедем?'}
              </Text>
              <Button 
                title="ПОДТВЕРДИТЬ ТОЧКУ" 
                onPress={confirmLocation}
                disabled={isMapMoving}
                buttonStyle={{backgroundColor: 'black', borderRadius: 10, width: 250, height: 50}}
                titleStyle={{fontWeight: 'bold'}}
              />
              <Button title="Отмена" type="clear" onPress={() => setIsPickingMode(null)} containerStyle={{marginTop: 10}} />
          </View>
      )}

      {/* 4. ОСНОВНОЙ ИНТЕРФЕЙС (Скрыт при выборе точки) */}
      {!isPickingMode && (
        <>
            {/* Кнопка Меню (ПОВЕРХ ВСЕГО) */}
            <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/menu')}>
                <Icon name="menu" type="feather" color="black" size={24} />
            </TouchableOpacity>

            {/* Шторка снизу (pointerEvents="box-none" чтобы пропускать нажатия выше нее) */}
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"} 
                style={styles.keyboardView} 
                pointerEvents="box-none"
            >
                <View style={styles.bottomSheet}>
                    {step === 'idle' ? (
                        <>
                          <Text h4 style={{marginBottom: 15}}>Заказать такси</Text>
                          
                          <View style={styles.inputRow}>
                              <Icon name="map-pin" type="feather" size={16} color="green" style={{marginTop: 12}} />
                              <View style={{flex: 1, flexDirection: 'row'}}>
                                  <Input placeholder="Откуда?" value={fromAddress} onChangeText={setFromAddress} containerStyle={{flex: 1}} inputStyle={{fontSize: 15}} renderErrorMessage={false} />
                                  <TouchableOpacity onPress={() => setIsPickingMode('from')} style={styles.mapBtn}><Text style={{fontWeight:'bold'}}>Карта</Text></TouchableOpacity>
                              </View>
                          </View>

                          <View style={styles.inputRow}>
                              <Icon name="flag" type="feather" size={16} color="black" style={{marginTop: 12}} />
                              <View style={{flex: 1, flexDirection: 'row'}}>
                                  <Input placeholder="Куда?" value={toAddress} onChangeText={setToAddress} containerStyle={{flex: 1}} inputStyle={{fontSize: 15}} renderErrorMessage={false} />
                                  <TouchableOpacity onPress={() => setIsPickingMode('to')} style={styles.mapBtn}><Text style={{fontWeight:'bold'}}>Карта</Text></TouchableOpacity>
                              </View>
                          </View>
                          
                          <View style={styles.inputRow}>
                                <Input placeholder="Комментарий..." value={comment} onChangeText={setComment} containerStyle={{flex: 1}} inputStyle={{fontSize: 14}} renderErrorMessage={false} />
                                <Input value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="Цена" containerStyle={{width: 100}} rightIcon={<Text style={{fontWeight:'bold'}}>₸</Text>} renderErrorMessage={false} />
                          </View>
                          <Button title="ЗАКАЗАТЬ" onPress={createOrder} loading={loading} buttonStyle={{ backgroundColor: '#FFC107', borderRadius: 10, height: 50 }} titleStyle={{color: 'black', fontWeight: 'bold'}} />
                        </>
                    ) : (
                        <ScrollView>
                            <Text h4 style={{textAlign:'center', marginBottom: 10}}>{activeOrder.status === 'accepted' ? 'Машина едет!' : 'Поиск...'}</Text>
                            {driverInfo && (
                                <View style={{flexDirection:'row', alignItems:'center', marginBottom:10}}>
                                    <Avatar rounded source={{uri: driverInfo.avatar_url}} size={50} containerStyle={{backgroundColor:'#eee'}} />
                                    <View style={{marginLeft:10}}><Text style={{fontWeight:'bold', fontSize:18}}>{driverInfo.car_number}</Text><Text>{driverInfo.car_model}</Text></View>
                                </View>
                            )}
                            <Button title="Отменить" type="outline" onPress={() => { supabase.from('orders').update({status:'cancelled'}).eq('id', activeOrder.id); setActiveOrder(null); setStep('idle'); setRouteCoords([]); }} />
                        </ScrollView>
                    )}
                </View>
            </KeyboardAvoidingView>
        </>
      )}

      <Modal visible={showRating} transparent animationType="fade"><View style={styles.modalOverlay}><View style={styles.ratingCard}><Text h4>Как прошла поездка?</Text><AirbnbRating showRating={false} defaultRating={5} size={30} onFinishRating={(r) => { supabase.from('reviews').insert({order_id: activeOrder.id, rating: r}).then(); setShowRating(false); setActiveOrder(null); setStep('idle'); setRouteCoords([]); }} /><Button title="Оценить" onPress={() => setShowRating(false)} buttonStyle={{backgroundColor:'black', marginTop:20, borderRadius:10}} /></View></View></Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor:'white' },
  // Кнопка меню теперь с высоким Z-индексом, чтобы её не перекрывали
  menuBtn: { position:'absolute', top:50, left:20, backgroundColor:'white', padding:10, borderRadius:30, elevation: 10, zIndex: 100 },
  keyboardView: { flex: 1, justifyContent: 'flex-end', zIndex: 1 },
  bottomSheet: { backgroundColor:'white', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 15, maxHeight: '65%' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 },
  mapBtn: { justifyContent: 'center', paddingHorizontal: 10, backgroundColor: '#eee', borderRadius: 5, height: 40, marginTop: 5, marginRight: 10 },
  
  // СТИЛИ ТОНКОГО ПИНА (Как в Uber)
  pinOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 50 },
  thinCrossVertical: { width: 1, height: 20, backgroundColor: 'black' },
  thinCrossHorizontal: { width: 20, height: 1, backgroundColor: 'black', position: 'absolute' },
  centerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'black', position: 'absolute' },
  movingLabel: { position: 'absolute', top: -30, backgroundColor: 'black', padding: 4, borderRadius: 4 },

  confirmBtnContainer: { position: 'absolute', bottom: 50, alignItems: 'center', width: '100%', zIndex: 100 },
  pickLabel: { backgroundColor: 'white', padding: 10, borderRadius: 10, overflow: 'hidden', marginBottom: 15, fontWeight: 'bold', elevation: 5, fontSize: 16 },
  
  driverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  plateBox: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 5, backgroundColor: 'white' },
  plateText: { fontSize: 22, fontWeight: 'bold', letterSpacing: 1 },
  actionButtons: { flexDirection: 'row', marginBottom: 15 },
  greyBtn: { backgroundColor: '#f2f2f2', borderRadius: 10, borderColor: '#ddd', borderWidth: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' },
  ratingCard: { backgroundColor:'white', padding:30, borderRadius:20, width:'80%', alignItems:'center' },
});