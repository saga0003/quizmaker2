import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { normalizeEvidaraRole } from '@/lib/roles';
import { uploadResourceFileToR2 } from '@/lib/server/r2';

const managerRoles = new Set(['school_admin','school_teacher']);
function fail(error:unknown,status=500){const e=error as {message?:string;status?:number};return NextResponse.json({error:e.message||'Resource request failed.'},{status:e.status||status,headers:{'Cache-Control':'no-store'}})}

async function context(request:Request){
  const auth=await authenticateRequest(request); const {data:profile}=await auth.admin.from('profiles').select('role').eq('id',auth.user.id).single(); const role=normalizeEvidaraRole(profile?.role);
  const params=new URL(request.url).searchParams; const mode=params.get('mode')||'school';
  if(mode==='platform'){
    if(!['super_admin','evidara_admin'].includes(role))throw Object.assign(new Error('Platform resource permission is required.'),{status:403});
    return {...auth,role,mode,organizationId:null,canManage:true};
  }
  const {data:staff}=await auth.admin.from('organization_members').select('organization_id,member_role').eq('user_id',auth.user.id).eq('is_active',true).limit(1).maybeSingle();
  if(staff?.organization_id){return {...auth,role,mode,organizationId:staff.organization_id,canManage:managerRoles.has(role)};}
  const {data:student}=await auth.admin.from('student_school_memberships').select('organization_id').eq('student_id',auth.user.id).eq('status','active').order('updated_at',{ascending:false}).limit(1).maybeSingle();
  if(!student?.organization_id)throw Object.assign(new Error('No active institution membership is linked to this account.'),{status:403});
  return {...auth,role,mode:'student',organizationId:student.organization_id,canManage:false};
}

