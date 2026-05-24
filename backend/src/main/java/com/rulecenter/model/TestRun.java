package com.rulecenter.model;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "test_runs")
public class TestRun {

    @Id
    @Column(name = "run_id")
    private String runId;

    private String suite;

    private String environment;

    private Instant timestamp;

    @OneToMany(
        mappedBy = "testRun",
        cascade = CascadeType.ALL,
        orphanRemoval = true,
        fetch = FetchType.EAGER
    )
    @JsonManagedReference
    private List<TestResult> tests = new ArrayList<>();

    public TestRun() {}

    // Getters & setters
    public String getRunId() { return runId; }
    public void setRunId(String runId) { this.runId = runId; }

    public String getSuite() { return suite; }
    public void setSuite(String suite) { this.suite = suite; }

    public String getEnvironment() { return environment; }
    public void setEnvironment(String environment) { this.environment = environment; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public List<TestResult> getTests() { return tests; }
    public void setTests(List<TestResult> tests) { this.tests = tests; }
}
