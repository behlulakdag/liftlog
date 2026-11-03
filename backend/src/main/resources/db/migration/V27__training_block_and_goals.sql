-- A training block ("12 weeks from 18 October") and the goals for its end. One block at a time, so it lives on
-- the user; null until set. The weight goal keeps the weight it started from, so progress has a baseline.
ALTER TABLE users
    ADD COLUMN block_start_date     DATE,
    ADD COLUMN block_weeks          INTEGER CHECK (block_weeks BETWEEN 1 AND 52),
    ADD COLUMN weight_goal_kg       NUMERIC(5,2) CHECK (weight_goal_kg BETWEEN 20 AND 400),
    ADD COLUMN weight_goal_start_kg NUMERIC(5,2) CHECK (weight_goal_start_kg BETWEEN 20 AND 400);

-- A target weight for one exercise. start_kg is the best set when the goal was made, so the bar shows how much of
-- the way is done; the current best is computed from the sets, never stored.
CREATE TABLE lift_goals (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id BIGINT       NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    start_kg    NUMERIC(6,2) NOT NULL CHECK (start_kg BETWEEN 0 AND 1000),
    target_kg   NUMERIC(6,2) NOT NULL CHECK (target_kg > 0 AND target_kg <= 1000),
    created_at  TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT uq_lift_goals_user_exercise UNIQUE (user_id, exercise_id)
);
