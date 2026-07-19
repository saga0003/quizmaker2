-- Replace the email below with the email you used to register in ScholarOS.
update public.profiles
set role = 'super_admin'
where id = (
  select id from auth.users where email = 'YOUR_EMAIL_HERE'
);

select p.id, u.email, p.full_name, p.role
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'YOUR_EMAIL_HERE';
