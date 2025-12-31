import { Avatar, Button, Icon, Input, Text, useTheme } from '@rneui/themed';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { supabase } from '../lib/supabase';
import { uploadImage } from '../lib/uploader';
import { useAuth } from '../providers/AuthProvider';

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { user, role } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Данные профиля
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false); // <--- Флаг админа
  
  // Данные водителя
  const [carModel, setCarModel] = useState('');
  const [carNumber, setCarNumber] = useState('');
  const [carColor, setCarColor] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
      if (error) throw error;
      
      setFullName(data.full_name || '');
      setPhone(data.phone || '');
      setAvatarUrl(data.avatar_url);
      setIsAdmin(data.is_admin); // <--- Проверяем, админ ли это
      
      if (data.role === 'driver') {
          setCarModel(data.car_model || '');
          setCarNumber(data.car_number || '');
          setCarColor(data.car_color || '');
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  }
  // ... другие функции ...

  async function deleteAccount() {
      Alert.alert(
          "Удаление аккаунта",
          "Вы уверены? Это действие нельзя отменить. Все ваши данные и история поездок будут удалены.",
          [
              { text: "Отмена", style: "cancel" },
              { 
                  text: "Удалить навсегда", 
                  style: "destructive", 
                  onPress: async () => {
                      setLoading(true);
                      // Вызываем нашу SQL функцию
                      const { error } = await supabase.rpc('delete_my_account');
                      
                      if (error) {
                          Alert.alert("Ошибка", error.message);
                          setLoading(false);
                      } else {
                          // Разлогиниваем на клиенте
                          await supabase.auth.signOut();
                          router.replace('/(auth)/login');
                      }
                  }
              }
          ]
      );
  }

  async function pickImage() {
      const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
      });

      if (!result.canceled) {
          try {
              setUploading(true);
              const uri = result.assets[0].uri;
              const publicUrl = await uploadImage(uri);
              
              const { error } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user?.id);
              if (error) throw error;

              setAvatarUrl(publicUrl);
              Alert.alert("Фото обновлено!");
          } catch (e: any) {
              Alert.alert("Ошибка загрузки", e.message);
          } finally {
              setUploading(false);
          }
      }
  }

  async function saveProfile() {
    setSaving(true);
    try {
        const updates: any = {
            full_name: fullName,
            phone: phone,
        };

        if (role === 'driver') {
            updates.car_model = carModel;
            updates.car_number = carNumber;
            updates.car_color = carColor;
        }

        const { error } = await supabase.from('profiles').update(updates).eq('id', user?.id);
        if (error) throw error;

        Alert.alert('Успех', 'Данные сохранены!');
    } catch (e: any) {
        Alert.alert('Ошибка', e.message);
    } finally {
        setSaving(false);
    }
  }

  async function handleLogout() {
      await supabase.auth.signOut();
      router.replace('/(auth)/login');
  }

  if (loading) return <ActivityIndicator size="large" color="#FFC107" style={{marginTop: 50}} />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text h2 style={{ textAlign: 'center', marginBottom: 20 }}>Профиль</Text>

        {/* Аватарка */}
        <View style={{alignItems: 'center', marginBottom: 20}}>
            <TouchableOpacity onPress={pickImage} disabled={uploading}>
                <Avatar 
                    size={100} 
                    rounded 
                    source={avatarUrl ? { uri: avatarUrl } : undefined} 
                    
                    // ИСПРАВЛЕНИЕ 1: Если есть фото, иконку делаем undefined (скрываем)
                    icon={avatarUrl ? undefined : { name: 'user', type: 'feather', color: 'gray' }}
                    
                    containerStyle={{ backgroundColor: '#e1e1e1' }}
                    
                    // ИСПРАВЛЕНИЕ 2: Растягиваем фото на весь круг (cover)
                    imageProps={{ resizeMode: 'cover' }}
                >
                    <Avatar.Accessory 
                        size={30} 
                        style={{backgroundColor: '#FFC107'}} 
                        color="black" 
                        onPress={pickImage} 
                    />
                </Avatar>
            </TouchableOpacity>
            {uploading && <Text style={{marginTop: 5, color: 'gray'}}>Загрузка...</Text>}
        </View>

        <View style={styles.section}>
            <Text h4 style={styles.label}>Личные данные</Text>
            <Input label="Имя" value={fullName} onChangeText={setFullName} />
            <Input label="Телефон" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+7 700 000 00 00" />
        </View>

        {role === 'driver' && (
            <View style={styles.section}>
                <Text h4 style={styles.label}>Автомобиль 🚖</Text>
                <Input label="Марка" value={carModel} onChangeText={setCarModel} placeholder="Toyota Camry" />
                <Input label="Госномер" value={carNumber} onChangeText={setCarNumber} placeholder="777 AAA 02" />
                <Input label="Цвет" value={carColor} onChangeText={setCarColor} placeholder="Белый" />
            </View>
        )}

        <Button 
            title="Сохранить изменения" 
            onPress={saveProfile} 
            loading={saving} 
            buttonStyle={{ backgroundColor: 'black', borderRadius: 10, marginBottom: 15, height: 50 }}
            titleStyle={{ color: 'white', fontWeight: 'bold' }}
        />

        {/* --- КНОПКА АДМИНА (Видна только админам) --- */}
        {isAdmin && (
            <Button 
                title="Панель Администратора" 
                type="outline"
                icon={<Icon name="shield" type="feather" color="#2089dc" style={{marginRight: 10}} />}
                onPress={() => router.push('/(admin)/dashboard')}
                buttonStyle={{ borderColor: '#2089dc', borderRadius: 10, marginBottom: 15, height: 50 }}
                titleStyle={{ color: '#2089dc' }}
            />
        )}
         <TouchableOpacity 
            onPress={deleteAccount} 
            style={{marginTop: 30, marginBottom: 10, alignItems: 'center'}}
        >
            <Text style={{color: 'gray', fontSize: 12}}>Удалить аккаунт и данные</Text>
        </TouchableOpacity>

        <Button 
            title="Выйти из аккаунта" 
            onPress={handleLogout} 
            type="outline" 
            buttonStyle={{ borderColor: 'red', borderRadius: 10, height: 50 }} 
            titleStyle={{ color: 'red' }}
        />
        
        <Button 
            title="Назад" 
            type="clear" 
            onPress={() => router.back()} 
            containerStyle={{ marginTop: 10 }}
        />
        <View style={{height: 50}} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', paddingTop: 40 },
  section: { marginBottom: 10 },
  label: { marginBottom: 10, marginLeft: 10, fontSize: 16 }
});