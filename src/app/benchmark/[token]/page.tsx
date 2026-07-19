import { BenchmarkLanding } from "@/components/benchmarks/BenchmarkLanding";

export default async function Page({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 return <BenchmarkLanding token={token}/>;
}
