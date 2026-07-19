import {readZip} from "./zipReader";
const cellColumn=(ref:string)=>{let value=0;for(const ch of ref.replace(/\d/g,"")){value=value*26+(ch.charCodeAt(0)-64)}return value-1};
export async function parseXlsx(input:ArrayBuffer):Promise<Record<string,unknown>[]> {
  const zip=await readZip(input);const parser=new DOMParser();
  const sharedEntry=zip.get("xl/sharedStrings.xml");const shared:string[]=[];
  if(sharedEntry){const xml=parser.parseFromString(await sharedEntry.text(),"application/xml");xml.querySelectorAll("si").forEach(si=>shared.push([...si.querySelectorAll("t")].map(t=>t.textContent||"").join("")));}
  const sheetName=[...zip.keys()].filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];if(!sheetName)throw new Error("The Excel file contains no readable worksheet.");
  const sheet=parser.parseFromString(await zip.get(sheetName)!.text(),"application/xml");const matrix:string[][]=[];
  sheet.querySelectorAll("sheetData > row").forEach(row=>{const values:string[]=[];row.querySelectorAll("c").forEach(cell=>{const ref=cell.getAttribute("r")||"A1";const index=cellColumn(ref);const type=cell.getAttribute("t");let value="";if(type==="inlineStr")value=[...cell.querySelectorAll("is t")].map(t=>t.textContent||"").join("");else{const raw=cell.querySelector("v")?.textContent||"";value=type==="s"?shared[Number(raw)]??"":raw;}values[index]=value;});matrix.push(values)});
  if(!matrix.length)return [];const headers=matrix[0].map(v=>String(v||"").trim().toLowerCase());return matrix.slice(1).filter(row=>row.some(v=>String(v||"").trim())).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]??""])));
}
