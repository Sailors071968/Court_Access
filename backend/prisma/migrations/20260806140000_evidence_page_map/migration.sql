-- Page boundaries for extracted evidence text.
--
-- Citations previously resolved only to a character offset in the document.
-- A brief cites a page and a line, so the extractor now records where each
-- page begins and ends within the text it produced, and that map is stored
-- alongside the evidence record.
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "pageMap" JSONB;
