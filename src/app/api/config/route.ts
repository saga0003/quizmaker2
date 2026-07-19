import { NextResponse } from "next/server";
export async function GET(){const configured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);return NextResponse.json({release:"4.0",configured,mode:configured?"supabase":"interactive-demo",subscriptionModel:"annual-school"},{headers:{"Cache-Control":"no-store"}})}
