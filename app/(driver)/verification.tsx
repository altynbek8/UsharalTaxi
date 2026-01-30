import { Button, Icon, Text, useTheme } from '@rneui/themed';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { uploadImage } from '../../lib/uploader';
import { useAuth } from '../../providers/AuthProvider';

export default function DriverVerificationScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('new');
  
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
      // Если уже на проверке или одобрено - запрещаем менять фото
      if (status === 'pending' || status === 'verified') return;

      const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.7,
      });

      if (!result.canceled) {
          setLoading(true);
          try {
              // Грузим в бакет документов
              const url = await uploadImage(result.assets[0].uri, 'documents');
              setDocs(prev => ({ ...prev, [type]: url }));
          } catch (e: any) {
              Alert.alert('Ошибка', e.message);
          } finally {
              setLoading(false);
          }
      }
  };

  const submitForReview = async () => {
      if (!docs.license_front || !docs.license_back || !docs.tech_passport || !docs.car_photo) {
          return Alert.alert('Ошибка', 'Пожалуйста, загрузите все 4 фотографии документов');
      }

      setLoading(true);
      const { error } = await supabase.from('profiles').update({
          documents: docs,
          verification_status: 'pending' // Ставим статус "на проверке"
      }).eq('id', user?.id);

      setLoading(false);
      
      if (error) {
          Alert.alert('Ошибка', error.message);
      } else {
          setStatus('pending'); // Мгновенно обновляем экран
          Alert.alert('Успешно', 'Документы отправлены!');
      }
  };

  const DocButton = ({ title, type, image }: any) => (
      <View style={styles.docContainer}>
          <Text style={styles.docTitle}>{title}</Text>
          <TouchableOpacity onPress={() => pickImage(type)} style={styles.uploadBox} disabled={loading}>
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
      
      {/* --- ЭКРАН ОЖИДАНИЯ (ЕСЛИ СТАТУС PENDING) --- */}
      {status === 'pending' && (
          <View style={styles.centeredView}>
              <Icon name="clock" type="feather" color="#FFC107" size={80} />
              <Text h3 style={{textAlign:'center', marginTop: 20}}>Документы на проверке</Text>
              
              <Text style={styles.waitText}>
                  Мы получили ваши фото.{"\n"}
                  Пожалуйста, ждите несколько часов, пока администратор их проверит.
              </Text>
              
              <Button 
                title="Вернуться на главную" 
                onPress={() => router.replace('/(driver)/home')}
                buttonStyle={{backgroundColor: '#333', borderRadius: 10, paddingHorizontal: 30}}
                containerStyle={{marginTop: 30}}
              />
          </View>
      )}

      {/* --- ЭКРАН УСПЕХА (ЕСЛИ СТАТУС VERIFIED) --- */}
      {status === 'verified' && (
          <View style={styles.centeredView}>
              <Icon name="check-circle" type="feather" color="green" size={80} />
              <Text h3 style={{textAlign:'center', marginTop: 20, color: 'green'}}>Вы верифицированы!</Text>
              <Text style={{textAlign:'center', color:'gray', marginTop: 10, fontSize: 16}}>
                  Теперь вы можете выходить на линию и принимать заказы.
              </Text>
              <Button 
                title="Начать работу" 
                onPress={() => router.replace('/(driver)/home')}
                buttonStyle={{backgroundColor: '#4CAF50', borderRadius: 10, paddingHorizontal: 30}}
                containerStyle={{marginTop: 30}}
              />
          </View>
      )}

      {/* --- ЭКРАН ЗАГРУЗКИ (ТОЛЬКО ЕСЛИ NEW ИЛИ REJECTED) --- */}
      {(status === 'new' || status === 'rejected') && (
          <>
            <Text h3 style={{textAlign:'center', marginBottom: 10}}>Верификация</Text>
            
            {status === 'rejected' && (
                <Text style={{color: 'red', textAlign: 'center', marginBottom: 10, fontWeight: 'bold'}}>
                    Ваша заявка была отклонена. Пожалуйста, переснимите документы четче.
                </Text>
            )}

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
                disabled={loading}
                buttonStyle={{backgroundColor: '#FFC107', borderRadius: 10, marginTop: 20}}
                titleStyle={{color: 'black', fontWeight: 'bold'}}
            />
            
            <Button title="Назад" type="clear" onPress={() => router.back()} containerStyle={{marginTop: 10}} />
          </>
      )}
      
      <View style={{height: 50}}/>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 40, backgroundColor: 'white', flexGrow: 1 },
  docContainer: { marginBottom: 20 },
  docTitle: { fontWeight: 'bold', marginBottom: 10 },
  uploadBox: { height: 150, backgroundColor: '#f5f5f5', borderRadius: 10, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  waitText: { textAlign: 'center', color: 'gray', marginTop: 15, fontSize: 16, lineHeight: 24, paddingHorizontal: 20 }
});
