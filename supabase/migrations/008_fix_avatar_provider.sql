-- Migration: Fix avatar provider to LiveAvatar
-- The IDs provided are from LiveAvatar, not Simli

-- Update "Venda de Seguro de Vida" scenario
UPDATE scenarios
SET
  avatar_provider = 'liveavatar',
  avatar_id = 'e9844e6d-847e-4964-a92b-7ecd066f69df'
WHERE id = '9394cfea-4e19-4c7e-a318-eb91c9eb3972';

-- Update "Apresentação de Proposta" scenario
UPDATE scenarios
SET
  avatar_provider = 'liveavatar',
  avatar_id = 'd1b25f7e-ef00-455b-af2f-62c84254924a'
WHERE id = '3ac8c8b6-27f9-46f8-a5fa-011c3212d64d';
