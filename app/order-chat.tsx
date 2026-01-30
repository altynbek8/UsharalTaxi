import { Icon, Input, Text, useTheme } from '@rneui/themed';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
    ActivityIndicator
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';

export default function OrderChatScreen() {
  const { id } = useLocalSearchParams(); // ID заказа
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchMessages();

    // Подписка на новые сообщения
    const channel = supabase.channel(`chat_${id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'order_messages', 
          filter: `order_id=eq.${id}` 
      }, (payload) => {
          // Когда приходит новое сообщение -> добавляем его в список
          setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Прокрутка вниз при добавлении сообщений
  useEffect(() => {
      setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
  }, [messages]);

  async function fetchMessages() {
    const { data } = await supabase
        .from('order_messages')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true });
    
    if (data) setMessages(data);
    setLoading(false);
  }

  async function sendMessage() {
    if (!text.trim()) return;
    const content = text.trim();
    setText(''); // Очищаем поле сразу

    const { error } = await supabase.from('order_messages').insert({
        order_id: id,
        sender_id: user?.id,
        content: content
    });

    if (error) console.log("Ошибка отправки:", error);
  }

  const renderItem = ({ item }: { item: any }) => {
      const isMine = item.sender_id === user?.id;
      const time = new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

      return (
        <View style={[
            styles.bubble, 
            isMine ? styles.bubbleMine : styles.bubbleOther
        ]}>
            <Text style={{color: 'black', fontSize: 16}}>{item.content}</Text>
            <Text style={{color: isMine ? '#555' : 'gray', fontSize: 10, alignSelf: 'flex-end', marginTop: 5}}>
                {time}
            </Text>
        </View>
      );
  };

  return (
    <View style={styles.container}>
      {/* Шапка */}
      <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{padding: 5}}>
              <Icon name="arrow-left" type="feather" size={24} />
          </TouchableOpacity>
          <Text h4 style={{marginLeft: 15, fontSize: 18}}>Чат заказа #{id}</Text>
      </View>

      {loading ? (
          <ActivityIndicator style={{marginTop: 50}} color="#FFC107" />
      ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
            renderItem={renderItem}
            ListEmptyComponent={
                <Text style={{textAlign:'center', color:'gray', marginTop: 50}}>
                    Напишите первое сообщение...
                </Text>
            }
          />
      )}

      {/* Поле ввода */}
      <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
          <View style={styles.inputRow}>
              <Input 
                placeholder="Сообщение..."
                value={text}
                onChangeText={setText}
                containerStyle={{flex: 1}}
                inputContainerStyle={styles.inputField}
                renderErrorMessage={false}
              />
              <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
                  <Icon name="send" type="feather" color="black" size={20} />
              </TouchableOpacity>
          </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', paddingTop: 40 },
  header: { 
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, 
      borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 10, height: 50 
  },
  bubble: { padding: 10, borderRadius: 15, marginBottom: 10, maxWidth: '80%' },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#FFC107', borderBottomRightRadius: 0 },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#f0f0f0', borderBottomLeftRadius: 0 },
  
  inputRow: { 
      flexDirection: 'row', alignItems: 'center', padding: 10, 
      borderTopWidth: 1, borderColor: '#eee', backgroundColor: 'white' 
  },
  inputField: { 
      borderBottomWidth: 0, backgroundColor: '#f5f5f5', 
      borderRadius: 20, paddingHorizontal: 15, height: 45 
  },
  sendBtn: { 
      backgroundColor: '#FFC107', width: 45, height: 45, borderRadius: 25, 
      justifyContent: 'center', alignItems: 'center', marginLeft: 10 
  }
});
