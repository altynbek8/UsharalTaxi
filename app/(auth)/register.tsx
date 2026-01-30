import { Button, ButtonGroup, Input, Text, Icon } from '@rneui/themed';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { normalizePhone } from '../../lib/utils';

export default function RegisterScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleIndex, setRoleIndex] = useState(0); 
  const [loading, setLoading] = useState(false);

  async function signUp() {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 11) {
        return Alert.alert('Ошибка', 'Введите корректный номер (8...)');
    }
    if (password.length < 6) return Alert.alert('Ошибка', 'Пароль минимум 6 символов');
    if (!fullName.trim()) return Alert.alert('Ошибка', 'Введите имя');

    setLoading(true);
    
    // 0 = Пассажир, 1 = Водитель
    const role = roleIndex === 0 ? 'passenger' : 'driver';
    const fakeEmail = `${cleanPhone}@taxi.kz`;

    try {
        const { data, error } = await supabase.auth.signUp({
          email: fakeEmail,
          password: password,
          options: {
            data: { full_name: fullName, role: role, phone: cleanPhone, is_telegram_verified: false }
          }
        });

        if (error) throw error;

        // УСПЕХ!
        // Сразу кидаем на проверку Телеграма, так как новый юзер еще не подтвержден
        router.replace('/(auth)/telegram-verify');

    } catch (e: any) {
        Alert.alert('Ошибка регистрации', 'Возможно, этот номер уже занят.');
    } finally {
        setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <TouchableOpacity onPress={() => router.back()} style={{alignSelf:'flex-start', marginBottom: 20}}>
              <Icon name="arrow-left" type="feather" color="white" size={28} />
          </TouchableOpacity>

          <Text h2 style={styles.title}>Создать аккаунт</Text>
          
          <ButtonGroup
            buttons={['Я Пассажир', 'Я Водитель']}
            selectedIndex={roleIndex}
            onPress={setRoleIndex}
            containerStyle={styles.buttonGroup}
            selectedButtonStyle={{ backgroundColor: '#FFC107' }}
            textStyle={{ color: 'white' }}
            selectedTextStyle={{ color: 'black', fontWeight: 'bold' }}
            innerBorderStyle={{ width: 0 }}
          />

          <Input 
            placeholder="Имя Фамилия" 
            value={fullName} onChangeText={setFullName} 
            placeholderTextColor="#666" inputStyle={{ color: 'white' }}
            leftIcon={{ type: 'feather', name: 'user', color: '#FFC107' }}
          />
          
          <Input 
            placeholder="Номер телефона (8...)" 
            value={phone} onChangeText={setPhone} keyboardType="phone-pad" 
            placeholderTextColor="#666" inputStyle={{ color: 'white' }}
            leftIcon={{ type: 'feather', name: 'phone', color: '#FFC107' }}
          />
          
          <Input 
            placeholder="Пароль (мин. 6 символов)" 
            value={password} onChangeText={setPassword} secureTextEntry 
            placeholderTextColor="#666" inputStyle={{ color: 'white' }}
            leftIcon={{ type: 'feather', name: 'lock', color: '#FFC107' }}
          />
          
          <Button 
            title="ДАЛЕЕ" 
            onPress={signUp} 
            loading={loading} 
            buttonStyle={styles.mainButton} 
            titleStyle={styles.buttonText} 
          />

          <Button 
            title="Уже есть аккаунт? Войти" 
            type="clear"
            onPress={() => router.push('/(auth)/login')} 
            titleStyle={{ color: '#888' }}
            containerStyle={{ marginTop: 10 }}
          />

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({ 
    container: { flex: 1, backgroundColor: '#121212' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 25 },
    title: { textAlign: 'center', color: 'white', marginBottom: 30 },
    buttonGroup: { marginBottom: 30, borderRadius: 12, backgroundColor: '#1E1E1E', height: 50, borderColor: '#333' },
    mainButton: { backgroundColor: '#FFC107', borderRadius: 12, height: 55 },
    buttonText: { color: 'black', fontWeight: 'bold', fontSize: 18 }
});