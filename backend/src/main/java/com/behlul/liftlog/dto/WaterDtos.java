package com.behlul.liftlog.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public final class WaterDtos {

    private WaterDtos() {
    }

    /** @param goalMl null when the user has not set a daily goal */
    public record WaterDayResponse(LocalDate date, int waterMl, Integer goalMl, int glassMl) {
    }

    /** Negative takes water back. Zero is rejected: it would be a request that changes nothing. */
    public record WaterAddRequest(@NotNull @Min(-5000) @Max(5000) Integer deltaMl) {
    }

    /** Limits mirror the users CHECK constraints; a null goal clears it. */
    public record WaterSettings(@Min(250) @Max(10000) Integer goalMl, @NotNull @Min(50) @Max(1000) Integer glassMl) {
    }
}
