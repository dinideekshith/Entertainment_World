package in.sp.main.repository;

import in.sp.main.entity.TeamMember;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {
    List<TeamMember> findByCompanyIdOrderByAddedAtDesc(Long companyId);
    Optional<TeamMember> findByIdAndCompanyId(Long id, Long companyId);
}
