ALTER TABLE platform_repository_observation
  ADD COLUMN coordinate TEXT NOT NULL DEFAULT '';

ALTER TABLE platform_repository_observation
  ADD COLUMN requested_ref TEXT NOT NULL DEFAULT 'HEAD';

ALTER TABLE platform_repository_observation
  ADD COLUMN default_branch TEXT NOT NULL DEFAULT '';

ALTER TABLE platform_repository_observation
  ADD COLUMN file_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE platform_repository_observation
  ADD COLUMN truncated INTEGER NOT NULL DEFAULT 0 CHECK (truncated IN (0, 1));

UPDATE platform_repository_observation
SET
  coordinate = COALESCE(
    NULLIF(json_extract(document, '$.coordinate'), ''),
    provider || ':' || namespace || '/' || repository
  ),
  requested_ref = COALESCE(
    NULLIF(json_extract(document, '$.requested_ref'), ''),
    'HEAD'
  ),
  default_branch = COALESCE(
    NULLIF(json_extract(document, '$.default_branch'), ''),
    NULLIF(json_extract(document, '$.requested_ref'), ''),
    'HEAD'
  ),
  file_count = COALESCE(
    CAST(json_extract(document, '$.inventory.file_count') AS INTEGER),
    0
  ),
  truncated = CASE
    WHEN json_extract(document, '$.inventory.truncated') IN (1, '1', 'true') THEN 1
    ELSE 0
  END;
