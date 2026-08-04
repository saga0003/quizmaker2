import fs from 'node:fs/promises';
import path from 'node:path';

const subjects=['Physics','Chemistry','Biology','Mathematics','Logical Reasoning'];
const chapters={Physics:['Mechanics','Electrodynamics','Optics'],Chemistry:['Physical Chemistry','Chemical Bonding','Organic Chemistry'],Biology:['Cell Biology','Human Physiology','Genetics'],Mathematics:['Algebra','Calculus','Coordinate Geometry'],'Logical Reasoning':['Series','Syllogisms','Puzzles']};
const students=[['trial-aarav','Aarav Sharma','11'],['trial-ananya','Ananya Rao','10'],['trial-rohan','Rohan Patil','12']];
const questions=[];
let q=1;
for(const subject of subjects){for(const chapter of chapters[subject]){for(let i=1;i<=8;i++){questions.push({id:`trial-q-${q++}`,subject,chapter,topic:`${chapter} Topic ${Math.ceil(i/2)}`,difficulty:['easy','medium','hard'][i%3],expected_seconds:55+i*5,correct_option:['A','B','C','D'][i%4]})}}}
const tests=Array.from({length:7},(_,i)=>({id:`trial-test-${i+1}`,name:`Comparable Test ${i+1}`,date:`2026-07-${String(2+i*3).padStart(2,'0')}`,question_ids:questions.slice(i*10,i*10+50).map(x=>x.id),comparable_group:'v10-14-neet-demo'}));
const attempts=[];const responses=[];
for(let s=0;s<students.length;s++){for(let t=0;t<tests.length;t++){const attemptId=`attempt-${s+1}-${t+1}`;const base=58+s*5+t*3;attempts.push({id:attemptId,student_id:students[s][0],test_id:tests[t].id,score_percent:Math.min(92,base),submitted:true,started_at:`${tests[t].date}T09:00:00Z`,completed_at:`${tests[t].date}T10:30:00Z`});tests[t].question_ids.forEach((qid,index)=>{const question=questions.find(x=>x.id===qid);const correct=((index+t+s)%5)!==0;const changed=index%9===0;responses.push({attempt_id:attemptId,question_id:qid,question_order:index+1,selected_option:correct?question.correct_option:['A','B','C','D'].find(x=>x!==question.correct_option),is_correct:correct,response_seconds:Math.max(18,question.expected_seconds+(correct?-8:18)+(index>37?12:0)),answer_changes:changed?[{from:'B',to:correct?question.correct_option:'C',at_seconds:42}]:[],reviewed:changed,skipped:false,revision_cycle:t>=4?'post_revision':t===6?'delayed_retention':'baseline'})})}}
const cohort={version:'10.14.0',generated_at:new Date().toISOString(),school:{id:'trial-school',name:'Evidara Trial School'},students:students.map(([id,name,grade])=>({id,name,grade})),questions,tests,attempts,responses,learning_behaviour_requirements:{minimum_comparable_tests:3,minimum_valid_responses:60,requires_timestamps:true,requires_answer_change_history:true,requires_difficulty_tags:true,requires_delayed_revision_check:true}};
const output=path.resolve('public/demo/evidara-v10-14-trial-cohort.json');
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify(cohort,null,2));
console.log(`Created ${output}: ${questions.length} questions, ${attempts.length} attempts, ${responses.length} responses.`);
