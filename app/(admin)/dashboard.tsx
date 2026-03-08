import { supabase } from '@/lib/supabase';
import { Avatar, Icon, ListItem, Text, useTheme } from '@rneui/themed';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function AdminDashboard() {
  const { theme } = useTheme();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    fetchPendingDrivers();
  }, []));

  async function fetchPendingDrivers() {
    setLoading(true);
    const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'driver')
        .eq('verification_status', 'pending'); // Берем только тех, кто ждет
    
    if (data) setDrivers(data);
    setLoading(false);
  }

  // ФУНКЦИЯ ВЫХОДА
  async function handleLogout() {
      Alert.alert("Выход", "Выйти из аккаунта администратора?", [
          { text: "Отмена", style: "cancel" },
          { 
              text: "Выйти", 
              style: "destructive", 
              onPress: async () => {
                  await supabase.auth.signOut();
                  router.replace('/(auth)/login');
              } 
          }
      ]);
  }

  return (
    <View style={styles.container}>
      
      {/* --- ШАПКА С КНОПКОЙ ВЫХОДА --- */}
      <View style={styles.header}>
          <Text h4>Админ-панель 🛡️</Text>
          <TouchableOpacity onPress={handleLogout} style={{padding: 5}}>
              <Icon name="log-out" type="feather" color="#ff4d4d" size={26} />
          </TouchableOpacity>
      </View>
      
      <Text style={{marginBottom: 15, color: 'gray'}}>Заявки на верификацию:</Text>
      
      {loading ? <ActivityIndicator color="#FFC107" size="large" /> : (
          <FlatList 
            data={drivers}
            keyExtractor={item => item.id}
            ListEmptyComponent={<Text style={{textAlign:'center', marginTop: 50, color:'gray'}}>Новых заявок нет</Text>}
            renderItem={({item}) => (
                <TouchableOpacity onPress={() => router.push({ pathname: '/(admin)/review', params: { id: item.id } })}>
                    <ListItem bottomDivider containerStyle={{borderRadius: 10, marginBottom: 10}}>
                        <Avatar rounded source={item.avatar_url ? {uri: item.avatar_url} : undefined} icon={{name:'user', type:'feather', color:'gray'}} containerStyle={{backgroundColor:'#eee'}} />
                        <ListItem.Content>
                            <ListItem.Title style={{fontWeight:'bold'}}>{item.full_name}</ListItem.Title>
                            <ListItem.Subtitle>{item.car_model} • {item.car_number}</ListItem.Subtitle>
                        </ListItem.Content>
                        <View style={{alignItems: 'flex-end'}}>
                             <Text style={{color: 'orange', fontSize: 12}}>Ждет</Text>
                             <Icon name="chevron-right" type="feather" size={20} color="gray" />
                        </View>
                    </ListItem>
                </TouchableOpacity>
            )}
          />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#f5f5f5' },
  header: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#ddd',
      paddingBottom: 15
  }
});
