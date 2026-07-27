import { ProtectedPage } from "@/components/ProtectedPage";

export default function Page(){
  return <ProtectedPage allowed="admin"><iframe title="Evidara V12 Super Admin student analytics" src="/evidara-analytics-v12.html?role=admin" style={{position:"fixed",inset:0,width:"100%",height:"100%",border:0,background:"#fbfcfd"}} /></ProtectedPage>;
}
