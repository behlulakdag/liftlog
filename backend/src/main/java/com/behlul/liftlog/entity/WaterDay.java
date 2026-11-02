package com.behlul.liftlog.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

/** How much water a user drank on one day. Written only through {@code WaterDayRepository.addWater}. */
@Entity
@Table(name = "water_days")
public class WaterDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "entry_date", nullable = false, updatable = false)
    private LocalDate entryDate;

    @Column(name = "water_ml", nullable = false)
    private int waterMl;

    protected WaterDay() {
    }

    public LocalDate getEntryDate() {
        return entryDate;
    }

    public int getWaterMl() {
        return waterMl;
    }
}
