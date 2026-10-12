import React from 'react';
import {View,Image,ActivityIndicator,Pressable} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {Text} from './Typography';
import {STARTUP_BACKGROUND} from '@/lib/startup';
export default function StartupScreen({message,error,onRetry,onLayout}:{message?:string;error?:boolean;onRetry?:()=>void;onLayout?:()=>void}) {
  return <View onLayout={onLayout} style={{flex:1,backgroundColor:STARTUP_BACKGROUND,alignItems:'center',justifyContent:'center'}}>
    <StatusBar style="light"/>
    <Image source={require('../assets/images/splash-icon.png')} resizeMode="contain" style={{width:288,height:288}} accessibilityLabel="شعار H0sS-Money"/>
    <View style={{position:'absolute',top:'72%',left:24,right:24,alignItems:'center',gap:14}}>
      {message && <Text style={{color:'#DBEEEC',fontSize:15,textAlign:'center',lineHeight:24}}>{message}</Text>}
      {error ? <Pressable onPress={onRetry} accessibilityRole="button" style={{backgroundColor:'#65E0CE',paddingHorizontal:24,paddingVertical:12,borderRadius:14}}><Text style={{fontFamily:'ArabicBold',color:STARTUP_BACKGROUND}}>إعادة المحاولة</Text></Pressable> : <ActivityIndicator color="#65E0CE" size="small"/>}
    </View>
  </View>;
}
