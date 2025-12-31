import { Button, Text } from '@rneui/themed';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import { supabase } from '../../lib/supabase';

export default function ReviewDriverScreen() {
  const { id } = useLocalSearchParams();
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDriver(); }, []);

  async function fetchDriver() {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
      if (error) {
          Alert.alert("Ошибка загрузки", error.message);
          return;
      }
      setDriver(data);
      setLoading(false);
  }

  async function setVerdict(status: 'verified' | 'rejected') {
      setLoading(true);
      
      // 1. Пытаемся обновить статус
      const { error } = await supabase
        .from('profiles')
        .update({ verification_status: status })
        .eq('id', id);

      setLoading(false);

      if (error) {
          console.log("Ошибка обновления:", error);
          Alert.alert("Ошибка", "Не удалось обновить статус. Проверьте права администратора.");
      } else {
          Alert.alert("Успех", status === 'verified' ? 'Водитель одобрен! ✅' : 'Водитель отклонен ❌');
          router.back();
      }
  }

  if (loading || !driver) return <ActivityIndicator style={{marginTop:50}} />;

  const docs = driver.documents || {};

  return (
    <ScrollView style={styles.container}>
      <Text h4 style={{textAlign:'center', marginBottom: 10}}>{driver.full_name}</Text>
      <Text style={{textAlign:'center', marginBottom: 20, color:'gray'}}>
          {driver.car_model} ({driver.car_number})
      </Text>
      
      <Text style={{textAlign:'center', marginBottom: 10, fontWeight: 'bold', color: driver.verification_status === 'verified' ? 'green' : 'orange'}}>
          Статус: {driver.verification_status}
      </Text>

      {/* ФОТО ДОКУМЕНТОВ */}
      <Text style={styles.label}>Права (Лицевая):</Text>
      {docs.license_front ? <Image source={{uri: docs.license_front}} style={styles.docImage} /> : <Text style={styles.noData}>Нет фото</Text>}

      <Text style={styles.label}>Права (Оборот):</Text>
      {docs.license_back ? <Image source={{uri: docs.license_back}} style={styles.docImage} /> : <Text style={styles.noData}>Нет фото</Text>}

      <Text style={styles.label}>Техпаспорт:</Text>
      {docs.tech_passport ? <Image source={{uri: docs.tech_passport}} style={styles.docImage} /> : <Text style={styles.noData}>Нет фото</Text>}

      <Text style={styles.label}>Фото машины:</Text>
      {docs.car_photo ? <Image source={{uri: docs.car_photo}} style={styles.docImage} /> : <Text style={styles.noData}>Нет фото</Text>}

      {/* КНОПКИ РЕШЕНИЯ */}
      <View style={styles.btnRow}>
          <Button 
            title="Отклонить" 
            onPress={() => setVerdict('rejected')} 
            buttonStyle={{backgroundColor: 'red', borderRadius: 10}} 
            containerStyle={{flex: 1, marginRight: 10}}
          />
          <Button 
            title="ОДОБРИТЬ" 
            onPress={() => setVerdict('verified')} 
            buttonStyle={{backgroundColor: 'green', borderRadius: 10}} 
            containerStyle={{flex: 1}}
          />
      </View>
      <View style={{height: 50}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: 'white' },
  label: { fontWeight: 'bold', marginTop: 15, marginBottom: 5, fontSize: 16 },
  noData: { color: 'gray', fontStyle: 'italic', marginBottom: 10 },
  docImage: { 
      width: '100%', 
      height: 250, 
      borderRadius: 10, 
      backgroundColor: '#f0f0f0', 
      resizeMode: 'contain', 
      marginBottom: 10,
      borderWidth: 1,
      borderColor: '#ddd'
  },
  btnRow: { flexDirection: 'row', marginTop: 30 }
});