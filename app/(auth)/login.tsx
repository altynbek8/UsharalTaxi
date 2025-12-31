import { Button, Input, Text, useTheme } from '@rneui/themed';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { normalizePhone } from '../../lib/utils'; // <--- НОВОЕ

export default function LoginScreen() {
  const { theme } = useTheme();
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!phone.trim() || !password.trim()) return Alert.alert('Ошибка', 'Введите номер и пароль');

    setLoading(true);
    
    // ИСПРАВЛЕНО: Используем нормализатор
    const cleanPhone = normalizePhone(phone); 
    const fakeEmail = `${cleanPhone}@taxi.kz`;

    // 1. Вход
    const { data, error } = await supabase.auth.signInWithPassword({ 
        email: fakeEmail, 
        password: password 
    });
    
    if (error) {
      Alert.alert('Ошибка входа', 'Неверный номер или пароль');
      setLoading(false);
      return;
    }

    // 2. Проверка роли (куда перекинуть)
    if (data.session) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .single();

      if (profileError || !profile) {
        Alert.alert('Ошибка', 'Профиль не найден');
        setLoading(false);
        return;
      }

      if (profile.role === 'driver') {
        router.replace('/(driver)/home');
      } else {
        router.replace('/(passenger)/home');
      }
    }
  }

  return (
    <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        <Text h1 style={{ textAlign: 'center', marginBottom: 40 }}>Taxi App 🚕</Text>
        
        <Input 
            placeholder="Номер телефона (777...)" 
            value={phone} 
            onChangeText={setPhone} 
            keyboardType="phone-pad" 
            leftIcon={{ type: 'feather', name: 'phone', color: 'gray' }}
        />
        
        <Input 
            placeholder="Пароль" 
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry 
            leftIcon={{ type: 'feather', name: 'lock', color: 'gray' }}
        />
        
        <Button 
            title="Войти" 
            onPress={signIn} 
            loading={loading} 
            buttonStyle={{ backgroundColor: theme.colors.primary, borderRadius: 10, height: 50 }} 
            titleStyle={{ color: 'black', fontWeight: 'bold' }} 
        />
        
        <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={{ marginTop: 20 }}>
          <Text style={{ textAlign: 'center', color: 'gray' }}>Нет аккаунта? Регистрация</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ 
    container: { flex: 1, backgroundColor: 'white' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 }
});