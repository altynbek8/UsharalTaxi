import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { Button, Icon, Input, Text } from '@rneui/themed';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Общие данные
  const [fullName, setFullName] = useState('');
  // Данные только для водителя
  const [carModel, setCarModel] = useState('');
  const [carNumber, setCarNumber] = useState('');
  const [carColor, setCarColor] = useState('');

  useEffect(() => { fetchProfile(); }, []);

  async function fetchProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
    if (data) {
      setFullName(data.full_name || '');
      // Если это водитель, подгружаем машину
      if (data.role === 'driver') {
        setCarModel(data.car_model || '');
        setCarNumber(data.car_number || '');
        setCarColor(data.car_color || '');
      }
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    
    // Формируем объект для обновления
    const updates: any = { full_name: fullName };

    // Если водитель — добавляем данные машины
    if (role === 'driver') {
        updates.car_model = carModel;
        updates.car_number = carNumber;
        updates.car_color = carColor;
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', user?.id);
    
    setSaving(false);
    if (error) Alert.alert('Ошибка', error.message);
    else Alert.alert('Успех', 'Профиль обновлен!');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Icon name="arrow-left" type="feather" color="white" /></TouchableOpacity>
        <Text h4 style={{ color: 'white', marginLeft: 15 }}>Настройки</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.label}>Личные данные</Text>
        <Input 
          placeholder="Имя и Фамилия" 
          value={fullName} 
          onChangeText={setFullName} 
          inputStyle={{ color: 'white' }} 
          leftIcon={{name: 'user', type: 'feather', color: '#FFC107'}}
        />

        {/* ЭТОТ БЛОК ВИДИТ ТОЛЬКО ВОДИТЕЛЬ */}
        {role === 'driver' && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.label}>Мой автомобиль 🚖</Text>
            <Input placeholder="Марка и модель (Toyota Camry)" value={carModel} onChangeText={setCarModel} inputStyle={{ color: 'white' }} />
            <Input placeholder="Госномер (001 ABC 19)" value={carNumber} onChangeText={setCarNumber} inputStyle={{ color: 'white' }} />
            <Input placeholder="Цвет" value={carColor} onChangeText={setCarColor} inputStyle={{ color: 'white' }} />
            
            <Button 
              title="Проверка документов" 
              type="outline" 
              onPress={() => router.push('/(driver)/verification')} 
              buttonStyle={{ borderColor: '#FFC107', borderRadius: 10, marginBottom: 20 }} 
              titleStyle={{ color: '#FFC107' }} 
            />
          </View>
        )}

        <Button 
          title="СОХРАНИТЬ" 
          onPress={handleSave} 
          loading={saving} 
          buttonStyle={{ backgroundColor: '#FFC107', borderRadius: 15, height: 55 }} 
          titleStyle={{ color: 'black', fontWeight: 'bold' }} 
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  label: { color: '#FFC107', fontWeight: 'bold', marginLeft: 10, marginBottom: 10, fontSize: 14, textTransform: 'uppercase' }
});