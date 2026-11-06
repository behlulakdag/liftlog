package com.behlul.liftlog.service;

import com.behlul.liftlog.dto.ExportDtos.ExportedProfile;
import com.behlul.liftlog.entity.User;
import com.behlul.liftlog.exception.ResourceNotFoundException;
import com.behlul.liftlog.repository.ExportRepository;
import com.behlul.liftlog.repository.ExportedFoodEntry;
import com.behlul.liftlog.repository.ExportedSet;
import com.behlul.liftlog.repository.UserRepository;
import com.behlul.liftlog.repository.WaterDayRepository;
import com.behlul.liftlog.repository.WeightEntryRepository;
import com.behlul.liftlog.security.CurrentUserProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Lets users take their own data with them. Every method writes straight to the given stream (the HTTP
 * response) while rows arrive from the database, so a long history never sits in memory as one string.
 * Only the caller's rows are read: the user id comes from the token, never from the request.
 */
@Service
public class ExportService {

    public static final String WORKOUTS_ENTRY = "antrenman.csv";
    public static final String NUTRITION_ENTRY = "beslenme.csv";
    public static final String WEIGHT_ENTRY = "kilo.csv";
    public static final String WATER_ENTRY = "su.csv";
    public static final String PROFILE_ENTRY = "profile.json";

    private final ExportRepository exportRepository;
    private final WeightEntryRepository weightRepository;
    private final WaterDayRepository waterRepository;
    private final UserRepository userRepository;
    private final CurrentUserProvider currentUser;
    private final JsonMapper jsonMapper;

    public ExportService(ExportRepository exportRepository, WeightEntryRepository weightRepository,
                         WaterDayRepository waterRepository, UserRepository userRepository,
                         CurrentUserProvider currentUser, JsonMapper jsonMapper) {
        this.exportRepository = exportRepository;
        this.weightRepository = weightRepository;
        this.waterRepository = waterRepository;
        this.userRepository = userRepository;
        this.currentUser = currentUser;
        this.jsonMapper = jsonMapper;
    }

    /** The transaction keeps the database cursor open while the rows stream out. */
    @Transactional(readOnly = true)
    public void writeWorkoutsCsv(OutputStream out) {
        writeWorkouts(loadUser(), out);
    }

    @Transactional(readOnly = true)
    public void writeNutritionCsv(OutputStream out) {
        writeNutrition(loadUser().getId(), out);
    }

    /** Every CSV and the profile in one ZIP, read in one transaction so they describe the same moment. */
    @Transactional(readOnly = true)
    public void writeAllZip(OutputStream out) throws IOException {
        User user = loadUser();
        ZipOutputStream zip = new ZipOutputStream(out);
        zip.putNextEntry(new ZipEntry(WORKOUTS_ENTRY));
        writeWorkouts(user, zip);
        zip.closeEntry();
        zip.putNextEntry(new ZipEntry(NUTRITION_ENTRY));
        writeNutrition(user.getId(), zip);
        zip.closeEntry();
        // At most one row per day each, so a plain list is small enough; no streaming needed
        zip.putNextEntry(new ZipEntry(WEIGHT_ENTRY));
        CsvWriter weights = CsvWriter.start(zip, "Tarih", "Kilo (kg)");
        weightRepository.findByUserIdOrderByEntryDateAsc(user.getId())
                .forEach(entry -> weights.row(entry.getEntryDate(), entry.getWeightKg()));
        weights.flush();
        zip.closeEntry();
        zip.putNextEntry(new ZipEntry(WATER_ENTRY));
        CsvWriter water = CsvWriter.start(zip, "Tarih", "Su (ml)");
        waterRepository.findByUserIdOrderByEntryDateAsc(user.getId())
                .forEach(day -> water.row(day.getEntryDate(), day.getWaterMl()));
        water.flush();
        zip.closeEntry();
        zip.putNextEntry(new ZipEntry(PROFILE_ENTRY));
        zip.write(jsonMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(ExportedProfile.from(user)));
        zip.closeEntry();
        // finish, not close: the servlet container owns the response stream
        zip.finish();
    }

    private void writeWorkouts(User user, OutputStream out) {
        // The cardio columns come last, so a sheet built on the older layout still finds its columns
        CsvWriter csv = CsvWriter.start(out, "Tarih", "Antrenman notu", "Egzersiz", "Set", "Ağırlık (kg)",
                "Tekrar", "RPE", "Vücut ağırlığı", "Tahmini 1RM (kg)", "Süre (dk)", "Mesafe (km)", "Kalori (kcal)");
        try (Stream<ExportedSet> sets = exportRepository.streamSets(user.getId())) {
            sets.forEach(set -> {
                if (set.cardio()) {
                    csv.row(set.workoutDate(), set.workoutNotes(), set.exerciseName(), set.setOrder(), null, null, null,
                            "hayır", null, minutes(set.durationSec()), kilometres(set.distanceM()), set.calories());
                } else {
                    csv.row(set.workoutDate(), set.workoutNotes(), set.exerciseName(), set.setOrder(),
                            set.weightKg(), set.reps(), set.rpe(), set.bodyweight() ? "evet" : "hayır",
                            estimatedOneRepMax(set, user.getBodyWeightKg()), null, null, null);
                }
            });
        }
        csv.flush();
    }

    /** 1815 s → 30,25: minutes with decimals sum and chart in a spreadsheet, unlike "30:15" text */
    private static BigDecimal minutes(Integer seconds) {
        return seconds == null ? null : BigDecimal.valueOf(seconds).divide(BigDecimal.valueOf(60), 2, java.math.RoundingMode.HALF_UP)
                .stripTrailingZeros();
    }

    private static BigDecimal kilometres(Integer metres) {
        return metres == null ? null : BigDecimal.valueOf(metres).movePointLeft(3).stripTrailingZeros();
    }

    private void writeNutrition(Long userId, OutputStream out) {
        // "Miktar (g)" sits next to the name it describes; empty when the portion is unknown
        CsvWriter csv = CsvWriter.start(out, "Tarih", "Yemek", "Miktar (g)", "Kalori (kcal)", "Protein (g)",
                "Karbonhidrat (g)", "Yağ (g)");
        try (Stream<ExportedFoodEntry> entries = exportRepository.streamFoodEntries(userId)) {
            entries.forEach(entry -> csv.row(entry.entryDate(), entry.name(), entry.grams(), entry.caloriesKcal(),
                    entry.proteinG(), entry.carbsG(), entry.fatG()));
        }
        csv.flush();
    }

    /**
     * Same rule as personal records in the app: for a bodyweight exercise the logged weight is the added
     * load, so the lifter's (current) body weight counts too when it is known.
     */
    static BigDecimal estimatedOneRepMax(ExportedSet set, BigDecimal bodyWeightKg) {
        if (set.reps() < 1) {
            return null;
        }
        BigDecimal load = set.bodyweight() && bodyWeightKg != null ? set.weightKg().add(bodyWeightKg) : set.weightKg();
        return OneRepMax.estimate(load, set.reps());
    }

    private User loadUser() {
        Long userId = currentUser.currentUserId();
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
    }
}
