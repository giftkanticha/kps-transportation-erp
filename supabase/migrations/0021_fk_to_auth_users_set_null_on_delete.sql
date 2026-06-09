-- Allow deleting an auth.users row (via admin_delete_user) without blowing up
-- on audit/history FKs that referenced it with default RESTRICT semantics.
-- All target columns are already nullable; ON DELETE SET NULL preserves the
-- log entries while clearing the reference to the deleted user.

ALTER TABLE public.user_profiles
  DROP CONSTRAINT user_profiles_approved_by_fkey,
  ADD  CONSTRAINT user_profiles_approved_by_fkey
       FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.user_permissions
  DROP CONSTRAINT user_permissions_granted_by_fkey,
  ADD  CONSTRAINT user_permissions_granted_by_fkey
       FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.acl_audit_log
  DROP CONSTRAINT acl_audit_log_actor_id_fkey,
  ADD  CONSTRAINT acl_audit_log_actor_id_fkey
       FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.acl_audit_log
  DROP CONSTRAINT acl_audit_log_target_id_fkey,
  ADD  CONSTRAINT acl_audit_log_target_id_fkey
       FOREIGN KEY (target_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.data_reset_log
  DROP CONSTRAINT data_reset_log_reset_by_fkey,
  ADD  CONSTRAINT data_reset_log_reset_by_fkey
       FOREIGN KEY (reset_by) REFERENCES auth.users(id) ON DELETE SET NULL;
