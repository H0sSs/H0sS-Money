"""Update just versionName/versionCode in Android binary XML, preserving pool layout."""
import struct

def patch_manifest(data,old_version,new_version,old_code,new_code):
 raw=bytearray(data)
 u16=lambda p:struct.unpack_from('<H',raw,p)[0]
 u32=lambda p:struct.unpack_from('<I',raw,p)[0]
 assert u16(0)==3 and u32(4)==len(raw),'Not binary XML'
 strings=[];offsets=[];utf8=False;string_base=0;version_changed=False;code_changed=False
 def length(p,byte):
  n=raw[p] if byte else u16(p);high=0x80 if byte else 0x8000;step=1 if byte else 2
  if n&high:return ((n&(high-1))<<(7 if byte else 15))|(raw[p+step] if byte else u16(p+step)),p+2*step
  return n,p+step
 p=u16(2)
 while p<len(raw):
  kind,header,size=u16(p),u16(p+2),u32(p+4);assert size>=header and p+size<=len(raw)
  if kind==1:
   count=u32(p+8);utf8=bool(u32(p+16)&0x100);string_base=p+u32(p+20)
   for i in range(count):
    loc=string_base+u32(p+header+4*i);n,start=length(loc,utf8)
    if utf8:n,start=length(start,True)
    end=start+n*(1 if utf8 else 2);strings.append(bytes(raw[start:end]).decode('utf-8' if utf8 else 'utf-16-le'));offsets.append((start,end))
  elif kind==0x102:
   ext=p+header;tag=u32(ext+4)
   if strings[tag]=='manifest':
    attr_start=u16(ext+8);attr_size=u16(ext+10);count=u16(ext+12)
    for i in range(count):
     a=ext+attr_start+i*attr_size;name=strings[u32(a+4)]
     if name=='versionName':
      index=u32(a+16);assert raw[a+15]==3 and strings[index]==old_version
      start,end=offsets[index];payload=new_version.encode('utf-8' if utf8 else 'utf-16-le');assert len(payload)==end-start,'Version length must match'
      raw[start:end]=payload;version_changed=True
     elif name=='versionCode':
      assert raw[a+15] in (0x10,0x11) and u32(a+16)==old_code
      struct.pack_into('<I',raw,a+16,new_code);code_changed=True
  p+=size
 assert version_changed and code_changed,'Version attributes missing'
 return bytes(raw)
