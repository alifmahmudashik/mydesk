-- Migration 003: per-client choice to display the company name instead of the contact name.
-- Run once in the Supabase SQL editor.

alter table clients add column if not exists use_company_name boolean not null default false;
