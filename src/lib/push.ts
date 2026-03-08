import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Настройка поведения: показывать уведомление, даже если приложение открыто
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 1. ФУНКЦИЯ РЕГИСТРАЦИИ (Узнаем токен и сохраняем в базу)
export async function registerForPushNotificationsAsync(userId: string) {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Не дали разрешение на пуши!');
      return;
    }

    // Получаем токен
    // Получаем Project ID из конфига
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

    if (!projectId) {
        console.log('❌ Ошибка: Project ID не найден. Запустите "npx eas init"');
        return;
    }

    // Получаем токен, явно передавая ID
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log("🔥 Мой Пуш-Токен:", token);

    // Сохраняем в Supabase
    if (userId && token) {
        const { error } = await supabase
            .from('profiles')
            .update({ push_token: token })
            .eq('id', userId);
            
        if (error) console.log("Ошибка сохранения токена:", error.message);
    }
  } else {
    console.log('Пуши не работают на симуляторе, нужен реальный телефон');
  }
}

// 2. ФУНКЦИЯ ОТПРАВКИ (Шлем уведомление на чужой токен)
export async function sendPush(targetUserId: string, title: string, body: string) {
    try {
        // 1. Узнаем токен получателя из базы
        const { data } = await supabase
            .from('profiles')
            .select('push_token')
            .eq('id', targetUserId)
            .single();

        if (!data?.push_token) {
            console.log("У пользователя нет токена :(");
            return;
        }

        // 2. Отправляем через сервера Expo
        const message = {
            to: data.push_token,
            sound: 'default',
            title: title,
            body: body,
            data: { someData: 'goes here' },
        };

        await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });
        
        console.log("🚀 Пуш отправлен!");

    } catch (error) {
        console.log("Ошибка отправки пуша:", error);
    }
}