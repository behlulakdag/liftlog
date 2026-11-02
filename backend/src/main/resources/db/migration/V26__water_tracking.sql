-- Water intake: one running total per user per calendar day (the client's date). A tap on "a glass" adds the
-- user's glass size to it; there is no row per glass, since only the day's total is ever shown.
CREATE TABLE water_days (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_date DATE      NOT NULL,
    water_ml   INTEGER   NOT NULL CHECK (water_ml BETWEEN 0 AND 20000),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_water_days_user_date UNIQUE (user_id, entry_date)
);

-- The daily goal is null until the user sets one; the glass size has a default so the first tap just works.
ALTER TABLE users
    ADD COLUMN water_goal_ml INTEGER CHECK (water_goal_ml BETWEEN 250 AND 10000),
    ADD COLUMN glass_ml      INTEGER NOT NULL DEFAULT 250 CHECK (glass_ml BETWEEN 50 AND 1000);
