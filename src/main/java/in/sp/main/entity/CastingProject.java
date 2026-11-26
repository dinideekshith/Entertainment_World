package in.sp.main.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

/**
 * Casting call / project posted by a verified & subscribed Casting Company.
 */
@Entity
@Table(name = "casting_projects")
public class CastingProject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long companyId;

    @Column(nullable = false, length = 220)
    private String projectTitle;

    @Column(nullable = false, length = 80)
    private String projectType;

    @Column(nullable = false, length = 100)
    private String targetCategory;

    @Column(nullable = false, length = 40)
    private String targetGender = "All";

    @Column(nullable = false)
    private int ageMin = 18;

    @Column(nullable = false)
    private int ageMax = 55;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String projectDetails;

    @Column(length = 300)
    private String tags;

    @Column(nullable = false, length = 60)
    private String durationType = "Full-Time";

    @Column(length = 120)
    private String budget;

    @Column(length = 140)
    private String location;

    @Column(nullable = false)
    private boolean onlineAuditionEnabled = true;

    @Column(columnDefinition = "TEXT")
    private String auditionScript;

    @Column(nullable = false)
    private boolean promoted = false;

    @Column(nullable = false, length = 30)
    private String status = "ACTIVE";

    @Column(nullable = false)
    private LocalDate postedDate = LocalDate.now();

    @Column(nullable = false)
    private LocalDate expiryDate = LocalDate.now().plusDays(30);

    @Column(nullable = false)
    private LocalDate lastViewedDate = LocalDate.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }

    public String getProjectTitle() { return projectTitle; }
    public void setProjectTitle(String projectTitle) { this.projectTitle = projectTitle; }

    public String getProjectType() { return projectType; }
    public void setProjectType(String projectType) { this.projectType = projectType; }

    public String getTargetCategory() { return targetCategory; }
    public void setTargetCategory(String targetCategory) { this.targetCategory = targetCategory; }

    public String getTargetGender() { return targetGender; }
    public void setTargetGender(String targetGender) { this.targetGender = targetGender; }

    public int getAgeMin() { return ageMin; }
    public void setAgeMin(int ageMin) { this.ageMin = ageMin; }

    public int getAgeMax() { return ageMax; }
    public void setAgeMax(int ageMax) { this.ageMax = ageMax; }

    public String getProjectDetails() { return projectDetails; }
    public void setProjectDetails(String projectDetails) { this.projectDetails = projectDetails; }

    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }

    public String getDurationType() { return durationType; }
    public void setDurationType(String durationType) { this.durationType = durationType; }

    public String getBudget() { return budget; }
    public void setBudget(String budget) { this.budget = budget; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public boolean isOnlineAuditionEnabled() { return onlineAuditionEnabled; }
    public void setOnlineAuditionEnabled(boolean onlineAuditionEnabled) { this.onlineAuditionEnabled = onlineAuditionEnabled; }

    public String getAuditionScript() { return auditionScript; }
    public void setAuditionScript(String auditionScript) { this.auditionScript = auditionScript; }

    public boolean isPromoted() { return promoted; }
    public void setPromoted(boolean promoted) { this.promoted = promoted; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDate getPostedDate() { return postedDate; }
    public void setPostedDate(LocalDate postedDate) { this.postedDate = postedDate; }

    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }

    public LocalDate getLastViewedDate() { return lastViewedDate; }
    public void setLastViewedDate(LocalDate lastViewedDate) { this.lastViewedDate = lastViewedDate; }
}
