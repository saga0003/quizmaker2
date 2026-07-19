import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AdminProductManager } from "@/components/commerce/AdminProductManager";
export default function AdminProducts(){return <ProtectedPage allowed="admin"><DashboardShell kind="admin"><div><span className="rm-label">Version 2 commerce</span><h1 style={{margin:"5px 0",fontSize:34,color:"#131e35"}}>Products, pricing and access</h1><p style={{color:"#667085"}}>Create products, change prices and publish offers without editing application code.</p></div><AdminProductManager/></DashboardShell></ProtectedPage>}
