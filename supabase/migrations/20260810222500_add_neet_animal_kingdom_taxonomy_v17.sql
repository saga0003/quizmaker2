do $$ declare v_subject uuid; v_chapter uuid; begin
 select id into v_subject from public.subjects where organization_id is null and name='Biology' limit 1;
 if v_subject is null then raise exception 'Missing global Biology subject'; end if;
 select id into v_chapter from public.chapters where organization_id is null and subject_id=v_subject and lower(name)=lower('Animal Kingdom') order by created_at limit 1;
 if v_chapter is null then insert into public.chapters(organization_id,subject_id,code,name,display_order,is_active) values(null,v_subject,null,'Animal Kingdom',4,true) returning id into v_chapter; end if;
 if not exists(select 1 from public.topics where organization_id is null and chapter_id=v_chapter and lower(name)=lower('Non-chordates')) then insert into public.topics(organization_id,chapter_id,name,display_order,is_active) values(null,v_chapter,'Non-chordates',1,true); end if;
 if not exists(select 1 from public.topics where organization_id is null and chapter_id=v_chapter and lower(name)=lower('Chordates and vertebrates')) then insert into public.topics(organization_id,chapter_id,name,display_order,is_active) values(null,v_chapter,'Chordates and vertebrates',2,true); end if;
 if not exists(select 1 from public.topics where organization_id is null and chapter_id=v_chapter and lower(name)=lower('Animal symmetry and body plan')) then insert into public.topics(organization_id,chapter_id,name,display_order,is_active) values(null,v_chapter,'Animal symmetry and body plan',3,true); end if;
 if not exists(select 1 from public.topics where organization_id is null and chapter_id=v_chapter and lower(name)=lower('General / Mixed Concepts')) then insert into public.topics(organization_id,chapter_id,name,display_order,is_active) values(null,v_chapter,'General / Mixed Concepts',4,true); end if;
end $$;
