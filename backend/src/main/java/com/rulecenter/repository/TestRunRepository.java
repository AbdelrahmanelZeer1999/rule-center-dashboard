package com.rulecenter.repository;

import com.rulecenter.model.TestRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TestRunRepository extends JpaRepository<TestRun, String> {
    List<TestRun> findAllByOrderByTimestampDesc();
}
