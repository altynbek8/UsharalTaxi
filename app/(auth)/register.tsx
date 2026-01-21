import { Button, ButtonGroup, Input, Text, useTheme } from '@rneui/themed';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { normalizePhone } from '../../lib/utils';

export default function RegisterScreen() {
  const { theme } = useTheme();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleIndex, setRoleIndex] = useState(0); 
  const [loading, setLoading] = useState(false);

  async function signUp() {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || password.length < 6 || !fullName.trim()) {
        return Alert.alert('Ошибка', 'Заполните все поля (пароль минимум 6 символов)');
    }

    setLoading(true);
    const role = roleIndex === 0 ? 'passenger' : 'driver';
    const fakeEmail = `${cleanPhone}@taxi.kz`;

    const { error } = await supabase.auth.signUp({
      email: fakeEmail,
      password: password,
      options: {
        data: { full_name: fullName, role: role, phone: cleanPhone }
      }
    });

    if (error) {
        Alert.alert('Ошибка', 'Этот номер уже занят или данные неверны');
    } else {
        Alert.alert('Успех', 'Аккаунт создан!');
        router.replace('/(auth)/login');
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <Text h2 style={styles.title}>Регистрация</Text>
          
          <ButtonGroup
            buttons={['Я Пассажир', 'Я Водитель']}
            selectedIndex={roleIndex}
            onPress={setRoleIndex}
            containerStyle={styles.buttonGroup}
            selectedButtonStyle={{ backgroundColor: '#FFC107' }}
            textStyle={{ color: 'white' }}
            selectedTextStyle={{ color: 'black', fontWeight: 'bold' }}
            innerBorderStyle={{ color: '#333' }}
          />

          <Input 
            placeholder="Имя Фамилия" 
            value={fullName} 
            onChangeText={setFullName} 
            placeholderTextColor="#666"
            inputStyle={{ color: 'white' }}
            leftIcon={{ type: 'feather', name: 'user', color: '#FFC107' }}
          />
          
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
            placeholder="Придумайте пароль" 
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry 
            placeholderTextColor="#666"
            inputStyle={{ color: 'white' }}
            leftIcon={{ type: 'feather', name: 'lock', color: '#FFC107' }}
          />
          
          <Button 
            title="СОЗДАТЬ АККАУНТ" 
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
    buttonText: { color: 'black', fontWeight: 'bold' }
});