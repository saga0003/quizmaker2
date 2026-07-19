export type ZipEntry={name:string;bytes:Uint8Array;blob:Blob;text:()=>Promise<string>};
const u16=(v:DataView,o:number)=>v.getUint16(o,true);const u32=(v:DataView,o:number)=>v.getUint32(o,true);
async function inflateRaw(bytes:Uint8Array){
  if(typeof DecompressionStream==="undefined")throw new Error("This browser cannot decompress ZIP files. Use the latest Chrome or Edge.");
  const stream=new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
export async function readZip(input:ArrayBuffer):Promise<Map<string,ZipEntry>>{
  const bytes=new Uint8Array(input);const view=new DataView(input);let eocd=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(u32(view,i)===0x06054b50){eocd=i;break;}}
  if(eocd<0)throw new Error("Invalid ZIP/XLSX file: end directory not found.");
  const count=u16(view,eocd+10);let offset=u32(view,eocd+16);const decoder=new TextDecoder();const result=new Map<string,ZipEntry>();
  for(let n=0;n<count;n++){
    if(u32(view,offset)!==0x02014b50)throw new Error("Invalid ZIP central directory.");
    const method=u16(view,offset+10);const compressedSize=u32(view,offset+20);const nameLen=u16(view,offset+28);const extraLen=u16(view,offset+30);const commentLen=u16(view,offset+32);const localOffset=u32(view,offset+42);
    const name=decoder.decode(bytes.slice(offset+46,offset+46+nameLen));offset+=46+nameLen+extraLen+commentLen;
    if(name.endsWith("/"))continue;
    if(u32(view,localOffset)!==0x04034b50)throw new Error(`Invalid local ZIP entry: ${name}`);
    const localNameLen=u16(view,localOffset+26);const localExtraLen=u16(view,localOffset+28);const dataStart=localOffset+30+localNameLen+localExtraLen;const compressed=bytes.slice(dataStart,dataStart+compressedSize);
    let expanded:Uint8Array;if(method===0)expanded=compressed;else if(method===8)expanded=await inflateRaw(compressed);else throw new Error(`Unsupported ZIP compression method ${method} in ${name}.`);
    const blob=new Blob([expanded as BlobPart]);result.set(name,{name,bytes:expanded,blob,text:()=>blob.text()});
  }
  return result;
}
