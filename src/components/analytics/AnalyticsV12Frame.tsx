'use client';

import { useSearchParams } from 'next/navigation';
import { useRef } from 'react';

const allowedViews=new Set(['overview','subject','chapter','topic','behaviour','practice','history','goals']);

export function AnalyticsV12Frame({admin=false}:{admin?:boolean}){
  const params=useSearchParams();
  const frame=useRef<HTMLIFrameElement>(null);
  const requested=params.get('view')||'overview';
  const view=allowedViews.has(requested)?requested:'overview';

  function activateRequestedView(){
    const doc=frame.current?.contentDocument;
    const button=doc?.querySelector<HTMLButtonElement>(`[data-view="${view}"]`);
    button?.click();
  }

  return <iframe ref={frame} onLoad={activateRequestedView} title={admin?'Evidara V12 Super Admin student analytics':'Evidara V12 complete student analytics'} src={`/evidara-analytics-v12.html${admin?'?role=admin':''}`} style={{position:'fixed',inset:0,width:'100%',height:'100%',border:0,background:'#fbfcfd'}}/>;
}
