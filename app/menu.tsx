import { Avatar, Icon, ListItem, Text, useTheme } from '@rneui/themed';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View, Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';

export default function MenuScreen() {
  const { theme } = useTheme();
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [earnings, setEarnings] = useState(0); // Сумма заработка

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      if (role === 'driver') fetchEarnings();
    }, [])
  );

  async function fetchProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
    if (data) setProfile(data);
  }

  // СЧИТАЕМ ДЕНЬГИ (Только для водителя)
  async function fetchEarnings() {
      const { data } = await supabase
        .from('orders')
        .select('price')
        .eq('driver_id', user?.id)
        .eq('status', 'completed');
      
      if (data) {
          // Складываем все цены
          const total = data.reduce((sum, order) => sum + (order.price || 0), 0);
          setEarnings(total);
      }
  }

  async function handleLogout() {
    Alert.alert("Выход", "Точно выйти?", [
        {text: "Нет"},
        {text: "Да, выйти", style: 'destructive', onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
        }}
    ]);
  }

  // Звонок диспетчеру
  const callSupport = () => {
      Linking.openURL('tel:+77001234567');
  };

  const menuItems = [
    { title: 'История заказов', icon: 'clock', route: '/history' },
    // ДОБАВЛЯЕМ ЭТУ СТРОКУ:
    { title: 'Верификация / Документы', icon: 'shield', route: '/(driver)/verification' },
    { title: 'Настройки профиля', icon: 'settings', route: '/settings' },
    { title: 'Служба поддержки', icon: 'headphones', action: callSupport },
  ];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Icon name="x" type="feather" size={28} color="black" />
      </TouchableOpacity>

      <View style={styles.header}>
          <Avatar 
            size={90} 
            rounded 
            source={profile?.avatar_url ? { uri: profile.avatar_url } : undefined}
            icon={profile?.avatar_url ? undefined : { name: 'user', type: 'feather', color: 'gray' }}
            containerStyle={{ backgroundColor: '#e1e1e1', marginBottom: 15, borderWidth: 2, borderColor: 'white', elevation: 5 }}
            imageProps={{ resizeMode: 'cover' }}
          />
          <Text h3>{profile?.full_name || 'Пользователь'}</Text>
          <Text style={{color: 'gray', marginTop: 5}}>{profile?.phone}</Text>
          
          {/* БЕЙДЖ РОЛИ */}
          <View style={[styles.roleBadge, {backgroundColor: role === 'driver' ? '#FFC107' : '#2196F3'}]}>
              <Text style={{color: 'black', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase'}}>
                  {role === 'driver' ? 'Водитель' : role === 'admin' ? 'Админ' : 'Пассажир'}
              </Text>
          </View>
      </View>

      {/* БАЛАНС ВОДИТЕЛЯ */}
      {role === 'driver' && (
          <View style={styles.balanceCard}>
              <View>
                  <Text style={{color:'white', fontSize: 14, opacity: 0.8}}>Ваш заработок</Text>
                  <Text h3 style={{color:'white'}}>{earnings} ₸</Text>
              </View>
              <View style={{backgroundColor: 'white', padding: 8, borderRadius: 20}}>
                  <Icon name="trending-up" type="feather" color="#4CAF50" size={24} />
              </View>
          </View>
      )}

      <ScrollView style={{marginTop: 10}}>
          {menuItems.map((item, index) => (
              <TouchableOpacity 
                key={index}
                onPress={() => item.route ? router.push(item.route as any) : item.action && item.action()}
              >
                  <ListItem containerStyle={styles.listItem}>
                      <View style={{backgroundColor: '#f5f5f5', padding: 10, borderRadius: 10}}>
                        <Icon name={item.icon} type="feather" size={22} color="#333" />
                      </View>
                      <ListItem.Content>
                          <ListItem.Title style={{fontWeight: '600', fontSize: 16}}>{item.title}</ListItem.Title>
                      </ListItem.Content>
                      <ListItem.Chevron />
                  </ListItem>
              </TouchableOpacity>
          ))}
      </ScrollView>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Icon name="log-out" type="feather" color="#ff4d4d" style={{marginRight: 10}} />
          <Text style={{color: '#ff4d4d', fontWeight: 'bold', fontSize: 16}}>Выйти</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', paddingTop: 60, paddingHorizontal: 20 },
  closeBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
  header: { alignItems: 'center', marginTop: 10, paddingBottom: 20 },
  roleBadge: { marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  
  balanceCard: {
      backgroundColor: '#4CAF50',
      borderRadius: 15,
      padding: 20,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
      elevation: 5,
      shadowColor: '#4CAF50',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.3,
      shadowRadius: 5
  },
  
  listItem: { paddingVertical: 10 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 30 }
});