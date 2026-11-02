package com.behlul.liftlog.controller;

import com.behlul.liftlog.dto.WaterDtos.WaterAddRequest;
import com.behlul.liftlog.dto.WaterDtos.WaterDayResponse;
import com.behlul.liftlog.dto.WaterDtos.WaterSettings;
import com.behlul.liftlog.service.WaterService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/** The date is always the phone's calendar date, like the nutrition day, so "today" follows its time zone. */
@RestController
@RequestMapping("/api/v1/water")
public class WaterController {

    private final WaterService waterService;

    public WaterController(WaterService waterService) {
        this.waterService = waterService;
    }

    @GetMapping("/days/{date}")
    public WaterDayResponse day(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return waterService.getDay(date);
    }

    /** POST, not PUT: each tap adds to the total, so repeating it is meant to count again. */
    @PostMapping("/days/{date}/add")
    public WaterDayResponse add(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                @Valid @RequestBody WaterAddRequest request) {
        return waterService.add(date, request.deltaMl());
    }

    @PutMapping("/days/{date}/settings")
    public WaterDayResponse updateSettings(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                           @Valid @RequestBody WaterSettings settings) {
        return waterService.updateSettings(date, settings);
    }
}
