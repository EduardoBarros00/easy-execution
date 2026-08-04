
UPDATE public.prosthesis_types SET default_price = v.price FROM (VALUES
  ('23c42efb-f623-4278-85a5-8ef9d7ff452f'::uuid, 61.00),
  ('bc319d1d-db3d-431a-9ca9-da01ab29a11c'::uuid, 100.00),
  ('3fd9e872-f6b4-4b31-92eb-d4e90744cb59'::uuid, 100.00),
  ('8bd189cf-45b0-4dfd-9d64-cae814edb31e'::uuid, 100.00),
  ('f88c3bf9-4b04-4766-b8d1-c08021f9b333'::uuid, 61.00),
  ('179f80fa-8a2d-43ba-9937-4a9e07bcafd1'::uuid, 69.00),
  ('bcad6c6b-87f6-4c0b-b418-686caf17d22f'::uuid, 101.00),
  ('a6923f80-a680-48ca-8a41-01e51c419a9f'::uuid, 107.78),
  ('093a4465-22f5-415b-a2df-a0dfb4b7720e'::uuid, 100.00),
  ('e26707ee-eee5-4871-a678-57080ad7f9a6'::uuid, 170.00),
  ('e59fb611-4a0c-4e82-83e1-6e78cc880527'::uuid, 100.00),
  ('f4970fa6-9544-4bc7-8316-d904a72949dd'::uuid, 100.00)
) AS v(id, price)
WHERE public.prosthesis_types.id = v.id;
