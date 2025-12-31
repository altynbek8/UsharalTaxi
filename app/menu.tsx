import { Avatar, Icon, ListItem, Text, useTheme } from '@rneui/themed';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';

export default function MenuScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
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
    await supabase.auth.signOut();
    router.replace('/');
  }

  const menuItems = [
    { title: 'История заказов', icon: 'clock', route: '/history' },
    { title: 'Настройки профиля', icon: 'settings', route: '/settings' },
    { title: 'Служба поддержки', icon: 'help-circle', action: () => Alert.alert('Поддержка', 'Звоните: +7 700 123 45 67') },
  ];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Icon name="x" type="feather" size={28} color="black" />
      </TouchableOpacity>

      <View style={styles.header}>
          <Avatar 
            size={80} 
            rounded 
            source={profile?.avatar_url ? { uri: profile.avatar_url } : undefined}
            
            // ИСПРАВЛЕНИЕ 1: Скрываем иконку, если есть фото
            icon={profile?.avatar_url ? undefined : { name: 'user', type: 'feather', color: 'gray' }}
            
            containerStyle={{ backgroundColor: '#e1e1e1', marginBottom: 15 }}
            
            // ИСПРАВЛЕНИЕ 2: Растягиваем фото на весь круг
            imageProps={{ resizeMode: 'cover' }}
          />
          <Text h3>{profile?.full_name || 'Пользователь'}</Text>
          <Text style={{color: 'gray', marginTop: 5}}>{profile?.phone}</Text>
      </View>

      <ScrollView style={{marginTop: 20}}>
          {menuItems.map((item) => (
              <TouchableOpacity 
                key={item.title} // <--- ИСПОЛЬЗУЕМ УНИКАЛЬНОЕ НАЗВАНИЕ КАК КЛЮЧ
                onPress={() => item.route ? router.push(item.route as any) : item.action && item.action()}
              >
                  <ListItem containerStyle={styles.listItem}>
                      <Icon name={item.icon} type="feather" size={24} color="gray" />
                      <ListItem.Content>
                          <ListItem.Title style={{fontWeight: 'bold', fontSize: 18}}>{item.title}</ListItem.Title>
                      </ListItem.Content>
                      <ListItem.Chevron />
                  </ListItem>
              </TouchableOpacity>
          ))}
      </ScrollView>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Icon name="log-out" type="feather" color="#ff4d4d" style={{marginRight: 10}} />
          <Text style={{color: '#ff4d4d', fontWeight: 'bold', fontSize: 18}}>Выйти</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', paddingTop: 60, paddingHorizontal: 20 },
  closeBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
  header: { alignItems: 'center', marginTop: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 30 },
  listItem: { paddingVertical: 15 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, marginBottom: 30 }
});