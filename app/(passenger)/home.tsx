import { Button, Icon, Input, Text } from '@rneui/themed';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  StatusBar,
  StyleSheet,
  TouchableOpacity, View
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useOrderStore } from '@/store/useOrderStore';
import { Order, Profile } from '@/types/database';

const USHARAL_REGION = {
    latitude: 46.1687,
    longitude: 80.9431,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
};

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

export default function PassengerHome() {
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);
  
  const { 
    activeOrder, setActiveOrder, 
    driverInfo, setDriverInfo, 
    resetOrder 
  } = useOrderStore();
  
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState(''); 
  const [isPickingMode, setIsPickingMode] = useState<'from' | 'to' | null>(null);
  const [centerCoords, setCenterCoords] = useState(USHARAL_REGION);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [step, setStep] = useState<'idle' | 'active'>('idle');
  const [loading, setLoading] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<Profile[]>([]);
  const [showRating, setShowRating] = useState(false);

  useEffect(() => { 
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
          let loc = await Location.getCurrentPositionAsync({});
          const reg = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005
          };
          mapRef.current?.animateToRegion(reg, 1000);
          reverseGeocode(loc.coords.latitude, loc.coords.longitude, 'from');
      } catch (e) {}
    })();
  }, []);

  const reverseGeocode = async (lat: number, lon: number, field: 'from' | 'to') => {
      try {
          let addressList = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          if (addressList.length > 0) {
              const addr = `${addressList[0].street || ''} ${addressList[0].name || ''}`.trim();
              if (field === 'from') setFromAddress(addr);
              else setToAddress(addr);
          }
      } catch (e) {}
  };

  useFocusEffect(useCallback(() => { 
    if (user) checkActiveOrder(); 
  }, [user]));

  async function checkActiveOrder() {
    const { data } = await supabase.from('orders')
        .select('*').eq('passenger_id', user?.id)
        .neq('status', 'completed').neq('status', 'cancelled').maybeSingle();

    if (data) { 
        setActiveOrder(data as Order); setStep('active'); 
        if (data.driver_id) fetchDriverInfo(data.driver_id);
    } else {
        fetchNearbyDrivers();
    }
  }

  async function fetchNearbyDrivers() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'driver').eq('is_online', true);
    if (data) setNearbyDrivers(data as Profile[]);
  }

  async function fetchDriverInfo(driverId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', driverId).single();
    if (data) setDriverInfo(data as Profile);
  }

  async function createOrder() {
    if (!fromAddress || !toAddress || !price) return Alert.alert('Ошибка', 'Заполните данные');
    setLoading(true);
    const { data, error } = await supabase.from('orders').insert({
        passenger_id: user?.id, from_address: fromAddress, to_address: toAddress,
        price: parseInt(price), comment: comment,
        from_lat: centerCoords.latitude, from_lon: centerCoords.longitude,
        to_lat: centerCoords.latitude, to_lon: centerCoords.longitude,
        status: 'pending'
    }).select().single();
    setLoading(false);
    if (!error) { setActiveOrder(data as Order); setStep('active'); }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <MapView 
        ref={mapRef}
        provider={PROVIDER_GOOGLE} 
        style={StyleSheet.absoluteFill} 
        customMapStyle={darkMapStyle}
        initialRegion={USHARAL_REGION}
        showsUserLocation
        onRegionChange={() => setIsMapMoving(true)}
        onRegionChangeComplete={(reg) => { setCenterCoords(reg); setIsMapMoving(false); }}
      >
          {step === 'idle' && nearbyDrivers.map(d => (
             <Marker key={d.id} coordinate={{latitude: d.current_lat || 0, longitude: d.current_lon || 0}}>
                 <Image source={require('@/../assets/images/icon.png')} style={{width: 30, height: 30}} />
             </Marker>
          ))}
      </MapView>
      {isPickingMode && (
          <View style={styles.pinOverlay} pointerEvents="none">
              <View style={styles.centerDot} />
              <View style={styles.thinCrossVertical} />
              <View style={styles.thinCrossHorizontal} />
          </View>
      )}
      {!isPickingMode && (
        <SafeAreaView style={styles.topBar}>
            <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/menu')}>
                <Icon name="menu" type="feather" color="white" size={24} />
            </TouchableOpacity>
        </SafeAreaView>
      )}
      {isPickingMode && (
          <View style={styles.confirmBtnContainer}>
              <Text style={styles.pickLabel}>{isPickingMode === 'from' ? 'Откуда забрать?' : 'Куда едем?'}</Text>
              <Button title="ПОДТВЕРДИТЬ" onPress={() => { reverseGeocode(centerCoords.latitude, centerCoords.longitude, isPickingMode); setIsPickingMode(null); }} buttonStyle={styles.mainBtn} containerStyle={{width: 200}} titleStyle={{color: 'black'}} />
          </View>
      )}
      {!isPickingMode && (
        <KeyboardAvoidingView behavior={undefined} style={styles.bottomContainer}>
            <View style={styles.bottomSheet}>
                <View style={styles.sheetHandle} />
                {step === 'idle' ? (
                    <>
                      <Text style={styles.sheetTitle}>Заказать такси</Text>
                      <TouchableOpacity style={styles.inputBox} onPress={() => setIsPickingMode('from')}>
                          <Icon name="map-pin" type="feather" size={18} color="#FFC107" />
                          <Text style={styles.inputText} numberOfLines={1}>{fromAddress || 'Откуда?'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.inputBox} onPress={() => setIsPickingMode('to')}>
                          <Icon name="flag" type="feather" size={18} color="white" />
                          <Text style={styles.inputText} numberOfLines={1}>{toAddress || 'Куда?'}</Text>
                      </TouchableOpacity>
                      <View style={styles.priceRow}>
                        <View style={styles.miniInput}>
                            <Text style={styles.label}>Цена (₸)</Text>
                            <Input value={price} onChangeText={setPrice} keyboardType="numeric" inputContainerStyle={{borderBottomWidth: 0}} style={styles.priceInput} renderErrorMessage={false} />
                        </View>
                        <Button title="ЗАКАЗАТЬ" onPress={createOrder} loading={loading} buttonStyle={styles.mainBtn} titleStyle={{color:'black', fontWeight:'bold'}} containerStyle={{flex:1, marginLeft: 10}} />
                      </View>
                    </>
                ) : (
                    <View>
                        <Text style={styles.sheetTitle}>{activeOrder?.status === 'pending' ? 'Ищем водителя...' : 'Водитель назначен'}</Text>
                        <Button title="Отменить" type="outline" onPress={() => { supabase.from('orders').update({status:'cancelled'}).eq('id', activeOrder?.id).then(); resetOrder(); setStep('idle'); }} buttonStyle={{borderColor:'#ff4d4d'}} titleStyle={{color:'#ff4d4d'}} />
                    </View>
                )}
            </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { position: 'absolute', top: 10, left: 20, zIndex: 100 },
  menuBtn: { backgroundColor: '#1A1A1A', padding: 12, borderRadius: 15, elevation: 10 },
  bottomContainer: { justifyContent: 'flex-end', flex: 1 },
  bottomSheet: { backgroundColor: '#121212', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, paddingBottom: 40, borderTopWidth: 1, borderColor: '#333' },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#333', alignSelf: 'center', borderRadius: 2, marginBottom: 15 },
  sheetTitle: { color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', padding: 15, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  inputText: { color: 'white', marginLeft: 10, fontSize: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  miniInput: { backgroundColor: '#1A1A1A', borderRadius: 15, paddingHorizontal: 15, width: 120, height: 55, justifyContent: 'center' },
  label: { color: 'gray', fontSize: 10, marginBottom: -5 },
  priceInput: { color: '#FFC107', fontWeight: 'bold', fontSize: 18 },
  mainBtn: { backgroundColor: '#FFC107', borderRadius: 15, height: 55 },
  pinOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 50 },
  centerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFC107', position: 'absolute' },
  thinCrossVertical: { width: 1, height: 40, backgroundColor: 'rgba(255,193,7,0.5)' },
  thinCrossHorizontal: { width: 40, height: 1, backgroundColor: 'rgba(255,193,7,0.5)', position: 'absolute' },
  confirmBtnContainer: { position: 'absolute', bottom: 50, alignItems: 'center', width: '100%', zIndex: 100 },
  pickLabel: { backgroundColor: '#FFC107', padding: 10, borderRadius: 10, marginBottom: 15, fontWeight: 'bold', color: 'black' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  ratingCard: { backgroundColor: '#1A1A1A', padding: 30, borderRadius: 20, width: '80%', alignItems: 'center', borderWidth: 1, borderColor: '#333' }
});