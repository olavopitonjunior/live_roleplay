-- Migration: Switch avatar provider from Simli to Hedra
-- Created: 2026-01-27

-- Update "Venda de Seguro de Vida" scenario with first Hedra avatar
UPDATE scenarios
SET
  avatar_provider = 'hedra',
  avatar_id = '20a5bee3-446b-48d8-8a29-b5c3adfebece'
WHERE title ILIKE '%Venda de Seguro de Vida%'
  OR title ILIKE '%seguro de vida%';

-- Update "Apresentação de Proposta" scenario with second Hedra avatar
UPDATE scenarios
SET
  avatar_provider = 'hedra',
  avatar_id = '366d7f86-3766-4751-8cbd-63e091e2571f'
WHERE title ILIKE '%Apresent%Proposta%'
  OR title ILIKE '%proposta%comercial%';

-- Update any remaining scenarios using Simli to use Hedra with default avatar
UPDATE scenarios
SET
  avatar_provider = 'hedra',
  avatar_id = '20a5bee3-446b-48d8-8a29-b5c3adfebece'
WHERE avatar_provider = 'simli'
  OR avatar_provider IS NULL;

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Migrated scenarios from Simli to Hedra';
END $$;
