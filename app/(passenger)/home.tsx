import { Avatar, Button, Icon, Input, Text } from '@rneui/themed';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    SafeAreaView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

const DARK_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
];

export default function PassengerHome() {
  const { user } = useAuth();
  
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [fromAddress, setFromAddress] = useState('Определяем...');
  const [toAddress, setToAddress] = useState('');
  const [price, setPrice] = useState('');
  
  const [step, setStep] = useState<'idle' | 'selecting' | 'picking_dest' | 'pricing' | 'active'>('idle');

  const [loading, setLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{lat: number, lon: number} | null>(null);

  const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([]);
  const [coords, setCoords] = useState({ from: {lat:0, lon:0}, to: {lat:0, lon:0} });

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [rating, setRating] = useState(5);

  const [recentPlaces, setRecentPlaces] = useState<any[]>([]);

  // Для фокуса на нужном поле
  const [focusField, setFocusField] = useState<'to' | 'from'>('to');

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let loc = await Location.getCurrentPositionAsync({});
      
      const region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setMapRegion(region);
      decodeAddress(region.latitude, region.longitude, 'from');
    })();
  }, []);

  useFocusEffect(useCallback(() => {
      if (user) fetchRecentPlaces();
  }, [user]));

  async function fetchRecentPlaces() {
      const { data } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('user_id', user?.id)
        .order('count', { ascending: false })
        .limit(10);
      
      if (data) setRecentPlaces(data);
  }

  useEffect(() => {
      fetchNearbyDrivers();
      const channel = supabase.channel('nearby_drivers')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles',
            filter: "role=eq.driver"
        }, (payload) => {
            const updatedDriver = payload.new;
            if (updatedDriver.is_online && updatedDriver.latitude) {
                setNearbyDrivers(prev => {
                    const filtered = prev.filter(d => d.id !== updatedDriver.id);
                    return [...filtered, updatedDriver];
                });
            } else {
                setNearbyDrivers(prev => prev.filter(d => d.id !== updatedDriver.id));
            }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchNearbyDrivers() {
      const { data } = await supabase.from('profiles').select('*').eq('role', 'driver').eq('is_online', true).not('latitude', 'is', null);
      if (data) setNearbyDrivers(data);
  }

  const decodeAddress = async (lat: number, lon: number, type: 'from' | 'to') => {
      setAddressLoading(true);
      try {
          setCoords(prev => ({ ...prev, [type]: {lat, lon} }));
          let addressList = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          if (addressList.length > 0) {
              const addr = addressList[0];
              let fullAddr = '';
              if (addr.street) fullAddr += addr.street;
              if (addr.streetNumber) fullAddr += `, ${addr.streetNumber}`;
              if (!fullAddr) fullAddr = addr.name || 'Неизвестное место';
              if (type === 'from') setFromAddress(fullAddr);
              else setToAddress(fullAddr);
          }
      } catch (e) {} finally { setAddressLoading(false); }
  };

  const onRegionChangeComplete = (region: any) => {
      if (!region || !region.latitude) return;
      if (step === 'idle') decodeAddress(region.latitude, region.longitude, 'from');
      else if (step === 'picking_dest') decodeAddress(region.latitude, region.longitude, 'to');
  };

  useEffect(() => {
    if (!activeOrder) return;
    const channel = supabase.channel(`order_${activeOrder.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${activeOrder.id}` }, (payload) => {
          setActiveOrder(payload.new);
          if (payload.new.driver_id && !driverInfo) fetchDriver(payload.new.driver_id);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeOrder?.id]);

  useEffect(() => {
      if (!driverInfo) return;
      const channel = supabase.channel(`driver_loc_${driverInfo.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${driverInfo.id}` }, (payload) => {
            if (payload.new.latitude) setDriverLocation({ lat: payload.new.latitude, lon: payload.new.longitude });
        }).subscribe();
      return () => { supabase.removeChannel(channel); };
  }, [driverInfo?.id]);

  async function fetchDriver(driverId: string) {
      const { data } = await supabase.from('profiles').select('*').eq('id', driverId).single();
      setDriverInfo(data);
      if (data.latitude) setDriverLocation({ lat: data.latitude, lon: data.longitude });
  }

  async function createOrder() {
    if (!toAddress.trim() || !price.trim()) return Alert.alert('Ошибка', 'Заполните поля');
    setLoading(true);
    Keyboard.dismiss();
    try {
      let finalToLat = coords.to.lat;
      let finalToLon = coords.to.lon;
      
      // Геокодинг КУДА, если не выбрано на карте
      if (finalToLat === 0 && finalToLon === 0) {
          const geocoded = await Location.geocodeAsync(toAddress);
          if (geocoded.length > 0) {
              finalToLat = geocoded[0].latitude;
              finalToLon = geocoded[0].longitude;
          }
      }

      // Геокодинг ОТКУДА, если пользователь ввел текст руками
      let finalFromLat = coords.from.lat;
      let finalFromLon = coords.from.lon;
      if (step === 'pricing') { // Если мы уже ввели цену, значит адрес подтвержден
           // Можно добавить проверку: если текст fromAddress изменился, а координаты старые -> геокодируем заново
           // Но для MVP берем текущие координаты пина или локации
           if (finalFromLat === 0) {
               finalFromLat = mapRegion.latitude;
               finalFromLon = mapRegion.longitude;
           }
      }
      
      const { data, error } = await supabase.from('orders').insert({
        passenger_id: user?.id,
        from_address: fromAddress,
        to_address: toAddress,
        price: parseInt(price) || 0,
        status: 'pending',
        from_lat: finalFromLat,
        from_lon: finalFromLon,
        to_lat: finalToLat,
        to_lon: finalToLon,
      }).select().single();

      if (error) throw error;

      await supabase.rpc('save_order_address', {
          p_user_id: user?.id,
          p_address: toAddress,
          p_lat: finalToLat,
          p_lon: finalToLon
      });
      fetchRecentPlaces();

      setActiveOrder(data);
      setStep('active');
    } catch (e: any) { Alert.alert('Ошибка', e.message); } finally { setLoading(false); }
  }

  const selectPresetPlace = (addr: string, lat?: number, lon?: number) => { 
      setToAddress(addr); 
      if (lat && lon) setCoords(prev => ({ ...prev, to: {lat, lon} }));
      setStep('pricing'); 
  };
  
  const confirmDestOnMap = () => { setStep('pricing'); };

  const finishRide = () => { setRatingModalVisible(true); };

  const submitRating = async () => {
      setLoading(true);
      if (activeOrder) await supabase.from('orders').update({ rating: rating }).eq('id', activeOrder.id);
      setLoading(false);
      setRatingModalVisible(false);
      
      setActiveOrder(null); setDriverInfo(null); setDriverLocation(null); setToAddress(''); setPrice(''); setStep('idle');
      Alert.alert('Спасибо!', 'Ваша оценка сохранена');
  };

  if (!mapRegion && !activeOrder) return <ActivityIndicator size="large" style={{marginTop: 50}} color="#FFC107" />;

  return (
    <View style={styles.container}>
      {/* 1. КАРТА */}
      {step !== 'selecting' && mapRegion && (
          <View style={StyleSheet.absoluteFill}>
              <MapView
                style={StyleSheet.absoluteFill}
                initialRegion={mapRegion}
                customMapStyle={DARK_MAP_STYLE}
                provider={PROVIDER_GOOGLE}
                onRegionChangeComplete={onRegionChangeComplete}
                showsUserLocation={true}
              >
                  {!activeOrder && nearbyDrivers.map((drv) => (
                      <Marker key={String(drv.id)} coordinate={{ latitude: drv.latitude, longitude: drv.longitude }}>
                          <View style={{backgroundColor: '#424242', borderRadius: 15, padding: 3, elevation: 3}}>
                              <Icon name="truck" type="feather" color="#FFC107" size={16} /> 
                          </View>
                      </Marker>
                  ))}
                  {driverLocation && (
                      <Marker coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lon }}>
                          <View style={{backgroundColor: 'white', borderRadius: 20, padding: 5}}>
                              <Icon name="truck" type="feather" color="#FFC107" size={24} /> 
                          </View>
                      </Marker>
                  )}
                  {driverLocation && activeOrder && (
                      <Polyline
                          coordinates={[
                              { latitude: driverLocation!.lat, longitude: driverLocation!.lon },
                              { latitude: coords.from.lat || mapRegion.latitude, longitude: coords.from.lon || mapRegion.longitude }
                          ]}
                          strokeColor="#FFC107"
                          strokeWidth={4}
                      />
                  )}
              </MapView>

              {(step === 'idle' || step === 'picking_dest') && (
                  <View style={styles.centerPinContainer} pointerEvents="none">
                      <View style={styles.pinWrapper}>
                          <View style={styles.pinHead}>
                              <View style={[styles.pinDot, { backgroundColor: step === 'idle' ? '#2089dc' : '#FF3B30' }]} />
                          </View>
                          <View style={styles.pinStick} />
                      </View>
                      <View style={styles.pinShadow} />
                  </View>
              )}
          </View>
      )}

      {step !== 'selecting' && (
        <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/menu')}>
            <Icon name="menu" type="feather" size={24} color="black" />
        </TouchableOpacity>
      )}

      {/* ПЛАШКА "КУДА?" (Idle) */}
      {step === 'idle' && (
        <View style={styles.whereToCard}>
            <Text style={{color: 'gray', fontSize: 12, marginBottom: 5}}>Ваш адрес:</Text>
            
            {/* ТЕПЕРЬ ЭТО ТОЖЕ КНОПКА - ОТКРЫВАЕТ РЕДАКТОР */}
            <TouchableOpacity onPress={() => { setFocusField('from'); setStep('selecting'); }} style={{flexDirection: 'row', alignItems: 'center'}}>
                {addressLoading && <ActivityIndicator size="small" color="black" style={{marginRight: 5}} />}
                <Text style={{fontSize: 16, fontWeight: 'bold', color: 'black', flex: 1}} numberOfLines={1}>{fromAddress}</Text>
            </TouchableOpacity>
            
            <View style={{height: 1, backgroundColor: '#eee', marginVertical: 10}} />
            
            <TouchableOpacity onPress={() => { setFocusField('to'); setStep('selecting'); }} style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={{width: 8, height: 8, backgroundColor: 'black', marginRight: 10}} />
                <Text style={{fontSize: 20, fontWeight: 'bold', color: '#999'}}>Куда едем?</Text>
            </TouchableOpacity>
        </View>
      )}

      {/* ВЫБОР НА КАРТЕ */}
      {step === 'picking_dest' && (
          <View style={styles.confirmMapBtnContainer}>
              <View style={styles.addressFloatingBubble}>
                  {addressLoading ? <ActivityIndicator size="small" color="white" /> : <Text style={{color: 'white', fontWeight: 'bold'}}>{toAddress}</Text>}
              </View>
              <Button title="Подтвердить точку" onPress={confirmDestOnMap} buttonStyle={{backgroundColor: 'black', borderRadius: 10, width: 250, height: 50}} />
              <TouchableOpacity onPress={() => setStep('selecting')} style={{marginTop: 10, backgroundColor: 'white', padding: 10, borderRadius: 20}}>
                  <Icon name="x" type="feather" size={20} />
              </TouchableOpacity>
          </View>
      )}

      {/* ЭКРАН ВЫБОРА (РЕДАКТОР) */}
      {step === 'selecting' && (
          <SafeAreaView style={styles.selectingContainer}>
              <View style={styles.selectionHeader}>
                  <TouchableOpacity onPress={() => setStep('idle')} style={styles.backButton}>
                      <Icon name="arrow-left" type="feather" size={24} />
                  </TouchableOpacity>
                  <Text h4 style={{flex: 1, textAlign: 'center'}}>Маршрут</Text>
                  <View style={{width: 40}} />
              </View>

              <View style={styles.inputsBlock}>
                  {/* ПОЛЕ ОТКУДА (РЕДАКТИРУЕМОЕ) */}
                  <View style={styles.inputRow}>
                      <View style={[styles.dot, {backgroundColor: '#2089dc'}]} />
                      <View style={{flex: 1}}>
                          <Text style={styles.label}>Откуда</Text>
                          <TextInput 
                            style={styles.inputField} 
                            value={fromAddress} 
                            onChangeText={setFromAddress} 
                            placeholder="Откуда забрать?"
                            autoFocus={focusField === 'from'} // Фокус если нажали сверху
                          />
                      </View>
                  </View>
                  
                  <View style={styles.dividerRow}>
                      <View style={styles.verticalLine} />
                      <View style={styles.dividerLine} />
                  </View>
                  
                  {/* ПОЛЕ КУДА (РЕДАКТИРУЕМОЕ) */}
                  <View style={styles.inputRow}>
                      <View style={[styles.dot, {backgroundColor: 'black'}]} />
                      <View style={{flex: 1}}>
                          <Text style={styles.label}>Куда</Text>
                          <TextInput 
                            style={styles.inputField} 
                            placeholder="Куда едем?" 
                            placeholderTextColor="#999"
                            value={toAddress} 
                            onChangeText={setToAddress} 
                            autoFocus={focusField === 'to'} // Фокус если нажали снизу
                          />
                      </View>
                  </View>
              </View>
              
              <TouchableOpacity style={styles.mapPickRow} onPress={() => setStep('picking_dest')}>
                  <View style={styles.iconCircleSmall}>
                      <Icon name="map" type="feather" size={20} color="#2089dc" />
                  </View>
                  <Text style={{fontSize: 16, fontWeight: 'bold', color: '#2089dc'}}>Указать на карте</Text>
              </TouchableOpacity>
              
              <View style={{flex: 1}}>
                  <Text style={{marginLeft: 20, marginTop: 20, marginBottom: 10, color: 'gray', fontWeight: 'bold'}}>История поездок</Text>
                  
                  <FlatList 
                      data={recentPlaces} 
                      keyExtractor={(item) => String(item.id)} 
                      keyboardShouldPersistTaps="handled"
                      ListEmptyComponent={<Text style={{marginLeft: 20, color: '#ccc'}}>Пока пусто</Text>}
                      renderItem={({item}) => (
                          <TouchableOpacity style={styles.placeItem} onPress={() => selectPresetPlace(item.address, item.lat, item.lon)}>
                              <View style={styles.placeIconBg}><Icon name="clock" type="feather" size={20} color="gray" /></View>
                              <View style={{flex: 1}}>
                                  <Text style={styles.placeName}>{item.address}</Text>
                                  <Text style={styles.placeCity}>{item.city || 'Ушарал'}</Text>
                              </View>
                          </TouchableOpacity>
                      )} 
                  />
              </View>
          </SafeAreaView>
      )}

      {/* ВВОД ЦЕНЫ */}
      {step === 'pricing' && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.bottomWrapper}>
            <View style={styles.priceBox}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
                    <TouchableOpacity onPress={() => setStep('selecting')}><Icon name="arrow-left" type="feather" color="gray" /></TouchableOpacity>
                    <Text style={{fontWeight: 'bold', fontSize: 16}} numberOfLines={1}>{toAddress}</Text>
                    <View style={{width: 24}} />
                </View>
                <Input placeholder="Ваша цена (₸)" value={price} onChangeText={setPrice} keyboardType="numeric" autoFocus={true} inputContainerStyle={{borderBottomWidth: 0, backgroundColor: '#f2f2f2', borderRadius: 10, paddingHorizontal: 10}} leftIcon={{type:'feather', name:'dollar-sign', color:'green'}} />
                <Button title="Заказать такси" onPress={createOrder} loading={loading} buttonStyle={{ backgroundColor: 'black', borderRadius: 10, height: 50 }} titleStyle={{ color: 'white', fontWeight: 'bold', fontSize: 18 }} />
            </View>
        </KeyboardAvoidingView>
      )}

      {/* АКТИВНЫЙ ЗАКАЗ */}
      {step === 'active' && activeOrder && (
          <View style={styles.activeOrderCard}>
              <Text h4 style={{textAlign:'center', marginBottom: 10}}>{activeOrder.status === 'pending' ? 'Ищем водителя...' : 'В пути'}</Text>
              <View style={{flexDirection: 'row', justifyContent: 'center', marginBottom: 15}}>
                  <TouchableOpacity style={{backgroundColor: '#E8F5E9', padding: 10, borderRadius: 25, marginRight: 15}} onPress={() => driverInfo && Linking.openURL(`tel:${driverInfo.phone}`)}>
                      <Icon name="phone" type="feather" color="green" size={24} />
                  </TouchableOpacity>
                  <TouchableOpacity style={{backgroundColor: '#E3F2FD', padding: 10, borderRadius: 25}} onPress={() => router.push({ pathname: '/order-chat', params: { id: activeOrder.id } })}>
                      <Icon name="message-circle" type="feather" color="#2089dc" size={24} />
                  </TouchableOpacity>
              </View>
              {driverInfo ? (
                  <View style={styles.driverRow}>
                      <Avatar rounded size={50} source={driverInfo.avatar_url ? {uri:driverInfo.avatar_url} : undefined} icon={{name:'user', type:'feather', color:'black'}} containerStyle={{backgroundColor:'#FFC107'}} />
                      <View style={{marginLeft: 15, flex: 1}}>
                          <Text style={{fontWeight:'bold', fontSize: 18}}>{driverInfo.full_name}</Text>
                          <Text style={{color: '#555'}}>{driverInfo.car_model} • {driverInfo.car_number}</Text>
                      </View>
                  </View>
              ) : <ActivityIndicator color="black" />}
              {activeOrder.status === 'completed' && <Button title="Закрыть" onPress={finishRide} buttonStyle={{backgroundColor:'black', marginTop:15, borderRadius:10}} />}
          </View>
      )}

      <Modal visible={ratingModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
              <View style={styles.ratingCard}>
                  <Text h3 style={{textAlign:'center', marginBottom:10}}>Как поездка?</Text>
                  <Text style={{textAlign:'center', color:'gray', marginBottom: 20}}>Поставьте оценку</Text>
                  <View style={{flexDirection:'row', justifyContent:'center', marginBottom: 30}}>
                      {[1, 2, 3, 4, 5].map((star) => (
                          <TouchableOpacity key={star} onPress={() => setRating(star)} style={{marginHorizontal: 5}}>
                              <Icon name="star" type="font-awesome" size={40} color={star <= rating ? "#FFC107" : "#e1e1e1"} />
                          </TouchableOpacity>
                      ))}
                  </View>
                  <Button title="Готово" onPress={submitRating} buttonStyle={{backgroundColor:'black', borderRadius:10, height: 50}} />
              </View>
          </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerPinContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10, marginTop: -35 },
  pinWrapper: { alignItems: 'center', justifyContent: 'flex-end' },
  pinHead: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  pinDot: { width: 12, height: 12, borderRadius: 6 },
  pinStick: { width: 2, height: 18, backgroundColor: 'black', marginTop: -1 },
  pinShadow: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.3)' },
  
  menuBtn: { position: 'absolute', top: 50, left: 20, backgroundColor: 'white', padding: 10, borderRadius: 25, elevation: 5, zIndex: 20 },
  whereToCard: { position: 'absolute', top: 110, left: 20, right: 20, backgroundColor: 'white', borderRadius: 15, padding: 15, elevation: 10 },
  
  selectingContainer: { flex: 1, backgroundColor: 'white' },
  selectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 10 },
  backButton: { padding: 10, marginLeft: 10 },
  inputsBlock: { 
      backgroundColor: 'white', 
      marginHorizontal: 15, 
      paddingVertical: 10, 
      paddingHorizontal: 15,
      borderRadius: 15, 
      borderWidth: 1, 
      borderColor: '#eee', 
      marginBottom: 10,
      elevation: 3,
      shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  label: { fontSize: 10, color: 'gray', marginBottom: 2 },
  inputField: { fontSize: 16, fontWeight: 'bold', color: 'black', paddingVertical: 5, width: '100%' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 15, marginTop: 5 },
  dividerRow: { flexDirection: 'row', height: 20, alignItems: 'center' },
  verticalLine: { width: 1, height: '100%', backgroundColor: '#ddd', marginLeft: 4, marginRight: 19 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#eee' },

  mapPickRow: { flexDirection: 'row', alignItems: 'center', padding: 15, marginHorizontal: 15, backgroundColor: '#F0F8FF', borderRadius: 10, borderWidth: 1, borderColor: '#E0F7FA' },
  iconCircleSmall: { marginRight: 15 },
  
  placeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
  placeIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f2f2f2', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  placeName: { fontWeight: 'bold', fontSize: 16, color: 'black' },
  placeCity: { color: 'gray', fontSize: 12 },
  
  confirmMapBtnContainer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  addressFloatingBubble: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, borderRadius: 20, marginBottom: 10, maxWidth: '80%' },
  
  bottomWrapper: { position: 'absolute', bottom: 0, width: '100%' },
  priceBox: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, elevation: 20 },
  activeOrderCard: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, elevation: 20 },
  driverRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 15, borderRadius: 15 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  ratingCard: { backgroundColor: 'white', borderRadius: 20, padding: 30, alignItems: 'stretch' },
});