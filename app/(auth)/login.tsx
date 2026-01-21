import { Button, Input, Text } from '@rneui/themed';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  StatusBar
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { normalizePhone } from '../../lib/utils';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!phone.trim() || !password.trim()) return Alert.alert('Ошибка', 'Введите номер и пароль');
    setLoading(true);
    
    try {
        const cleanPhone = normalizePhone(phone); 
        const fakeEmail = `${cleanPhone}@taxi.kz`;

        const { data, error } = await supabase.auth.signInWithPassword({ 
            email: fakeEmail, 
            password: password 
        });
        
        if (error) throw error;

        if (data.session) {
            const { data: profile, error: profileError } = await supabase
                .from('profiles').select('role').eq('id', data.session.user.id).single();

            if (profileError || !profile) throw new Error('Профиль не найден');

            // ЛОГИКА НАВИГАЦИИ ПО РОЛЯМ
            if (profile.role === 'admin') {
                router.replace('/(admin)/dashboard');
            } else if (profile.role === 'driver') {
                router.replace('/(driver)/home');
            } else {
                router.replace('/(passenger)/home');
            }
        }
    } catch (e: any) {
        Alert.alert('Ошибка входа', e.message || 'Неверные данные');
    } finally {
        setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <Text h1 style={styles.title}>U-GO TAXI 🚖</Text>
          <Text style={styles.subtitle}>Вход в систему</Text>
          
          <View style={styles.inputContainer}>
            <Input 
                placeholder="Номер телефона" 
                value={phone} 
                onChangeText={setPhone} 
                keyboardType="phone-pad" 
                placeholderTextColor="#666"
                inputStyle={{ color: 'white' }}
                leftIcon={{ type: 'feather', name: 'phone', color: '#FFC107' }}
            />
            
            <Input 
                placeholder="Пароль" 
                value={password} 
                onChangeText={setPassword} 
                secureTextEntry 
                placeholderTextColor="#666"
                inputStyle={{ color: 'white' }}
                leftIcon={{ type: 'feather', name: 'lock', color: '#FFC107' }}
            />
          </View>
          
          <Button 
              title="ВОЙТИ" 
              onPress={signIn} 
              loading={loading} 
              buttonStyle={styles.button} 
              titleStyle={styles.buttonText} 
          />
          
          <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={{ marginTop: 25 }}>
            <Text style={{ textAlign: 'center', color: '#888' }}>
                Нет аккаунта? <Text style={{color:'#FFC107', fontWeight:'bold'}}>Регистрация</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({ 
    container: { flex: 1, backgroundColor: '#121212' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 25 },
    title: { textAlign: 'center', color: 'white', marginBottom: 5 },
    subtitle: { textAlign: 'center', color: '#666', marginBottom: 40, fontSize: 16 },
    inputContainer: { marginBottom: 20 },
    button: { backgroundColor: '#FFC107', borderRadius: 12, height: 55, shadowColor: '#FFC107', shadowOpacity: 0.3, shadowRadius: 10 },
    buttonText: { color: 'black', fontWeight: 'bold', fontSize: 18 }
});