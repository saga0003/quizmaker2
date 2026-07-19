-- Optional Version 2 starter products. Run after 03_version_2_commerce.sql.
insert into public.products(name,slug,short_description,description,product_type,audience,exam_type,status,is_featured)
values
('NEET Complete Test Series','neet-complete-test-series','Full-syllabus NEET mock tests with performance analysis.','A launch package for students preparing for NEET, including full-length mock tests and progress analytics.','test_series','student','NEET','published',true),
('JEE Main Practice Series','jee-main-practice-series','JEE Main pattern tests across Physics, Chemistry and Mathematics.','Timed JEE Main practice papers designed for subject and overall performance tracking.','test_series','student','JEE Main','published',true),
('School Starter Plan','school-starter-plan','Run tests for up to 100 students.','School workspace, staff access, private question bank and entry-level examination controls.','school_subscription','school',null,'published',false)
on conflict(slug) do nothing;

insert into public.product_versions(product_id,version_number,mrp_paise,selling_price_paise,access_days,max_attempts,student_limit,features,is_current)
select p.id,1,599900,199900,365,20,null,'["20 full-length tests","Subject and chapter analysis","Attempt history","Mobile access"]'::jsonb,true
from public.products p where p.slug='neet-complete-test-series'
and not exists(select 1 from public.product_versions v where v.product_id=p.id);
insert into public.product_versions(product_id,version_number,mrp_paise,selling_price_paise,access_days,max_attempts,student_limit,features,is_current)
select p.id,1,399900,149900,180,15,null,'["15 JEE Main tests","PCM analytics","Rank and percentile-ready","Mobile access"]'::jsonb,true
from public.products p where p.slug='jee-main-practice-series'
and not exists(select 1 from public.product_versions v where v.product_id=p.id);
insert into public.product_versions(product_id,version_number,mrp_paise,selling_price_paise,access_days,max_attempts,student_limit,features,is_current)
select p.id,1,999900,599900,365,null,100,'["Up to 100 students","2 staff accounts","Private question bank","20 examinations"]'::jsonb,true
from public.products p where p.slug='school-starter-plan'
and not exists(select 1 from public.product_versions v where v.product_id=p.id);

insert into public.coupons(code,description,discount_type,discount_value,max_discount_paise,minimum_order_paise,usage_limit,per_user_limit,active)
values('LAUNCH10','Launch offer: 10% additional discount','percentage',10,50000,49900,1000,1,true)
on conflict(code) do nothing;
