import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { normalizeEvidaraRole } from '@/lib/roles';
import { uploadResourceFileToR2 } from '@/lib/server/r2';
import { createPrivateAcademicResourceUrl, uploadPrivateAcademicResource } from '@/lib/server/privateResourceStorage';

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

type ResourceRecord={id:string;resource_scope:string;organization_id:string|null;subscription_required:boolean;grade_min:number|null;grade_max:number|null;board:string|null;required_track:string|null;storage_key:string|null;content_url:string|null;metadata:Record<string,unknown>|null;[key:string]:unknown};

async function studentEligibleResources(ctx:Awaited<ReturnType<typeof context>>,resources:ResourceRecord[]){
  if(ctx.mode!=='student')return resources;
  const [{data:membership},{data:subscription}]=await Promise.all([
    ctx.admin.from('student_school_memberships').select('grade,board,tracks,status').eq('student_id',ctx.user.id).eq('organization_id',ctx.organizationId!).eq('status','active').order('updated_at',{ascending:false}).limit(1).maybeSingle(),
    ctx.admin.from('school_subscriptions').select('status,starts_at,ends_at,resource_access').eq('organization_id',ctx.organizationId!).order('ends_at',{ascending:false}).limit(1).maybeSingle(),
  ]);
  if(!membership)throw Object.assign(new Error('No active student membership is linked to this institution.'),{status:403});
  const today=new Date().toISOString().slice(0,10);const subActive=Boolean(subscription&&subscription.status==='active'&&subscription.starts_at<=today&&subscription.ends_at>=today);
  return resources.filter((r)=>{
    if(r.resource_scope==='organization'&&r.organization_id!==ctx.organizationId)return false;
    if(r.subscription_required&&!subActive)return false;
    if(Number(membership.grade)<Number(r.grade_min||1)||Number(membership.grade)>Number(r.grade_max||12))return false;
    if(r.board&&String(r.board).toLowerCase()!==String(membership.board||'').toLowerCase())return false;
    if(r.required_track&&!((membership.tracks||[]) as string[]).includes(String(r.required_track)))return false;
    return true;
  });
}

