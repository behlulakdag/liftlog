package com.behlul.liftlog.repository;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One logged set, flattened with its workout and exercise for the CSV export. A cardio set ({@code cardio}) carries
 * its time, distance and calories; its weight and reps are the stored 0 and 1, which the export leaves out.
 */
public record ExportedSet(LocalDate workoutDate, String workoutNotes, String exerciseName, int setOrder,
                          BigDecimal weightKg, int reps, BigDecimal rpe, boolean bodyweight, boolean cardio,
                          Integer durationSec, Integer distanceM, Integer calories) {
}
