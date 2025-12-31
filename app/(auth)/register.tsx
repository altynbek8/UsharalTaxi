import { Button, ButtonGroup, Input, Text, useTheme } from '@rneui/themed';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { normalizePhone } from '../../lib/utils'; // <--- НОВОЕ

export default function RegisterScreen() {
  const { theme } = useTheme();
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleIndex, setRoleIndex] = useState(0); 
  
  const [loading, setLoading] = useState(false);

  async function signUp() {
    if (!phone.trim() || !password.trim() || !fullName.trim()) {
        return Alert.alert('Ошибка', 'Заполните все поля');
    }

    setLoading(true);
    const role = roleIndex === 0 ? 'passenger' : 'driver';
    
    // ИСПРАВЛЕНО: Используем нормализатор
    const cleanPhone = normalizePhone(phone); 
    const fakeEmail = `${cleanPhone}@taxi.kz`;

    const { error } = await supabase.auth.signUp({
      email: fakeEmail,
      password: password,
      options: {
        data: {
          full_name: fullName,
          role: role,
          phone: cleanPhone 
        }
      }
    });

    if (error) {
        Alert.alert('Ошибка', 'Возможно, такой номер уже зарегистрирован');
    } else {
        Alert.alert('Успех', 'Аккаунт создан!');
        router.replace('/(auth)/login');
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <Text h2 style={{ textAlign: 'center', marginBottom: 20 }}>Регистрация</Text>
          
          <ButtonGroup
            buttons={['Я Пассажир', 'Я Водитель']}
            selectedIndex={roleIndex}
            onPress={setRoleIndex}
            containerStyle={{ marginBottom: 20, borderRadius: 10 }}
            selectedButtonStyle={{ backgroundColor: theme.colors.primary }}
            textStyle={{ color: 'black' }}
          />

          <Input 
            placeholder="Имя Фамилия" 
            value={fullName} 
            onChangeText={setFullName} 
            leftIcon={{ type: 'feather', name: 'user', color: 'gray' }}
          />
          
          <Input 
            placeholder="Номер телефона (777...)" 
            value={phone} 
            onChangeText={setPhone} 
            keyboardType="phone-pad" 
            leftIcon={{ type: 'feather', name: 'phone', color: 'gray' }}
          />
          
          <Input 
            placeholder="Придумайте пароль" 
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry 
            leftIcon={{ type: 'feather', name: 'lock', color: 'gray' }}
          />
          
          <Button 
            title="Создать аккаунт" 
            onPress={signUp} 
            loading={loading} 
            buttonStyle={{ backgroundColor: theme.colors.primary, borderRadius: 10, height: 50, marginTop: 10 }} 
            titleStyle={{ color: 'black', fontWeight: 'bold' }} 
          />

          <Button 
            title="Уже есть аккаунт? Войти" 
            type="clear"
            onPress={() => router.push('/(auth)/login')} 
            containerStyle={{ marginTop: 10 }}
          />

          <View style={{height: 50}} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ 
    container: { flex: 1, backgroundColor: 'white' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 }
});