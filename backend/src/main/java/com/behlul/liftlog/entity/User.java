package com.behlul.liftlog.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "height_cm", precision = 4, scale = 1)
    private BigDecimal heightCm;

    @Column(name = "body_weight_kg", precision = 5, scale = 2)
    private BigDecimal bodyWeightKg;

    /** Raised by every password change; tokens carrying an older value are rejected (TokenVersionValidator). */
    @Column(name = "token_version", nullable = false)
    private int tokenVersion;

    @Column(name = "calorie_goal_kcal")
    private Integer calorieGoalKcal;

    @Column(name = "protein_goal_g")
    private Integer proteinGoalG;

    @Column(name = "water_goal_ml")
    private Integer waterGoalMl;

    /** What one tap on "a glass" adds to the day's water. */
    @Column(name = "glass_ml", nullable = false)
    private int glassMl = 250;

    @Column(name = "block_start_date")
    private LocalDate blockStartDate;

    @Column(name = "block_weeks")
    private Integer blockWeeks;

    @Column(name = "weight_goal_kg", precision = 5, scale = 2)
    private BigDecimal weightGoalKg;

    /** The weight when the goal was set, so the goal's progress has a baseline */
    @Column(name = "weight_goal_start_kg", precision = 5, scale = 2)
    private BigDecimal weightGoalStartKg;

    /** The WebAuthn user handle inside every passkey of this account; null until the first passkey. */
    @Column(name = "passkey_handle", unique = true)
    private byte[] passkeyHandle;

    /** Opt-in: the user's group may see their training summary (counts and e1RMs, never workout details). */
    @Column(name = "share_training", nullable = false)
    private boolean shareTraining;

    protected User() {
    }

    public User(String email, String passwordHash, String displayName) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    /**
     * Stores a new password hash and invalidates every token issued before it. This is the only way to
     * change a password, so no future feature can change one and forget to sign other devices out.
     */
    public void changePassword(String newPasswordHash) {
        this.passwordHash = newPasswordHash;
        this.tokenVersion++;
    }

    public int getTokenVersion() {
        return tokenVersion;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public BigDecimal getHeightCm() {
        return heightCm;
    }

    public void setHeightCm(BigDecimal heightCm) {
        this.heightCm = heightCm;
    }

    public BigDecimal getBodyWeightKg() {
        return bodyWeightKg;
    }

    public void setBodyWeightKg(BigDecimal bodyWeightKg) {
        this.bodyWeightKg = bodyWeightKg;
    }

    public Integer getCalorieGoalKcal() {
        return calorieGoalKcal;
    }

    public Integer getProteinGoalG() {
        return proteinGoalG;
    }

    public void setNutritionGoals(Integer calorieGoalKcal, Integer proteinGoalG) {
        this.calorieGoalKcal = calorieGoalKcal;
        this.proteinGoalG = proteinGoalG;
    }

    public Integer getWaterGoalMl() {
        return waterGoalMl;
    }

    public int getGlassMl() {
        return glassMl;
    }

    public void setWaterSettings(Integer waterGoalMl, int glassMl) {
        this.waterGoalMl = waterGoalMl;
        this.glassMl = glassMl;
    }

    public LocalDate getBlockStartDate() {
        return blockStartDate;
    }

    public Integer getBlockWeeks() {
        return blockWeeks;
    }

    /** Both null clears the block */
    public void setBlock(LocalDate startDate, Integer weeks) {
        this.blockStartDate = startDate;
        this.blockWeeks = weeks;
    }

    public BigDecimal getWeightGoalKg() {
        return weightGoalKg;
    }

    public BigDecimal getWeightGoalStartKg() {
        return weightGoalStartKg;
    }

    public void setWeightGoal(BigDecimal targetKg, BigDecimal startKg) {
        this.weightGoalKg = targetKg;
        this.weightGoalStartKg = startKg;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public boolean isShareTraining() {
        return shareTraining;
    }

    public void setShareTraining(boolean shareTraining) {
        this.shareTraining = shareTraining;
    }

    public byte[] getPasskeyHandle() {
        return passkeyHandle;
    }

    /** Set once: every passkey already made carries the handle, so changing it would orphan them. */
    public void assignPasskeyHandle(byte[] handle) {
        if (passkeyHandle != null) {
            throw new IllegalStateException("Passkey handle is already set");
        }
        this.passkeyHandle = handle;
    }
}
