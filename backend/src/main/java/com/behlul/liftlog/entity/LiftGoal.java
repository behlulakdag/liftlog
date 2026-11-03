package com.behlul.liftlog.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;

/** A target weight for one exercise by the end of the user's training block. */
@Entity
@Table(name = "lift_goals")
public class LiftGoal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "exercise_id", nullable = false, updatable = false)
    private Long exerciseId;

    @Column(name = "start_kg", nullable = false, updatable = false, precision = 6, scale = 2)
    private BigDecimal startKg;

    @Column(name = "target_kg", nullable = false, precision = 6, scale = 2)
    private BigDecimal targetKg;

    protected LiftGoal() {
    }

    public LiftGoal(Long userId, Long exerciseId, BigDecimal startKg, BigDecimal targetKg) {
        this.userId = userId;
        this.exerciseId = exerciseId;
        this.startKg = startKg;
        this.targetKg = targetKg;
    }

    public Long getExerciseId() {
        return exerciseId;
    }

    public BigDecimal getStartKg() {
        return startKg;
    }

    public BigDecimal getTargetKg() {
        return targetKg;
    }

    public void setTargetKg(BigDecimal targetKg) {
        this.targetKg = targetKg;
    }
}
