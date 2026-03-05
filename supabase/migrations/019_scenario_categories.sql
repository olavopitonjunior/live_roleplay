-- Migration 019: Add category column to scenarios for folder-based organization
-- Existing scenarios are categorized as "Testes"

ALTER TABLE scenarios ADD COLUMN category VARCHAR(100) DEFAULT NULL;

-- Categorize existing scenarios
UPDATE scenarios SET category = 'Testes' WHERE category IS NULL;
