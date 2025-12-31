import { Avatar, Icon, ListItem, Text, useTheme } from '@rneui/themed';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

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

  return (
    <View style={styles.container}>
      <Text h4 style={{marginBottom: 15, textAlign: 'center'}}>Заявки на верификацию</Text>
      
      {loading ? <ActivityIndicator /> : (
          <FlatList 
            data={drivers}
            keyExtractor={item => item.id}
            ListEmptyComponent={<Text style={{textAlign:'center', marginTop: 50, color:'gray'}}>Заявок нет</Text>}
            renderItem={({item}) => (
                <TouchableOpacity onPress={() => router.push({ pathname: '/(admin)/review', params: { id: item.id } })}>
                    <ListItem bottomDivider>
                        <Avatar rounded source={{uri: item.avatar_url}} icon={{name:'user', type:'feather'}} containerStyle={{backgroundColor:'#ccc'}} />
                        <ListItem.Content>
                            <ListItem.Title style={{fontWeight:'bold'}}>{item.full_name}</ListItem.Title>
                            <ListItem.Subtitle>{item.car_model} • {item.car_number}</ListItem.Subtitle>
                        </ListItem.Content>
                        <Icon name="chevron-right" type="feather" />
                    </ListItem>
                </TouchableOpacity>
            )}
          />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: 'white' }
});