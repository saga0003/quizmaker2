"use client";
import { RichQuestionContent } from "@/components/evidara/rich-math-content";

export function QuestionMathPreview({text,latex,imageUrl,label="Question preview"}:{text?:string;latex?:string;imageUrl?:string;label?:string}){
  if(!text&&!latex&&!imageUrl) return null;
  return <div style={{border:"1px solid #dfe4ec",borderRadius:14,padding:16,background:"#fbfcfe"}}>
    <span className="rm-label">{label}</span>
    <div style={{marginTop:10}}><RichQuestionContent text={text} latex={latex} imageUrl={imageUrl} textClassName="text-base" /></div>
  </div>
}
