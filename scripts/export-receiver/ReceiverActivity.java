package com.hossmoney.exportqa;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import java.io.*;
public class ReceiverActivity extends Activity {
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  try {
   Intent intent=getIntent();
   if(!Intent.ACTION_SEND.equals(intent.getAction())) throw new IOException("Expected SEND");
   String type=intent.getType();
   String name="application/pdf".equals(type)?"report.pdf":"image/png".equals(type)?"stats.png":null;
   if(name==null)throw new IOException("Unexpected type");
   Uri uri=intent.getParcelableExtra(Intent.EXTRA_STREAM);
   if(uri==null)throw new IOException("No stream");
   try(InputStream in=getContentResolver().openInputStream(uri);OutputStream out=new FileOutputStream(new File(getExternalFilesDir(null),name))) {
    if(in==null)throw new IOException("Unreadable stream");
    byte[] b=new byte[8192];int n,total=0;
    while((n=in.read(b))!=-1){total+=n;if(total>32*1024*1024)throw new IOException("Too large");out.write(b,0,n);}
   }
  } catch(Exception e) {
   try(FileWriter w=new FileWriter(new File(getExternalFilesDir(null),"error.txt"))){w.write(e.toString());}catch(Exception ignored){}
  }
  finish();
 }
}
