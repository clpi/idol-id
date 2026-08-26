ALTER TABLE platform_repository_scaffold
  ADD COLUMN status TEXT NOT NULL DEFAULT 'preview'
  CHECK (status IN ('preview', 'refused'));

ALTER TABLE platform_repository_scaffold
  ADD COLUMN file_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE platform_repository_scaffold
  ADD COLUMN refusal_code TEXT;

UPDATE platform_repository_scaffold
SET
  status = CASE
    WHEN json_valid(document) AND json_extract(document, '$.status') = 'refused' THEN 'refused'
    ELSE 'preview'
  END,
  file_count = CASE
    WHEN json_valid(document) THEN COALESCE(json_array_length(document, '$.files'), 0)
    ELSE 0
  END,
  refusal_code = CASE
    WHEN json_valid(document) THEN json_extract(document, '$.refusal.code')
    ELSE NULL
  END;
