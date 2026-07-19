export function parseCsv(text:string):Record<string,unknown>[] {
  const rows:string[][]=[];let row:string[]=[];let field="";let quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}
      else if(ch==='"')quoted=false;
      else field+=ch;
    }else{
      if(ch==='"')quoted=true;
      else if(ch===','){row.push(field);field="";}
      else if(ch==='\n'){row.push(field.replace(/\r$/,""));if(row.some(v=>v.trim()))rows.push(row);row=[];field="";}
      else field+=ch;
    }
  }
  row.push(field.replace(/\r$/,""));if(row.some(v=>v.trim()))rows.push(row);
  if(!rows.length)return [];
  const headers=rows[0].map(h=>h.trim().toLowerCase());
  return rows.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??""])));
}
