-- First-boot init for Compose postgres:16 (database already = quetzal).
-- Full DDL lives in db/migrations/001_init.sql (QZ-PG-1).
CREATE SCHEMA IF NOT EXISTS quetzal;
ALTER DATABASE quetzal SET search_path TO quetzal, public;
