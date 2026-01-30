import { Button, Input, Text, Icon } from '@rneui/themed';
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
  StatusBar,
  Linking
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { normalizePhone } from '../../lib/utils';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    const cleanPhone = normalizePhone(phone);
    
    if (!cleanPhone || cleanPhone.length < 11) {
        return Alert.alert('Ошибка', 'Введите корректный номер (8...)');
    }
    if (!password.trim()) return Alert.alert('Ошибка', 'Введите пароль');

    setLoading(true);
    
    try {
        // ХАК: Номер -> Email
        const fakeEmail = `${cleanPhone}@taxi.kz`;

        const { data, error } = await supabase.auth.signInWithPassword({ 
            email: fakeEmail, 
            password: password 
        });
        
        if (error) throw error;

        if (data.session) {
            const { data: profile, error: profileError } = await supabase
                .from('profiles').select('role, is_telegram_verified').eq('id', data.session.user.id).single();

            if (profileError || !profile) throw new Error('Профиль не найден');

            // --- ПРОВЕРКА ТЕЛЕГРАМА ---
            // Если не админ и не верифицирован -> на экран подтверждения
            if (profile.role !== 'admin' && !profile.is_telegram_verified) {
                router.replace('/(auth)/telegram-verify');
                return;
            }

            // Если все ок -> домой
            if (profile.role === 'driver') router.replace('/(driver)/home');
            else router.replace('/(passenger)/home');
        }
    } catch (e: any) {
        if (e.message.includes('Invalid login')) Alert.alert('Ошибка', 'Неверный номер или пароль');
        else Alert.alert('Ошибка', e.message);
    } finally {
        setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <View style={{alignItems: 'center', marginBottom: 40}}>
              <Icon name="map-pin" type="feather" size={60} color="#FFC107" />
              <Text h2 style={styles.title}>TAXI USHARAL</Text>
              <Text style={styles.subtitle}>Быстрые поездки по городу</Text>
          </View>
          
          <View style={styles.inputContainer}>
            <Input 
                placeholder="Номер телефона (8...)" 
                value={phone} onChangeText={setPhone} keyboardType="phone-pad" 
                placeholderTextColor="#666" inputStyle={{ color: 'white', fontSize: 18 }}
                leftIcon={{ type: 'feather', name: 'phone', color: '#FFC107' }}
            />
            <Input 
                placeholder="Пароль" 
                value={password} onChangeText={setPassword} secureTextEntry 
                placeholderTextColor="#666" inputStyle={{ color: 'white', fontSize: 18 }}
                leftIcon={{ type: 'feather', name: 'lock', color: '#FFC107' }}
            />
          </View>
          
          <Button title="ВОЙТИ" onPress={signIn} loading={loading} buttonStyle={styles.button} titleStyle={styles.buttonText} containerStyle={{marginBottom: 15}} />
          
          <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={{ marginTop: 10, padding: 10 }}>
            <Text style={{ textAlign: 'center', color: '#bbb', fontSize: 16 }}>
                Впервые у нас? <Text style={{color:'#FFC107', fontWeight:'bold'}}>Регистрация</Text>
            </Text>
          </TouchableOpacity>

          <View style={{marginTop: 50, alignItems: 'center'}}>
            <Text style={{color: 'gray', marginBottom: 15, fontSize: 12}}>Проблемы со входом?</Text>
            <TouchableOpacity onPress={() => Linking.openURL('tel:+77000000000')} style={styles.helpBtn}>
                <Icon name="headphones" type="feather" color="black" size={20} />
                <Text style={{color: 'black', marginLeft: 10, fontWeight: 'bold'}}>Позвонить диспетчеру</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({ 
    container: { flex: 1, backgroundColor: '#121212' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 25 },
    title: { textAlign: 'center', color: 'white', marginTop: 10, fontWeight: 'bold' },
    subtitle: { textAlign: 'center', color: '#888', marginTop: 5, fontSize: 16 },
    inputContainer: { marginBottom: 20 },
    button: { backgroundColor: '#FFC107', borderRadius: 12, height: 55 },
    buttonText: { color: 'black', fontWeight: 'bold', fontSize: 18 },
    helpBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eee', padding: 12, borderRadius: 25, paddingHorizontal: 25 }
});