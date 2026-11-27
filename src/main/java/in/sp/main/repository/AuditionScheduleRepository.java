package in.sp.main.repository;

import in.sp.main.entity.AuditionSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AuditionScheduleRepository extends JpaRepository<AuditionSchedule, Long> {
    List<AuditionSchedule> findByCompanyIdOrderByScheduledDateAscIdDesc(Long companyId);
    Optional<AuditionSchedule> findByIdAndCompanyId(Long id, Long companyId);
    long countByCompanyIdAndStatusIn(Long companyId, List<String> statuses);
    void deleteByCompanyIdAndProjectId(Long companyId, Long projectId);
}
