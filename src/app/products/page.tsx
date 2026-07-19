import { Navbar } from "@/components/Navbar";
import { ProductStore } from "@/components/commerce/ProductStore";
import { SetupBanner } from "@/components/SetupBanner";
export default function ProductsPage(){return <><SetupBanner/><Navbar/><main className="rm-container" style={{padding:"46px 0 70px"}}><div style={{maxWidth:760,marginBottom:28}}><span className="rm-label">ScholarOS Store · Version 2</span><h1 style={{fontSize:"clamp(36px,6vw,54px)",lineHeight:1.08,color:"#131e35",margin:"8px 0 12px"}}>Choose a test series or school plan</h1><p style={{color:"#667085",fontSize:17,lineHeight:1.7}}>Products, prices, discounts, access duration and package limits are controlled by the super admin. Verified payments unlock access immediately.</p></div><ProductStore/></main></>}
