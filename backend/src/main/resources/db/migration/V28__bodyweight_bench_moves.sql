-- Moves done on a bench or a GHD with the body as the load were seeded as machines, so their weight field asked for
-- a load and a set logged at 0 kg added nothing to the volume. Like the calisthenics of V5 they are bodyweight
-- moves: the logged weight is the load added on top (a plate held to the chest), and the body counts too.
UPDATE exercises
SET bodyweight = true, equipment = 'BODYWEIGHT'
WHERE user_id IS NULL
  AND name IN ('Back Extension', '45° Back Extension', 'GHD Sit-up', 'Glute-Ham Raise');
