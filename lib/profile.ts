import {db} from './db';
export type Profile={name:string;phone:string;email:string;details:string;photo:string;showInReports:boolean};
export const emptyProfile:Profile={name:'',phone:'',email:'',details:'',photo:'',showInReports:false};
export function validateProfile(p:Profile){
 for(const k of ['name','phone','email','details'] as const)if(typeof p[k]!=='string'||p[k].length>(k==='details'?1000:200))throw Error('بيانات الملف الشخصي أطول من الحد المسموح');
 if(typeof p.photo!=='string'||p.photo.length>3*1024*1024||(p.photo&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.photo)))throw Error('الصورة غير صالحة أو كبيرة جدًا');
 if(typeof p.showInReports!=='boolean')throw Error('اختيار ظهور الملف غير صالح');
 return p;
}
export async function getProfile():Promise<Profile>{const r=await db.getFirstAsync<{value:string}>("SELECT value FROM settings WHERE key='personalProfile'");return r?validateProfile(JSON.parse(r.value)):{...emptyProfile};}
export async function saveProfile(p:Profile){validateProfile(p);await db.runAsync("INSERT OR REPLACE INTO settings(key,value) VALUES('personalProfile',?)",[JSON.stringify(p)]);}
