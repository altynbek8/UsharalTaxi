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
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
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
              const publicUrl = await uploadImage(uri, 'avatars');
              
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
      Alert.alert("Выход", "Вы уверены?", [
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

  if (loading) return <ActivityIndicator size="large" color="#FFC107" style={{marginTop: 50}} />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      
      <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{padding: 10}}>
              <Icon name="arrow-left" type="feather" size={24} />
          </TouchableOpacity>
          <Text h3 style={{flex: 1, textAlign: 'center', marginRight: 40}}>Профиль</Text>
      </View>

      {/* ВОТ ТУТ ИСПРАВЛЕН ОТСТУП СНИЗУ (paddingBottom: 150) */}
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 150 }}>

        <View style={{alignItems: 'center', marginBottom: 30}}>
            <TouchableOpacity onPress={pickImage} disabled={uploading}>
                <Avatar 
                    size={110} 
                    rounded 
                    source={avatarUrl ? { uri: avatarUrl } : undefined} 
                    icon={avatarUrl ? undefined : { name: 'user', type: 'feather', color: 'gray' }}
                    containerStyle={{ backgroundColor: '#e1e1e1', borderWidth: 2, borderColor: '#FFC107' }}
                    imageProps={{ resizeMode: 'cover' }}
                >
                    <Avatar.Accessory 
                        size={30} 
                        style={{backgroundColor: '#333'}} 
                        color="white" 
                        onPress={pickImage} 
                    />
                </Avatar>
            </TouchableOpacity>
            {uploading && <ActivityIndicator size="small" color="black" style={{marginTop: 10}} />}
        </View>

        <View style={styles.section}>
            <Text h4 style={styles.label}>Личные данные</Text>
            <Input 
                label="Имя Фамилия" 
                value={fullName} 
                onChangeText={setFullName} 
                leftIcon={{name:'user', type:'feather', color:'gray'}}
            />
            <Input 
                label="Телефон" 
                value={phone} 
                onChangeText={setPhone} 
                keyboardType="phone-pad" 
                disabled={true}
                leftIcon={{name:'phone', type:'feather', color:'gray'}}
            />
        </View>

        {role === 'driver' && (
            <View style={styles.section}>
                <Text h4 style={styles.label}>Мой автомобиль 🚖</Text>
                <Input label="Марка" value={carModel} onChangeText={setCarModel} />
                <Input label="Госномер" value={carNumber} onChangeText={setCarNumber} />
                <Input label="Цвет" value={carColor} onChangeText={setCarColor} />
            </View>
        )}

        <Button 
            title="СОХРАНИТЬ ИЗМЕНЕНИЯ" 
            onPress={saveProfile} 
            loading={saving} 
            buttonStyle={{ backgroundColor: '#FFC107', borderRadius: 10, marginBottom: 15, height: 55 }}
            titleStyle={{ color: 'black', fontWeight: 'bold' }}
        />

        <Button 
            title="Выйти из аккаунта" 
            onPress={handleLogout} 
            type="outline" 
            buttonStyle={{ borderColor: '#ff4d4d', borderRadius: 10, height: 50, marginTop: 20 }} 
            titleStyle={{ color: '#ff4d4d' }}
            icon={{name:'log-out', type:'feather', color:'#ff4d4d', style:{marginRight:10}}}
        />
        
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  section: { marginBottom: 20, backgroundColor: '#f9f9f9', padding: 15, borderRadius: 15 },
  label: { marginBottom: 15, marginLeft: 10, fontSize: 18 }
});