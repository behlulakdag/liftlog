package com.behlul.liftlog.repository;

import com.behlul.liftlog.entity.LiftGoal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LiftGoalRepository extends JpaRepository<LiftGoal, Long> {

    /** In the order they were set, so the list does not reshuffle when a target changes. */
    List<LiftGoal> findByUserIdOrderByIdAsc(Long userId);

    Optional<LiftGoal> findByUserIdAndExerciseId(Long userId, Long exerciseId);

    long countByUserId(Long userId);
}
