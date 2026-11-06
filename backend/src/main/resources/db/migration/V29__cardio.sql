-- Cardio: a set is a stretch of time (and maybe a distance) instead of weight × reps. Cardio moves are told apart by
-- their equipment, the way bodyweight moves are: equipment CARDIO, never bodyweight. A cardio set keeps reps = 1 and
-- weight = 0, so every volume sum and set count stays correct without knowing about cardio.
ALTER TABLE exercises DROP CONSTRAINT exercises_equipment_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_equipment_check
    CHECK (equipment IN ('BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'CARDIO'));

ALTER TABLE workout_sets
    ADD COLUMN duration_sec INTEGER CHECK (duration_sec BETWEEN 1 AND 86400),
    ADD COLUMN distance_m   INTEGER CHECK (distance_m BETWEEN 0 AND 1000000),
    ADD COLUMN calories     INTEGER CHECK (calories BETWEEN 0 AND 10000);

-- Names already in the list (a user's own exercise does not count) are skipped
INSERT INTO exercises (name, muscle_group, equipment, bodyweight)
SELECT name, 'Cardio', 'CARDIO', false
FROM (VALUES ('Running'), ('Treadmill'), ('Incline Treadmill Walk'), ('Walking'), ('Hiking'), ('Outdoor Cycling'),
             ('Stationary Bike'), ('Assault Bike'), ('Elliptical'), ('Rowing Machine'), ('Stair Climber'),
             ('Jump Rope'), ('Swimming'), ('Ski Erg')) AS cardio(name)
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.user_id IS NULL AND lower(e.name) = lower(cardio.name));
