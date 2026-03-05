-- Migration 023: Add character_gender, fix session_types, deactivate duplicates
--
-- Changes:
-- 1. Add character_gender column to scenarios (male/female)
-- 2. Populate character_gender for all active scenarios
-- 3. Fix session_type for Venda de Seguro and Apresentacao (should be 'apresentacao')
-- 4. Fix Retencao character_name collision (same as B2B)
-- 5. Deactivate duplicate scenarios (Marcia Helena Santos, Sergio Almeida)

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. ADD character_gender COLUMN
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS character_gender VARCHAR(10)
  CHECK (character_gender IN ('male', 'female'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. POPULATE character_gender FOR ALL ACTIVE SCENARIOS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Female characters
UPDATE scenarios SET character_gender = 'female' WHERE id IN (
  'aadef0ee-3c28-4097-9e00-621f30ecd480',  -- Helena Silva Costa
  'e52819ed-941d-4bb2-83c3-48c394417866',  -- Márcia Helena Santos
  'b233a115-f80f-4f5a-bc87-42096aefe406',  -- Sandra Ferreira
  'f3fd6489-bc3d-442b-a95a-b24b42fc024d'   -- Amanda Ferreira
);

-- Male characters
UPDATE scenarios SET character_gender = 'male' WHERE id IN (
  '2bef6420-c23c-4598-a774-01aa0376e457',  -- Sérgio Almeida
  '7e1c97dc-835a-4a52-9efc-c4dfbfe8a365',  -- Fernando Almeida
  '4a586d1d-b261-4b8a-939d-c7cfcd64ebea',  -- Carlos Roberto Silva
  '6d609c9b-e5af-409a-859a-a534286289ce',  -- Dr. Fernando Costa
  'eda41f1b-d7da-4a68-b95a-add6e00626d9',  -- Paulo Mendes
  '05719d8b-9cad-4cc6-9bcb-f53df9d87e6a',  -- Ricardo Torres
  '0cff2171-3a6f-4e2d-a1fb-01e9456d40f0',  -- Marcos Ribeiro
  '3f562741-9109-48a7-9917-46f2209764da',  -- Ricardo Oliveira
  '3ac8c8b6-27f9-46f8-a5fa-011c3212d64d',  -- Dr. Ricardo Vasconcelos
  'e8f49f05-bd0a-4694-bc7e-6c7145e5283f',  -- Carlos Eduardo Mendes
  'cc2baea3-f9b2-4415-87bf-598168d14501',  -- Retencao (Andre Carvalho)
  '9394cfea-4e19-4c7e-a318-eb91c9eb3972'   -- Roberto Silva
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. FIX session_type FOR SCHEDULED MEETINGS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Venda de Seguro de Vida: client scheduled this meeting after seeing an ad
UPDATE scenarios SET session_type = 'apresentacao'
WHERE id = '9394cfea-4e19-4c7e-a318-eb91c9eb3972';

-- Apresentação de Proposta: scheduled presentation meeting
UPDATE scenarios SET session_type = 'apresentacao'
WHERE id = '3ac8c8b6-27f9-46f8-a5fa-011c3212d64d';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. FIX RETENCAO character_name COLLISION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Retencao was sharing "Carlos Eduardo Mendes" with B2B Negociacao
UPDATE scenarios SET
  character_name = 'Andre Carvalho',
  character_role = 'Gerente de TI de e-commerce'
WHERE id = 'cc2baea3-f9b2-4415-87bf-598168d14501';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. DEACTIVATE DUPLICATE SCENARIOS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Márcia Helena Santos: duplicate of Helena Silva Costa (same age, same anti-broker concept)
-- Sérgio Almeida: duplicate of Fernando Almeida (same recruiter cold call concept)
UPDATE scenarios SET is_active = false WHERE id IN (
  'e52819ed-941d-4bb2-83c3-48c394417866',  -- Márcia Helena Santos
  '2bef6420-c23c-4598-a774-01aa0376e457'   -- Sérgio Almeida
);
