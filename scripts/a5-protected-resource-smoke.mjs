import fs from 'node:fs';

const route=fs.readFileSync('src/app/api/resources-v14/route.ts','utf8');
const storage=fs.readFileSync('src/lib/server/privateResourceStorage.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20260831003359_phase1_private_academic_resource_bucket.sql','utf8');

const checks=[
  ['private bucket is explicitly non-public',/academic-resources-private[\s\S]*false/i.test(migration)],
  ['new resource uploads use protected Supabase storage',route.includes('uploadPrivateAcademicResource')&&!route.includes('uploadResourceFileToR2')],
  ['platform and institution scopes share the protected uploader',route.includes("ctx.mode === 'platform' ? 'platform' : 'organization'")&&storage.includes("scope?: 'organization' | 'platform'")],
  ['new protected resource rows do not persist a public URL',route.includes('content_url: null')],
  ['private backend is recorded',route.includes("storage_backend: 'supabase-private-v1'")) ,
  ['private storage creates short-lived signed URLs',storage.includes('createSignedUrl')&&storage.includes('expiresIn ?? 300')],
  ['resource download is re-authorized through authenticated API',route.includes("params.get('resourceId')")&&route.includes('studentEligibleResources')],
  ['legacy institution public resources fail closed',route.includes('legacy institution resource must be migrated to protected storage')],
  ['resource list replaces protected storage keys with signed URLs',route.includes('isProtectedSupabaseResource')&&route.includes('protectedUrl(ctx')],
  ['historical platform public URLs remain readable without creating new public uploads',route.includes('Preserve existing platform resources that already have historical public URLs')],
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} A5 ${name}`);
if(failed.length){console.error(`A5 protected resource smoke failed: ${failed.map(([name])=>name).join(', ')}`);process.exit(1)}
console.log(`PASS A5 protected resource smoke (${checks.length} assertions)`);
