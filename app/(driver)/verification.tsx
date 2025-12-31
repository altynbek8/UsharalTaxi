import { Button, Icon, Text, useTheme } from '@rneui/themed';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { uploadImage } from '../../lib/uploader'; // Наш загрузчик
import { useAuth } from '../../providers/AuthProvider';

export default function DriverVerificationScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('new');
  
  // Ссылки на фото
  const [docs, setDocs] = useState({
      license_front: null,
      license_back: null,
      tech_passport: null,
      car_photo: null
  });

  useFocusEffect(useCallback(() => {
      checkStatus();
  }, []));

  async function checkStatus() {
      const { data } = await supabase.from('profiles').select('verification_status, documents').eq('id', user?.id).single();
      if (data) {
          setStatus(data.verification_status);
          if (data.documents) setDocs({...docs, ...data.documents});
      }
  }

  const pickImage = async (type: string) => {
      if (status === 'pending' || status === 'verified') return;

      const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          
          // --- ДОБАВЛЕНЫ ЭТИ ДВЕ СТРОКИ ---
          allowsEditing: true, // Включает редактор и КОНВЕРТИРУЕТ В JPG
          quality: 0.8,        // Хорошее качество
          // --------------------------------
      });

      if (!result.canceled) {
          setLoading(true);
          try {
              const url = await uploadImage(result.assets[0].uri);
              setDocs(prev => ({ ...prev, [type]: url }));
          } catch (e: any) {
              Alert.alert('Ошибка', e.message);
          } finally {
              setLoading(false);
          }
      }
  };

  const submitForReview = async () => {
      if (!docs.license_front || !docs.tech_passport || !docs.car_photo) {
          return Alert.alert('Ошибка', 'Загрузите все обязательные фото');
      }

      setLoading(true);

      
      const { error } = await supabase.from('profiles').update({
          documents: docs,
          verification_status: 'pending' // Отправляем на проверку
      }).eq('id', user?.id);

      setLoading(false);
      
      if (error) Alert.alert('Ошибка', error.message);
      else {
          setStatus('pending');
          Alert.alert('Отправлено!', 'Администратор проверит ваши документы в ближайшее время.');
          router.replace('/(driver)/home');
      }
  };

  // Компонент для одной кнопки фото
  const DocButton = ({ title, type, image }: any) => (
      <View style={styles.docContainer}>
          <Text style={styles.docTitle}>{title}</Text>
          <TouchableOpacity onPress={() => pickImage(type)} style={styles.uploadBox}>
              {image ? (
                  <Image source={{ uri: image }} style={{ width: '100%', height: '100%', borderRadius: 10 }} />
              ) : (
                  <View style={{alignItems:'center'}}>
                      <Icon name="camera" type="feather" size={30} color="gray" />
                      <Text style={{color:'gray', marginTop:5}}>Загрузить фото</Text>
                  </View>
              )}
          </TouchableOpacity>
      </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text h3 style={{textAlign:'center', marginBottom: 10}}>Верификация</Text>
      
      {status === 'verified' && (
          <View style={[styles.statusBox, {backgroundColor: '#E8F5E9'}]}>
              <Icon name="check-circle" type="feather" color="green" size={30} />
              <Text style={{color:'green', fontWeight:'bold', marginLeft: 10}}>Вы верифицированы!</Text>
          </View>
      )}

      {status === 'pending' && (
          <View style={[styles.statusBox, {backgroundColor: '#FFF3E0'}]}>
              <Icon name="clock" type="feather" color="orange" size={30} />
              <Text style={{color:'#E65100', fontWeight:'bold', marginLeft: 10}}>Документы на проверке...</Text>
          </View>
      )}

      {(status === 'new' || status === 'rejected') && (
          <>
            <Text style={{textAlign:'center', color:'gray', marginBottom: 20}}>
                Загрузите фото документов, чтобы начать таксовать.
            </Text>
            
            <DocButton title="Водительские права (Лицевая)" type="license_front" image={docs.license_front} />
            <DocButton title="Водительские права (Обратная)" type="license_back" image={docs.license_back} />
            <DocButton title="Техпаспорт" type="tech_passport" image={docs.tech_passport} />
            <DocButton title="Фото автомобиля (Спереди + Номер)" type="car_photo" image={docs.car_photo} />

            <Button 
                title="Отправить на проверку" 
                onPress={submitForReview} 
                loading={loading}
                buttonStyle={{backgroundColor: '#FFC107', borderRadius: 10, marginTop: 20}}
                titleStyle={{color: 'black', fontWeight: 'bold'}}
            />
          </>
      )}
      
      <Button title="Назад" type="clear" onPress={() => router.back()} containerStyle={{marginTop: 10}} />
      <View style={{height: 50}}/>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 40, backgroundColor: 'white' },
  statusBox: { flexDirection:'row', alignItems:'center', padding: 15, borderRadius: 10, marginBottom: 20 },
  docContainer: { marginBottom: 20 },
  docTitle: { fontWeight: 'bold', marginBottom: 10 },
  uploadBox: { 
      height: 150, 
      backgroundColor: '#f5f5f5', 
      borderRadius: 10, 
      borderWidth: 1, 
      borderColor: '#ddd', 
      borderStyle: 'dashed',
      justifyContent: 'center', 
      alignItems: 'center' 
  }
});