import React from 'react';
import { View, Text, Switch, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/db';
import { updateSetting } from '@/lib/services';
import { requestNotificationPermission } from '@/lib/notifications';
import { useTheme } from '@/contexts/ThemeContext';
export default function BackupStatus(){
 const {colors:c}=useTheme();const client=useQueryClient();
 const {data:rows=[]}=useQuery({queryKey:['backup-status'],queryFn:()=>db.getAllAsync<{key:string;value:string}>("SELECT key,value FROM settings WHERE key IN ('localLastBackupAt','driveLastBackupAt','backupReminder')")});
 const value=(k:string)=>rows.find(x=>x.key===k)?.value;const stamp=(k:string)=>value(k)?new Date(Number(value(k))).toLocaleString('ar-EG'):'لم تُجهّز بعد';
 async function toggle(enabled:boolean){try{
  if(enabled&&!await requestNotificationPermission())throw Error('فعّل إذن الإشعارات أولًا');
  await Notifications.cancelScheduledNotificationAsync('backup-weekly').catch(()=>{});
  if(enabled)await Notifications.scheduleNotificationAsync({identifier:'backup-weekly',content:{title:'احمِ بيانات محفظتك',body:'جهّز نسخة احتياطية من الإعدادات ← النسخ والبيانات.'},trigger:{type:Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds:7*86400,repeats:true}});
  await updateSetting('backupReminder',String(enabled));client.invalidateQueries({queryKey:['backup-status']});
 }catch(e){Alert.alert('تعذر ضبط التذكير',e instanceof Error?e.message:'حاول مرة أخرى');}}
 return <View style={{margin:16,padding:16,borderWidth:1,borderColor:c.border,borderRadius:18,backgroundColor:c.surface,gap:12}}><Text style={{color:c.text,fontFamily:'ArabicBold',textAlign:'right'}}>حالة النسخ الاحتياطية</Text><Text style={{color:c.textSecondary,fontFamily:'ArabicRegular',textAlign:'right'}}>آخر تجهيز محلي: {stamp('localLastBackupAt')}</Text><Text style={{color:c.textSecondary,fontFamily:'ArabicRegular',textAlign:'right'}}>آخر رفع إلى Drive: {stamp('driveLastBackupAt')}</Text><Text style={{color:c.textSecondary,fontFamily:'ArabicRegular',fontSize:12,textAlign:'right'}}>تجهيز الملف لا يؤكد حفظه خارج التطبيق؛ اختر مكانًا آمنًا من نافذة المشاركة.</Text><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Switch value={value('backupReminder')==='true'} onValueChange={toggle}/><Text style={{color:c.text,fontFamily:'ArabicRegular'}}>تذكير أسبوعي بالنسخ</Text></View></View>;
}
