import { Button, Text, Icon } from '@rneui/themed';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { Linking, StyleSheet, View, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

export default function TelegramVerifyScreen() {
  const { user } = useAuth();

  // 🔴 ЗАМЕНИ НА СВОЕГО БОТА!
  const BOT_URL = 'https://t.me/Taxi_Zhetysu_bot?start=start';

  useEffect(() => {
      if (!user) return;

      const channel = supabase.channel('tg_verify')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload) => {
            if (payload.new.is_telegram_verified) {
                if (payload.new.role === 'driver') router.replace('/(driver)/home');
                else router.replace('/(passenger)/home');
            }
        })
        .subscribe();

      const interval = setInterval(async () => {
          const { data } = await supabase.from('profiles').select('is_telegram_verified, role').eq('id', user.id).single();
          if (data?.is_telegram_verified) {
              if (data.role === 'driver') router.replace('/(driver)/home');
              else router.replace('/(passenger)/home');
          }
      }, 3000);

      return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [user]);

  return (
    <View style={styles.container}>
      <Icon name="send" type="feather" size={80} color="#0088cc" />
      <Text h3 style={{textAlign:'center', marginTop:20, color:'white'}}>Проверка номера</Text>
      <Text style={styles.desc}>Мы используем Telegram для защиты от фейков.</Text>
      
      <View style={styles.stepBox}>
          <Text style={styles.step}>1. Нажмите кнопку ниже</Text>
          <Text style={styles.step}>2. В боте нажмите "Start" и "Поделиться контактом"</Text>
          <Text style={styles.step}>3. Приложение откроется автоматически</Text>
      </View>

      <Button title="ОТКРЫТЬ TELEGRAM" onPress={() => Linking.openURL(BOT_URL)} buttonStyle={{backgroundColor: '#0088cc', borderRadius: 10, height: 55, marginTop: 30}} titleStyle={{fontWeight: 'bold'}} />

      <View style={{marginTop: 40, flexDirection: 'row', alignItems: 'center'}}>
          <ActivityIndicator color="#FFC107" />
          <Text style={{color:'gray', marginLeft: 10}}>Ждем подтверждения...</Text>
      </View>
      
      <Button title="Выйти" type="clear" onPress={() => { supabase.auth.signOut(); router.replace('/(auth)/login'); }} containerStyle={{marginTop: 50}} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 30, justifyContent: 'center', alignItems: 'center' },
  desc: { color: '#ccc', textAlign: 'center', marginTop: 10, fontSize: 16, marginBottom: 30 },
  stepBox: { backgroundColor: '#222', padding: 20, borderRadius: 10, width: '100%' },
  step: { color: 'white', fontSize: 16, marginBottom: 10 }
});