export async function GET(request:Request){try{const ctx=await context(request);const params=new URL(request.url).searchParams;const requestedResourceId=params.get('resourceId');let folderQuery=ctx.admin.from('resource_folders').select('*').order('name');let resourceQuery=ctx.admin.from('academic_resources').select('id,title,kind,access_label,subscription_required,board,grade_min,grade_max,required_track,exam_type,subject,source_year,content_url,metadata,created_by,created_at,updated_at,organization_id,resource_scope,folder_id,storage_key,file_name,mime_type,size_bytes,file_extension,download_count').eq('is_active',true).order('title');
  if(ctx.mode==='platform'){folderQuery=folderQuery.eq('resource_scope','platform').is('organization_id',null);resourceQuery=resourceQuery.eq('resource_scope','platform').is('organization_id',null);}else{folderQuery=folderQuery.or(`resource_scope.eq.platform,and(resource_scope.eq.organization,organization_id.eq.${ctx.organizationId})`);resourceQuery=resourceQuery.or(`resource_scope.eq.platform,and(resource_scope.eq.organization,organization_id.eq.${ctx.organizationId})`);}
  const [{data:folders,error:ferr},{data:resources,error:rerr}]=await Promise.all([folderQuery,resourceQuery]);if(ferr||rerr)throw new Error(ferr?.message||rerr?.message||'Unable to load resources.');
  const safeResources=await studentEligibleResources(ctx,(resources||[]) as ResourceRecord[]);
  if(requestedResourceId){const resource=safeResources.find(r=>r.id===requestedResourceId);if(!resource)throw Object.assign(new Error('Resource not found or not available to this account.'),{status:404});
    if(resource.resource_scope==='organization'){
      if(resource.metadata?.storage_backend!=='supabase-private-v1'||!resource.storage_key)throw Object.assign(new Error('This legacy institution resource must be migrated to protected storage before it can be opened.'),{status:409});
      const url=await createPrivateAcademicResourceUrl({admin:ctx.admin,key:resource.storage_key,expiresIn:300});
      await ctx.admin.from('academic_resources').update({download_count:Number(resource.download_count||0)+1}).eq('id',resource.id);
      return NextResponse.json({url,expiresIn:300},{headers:{'Cache-Control':'no-store'}});
    }
    if(!resource.content_url)throw Object.assign(new Error('This platform resource does not have an available file URL.'),{status:404});
    return NextResponse.json({url:resource.content_url},{headers:{'Cache-Control':'no-store'}});
  }
  const clientResources=safeResources.map(({content_url,...resource})=>({...resource,download_available:Boolean(resource.storage_key||content_url)}));
  return NextResponse.json({role:ctx.role,mode:ctx.mode,organizationId:ctx.organizationId,canManage:ctx.canManage,folders:folders||[],resources:clientResources},{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e)}}

export async function POST(request:Request){try{const ctx=await context(request);if(!ctx.canManage)throw Object.assign(new Error('Resource publishing permission is required.'),{status:403});const contentType=request.headers.get('content-type')||'';
  if(contentType.includes('multipart/form-data')){const form=await request.formData();const file=form.get('file');if(!(file instanceof File))throw Object.assign(new Error('Choose a resource file.'),{status:400});const folderId=String(form.get('folderId')||'')||null;const title=String(form.get('title')||file.name).trim();const subject=String(form.get('subject')||'General').trim();const gradeMin=Math.max(1,Math.min(12,Number(form.get('gradeMin')||1)));const gradeMax=Math.max(gradeMin,Math.min(12,Number(form.get('gradeMax')||12)));
    if(folderId){let q=ctx.admin.from('resource_folders').select('id').eq('id',folderId);if(ctx.mode==='platform')q=q.eq('resource_scope','platform').is('organization_id',null);else q=q.eq('organization_id',ctx.organizationId!);const {data:folder}=await q.maybeSingle();if(!folder)throw Object.assign(new Error('The selected folder is outside your resource scope.'),{status:403});}
    const bytes=new Uint8Array(await file.arrayBuffer());const scope=ctx.mode==='platform'?'platform':'organization';
    if(scope==='organization'){
      const uploaded=await uploadPrivateAcademicResource({admin:ctx.admin,bytes,contentType:file.type||'application/octet-stream',originalName:file.name,userId:ctx.user.id,organizationId:ctx.organizationId!});
      const {data,error}=await ctx.admin.from('academic_resources').insert({title,kind:'foundation',access_label:'included',subscription_required:true,grade_min:gradeMin,grade_max:gradeMax,subject,content_url:null,is_active:true,resource_scope:scope,organization_id:ctx.organizationId,folder_id:folderId,storage_key:uploaded.key,file_name:file.name,mime_type:uploaded.contentType,size_bytes:uploaded.size,file_extension:file.name.includes('.')?file.name.split('.').pop()?.toLowerCase()||null:null,created_by:ctx.user.id,metadata:{description:String(form.get('description')||''),storage_backend:'supabase-private-v1'}}).select('id').single();if(error)throw new Error(error.message);return NextResponse.json({ok:true,id:data.id});
    }
    const uploaded=await uploadResourceFileToR2({bytes,contentType:file.type||'application/octet-stream',originalName:file.name,userId:ctx.user.id,scope:'platform',organizationId:null});
    const {data,error}=await ctx.admin.from('academic_resources').insert({title,kind:'foundation',access_label:'included',subscription_required:false,grade_min:gradeMin,grade_max:gradeMax,subject,content_url:uploaded.publicUrl,is_active:true,resource_scope:scope,organization_id:null,folder_id:folderId,storage_key:uploaded.key,file_name:file.name,mime_type:uploaded.contentType,size_bytes:uploaded.size,file_extension:uploaded.extension,created_by:ctx.user.id,metadata:{description:String(form.get('description')||''),storage_backend:'r2-public-v1'}}).select('id').single();if(error)throw new Error(error.message);return NextResponse.json({ok:true,id:data.id});
  }
  const body=await request.json() as Record<string,unknown>;const action=String(body.action||'');if(action==='createFolder'){const name=String(body.name||'').trim();if(!name)throw Object.assign(new Error('Folder name is required.'),{status:400});const parentId=body.parentId?String(body.parentId):null;if(parentId){let q=ctx.admin.from('resource_folders').select('id').eq('id',parentId);if(ctx.mode==='platform')q=q.eq('resource_scope','platform').is('organization_id',null);else q=q.eq('organization_id',ctx.organizationId!);const {data:parent}=await q.maybeSingle();if(!parent)throw Object.assign(new Error('Parent folder is outside your resource scope.'),{status:403});}
    const {error}=await ctx.admin.from('resource_folders').insert({resource_scope:ctx.mode==='platform'?'platform':'organization',organization_id:ctx.organizationId,parent_id:parentId,name,class_level:String(body.classLevel||'').trim()||null,subject:String(body.subject||'').trim()||null,chapter:String(body.chapter||'').trim()||null,created_by:ctx.user.id});if(error)throw new Error(error.message);return NextResponse.json({ok:true});}
  if(action==='deleteResource'){const id=String(body.resourceId||'');const {data:r}=await ctx.admin.from('academic_resources').select('id,organization_id,resource_scope').eq('id',id).maybeSingle();if(!r)throw Object.assign(new Error('Resource not found.'),{status:404});if(ctx.mode==='platform'&&r.resource_scope!=='platform')throw Object.assign(new Error('Evidara Admin cannot alter school resources.'),{status:403});if(ctx.mode!=='platform'&&(r.resource_scope!=='organization'||r.organization_id!==ctx.organizationId))throw Object.assign(new Error('You can remove only your institution resources.'),{status:403});const {error}=await ctx.admin.from('academic_resources').update({is_active:false,updated_at:new Date().toISOString()}).eq('id',id);if(error)throw new Error(error.message);return NextResponse.json({ok:true});}
  if(action==='deleteFolder'){const id=String(body.folderId||'');const {data:f}=await ctx.admin.from('resource_folders').select('id,organization_id,resource_scope').eq('id',id).maybeSingle();if(!f)throw Object.assign(new Error('Folder not found.'),{status:404});if(ctx.mode==='platform'&&f.resource_scope!=='platform')throw Object.assign(new Error('Evidara Admin cannot alter school folders.'),{status:403});if(ctx.mode!=='platform'&&f.organization_id!==ctx.organizationId)throw Object.assign(new Error('Folder is outside your institution.'),{status:403});const {count}=await ctx.admin.from('academic_resources').select('id',{count:'exact',head:true}).eq('folder_id',id).eq('is_active',true);const {count:children}=await ctx.admin.from('resource_folders').select('id',{count:'exact',head:true}).eq('parent_id',id);if((count||0)>0||(children||0)>0)throw Object.assign(new Error('Move or remove files/subfolders before deleting this folder.'),{status:409});const {error}=await ctx.admin.from('resource_folders').delete().eq('id',id);if(error)throw new Error(error.message);return NextResponse.json({ok:true});}
  throw Object.assign(new Error('Unsupported resource action.'),{status:400});
}catch(e){return fail(e)}}
