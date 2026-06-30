/*
* public.is_super_admin
* Check if the user is a super admin.
* A Super Admin is a user that has the role 'super-admin'.
* MFA is no longer required for super admin access.
*/
create or replace function public.is_super_admin() returns boolean
    set search_path = '' as
$$
declare
    is_super_admin boolean;
begin
    select (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super-admin' into is_super_admin;

    return coalesce(is_super_admin, false);
end
$$ language plpgsql;
