import React from 'react';
import {View,ActivityIndicator,Pressable} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {Text} from './Typography';
import Svg,{Path,Circle} from 'react-native-svg';
import {STARTUP_BACKGROUND} from '@/lib/startup';
export default function StartupScreen({message,error,onRetry,onLayout}:{message?:string;error?:boolean;onRetry?:()=>void;onLayout?:()=>void}) {
  return <View onLayout={onLayout} style={{flex:1,backgroundColor:STARTUP_BACKGROUND,alignItems:'center',justifyContent:'center'}}>
    <StatusBar style="light"/>
    <Svg width={288} height={288} viewBox="0 0 288 288" accessibilityLabel="شعار H0sS-Money">
      <Path d="M192 101V86a16 16 0 0 0-16-16H96a20 20 0 0 0-20 20v108a20 20 0 0 0 20 20h80a16 16 0 0 0 16-16v-15M96 90h92a16 16 0 0 1 16 16v19m0 48v25M182 125h28v48h-28a24 24 0 0 1 0-48Z" fill="none" stroke="#65E0CE" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M109 114v58m38-58v58m-38-29h38" fill="none" stroke="#F5FAF9" strokeWidth={9} strokeLinecap="round"/><Circle cx={183} cy={149} r={4} fill="#65E0CE"/>
    </Svg>
    <View style={{position:'absolute',top:'72%',left:24,right:24,alignItems:'center',gap:14}}>
      {message && <Text style={{color:'#DBEEEC',fontSize:15,textAlign:'center',lineHeight:24}}>{message}</Text>}
      {error ? <Pressable onPress={onRetry} accessibilityRole="button" style={{backgroundColor:'#65E0CE',paddingHorizontal:24,paddingVertical:12,borderRadius:14}}><Text style={{fontFamily:'ArabicBold',color:STARTUP_BACKGROUND}}>إعادة المحاولة</Text></Pressable> : <ActivityIndicator color="#65E0CE" size="small"/>}
    </View>
  </View>;
}
