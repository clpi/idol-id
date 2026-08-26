PRAGMA foreign_keys = ON;

ALTER TABLE platform_token ADD COLUMN last_scope TEXT;

CREATE TRIGGER IF NOT EXISTS platform_token_audit_created
AFTER INSERT ON platform_token
BEGIN
  INSERT INTO platform_audit(
    id, subject, actor_email, type, target, metadata, created_at
  )
  SELECT
    lower(hex(randomblob(16))),
    NEW.subject,
    profile.email,
    'token.created',
    NEW.id,
    json_object(
      'name', NEW.name,
      'scopes', json(NEW.scopes),
      'expires_at', NEW.expires_at
    ),
    NEW.created_at
  FROM platform_profile AS profile
  WHERE profile.subject = NEW.subject;
END;

CREATE TRIGGER IF NOT EXISTS platform_token_audit_used
AFTER UPDATE OF last_used_at ON platform_token
WHEN NEW.last_used_at IS NOT NULL
 AND (
   OLD.last_used_at IS NULL
   OR OLD.last_used_at <> NEW.last_used_at
   OR COALESCE(OLD.last_scope, '') <> COALESCE(NEW.last_scope, '')
 )
BEGIN
  INSERT INTO platform_audit(
    id, subject, actor_email, type, target, metadata, created_at
  )
  SELECT
    lower(hex(randomblob(16))),
    NEW.subject,
    profile.email,
    'token.used',
    NEW.id,
    json_object('scope', NEW.last_scope),
    NEW.last_used_at
  FROM platform_profile AS profile
  WHERE profile.subject = NEW.subject;
END;

CREATE TRIGGER IF NOT EXISTS platform_token_audit_revoked
AFTER UPDATE OF revoked_at ON platform_token
WHEN OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
BEGIN
  INSERT INTO platform_audit(
    id, subject, actor_email, type, target, metadata, created_at
  )
  SELECT
    lower(hex(randomblob(16))),
    NEW.subject,
    profile.email,
    'token.revoked',
    NEW.id,
    json_object('name', NEW.name),
    NEW.revoked_at
  FROM platform_profile AS profile
  WHERE profile.subject = NEW.subject;
END;
