package com.rulecenter.controller;

import com.rulecenter.model.TestResult;
import com.rulecenter.model.TestRun;
import com.rulecenter.repository.TestRunRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/runs")
public class RunController {

    private final TestRunRepository repository;

    public RunController(TestRunRepository repository) {
        this.repository = repository;
    }

    // GET /api/runs — all runs (newest first)
    @GetMapping
    public List<TestRun> getAll() {
        return repository.findAllByOrderByTimestampDesc();
    }

    // GET /api/runs/{id} — one specific run
    @GetMapping("/{id}")
    public ResponseEntity<TestRun> getOne(@PathVariable String id) {
        return repository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    // POST /api/runs — submit a new run (this is what REST Assured calls)
    @PostMapping
    public ResponseEntity<TestRun> submit(@RequestBody TestRun run) {
        if (run.getRunId() == null || run.getRunId().isBlank()) {
            run.setRunId("run_" + System.currentTimeMillis());
        }
        if (run.getTimestamp() == null) {
            run.setTimestamp(Instant.now());
        }
        // Wire the back-reference so JPA cascades correctly
        if (run.getTests() != null) {
            for (TestResult t : run.getTests()) {
                t.setTestRun(run);
            }
        }
        TestRun saved = repository.save(run);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // DELETE /api/runs/{id} — delete a single run
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOne(@PathVariable String id) {
        if (!repository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // DELETE /api/runs — clear all
    @DeleteMapping
    public ResponseEntity<Void> deleteAll() {
        repository.deleteAll();
        return ResponseEntity.noContent().build();
    }

    // GET /api/runs/stats — aggregate counts
    @GetMapping("/stats")
    public Map<String, Object> stats() {
        List<TestRun> all = repository.findAll();
        long totalRuns = all.size();
        long total = 0, pass = 0, fail = 0, skip = 0;
        for (TestRun r : all) {
            for (TestResult t : r.getTests()) {
                total++;
                switch (t.getStatus()) {
                    case "PASS" -> pass++;
                    case "FAIL" -> fail++;
                    case "SKIP" -> skip++;
                }
            }
        }
        double rate = total == 0 ? 0.0 : (pass * 100.0 / total);
        return Map.of(
            "totalRuns", totalRuns,
            "totalTests", total,
            "pass", pass,
            "fail", fail,
            "skip", skip,
            "passRate", Math.round(rate * 10) / 10.0
        );
    }
}
