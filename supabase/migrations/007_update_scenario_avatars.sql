-- Migration: Update avatar IDs for specific scenarios
-- Adds Simli avatar IDs to training scenarios

-- Update "Venda de Seguro de Vida" scenario
UPDATE scenarios
SET
  avatar_provider = 'simli',
  avatar_id = 'e9844e6d-847e-4964-a92b-7ecd066f69df'
WHERE title ILIKE '%Venda de Seguro de Vida%'
  OR title ILIKE '%seguro de vida%';

-- Update "Apresentação de Proposta" scenario
UPDATE scenarios
SET
  avatar_provider = 'simli',
  avatar_id = 'd1b25f7e-ef00-455b-af2f-62c84254924a'
WHERE title ILIKE '%Apresent%Proposta%'
  OR title ILIKE '%proposta%comercial%';

-- Verify the updates
-- SELECT id, title, avatar_provider, avatar_id FROM scenarios WHERE avatar_id IS NOT NULL;
