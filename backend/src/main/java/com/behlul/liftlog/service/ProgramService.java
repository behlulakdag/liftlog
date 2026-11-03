package com.behlul.liftlog.service;

import com.behlul.liftlog.dto.ProgramDtos.LiftGoalResponse;
import com.behlul.liftlog.dto.ProgramDtos.ProgramResponse;
import com.behlul.liftlog.dto.ProgramDtos.WeightGoalResponse;
import com.behlul.liftlog.dto.StatsDtos.PersonalRecordResponse;
import com.behlul.liftlog.entity.Exercise;
import com.behlul.liftlog.entity.LiftGoal;
import com.behlul.liftlog.entity.User;
import com.behlul.liftlog.entity.WeightEntry;
import com.behlul.liftlog.exception.FieldValidationException;
import com.behlul.liftlog.exception.ResourceNotFoundException;
import com.behlul.liftlog.repository.ExerciseRepository;
import com.behlul.liftlog.repository.LiftGoalRepository;
import com.behlul.liftlog.repository.UserRepository;
import com.behlul.liftlog.repository.WeightEntryRepository;
import com.behlul.liftlog.security.CurrentUserProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** The user's training block ("week 3 of 12") and the goals for its end. */
@Service
public class ProgramService {

    /** Enough for the main lifts; more would crowd the home screen */
    static final int MAX_GOALS = 6;

    private final UserRepository userRepository;
    private final LiftGoalRepository goalRepository;
    private final ExerciseRepository exerciseRepository;
    private final WeightEntryRepository weightRepository;
    private final StatsService statsService;
    private final CurrentUserProvider currentUser;

    public ProgramService(UserRepository userRepository, LiftGoalRepository goalRepository,
                          ExerciseRepository exerciseRepository, WeightEntryRepository weightRepository,
                          StatsService statsService, CurrentUserProvider currentUser) {
        this.userRepository = userRepository;
        this.goalRepository = goalRepository;
        this.exerciseRepository = exerciseRepository;
        this.weightRepository = weightRepository;
        this.statsService = statsService;
        this.currentUser = currentUser;
    }

    /** @param today the phone's date, so the week turns over at the user's midnight */
    @Transactional(readOnly = true)
    public ProgramResponse get(LocalDate today) {
        User user = loadUser();
        Integer currentWeek = null;
        if (user.getBlockStartDate() != null) {
            long days = ChronoUnit.DAYS.between(user.getBlockStartDate(), today);
            currentWeek = (int) Math.max(1, days / 7 + 1);
        }

        List<LiftGoal> goals = goalRepository.findByUserIdOrderByIdAsc(user.getId());
        Map<Long, Exercise> exercises = exerciseRepository
                .findVisibleByIds(goals.stream().map(LiftGoal::getExerciseId).toList(), user.getId()).stream()
                .collect(Collectors.toMap(Exercise::getId, Function.identity()));
        Map<Long, PersonalRecordResponse> records = recordsByExercise();
        List<LiftGoalResponse> goalResponses = goals.stream()
                .filter(goal -> exercises.containsKey(goal.getExerciseId()))
                .map(goal -> {
                    Exercise exercise = exercises.get(goal.getExerciseId());
                    return new LiftGoalResponse(exercise.getId(), exercise.getName(), exercise.isBodyweight(),
                            goal.getStartKg(), goal.getTargetKg(), bestKg(records.get(exercise.getId())));
                })
                .toList();

        WeightGoalResponse weightGoal = user.getWeightGoalKg() == null ? null
                : new WeightGoalResponse(user.getWeightGoalStartKg(), user.getWeightGoalKg(), currentWeight(user));
        return new ProgramResponse(user.getBlockStartDate(), user.getBlockWeeks(), currentWeek, goalResponses, weightGoal);
    }

    @Transactional
    public ProgramResponse setBlock(LocalDate startDate, int weeks, LocalDate today) {
        loadUser().setBlock(startDate, weeks);
        return get(today);
    }

    @Transactional
    public void clearBlock() {
        loadUser().setBlock(null, null);
    }

    /** Creates the goal from today's best set, or changes the target of one that exists (its start stays). */
    @Transactional
    public ProgramResponse setLiftGoal(Long exerciseId, BigDecimal targetKg, LocalDate today) {
        Long userId = currentUser.currentUserId();
        Exercise exercise = exerciseRepository.findVisibleById(exerciseId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Exercise", exerciseId));
        goalRepository.findByUserIdAndExerciseId(userId, exerciseId).ifPresentOrElse(
                goal -> goal.setTargetKg(targetKg),
                () -> {
                    if (goalRepository.countByUserId(userId) >= MAX_GOALS) {
                        throw new FieldValidationException("exerciseId", "at most " + MAX_GOALS + " goals");
                    }
                    BigDecimal start = bestKg(recordsByExercise().get(exercise.getId()));
                    goalRepository.save(new LiftGoal(userId, exercise.getId(), start, targetKg));
                });
        return get(today);
    }

    @Transactional
    public void deleteLiftGoal(Long exerciseId) {
        LiftGoal goal = goalRepository.findByUserIdAndExerciseId(currentUser.currentUserId(), exerciseId)
                .orElseThrow(() -> new ResourceNotFoundException("Goal", exerciseId));
        goalRepository.delete(goal);
    }

    /** A new target keeps the original starting weight; a first one starts from the newest weigh-in. */
    @Transactional
    public ProgramResponse setWeightGoal(BigDecimal targetKg, LocalDate today) {
        User user = loadUser();
        BigDecimal start = user.getWeightGoalStartKg() != null ? user.getWeightGoalStartKg() : currentWeight(user);
        user.setWeightGoal(targetKg, start);
        return get(today);
    }

    @Transactional
    public void clearWeightGoal() {
        loadUser().setWeightGoal(null, null);
    }

    private Map<Long, PersonalRecordResponse> recordsByExercise() {
        return statsService.personalRecords().stream()
                .collect(Collectors.toMap(PersonalRecordResponse::exerciseId, Function.identity()));
    }

    /** The heaviest set; for a bodyweight exercise the load added on top of the body. */
    private static BigDecimal bestKg(PersonalRecordResponse record) {
        if (record == null) {
            return BigDecimal.ZERO;
        }
        if (record.bodyweight()) {
            return record.heaviestAddedKg() == null ? BigDecimal.ZERO : record.heaviestAddedKg();
        }
        return record.heaviestWeightKg();
    }

    private BigDecimal currentWeight(User user) {
        return weightRepository.findFirstByUserIdOrderByEntryDateDesc(user.getId())
                .map(WeightEntry::getWeightKg)
                .orElse(user.getBodyWeightKg());
    }

    private User loadUser() {
        Long id = currentUser.currentUserId();
        return userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User", id));
    }
}
