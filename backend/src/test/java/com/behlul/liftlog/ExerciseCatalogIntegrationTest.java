package com.behlul.liftlog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The built-in exercise list after V25: its size, the new names, their muscles and the bodyweight flag. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class ExerciseCatalogIntegrationTest {

    /** Built-ins of V2, V5 and V16 (16 + 14 + 46). */
    private static final int BUILT_INS_BEFORE_V25 = 76;

    @Autowired private MockMvc mockMvc;
    @Autowired private JsonMapper jsonMapper;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void v25AddsTheCalisthenicsMachinesAndFreeWeightsPerGroup() {
        Integer builtIns = jdbcTemplate.queryForObject("SELECT count(*) FROM exercises WHERE user_id IS NULL", Integer.class);
        assertThat(builtIns).isEqualTo(BUILT_INS_BEFORE_V25 + 180);

        List<String> names = jdbcTemplate.queryForList("SELECT name FROM exercises WHERE user_id IS NULL", String.class);
        assertThat(names).contains("Negative Pull-up", "Archer Pull-up", "Ring Dip", "Pseudo Planche Push-up", "Nordic Curl",
                "Dragon Flag", "Tuck Front Lever", "Hammer Strength Iso-Lateral Row", "Pendulum Squat", "Belt Squat",
                "Smith Machine Shoulder Press", "Wide-Grip Lat Pulldown", "Cable Crossover", "GHD Sit-up", "45° Back Extension",
                "Sumo Deadlift", "Arnold Press", "Landmine Press", "Farmer's Walk");
        // Names are unique among built-ins, ignoring case
        Integer distinct = jdbcTemplate.queryForObject(
                "SELECT count(DISTINCT lower(name)) FROM exercises WHERE user_id IS NULL", Integer.class);
        assertThat(distinct).isEqualTo(builtIns);
    }

    @Test
    void everyBodyweightExerciseIsMarkedLikeTheCalisthenicsOfV5() {
        Map<String, Object> flags = jdbcTemplate.queryForMap("""
                SELECT bool_and(bodyweight) FILTER (WHERE name IN ('Negative Pull-up', 'Ring Dip', 'Plank', 'Burpee', 'Nordic Curl'))
                           AS calisthenics,
                       bool_and(bodyweight) FILTER (WHERE name IN ('Back Extension', '45° Back Extension', 'GHD Sit-up', 'Glute-Ham Raise'))
                           AS benchBodyweight,
                       bool_or(bodyweight) FILTER (WHERE name IN ('Pendulum Squat', 'Cable Crossover', 'Arnold Press', 'Sumo Deadlift'))
                           AS loaded,
                       count(*) FILTER (WHERE bodyweight <> (equipment = 'BODYWEIGHT')) AS mismatched
                FROM exercises WHERE user_id IS NULL""");
        assertThat(flags.get("calisthenics")).isEqualTo(true);
        // V28: moved on a bench or a GHD, loaded by the body
        assertThat(flags.get("benchbodyweight")).isEqualTo(true);
        assertThat(flags.get("loaded")).isEqualTo(false);
        assertThat(((Number) flags.get("mismatched")).intValue()).isZero();

        Integer withoutEquipment = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM exercises WHERE user_id IS NULL AND equipment IS NULL", Integer.class);
        assertThat(withoutEquipment).isZero();
    }

    @Test
    void v25SkipsNamesThatAreAlreadyThere() throws Exception {
        String migration = new ClassPathResource("db/migration/V25__more_exercises.sql").getContentAsString(StandardCharsets.UTF_8);
        // Run again, every name is found in place: no exercise and no muscle row is added
        assertThat(jdbcTemplate.update(migration)).isZero();
    }

    @Test
    void newExercisesListTheirMusclesThroughTheApi() throws Exception {
        Map<String, List<String>> muscles = new HashMap<>();
        for (JsonNode exercise : exercises()) {
            List<String> entries = new ArrayList<>();
            exercise.get("muscles").forEach(m -> entries.add(m.get("muscle").asString() + ":" + m.get("role").asString()));
            muscles.put(exercise.get("name").asString(), entries);
        }
        assertThat(muscles.get("Nordic Curl")).containsExactlyInAnyOrder("HAMSTRINGS:PRIMARY", "CALVES:SECONDARY", "GLUTES:SECONDARY");
        assertThat(muscles.get("Pendulum Squat")).containsExactlyInAnyOrder("QUADS:PRIMARY", "GLUTES:SECONDARY");
        assertThat(muscles.get("Cable Hip Adduction")).containsExactly("QUADS:PRIMARY");
        assertThat(muscles.get("Side Plank")).containsExactlyInAnyOrder("OBLIQUES:PRIMARY", "ABS:SECONDARY", "GLUTES:SECONDARY");
    }

    private JsonNode exercises() throws Exception {
        String body = jsonMapper.writeValueAsString(Map.of("email", "exercises-" + UUID.randomUUID() + "@example.com", "password", "s3cret-pass"));
        String token = jsonMapper.readTree(mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("token").asString();
        return jsonMapper.readTree(mockMvc.perform(get("/api/v1/exercises").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }
}
