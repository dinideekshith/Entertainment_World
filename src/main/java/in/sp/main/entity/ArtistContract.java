package in.sp.main.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Talent contract and document verification record managed by a Casting Company.
 */
@Entity
@Table(name = "artist_contracts")
public class ArtistContract {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long companyId;

    @Column(nullable = false)
    private Long projectId;

    @Column(nullable = false)
    private Long artistId;

    @Column(nullable = false, length = 180)
    private String contractTitle;

    @Column(nullable = false, length = 120)
    private String roleName;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal compensationInr = BigDecimal.ZERO;

    @Column(nullable = false, length = 40)
    private String paymentBasis = "Per project";

    @Column(nullable = false, length = 30)
    private String contractStatus = "DRAFT"; // DRAFT, SENT, SIGNED, COMPLETED

    @Column(nullable = false, length = 30)
    private String documentVerificationStatus = "PENDING"; // PENDING, VERIFIED, REJECTED

    @Column(length = 500)
    private String contractFilePath;

    private LocalDate startDate;

    private LocalDate endDate;

    @Column(columnDefinition = "TEXT")
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

    public String getContractTitle() { return contractTitle; }
    public void setContractTitle(String contractTitle) { this.contractTitle = contractTitle; }

    public String getRoleName() { return roleName; }
    public void setRoleName(String roleName) { this.roleName = roleName; }

    public BigDecimal getCompensationInr() { return compensationInr; }
    public void setCompensationInr(BigDecimal compensationInr) { this.compensationInr = compensationInr; }

    public String getPaymentBasis() { return paymentBasis; }
    public void setPaymentBasis(String paymentBasis) { this.paymentBasis = paymentBasis; }

    public String getContractStatus() { return contractStatus; }
    public void setContractStatus(String contractStatus) { this.contractStatus = contractStatus; }

    public String getDocumentVerificationStatus() { return documentVerificationStatus; }
    public void setDocumentVerificationStatus(String documentVerificationStatus) { this.documentVerificationStatus = documentVerificationStatus; }

    public String getContractFilePath() { return contractFilePath; }
    public void setContractFilePath(String contractFilePath) { this.contractFilePath = contractFilePath; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
