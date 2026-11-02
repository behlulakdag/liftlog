package com.behlul.liftlog.service;

import com.behlul.liftlog.dto.WaterDtos.WaterDayResponse;
import com.behlul.liftlog.dto.WaterDtos.WaterSettings;
import com.behlul.liftlog.entity.User;
import com.behlul.liftlog.entity.WaterDay;
import com.behlul.liftlog.exception.FieldValidationException;
import com.behlul.liftlog.exception.ResourceNotFoundException;
import com.behlul.liftlog.repository.UserRepository;
import com.behlul.liftlog.repository.WaterDayRepository;
import com.behlul.liftlog.security.CurrentUserProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
public class WaterService {

    private final WaterDayRepository waterRepository;
    private final UserRepository userRepository;
    private final CurrentUserProvider currentUser;

    public WaterService(WaterDayRepository waterRepository, UserRepository userRepository,
                        CurrentUserProvider currentUser) {
        this.waterRepository = waterRepository;
        this.userRepository = userRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public WaterDayResponse getDay(LocalDate date) {
        return dayOf(loadUser(), date);
    }

    @Transactional
    public WaterDayResponse add(LocalDate date, int deltaMl) {
        if (deltaMl == 0) {
            throw new FieldValidationException("deltaMl", "must not be zero");
        }
        User user = loadUser();
        waterRepository.addWater(user.getId(), date, deltaMl);
        return dayOf(user, date);
    }

    /** Returns today's day with the new settings, so the screen can redraw from one response. */
    @Transactional
    public WaterDayResponse updateSettings(LocalDate date, WaterSettings settings) {
        User user = loadUser();
        user.setWaterSettings(settings.goalMl(), settings.glassMl());
        return dayOf(user, date);
    }

    private WaterDayResponse dayOf(User user, LocalDate date) {
        int waterMl = waterRepository.findByUserIdAndEntryDate(user.getId(), date).map(WaterDay::getWaterMl).orElse(0);
        return new WaterDayResponse(date, waterMl, user.getWaterGoalMl(), user.getGlassMl());
    }

    private User loadUser() {
        Long id = currentUser.currentUserId();
        return userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User", id));
    }
}
