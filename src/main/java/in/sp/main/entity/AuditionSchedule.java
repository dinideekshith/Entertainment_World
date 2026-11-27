package in.sp.main.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Scheduled online or offline audition managed by a Casting Company.
 */
@Entity
@Table(name = "audition_schedules")
public class AuditionSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long companyId;

    @Column(nullable = false)
    private Long projectId;

    @Column(nullable = false)
    private Long artistId;

    @Column(nullable = false, length = 30)
    private String auditionType = "Online"; // Online / Offline

    @Column(nullable = false)
    private LocalDate scheduledDate;

    @Column(nullable = false, length = 30)
    private String scheduledTime = "11:00";

    @Column(nullable = false, length = 280)
    private String locationOrLink;

    @Column(nullable = false, length = 30)
    private String status = "SCHEDULED"; // SCHEDULED, RESCHEDULED, COMPLETED, CANCELLED

    @Column(length = 400)
    private String auditionVideoUrl;

    @Column(columnDefinition = "TEXT")
    private String feedback;

    private Integer rating; // 1-5

    @Column(length = 300)
    private String notes;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public Long getArtistId() { return artistId; }
    public void setArtistId(Long artistId) { this.artistId = artistId; }

    public String getAuditionType() { return auditionType; }
    public void setAuditionType(String auditionType) { this.auditionType = auditionType; }

    public LocalDate getScheduledDate() { return scheduledDate; }
    public void setScheduledDate(LocalDate scheduledDate) { this.scheduledDate = scheduledDate; }

    public String getScheduledTime() { return scheduledTime; }
    public void setScheduledTime(String scheduledTime) { this.scheduledTime = scheduledTime; }

    public String getLocationOrLink() { return locationOrLink; }
    public void setLocationOrLink(String locationOrLink) { this.locationOrLink = locationOrLink; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getAuditionVideoUrl() { return auditionVideoUrl; }
    public void setAuditionVideoUrl(String auditionVideoUrl) { this.auditionVideoUrl = auditionVideoUrl; }

    public String getFeedback() { return feedback; }
    public void setFeedback(String feedback) { this.feedback = feedback; }

    public Integer getRating() { return rating; }
    public void setRating(Integer rating) { this.rating = rating; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
