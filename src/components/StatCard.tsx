import { LucideIcon } from "lucide-react";
export function StatCard({label,value,detail,icon:Icon}:{label:string;value:string;detail:string;icon:LucideIcon}){
 return <div className="rm-card" style={{padding:18}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span className="rm-label">{label}</span><span style={{background:"#fff4cc",borderRadius:10,padding:8,color:"#8a5f00"}}><Icon size={18}/></span></div><div style={{fontSize:29,fontWeight:900,color:"#131e35",marginTop:12}}>{value}</div><div style={{fontSize:13,color:"#667085",marginTop:5}}>{detail}</div></div>
}
