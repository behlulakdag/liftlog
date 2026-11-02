package com.behlul.liftlog.repository;

import com.behlul.liftlog.entity.WaterDay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface WaterDayRepository extends JpaRepository<WaterDay, Long> {

    Optional<WaterDay> findByUserIdAndEntryDate(Long userId, LocalDate entryDate);

    /**
     * Adds {@code deltaMl} (negative to take a glass back) to the day's total in one statement, so two quick taps
     * from two devices both count instead of one overwriting the other. The total stays within 0-20000 ml.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            INSERT INTO water_days (user_id, entry_date, water_ml)
            VALUES (:userId, :date, GREATEST(0, LEAST(20000, :deltaMl)))
            ON CONFLICT (user_id, entry_date) DO UPDATE
            SET water_ml = GREATEST(0, LEAST(20000, water_days.water_ml + :deltaMl)), updated_at = now()
            """, nativeQuery = true)
    void addWater(@Param("userId") Long userId, @Param("date") LocalDate date, @Param("deltaMl") int deltaMl);
}
