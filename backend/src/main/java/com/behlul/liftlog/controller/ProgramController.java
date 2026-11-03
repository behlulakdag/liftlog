package com.behlul.liftlog.controller;

import com.behlul.liftlog.dto.ProgramDtos.BlockRequest;
import com.behlul.liftlog.dto.ProgramDtos.LiftGoalRequest;
import com.behlul.liftlog.dto.ProgramDtos.ProgramResponse;
import com.behlul.liftlog.dto.ProgramDtos.WeightGoalRequest;
import com.behlul.liftlog.service.ProgramService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/** {@code today} is the phone's date (YYYY-MM-DD), so "week 3" turns over at the user's own midnight. */
@RestController
@RequestMapping("/api/v1/program")
public class ProgramController {

    private final ProgramService programService;

    public ProgramController(ProgramService programService) {
        this.programService = programService;
    }

    @GetMapping
    public ProgramResponse get(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
        return programService.get(today);
    }

    @PutMapping("/block")
    public ProgramResponse setBlock(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today,
                                    @Valid @RequestBody BlockRequest request) {
        return programService.setBlock(request.startDate(), request.weeks(), today);
    }

    @DeleteMapping("/block")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearBlock() {
        programService.clearBlock();
    }

    @PutMapping("/goals/{exerciseId}")
    public ProgramResponse setLiftGoal(@PathVariable Long exerciseId,
                                       @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today,
                                       @Valid @RequestBody LiftGoalRequest request) {
        return programService.setLiftGoal(exerciseId, request.targetKg(), today);
    }

    @DeleteMapping("/goals/{exerciseId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLiftGoal(@PathVariable Long exerciseId) {
        programService.deleteLiftGoal(exerciseId);
    }

    @PutMapping("/weight-goal")
    public ProgramResponse setWeightGoal(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today,
                                         @Valid @RequestBody WeightGoalRequest request) {
        return programService.setWeightGoal(request.targetKg(), today);
    }

    @DeleteMapping("/weight-goal")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearWeightGoal() {
        programService.clearWeightGoal();
    }
}
