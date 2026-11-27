package in.sp.main.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Casting assistants and coordinators assigned to projects under a Casting Company.
 */
@Entity
@Table(name = "team_members")
public class TeamMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long companyId;

    @Column(nullable = false, length = 140)
    private String fullName;

    @Column(nullable = false, length = 160)
    private String email;

    @Column(length = 40)
    private String phone;

    @Column(nullable = false, length = 80)
    private String roleTitle; // Casting Director, Casting Assistant, Talent Coordinator, Finance & Contracts

    @Column(length = 400)
    private String permissions; // Comma-separated permissions

    @Column(length = 260)
    private String assignedProjectIds; // Comma-separated project IDs

    @Column(nullable = false, length = 30)
    private String status = "ACTIVE"; // ACTIVE, INVITED, INACTIVE

    @Column(nullable = false)
    private LocalDateTime addedAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getRoleTitle() { return roleTitle; }
    public void setRoleTitle(String roleTitle) { this.roleTitle = roleTitle; }

    public String getPermissions() { return permissions; }
    public void setPermissions(String permissions) { this.permissions = permissions; }

    public String getAssignedProjectIds() { return assignedProjectIds; }
    public void setAssignedProjectIds(String assignedProjectIds) { this.assignedProjectIds = assignedProjectIds; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getAddedAt() { return addedAt; }
    public void setAddedAt(LocalDateTime addedAt) { this.addedAt = addedAt; }
}
