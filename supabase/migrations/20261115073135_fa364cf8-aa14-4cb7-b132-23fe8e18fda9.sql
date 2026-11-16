UPDATE public.user_roles
SET role = 'super_admin'
WHERE user_id IN (SELECT id FROM public.profiles WHERE lower(email) = 'vitophysio256@gmail.com')
  AND role = 'vito_admin';