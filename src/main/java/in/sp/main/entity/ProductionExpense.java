package in.sp.main.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Casting & production payment / expense ledger entry.
 */
@Entity
@Table(name = "production_expenses")
public class ProductionExpense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long companyId;

    private Long projectId;

    private Long artistId;

    @Column(nullable = false, length = 80)
    private String category; // Artist Fee, Audition Studio, Travel & Stay, Crew & Gear, Other

    @Column(nullable = false, length = 260)
    private String description;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amountInr = BigDecimal.ZERO;

    @Column(nullable = false, length = 30)
    private String paymentStatus = "PAID"; // PAID, PENDING, REIMBURSED

    @Column(nullable = false)
    private LocalDate expenseDate = LocalDate.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public Long getArtistId() { return artistId; }
    public void setArtistId(Long artistId) { this.artistId = artistId; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public BigDecimal getAmountInr() { return amountInr; }
    public void setAmountInr(BigDecimal amountInr) { this.amountInr = amountInr; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public LocalDate getExpenseDate() { return expenseDate; }
    public void setExpenseDate(LocalDate expenseDate) { this.expenseDate = expenseDate; }
}
