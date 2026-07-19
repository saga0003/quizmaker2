import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { PurchaseHistory } from "@/components/commerce/PurchaseHistory";
export default function Purchases(){return <ProtectedPage allowed="student"><DashboardShell kind="student"><div><span className="rm-label">Payments and access</span><h1 style={{margin:"5px 0",fontSize:34,color:"#131e35"}}>My test packages</h1><p style={{color:"#667085"}}>Verified purchases and their access periods appear here.</p></div><PurchaseHistory/></DashboardShell></ProtectedPage>}