export async function GET(request:Request){try{const ctx=await context(request);let folderQuery=ctx.admin.from('resource_folders').select('*').order('name');let resourceQuery=ctx.admin.from('academic_resources').select('id,title,kind,access_label,subscription_required,board,grade_min,grade_max,required_track,exam_type,subject,source_year,content_url,metadata,created_by,created_at,updated_at,organization_id,resource_scope,folder_id,storage_key,file_name,mime_type,size_bytes,file_extension,download_count').eq('is_active',true).order('title');
  if(ctx.mode==='platform'){folderQuery=folderQuery.eq('resource_scope','platform').is('organization_id',null);resourceQuery=resourceQuery.eq('resource_scope','platform').is('organization_id',null);}else{folderQuery=folderQuery.or(`resource_scope.eq.platform,and(resource_scope.eq.organization,organization_id.eq.${ctx.organizationId})`);resourceQuery=resourceQuery.or(`resource_scope.eq.platform,and(resource_scope.eq.organization,organization_id.eq.${ctx.organizationId})`);}
  const [{data:folders,error:ferr},{data:resources,error:rerr}]=await Promise.all([folderQuery,resourceQuery]);if(ferr||rerr)throw new Error(ferr?.message||rerr?.message||'Unable to load resources.');
  let safeResources=resources||[];
  if(ctx.mode==='student'){
    const [{data:membership},{data:subscription}]=await Promise.all([
      ctx.admin.from('student_school_memberships').select('grade,board,tracks,status').eq('student_id',ctx.user.id).eq('organization_id',ctx.organizationId!).eq('status','active').order('updated_at',{ascending:false}).limit(1).maybeSingle(),
      ctx.admin.from('school_subscriptions').select('status,starts_at,ends_at,resource_access').eq('organization_id',ctx.organizationId!).order('ends_at',{ascending:false}).limit(1).maybeSingle(),
    ]);
    if(!membership)throw Object.assign(new Error('No active student membership is linked to this institution.'),{status:403});
    const today=new Date().toISOString().slice(0,10);const subActive=Boolean(subscription&&subscription.status==='active'&&subscription.starts_at<=today&&subscription.ends_at>=today);
    safeResources=safeResources.filter((r)=>{
      if(r.resource_scope==='organization'&&r.organization_id!==ctx.organizationId)return false;
      if(r.subscription_required&&!subActive)return false;
      if(Number(membership.grade)<Number(r.grade_min||1)||Number(membership.grade)>Number(r.grade_max||12))return false;
      if(r.board&&String(r.board).toLowerCase()!==String(membership.board||'').toLowerCase())return false;
      if(r.required_track&&!((membership.tracks||[]) as string[]).includes(String(r.required_track)))return false;
      return true;
    });
  }
  return NextResponse.json({role:ctx.role,mode:ctx.mode,organizationId:ctx.organizationId,canManage:ctx.canManage,folders:folders||[],resources:safeResources},{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e)}}

export async function POST(request:Request){try{const ctx=await context(request);if(!ctx.canManage)throw Object.assign(new Error('Resource publishing permission is required.'),{status:403});const contentType=request.headers.get('content-type')||'';
  if(contentType.includes('multipart/form-data')){const form=await request.formData();const file=form.get('file');if(!(file instanceof File))throw Object.assign(new Error('Choose a resource file.'),{status:400});const folderId=String(form.get('folderId')||'')||null;const title=String(form.get('title')||file.name).trim();const subject=String(form.get('subject')||'General').trim();const gradeMin=Math.max(1,Math.min(12,Number(form.get('gradeMin')||1)));const gradeMax=Math.max(gradeMin,Math.min(12,Number(form.get('gradeMax')||12)));
    if(folderId){let q=ctx.admin.from('resource_folders').select('id').eq('id',folderId);if(ctx.mode==='platform')q=q.eq('resource_scope','platform').is('organization_id',null);else q=q.eq('organization_id',ctx.organizationId!);const {data:folder}=await q.maybeSingle();if(!folder)throw Object.assign(new Error('The selected folder is outside your resource scope.'),{status:403});}
    const bytes=new Uint8Array(await file.arrayBuffer());const uploaded=await uploadResourceFileToR2({bytes,contentType:file.type||'application/octet-stream',originalName:file.name,userId:ctx.user.id,scope:ctx.mode==='platform'?'platform':'organization',organizationId:ctx.organizationId});
    const scope=ctx.mode==='platform'?'platform':'organization';const {data,error}=await ctx.admin.from('academic_resources').insert({title,kind:'foundation',access_label:scope==='platform'?'included':'included',subscription_required:scope==='platform'?false:true,grade_min:gradeMin,grade_max:gradeMax,subject,content_url:uploaded.publicUrl,is_active:true,resource_scope:scope,organization_id:ctx.organizationId,folder_id:folderId,storage_key:uploaded.key,file_name:file.name,mime_type:uploaded.contentType,size_bytes:uploaded.size,file_extension:uploaded.extension,created_by:ctx.user.id,metadata:{description:String(form.get('description')||'')}}).select('id').single();if(error)throw new Error(error.message);return NextResponse.json({ok:true,id:data.id});
  }
  const body=await request.json() as Record<string,unknown>;const action=String(body.action||'');if(action==='createFolder'){const name=String(body.name||'').trim();if(!name)throw Object.assign(new Error('Folder name is required.'),{status:400});const parentId=body.parentId?String(body.parentId):null;if(parentId){let q=ctx.admin.from('resource_folders').select('id').eq('id',parentId);if(ctx.mode==='platform')q=q.eq('resource_scope','platform').is('organization_id',null);else q=q.eq('organization_id',ctx.organizationId!);const {data:parent}=await q.maybeSingle();if(!parent)throw Object.assign(new Error('Parent folder is outside your resource scope.'),{status:403});}
    const {error}=await ctx.admin.from('resource_folders').insert({resource_scope:ctx.mode==='platform'?'platform':'organization',organization_id:ctx.organizationId,parent_id:parentId,name,class_level:String(body.classLevel||'').trim()||null,subject:String(body.subject||'').trim()||null,chapter:String(body.chapter||'').trim()||null,created_by:ctx.user.id});if(error)throw new Error(error.message);return NextResponse.json({ok:true});}
  if(action==='deleteResource'){const id=String(body.resourceId||'');let q=ctx.admin.from('academic_resources').select('id,organization_id,resource_scope').eq('id',id);const {data:r}=await q.maybeSingle();if(!r)throw Object.assign(new Error('Resource not found.'),{status:404});if(ctx.mode==='platform'&&r.resource_scope!=='platform')throw Object.assign(new Error('Evidara Admin cannot alter school resources.'),{status:403});if(ctx.mode!=='platform'&&(r.resource_scope!=='organization'||r.organization_id!==ctx.organizationId))throw Object.assign(new Error('You can remove only your institution resources.'),{status:403});const {error}=await ctx.admin.from('academic_resources').update({is_active:false,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw new Error(error.message);return NextResponse.json({ok:true});}
  if(action==='deleteFolder'){const id=String(body.folderId||'');let q=ctx.admin.from('resource_folders').select('id,organization_id,resource_scope').eq('id',id);const {data:f}=await q.maybeSingle();if(!f)throw Object.assign(new Error('Folder not found.'),{status:404});if(ctx.mode==='platform'&&f.resource_scope!=='platform')throw Object.assign(new Error('Evidara Admin cannot alter school folders.'),{status:403});if(ctx.mode!=='platform'&&f.organization_id!==ctx.organizationId)throw Object.assign(new Error('Folder is outside your institution.'),{status:403});const {count}=await ctx.admin.from('academic_resources').select('id',{count:'exact',head:true}).eq('folder_id',id).eq('is_active',true);const {count:children}=await ctx.admin.from('resource_folders').select('id',{count:'exact',head:true}).eq('parent_id',id);if((count||0)>0||(children||0)>0)throw Object.assign(new Error('Move or remove files/subfolders before deleting this folder.'),{status:409});const {error}=await ctx.admin.from('resource_folders').delete().eq('id',id);if(error)throw new Error(error.message);return NextResponse.json({ok:true});}
  throw Object.assign(new Error('Unsupported resource action.'),{status:400});
}catch(e){return fail(e)}}
