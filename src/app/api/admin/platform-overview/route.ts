import { NextResponse } from "next/server";
import { authenticateRequest, isServerSupabaseConfigured } from "@/lib/server/supabaseServer";
import { isPlatformAdmin, isSuperAdmin } from "@/lib/roles";

type SubscriptionRow = { id:string; organization_id:string; plan_name:string; status:string; starts_at:string; ends_at:string; seat_limit:number };
export async function GET(request: Request) {
  if (!isServerSupabaseConfigured) return NextResponse.json({ error: "Server cloud environment is not configured." }, { status:503, headers:{"Cache-Control":"no-store"} });
  try {
    const auth=await authenticateRequest(request);
    const {data:profile}=await auth.admin.from("profiles").select("role").eq("id",auth.user.id).single();
    if(!profile||!isPlatformAdmin(profile.role)) return NextResponse.json({error:"Platform administrator permission is required."},{status:403,headers:{"Cache-Control":"no-store"}});
    const [profiles,organizations,products,papers,questions,orders,subscriptions]=await Promise.all([
      auth.admin.from("profiles").select("id",{count:"exact",head:true}), auth.admin.from("organizations").select("id",{count:"exact",head:true}), auth.admin.from("products").select("id",{count:"exact",head:true}), auth.admin.from("papers").select("id",{count:"exact",head:true}), auth.admin.from("questions").select("id",{count:"exact",head:true}), auth.admin.from("orders").select("amount_paise").eq("status","paid"), auth.admin.from("school_subscriptions").select("id,organization_id,plan_name,status,starts_at,ends_at,seat_limit").order("ends_at",{ascending:false})
    ]);
    if([profiles,organizations,products,papers,questions,orders,subscriptions].some((r)=>r.error)) return NextResponse.json({error:"One or more platform data sources are unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});
    const rows=(subscriptions.data??[]) as SubscriptionRow[]; const orgIds=[...new Set(rows.map(r=>r.organization_id))];
    const orgMap=new Map<string,{name:string;city:string|null}>(); const memberCounts=new Map<string,number>();
    if(orgIds.length){
      const {data:o}=await auth.admin.from("organizations").select("id,name,city").in("id",orgIds); for(const x of o??[])orgMap.set(x.id,{name:x.name,city:x.city});
      const counts=await Promise.all(orgIds.map(async organizationId=>({organizationId,result:await auth.admin.from("student_school_memberships").select("id",{count:"exact",head:true}).eq("organization_id",organizationId).eq("status","active")})));
      if(counts.some(({result})=>result.error)) return NextResponse.json({error:"Student licence usage counts are unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});
      for(const {organizationId,result} of counts) memberCounts.set(organizationId,result.count??0);
    }
    const revenuePaise=isSuperAdmin(profile.role)?(orders.data??[]).reduce((a,x)=>a+Number(x.amount_paise??0),0):null;
    return NextResponse.json({generatedAt:new Date().toISOString(),role:profile.role,stats:{users:profiles.count??0,schools:organizations.count??0,products:products.count??0,papers:papers.count??0,questions:questions.count??0,revenuePaise,activeSubscriptions:rows.filter(r=>r.status==="active").length},subscriptions:rows.map(r=>({id:r.id,school:orgMap.get(r.organization_id)?.name??"Institution",city:orgMap.get(r.organization_id)?.city??"",plan:r.plan_name,seats:r.seat_limit,seatsUsed:memberCounts.get(r.organization_id)??0,status:r.status,startsAt:r.starts_at,expiry:r.ends_at}))},{headers:{"Cache-Control":"no-store"}});
  } catch(error){ return NextResponse.json({error:error instanceof Error?error.message:"Unable to load platform overview."},{status:500,headers:{"Cache-Control":"no-store"}}); }
}
