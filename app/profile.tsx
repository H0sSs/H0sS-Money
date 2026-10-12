import React from 'react';
import {ScrollView,Pressable} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {useTheme} from '@/contexts/ThemeContext';
import PageHeader from '@/components/PageHeader';
import ProfileSettings from '@/components/ProfileSettings';
import Icon from '@/components/Icon';
export default function ProfilePage(){const {colors:c}=useTheme(),insets=useSafeAreaInsets(),router=useRouter();return <ScrollView style={{flex:1,backgroundColor:c.background}} contentContainerStyle={{paddingTop:insets.top,paddingBottom:insets.bottom+24}}><PageHeader title="الملف الشخصي" subtitle="اسمك وبياناتك وصورتك" icon="user" actions={<Pressable onPress={()=>router.back()} style={{padding:12}}><Icon name="arrow-left" color={c.text} size={22}/></Pressable>}/><ProfileSettings/></ScrollView>;}
