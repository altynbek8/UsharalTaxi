import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { Avatar, Icon, Text } from '@rneui/themed';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MenuScreen() {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  async function fetchProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
    if (data) setProfile(data);
  }

  async function handleLogout() {
    Alert.alert("Выход", "Вы уверены?", [
        { text: "Отмена", style: 'cancel' },
        { text: "Выйти", style: 'destructive', onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
        }}
    ]);
  }

  // Функция для звонка в поддержку
  const callSupport = () => {
    Linking.openURL('tel:+77001234567'); // Замени на реальный номер диспетчера
  };

  // Базовые пункты меню для ВСЕХ
  const menuItems: any[] = [
    { title: 'История поездок', icon: 'clock', route: '/history' },
    { title: 'Настройки профиля', icon: 'settings', route: '/settings' },
    { title: 'Служба поддержки', icon: 'headphones', action: callSupport },
  ];

  // Доп. пункт только для ВОДИТЕЛЯ
  if (role === 'driver') {
    // Вставляем проверку документов перед настройками или после
    menuItems.splice(2, 0, { title: 'Верификация документов', icon: 'shield', route: '/(driver)/verification' });
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Icon name="x" type="feather" color="white" size={28} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Avatar 
          size={80} 
          rounded 
          source={profile?.avatar_url ? { uri: profile.avatar_url } : undefined}
          icon={{ name: 'user', type: 'feather', color: 'gray' }}
          containerStyle={{ backgroundColor: '#1A1A1A', marginBottom: 15, borderWidth: 1, borderColor: '#333' }}
        />
        <Text h4 style={{ color: 'white' }}>{profile?.full_name || 'Пользователь'}</Text>
        <View style={[styles.roleBadge, { backgroundColor: role === 'driver' ? '#FFC107' : '#2196F3' }]}>
          <Text style={styles.roleText}>{role === 'driver' ? 'Водитель' : 'Клиент'}</Text>
        </View>
      </View>

      <ScrollView style={{ marginTop: 30 }}>
        {menuItems.map((item, index) => (
          <TouchableOpacity 
            key={index}
            onPress={() => {
                if (item.route) router.push(item.route as any);
                else if (item.action) item.action();
            }}
            style={styles.menuItem}
          >
            <View style={styles.iconBox}>
              <Icon name={item.icon} type="feather" size={20} color="white" />
            </View>
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Icon name="chevron-right" type="feather" size={18} color="#333" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Icon name="log-out" type="feather" color="#ff4d4d" size={20} />
        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingHorizontal: 20 },
  closeBtn: { marginTop: 10, alignSelf: 'flex-start' },
  header: { alignItems: 'center', marginTop: 20 },
  roleBadge: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  roleText: { color: 'black', fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  iconBox: { width: 40, height: 40, backgroundColor: '#1A1A1A', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  menuTitle: { color: 'white', fontSize: 16, flex: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, marginBottom: 20, backgroundColor: '#1A1A1A', borderRadius: 15 },
  logoutText: { color: '#ff4d4d', marginLeft: 10, fontWeight: 'bold' }
});