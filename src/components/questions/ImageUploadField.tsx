"use client";
import { useState } from "react";
import { ImagePlus, Link2, LoaderCircle, UploadCloud } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthProvider";
import { imageAcceptValue, normalizeImageFile, safeImageFileName } from "@/lib/imageFiles";

export function ImageUploadField({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){
  const {user}=useAuth();
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  async function upload(file:File){
    if(!supabase||!user){setMessage("Connect Supabase and sign in before uploading files.");return;}
    setBusy(true);setMessage("");
    try{
      const {blob,mime}=await normalizeImageFile(file);
      const safe=safeImageFileName(file.name);
      const path=`${user.id}/questions/${crypto.randomUUID()}-${safe}`;
      const {error}=await supabase.storage.from("question-assets").upload(path,blob,{upsert:false,contentType:mime,cacheControl:"3600"});
      if(error)throw error;
      const {data}=supabase.storage.from("question-assets").getPublicUrl(path);
      onChange(data.publicUrl);setMessage(`Image uploaded as ${mime}.`);
    }catch(error){setMessage(error instanceof Error?error.message:"Image upload failed.");}
    finally{setBusy(false);}
  }
  return <div><span className="rm-label">{label}</span><div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginTop:6}}><div style={{position:"relative"}}><Link2 size={17} style={{position:"absolute",left:12,top:13,color:"#98a2b3"}}/><input className="rm-input" style={{paddingLeft:38}} placeholder="Paste a public image URL or upload" value={value} onChange={e=>onChange(e.target.value)}/></div><label className="rm-btn-secondary" style={{display:"flex",alignItems:"center",gap:7,whiteSpace:"nowrap"}}>{busy?<LoaderCircle className="spin" size={17}/>:<UploadCloud size={17}/>}Upload<input type="file" accept={imageAcceptValue} hidden disabled={busy} onChange={e=>{const selected=e.target.files?.[0];if(selected)upload(selected);e.currentTarget.value="";}}/></label></div>{value&&<div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,color:"#137a3a",fontSize:12,fontWeight:700}}><ImagePlus size={15}/>Image linked</div>}{message&&<div style={{marginTop:7,fontSize:12,color:message.includes("uploaded")?"#137a3a":"#b42318"}}>{message}</div>}<div style={{fontSize:11,color:"#667085",marginTop:6}}>Supports JPG/JPEG/JFIF, PNG, WEBP, GIF, SVG, BMP, AVIF, ICO, TIFF and HEIC/HEIF up to 10 MB. Browser preview quality depends on the device for HEIC/TIFF.</div></div>
}
