import { Icon, Input, Text, useTheme } from '@rneui/themed';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';

export default function OrderChatScreen() {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams(); 
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchMessages();

    const channel = supabase.channel(`chat_${id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'order_messages', 
          filter: `order_id=eq.${id}` 
      }, (payload) => {
          setMessages(prev => [...prev, payload.new]);
          setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]); // ДОБАВЛЕН ID В ЗАВИСИМОСТИ

  async function fetchMessages() {
    const { data } = await supabase
        .from('order_messages')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true });
    
    if (data) setMessages(data);
  }

  async function sendMessage() {
    if (!text.trim()) return;
    const content = text.trim();
    setText('');

    await supabase.from('order_messages').insert({
        order_id: id,
        sender_id: user?.id,
        content: content
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
              <Icon name="arrow-left" type="feather" size={24} />
          </TouchableOpacity>
          <Text h4 style={{marginLeft: 15}}>Чат по заказу</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={{ padding: 15 }}
        renderItem={({ item }) => {
            const isMine = item.sender_id === user?.id;
            return (
                <View style={[
                    styles.bubble, 
                    isMine ? { alignSelf: 'flex-end', backgroundColor: '#FFC107' } : { alignSelf: 'flex-start', backgroundColor: '#e1e1e1' }
                ]}>
                    <Text style={{color: 'black'}}>{item.content}</Text>
                </View>
            );
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={10}>
          <View style={styles.inputRow}>
              <Input 
                placeholder="Сообщение..."
                value={text}
                onChangeText={setText}
                containerStyle={{flex: 1}}
                inputContainerStyle={{borderBottomWidth: 0, backgroundColor: '#f2f2f2', borderRadius: 20, paddingHorizontal: 15, height: 45}}
              />
              <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
                  <Icon name="send" type="feather" color="white" size={20} />
              </TouchableOpacity>
          </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 10 },
  bubble: { padding: 10, borderRadius: 15, marginBottom: 10, maxWidth: '80%' },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, borderColor: '#eee' },
  sendBtn: { backgroundColor: 'black', width: 45, height: 45, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginLeft: 5, marginBottom: 20 }
});