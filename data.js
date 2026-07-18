const state = {
  role: localStorage.getItem('scholaros-role') || 'super',
  page: 'dashboard',
  modal: null,
  testIndex: 0,
  answers: {},
  testComplete: false,
  schools: [
    {name:'Green Valley School', city:'Chikmagalur', students:482, grades:'8–10', status:'Active', consent:91},
    {name:'Horizon Public School', city:'Hassan', students:318, grades:'9–12', status:'Pilot', consent:76},
    {name:'Vidya Bharathi Academy', city:'Shivamogga', students:625, grades:'8–12', status:'Active', consent:88},
    {name:'Excel English School', city:'Mysuru', students:246, grades:'8–10', status:'Proposal', consent:0}
  ]
};

const questions = [
  {subject:'Science',topic:'Motion',difficulty:'Medium',q:'A cyclist travels 120 m in 20 seconds and then 180 m in 30 seconds. What is the average speed for the entire journey?',options:['5 m/s','6 m/s','7.5 m/s','10 m/s'],answer:1,time:75,explanation:'Total distance is 300 m and total time is 50 s, so average speed = 300/50 = 6 m/s.'},
  {subject:'Biology',topic:'Cell Structure',difficulty:'Easy',q:'Which cell organelle controls most activities of the cell and contains genetic material?',options:['Mitochondrion','Vacuole','Nucleus','Ribosome'],answer:2,time:40,explanation:'The nucleus stores genetic material and regulates the cell’s activities.'},
  {subject:'Mathematics',topic:'Ratio',difficulty:'Medium',q:'The ratio of boys to girls in a class is 3:5. If 8 more boys join, the ratio becomes 11:15. How many students were originally in the class?',options:['32','40','48','64'],answer:3,time:95,explanation:'Let boys = 3x and girls = 5x. (3x+8)/(5x)=11/15 gives x=8, hence total = 8x = 64.'},
  {subject:'Reasoning',topic:'Data Interpretation',difficulty:'Hard',q:'A test score rises by 20%, then falls by 20%. Compared with the original score, the final score is:',options:['4% lower','Unchanged','4% higher','8% lower'],answer:0,time:60,explanation:'1.20 × 0.80 = 0.96, so the final value is 4% below the original.'},
  {subject:'Chemistry',topic:'Matter',difficulty:'Medium',q:'Which observation most strongly indicates that a chemical change has taken place?',options:['Ice melting','Water boiling','A gas forming with a colour change','Sugar dissolving'],answer:2,time:50,explanation:'Gas formation together with a colour change is strong evidence that new substances formed.'}
];

const roleConfig = {
  super:{label:'Super Admin',subtitle:'Platform command centre',nav:[['dashboard','Command Centre','⌂'],['schools','Schools','▦'],['assessments','Assessments','✓'],['intelligence','Lead Intelligence','◎'],['consent','Consent & Privacy','⚿'],['roadmap','Product Roadmap','↗']]},
  admin:{label:'Organisation Admin',subtitle:'Programme operations',nav:[['dashboard','Operations','⌂'],['assessments','Assessment Builder','✓'],['students','Student Directory','♙'],['intelligence','Performance Segments','◎'],['reports','Reports','▤']]},
  school:{label:'School Admin',subtitle:'School academic dashboard',nav:[['dashboard','School Overview','⌂'],['classes','Classes & Sections','▦'],['students','Students','♙'],['interventions','Interventions','✦'],['reports','Parent Reports','▤']]},
  student:{label:'Student',subtitle:'My learning dashboard',nav:[['dashboard','My Dashboard','⌂'],['tests','My Tests','✓'],['analytics','My Analytics','◎'],['practice','Practice Plan','✦'],['certificates','Achievements','★']]}
};

function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
function pct(n){return `<div class="progress"><span style="width:${n}%"></span></div>`}
function badge(v){const c=v==='Active'||v==='Completed'||v==='Consent verified'?'green':v==='Pilot'||v==='Scheduled'?'gold':v==='At risk'?'red':'blue';return `<span class="badge ${c}">${v}</span>`}
function metric(icon,value,label,trend,cls=''){return `<div class="card metric"><div class="metric-top"><div class="metric-icon">${icon}</div><span class="trend ${cls}">${trend}</span></div><div class="metric-value">${value}</div><div class="metric-label">${label}</div></div>`}

