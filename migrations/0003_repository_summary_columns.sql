ALTER TABLE platform_repository_observation
  ADD COLUMN file_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE platform_repository_observation
  ADD COLUMN inventory_truncated INTEGER NOT NULL DEFAULT 0
  CHECK (inventory_truncated IN (0, 1));

UPDATE platform_repository_observation
SET
  file_count = CASE
    WHEN json_valid(document) THEN COALESCE(CAST(json_extract(document, '$.inventory.file_count') AS INTEGER), 0)
    ELSE 0
  END,
  inventory_truncated = CASE
    WHEN json_valid(document) THEN CASE
      WHEN COALESCE(json_extract(document, '$.inventory.truncated'), 0) THEN 1
      ELSE 0
    END
    ELSE 0
  END;

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
    WHEN json_valid(document) THEN COALESCE(json_extract(document, '$.status'), 'preview')
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
