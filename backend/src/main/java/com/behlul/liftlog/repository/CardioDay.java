package com.behlul.liftlog.repository;

import java.time.LocalDate;

/** One cardio move on one day: its sets added up. {@code distanceM} is null when no set of it had a distance. */
public record CardioDay(Long exerciseId, String exerciseName, LocalDate date, long durationSec, Long distanceM) {
}
