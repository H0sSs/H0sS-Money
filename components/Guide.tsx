import { Text } from "@/components/Typography";
import React from 'react';
import { Modal, View, Pressable, Alert } from "react-native";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/db';
import { updateSetting } from '@/lib/services';
import { useTheme } from '@/contexts/ThemeContext';
export default function Guide(){
 const {colors:c}=useTheme();const client=useQueryClient();
 const {data:seen,isSuccess}=useQuery({queryKey:['guide-seen'],queryFn:async()=>!!await db.getFirstAsync("SELECT key FROM settings WHERE key='guideSeen'")});
 async function close(){try{await updateSetting('guideSeen','true');client.invalidateQueries({queryKey:['guide-seen']});}catch{Alert.alert('تعذر الحفظ','حاول مرة أخرى');}}
 return <Modal visible={isSuccess&&!seen} transparent animationType="fade" onRequestClose={close}><View style={{flex:1,justifyContent:'center',padding:24,backgroundColor:'#00000080'}}><View style={{padding:24,borderRadius:24,backgroundColor:c.surface,gap:20}}><Text style={{color:c.text,fontFamily:'ArabicBold',fontSize:24,textAlign:'right'}}>أهلًا بمحفظتك</Text>{['سجّل المصروف يدويًا، أو بالصوت بعد إعداد مفتاح AI.','يمكنك قول عدة أصناف؛ راجع مبلغ وفئة وتاريخ وحساب كل صنف قبل حفظ القائمة.','تابع المصاريف والإحصائيات؛ الدخل والديون والحسابات من الإعدادات.','جهّز نسخة احتياطية دوريًا لحماية بياناتك المحلية.'].map((t,i)=><Text key={i} style={{color:c.textSecondary,fontFamily:'ArabicRegular',lineHeight:26,textAlign:'right'}}>{i+1}. {t}</Text>)}<Pressable onPress={close} style={{padding:14,borderRadius:14,backgroundColor:c.primary}}><Text style={{color:c.buttonText,textAlign:'center',fontFamily:'ArabicBold'}}>ابدأ الاستخدام</Text></Pressable><Pressable onPress={close} style={{padding:10}}><Text style={{color:c.textSecondary,textAlign:'center',fontFamily:'ArabicRegular'}}>تخطي</Text></Pressable></View></View></Modal>;
}
