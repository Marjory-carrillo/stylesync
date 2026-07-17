-- Migration 47: Set replica identity full for appointments and waiting_list tables to allow full payload on UPDATE events
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER TABLE public.waiting_list REPLICA IDENTITY FULL;
