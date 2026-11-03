package com.behlul.liftlog.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class ProgramDtos {

    private ProgramDtos() {
    }

    /**
     * The block and its goals for the Workouts home.
     *
     * @param currentWeek 1 in the block's first week; past {@code blockWeeks} once it is over; null without a block
     */
    public record ProgramResponse(LocalDate blockStart, Integer blockWeeks, Integer currentWeek, List<LiftGoalResponse> goals,
                                  WeightGoalResponse weightGoal) {
    }

    /**
     * @param currentKg the best set so far; for a bodyweight exercise the added load alone, as a goal like
     *                  "pull-up + 10 kg" means it; 0 before any set
     */
    public record LiftGoalResponse(Long exerciseId, String exerciseName, boolean bodyweight, BigDecimal startKg,
                                   BigDecimal targetKg, BigDecimal currentKg) {
    }

    /** @param currentKg the newest weigh-in; null without one */
    public record WeightGoalResponse(BigDecimal startKg, BigDecimal targetKg, BigDecimal currentKg) {
    }

    /** Limits mirror the users CHECK constraint. */
    public record BlockRequest(@NotNull LocalDate startDate, @NotNull @Min(1) @Max(52) Integer weeks) {
    }

    public record LiftGoalRequest(
            @NotNull @DecimalMin("0.5") @DecimalMax("1000.0") @Digits(integer = 4, fraction = 2) BigDecimal targetKg) {
    }

    /** Limits mirror the users CHECK constraint. */
    public record WeightGoalRequest(
            @NotNull @DecimalMin("20.0") @DecimalMax("400.0") @Digits(integer = 3, fraction = 2) BigDecimal targetKg) {
    }
}
