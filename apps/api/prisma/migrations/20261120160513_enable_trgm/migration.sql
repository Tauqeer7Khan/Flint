-- Enable pg_trgm extension for fuzzy and trigram search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for fast global search (Cmd+K)
CREATE INDEX IF NOT EXISTS "accounts_name_trgm_idx" ON "accounts" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "contacts_name_trgm_idx" ON "contacts" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "deals_title_trgm_idx" ON "deals" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "leads_company_name_trgm_idx" ON "leads" USING gin ("company_name" gin_trgm_ops);
