-- =============================================
-- Migration 22: Add message_type column to sms_logs
-- =============================================
-- Tracks what kind of message was sent: client_otp, admin_new, client_cancel, etc.
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'unknown';
