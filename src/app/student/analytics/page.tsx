import { ProtectedPage } from "@/components/ProtectedPage";

export default function Page(){
  return <ProtectedPage allowed="student"><iframe title="Evidara complete student analytics" src="/evidara-analytics-v10-14.html" style={{position:"fixed",inset:0,width:"100%",height:"100%",border:0,background:"#fbfcfd"}} /></ProtectedPage>;
}
