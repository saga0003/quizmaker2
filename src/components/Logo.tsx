export function Logo({compact=false,reversed=false}:{compact?:boolean;reversed?:boolean}){
 return <span className={`so-logo ev-logo ${compact?"compact":""} ${reversed?"reversed":""}`} aria-label="Evidara — Evidence-Driven Student Development">
  <img src="/brand/evidara-master.svg" alt="Evidara — Evidence-Driven Student Development"/>
 </span>;
}
