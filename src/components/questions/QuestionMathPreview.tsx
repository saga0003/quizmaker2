"use client";
import { BlockMath } from "react-katex";

export function QuestionMathPreview({text,latex,imageUrl,label="Question preview"}:{text?:string;latex?:string;imageUrl?:string;label?:string}){
  if(!text&&!latex&&!imageUrl) return null;
  return <div style={{border:"1px solid #dfe4ec",borderRadius:14,padding:16,background:"#fbfcfe"}}>
    <span className="rm-label">{label}</span>
    {text&&<p style={{fontSize:16,lineHeight:1.65,whiteSpace:"pre-wrap",margin:"10px 0"}}>{text}</p>}
    {latex&&<div style={{overflowX:"auto",background:"white",borderRadius:10,padding:"8px 12px",border:"1px solid #edf0f4"}}><BlockMath math={latex}/></div>}
    {imageUrl&&<img src={imageUrl} alt="Question attachment" style={{maxWidth:"100%",maxHeight:320,objectFit:"contain",borderRadius:12,marginTop:12,border:"1px solid #e4e7ec"}}/>}
  </div>
}
