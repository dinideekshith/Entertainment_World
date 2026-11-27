package in.sp.main.controller;

import in.sp.main.entity.*;
import in.sp.main.repository.*;
import in.sp.main.service.FileStorageService;
import in.sp.main.service.NotificationService;
import in.sp.main.service.SessionAuthHelper;
import in.sp.main.service.SimplePdfExportService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Casting Company Dashboard operations controller covering Audition Management,
 * Side-by-Side Selection & Comparison, Communication History, Reports & PDF/Excel Export,
 * Team Management, Contracts & Document Verification, and Expense Tracking.
 */
@RestController
@RequestMapping("/api/dashboard")
public class CastingOperationsController {

    private final CastingProjectRepository projectRepo;
    private final ArtistProfileRepository artistRepo;
    private final ProjectApplicationRepository appRepo;
    private final AuditionScheduleRepository auditionRepo;
    private final CommunicationMessageRepository messageRepo;
    private final TeamMemberRepository teamRepo;
    private final ArtistContractRepository contractRepo;
    private final ProductionExpenseRepository expenseRepo;
    private final SubscriptionPaymentRepository paymentRepo;
    private final ContactPortfolioHistoryRepository historyRepo;
    private final SessionAuthHelper authHelper;
    private final NotificationService notificationService;
    private final FileStorageService fileStorage;
    private final SimplePdfExportService pdfService;

    public CastingOperationsController(CastingProjectRepository projectRepo,
                                     ArtistProfileRepository artistRepo,
                                     ProjectApplicationRepository appRepo,
                                     AuditionScheduleRepository auditionRepo,
                                     CommunicationMessageRepository messageRepo,
                                     TeamMemberRepository teamRepo,
                                     ArtistContractRepository contractRepo,
                                     ProductionExpenseRepository expenseRepo,
                                     SubscriptionPaymentRepository paymentRepo,
                                     ContactPortfolioHistoryRepository historyRepo,
                                     SessionAuthHelper authHelper,
                                     NotificationService notificationService,
                                     FileStorageService fileStorage,
                                     SimplePdfExportService pdfService) {
        this.projectRepo = projectRepo;
        this.artistRepo = artistRepo;
        this.appRepo = appRepo;
        this.auditionRepo = auditionRepo;
        this.messageRepo = messageRepo;
        this.teamRepo = teamRepo;
        this.contractRepo = contractRepo;
        this.expenseRepo = expenseRepo;
        this.paymentRepo = paymentRepo;
        this.historyRepo = historyRepo;
        this.authHelper = authHelper;
        this.notificationService = notificationService;
        this.fileStorage = fileStorage;
        this.pdfService = pdfService;
    }

    // ================= ACTOR DIRECTORY & COMPARISON =================

    @GetMapping("/artists/all")
    public ResponseEntity<?> listAllArtists(HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        Set<Long> unlockedIds = historyRepo.findByCompanyIdAndViewTypeOrderByViewedAtDesc(company.getId(), "CONTACT_VIEW")
                .stream().map(ContactPortfolioHistory::getArtistId).collect(Collectors.toSet());
        return ResponseEntity.ok(artistRepo.findAll().stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("fullName", a.getFullName());
            m.put("category", a.getCategory());
            m.put("gender", a.getGender());
            m.put("age", a.getAge());
            m.put("city", a.getCity());
            m.put("languages", a.getLanguages());
            m.put("expertise", a.getExpertise());
            m.put("skills", a.getSkills() != null ? a.getSkills() : a.getKeywords());
            m.put("avatarUrl", a.getAvatarUrl());
            m.put("hasVideo", a.isHasVideo());
            m.put("videoUrl", a.getVideoUrl());
            m.put("profileVerified", a.isProfileVerified());
            m.put("verificationStatus", a.getVerificationStatus());
            m.put("contactUnlocked", unlockedIds.contains(a.getId()));
            return m;
        }).toList());
    }

    @PostMapping("/artists/compare")
    public ResponseEntity<?> compareArtists(@RequestBody Map<String, Object> body, HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        List<?> rawIds = (List<?>) body.getOrDefault("artistIds", List.of());
        List<Long> ids = rawIds.stream().map(o -> Long.valueOf(String.valueOf(o))).limit(4).toList();
        if (ids.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Select 2 to 4 actors to compare."));
        }
        Map<Long, ArtistProfile> artistById = artistRepo.findAllById(ids).stream()
                .collect(Collectors.toMap(ArtistProfile::getId, a -> a));
        List<AuditionSchedule> auditions = auditionRepo.findByCompanyIdOrderByScheduledDateAscIdDesc(company.getId());
        List<Long> projIds = projectRepo.findByCompanyIdOrderByPostedDateDescIdDesc(company.getId()).stream()
                .map(CastingProject::getId).toList();
        List<ProjectApplication> apps = projIds.isEmpty() ? List.of() : appRepo.findByProjectIdInOrderByAppliedAtDesc(projIds);

        List<Map<String, Object>> comparison = ids.stream().map(artistById::get).filter(Objects::nonNull).map(a -> {
            Double avgAuditionRating = auditions.stream()
                    .filter(au -> au.getArtistId().equals(a.getId()) && au.getRating() != null)
                    .mapToInt(AuditionSchedule::getRating).average().orElse(0.0);
            ProjectApplication latestApp = apps.stream()
                    .filter(pa -> pa.getArtistId().equals(a.getId()))
                    .findFirst().orElse(null);

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("fullName", a.getFullName());
            m.put("category", a.getCategory());
            m.put("gender", a.getGender());
            m.put("age", a.getAge());
            m.put("city", a.getCity());
            m.put("languages", a.getLanguages());
            m.put("expertise", a.getExpertise());
            m.put("skills", a.getSkills() != null ? a.getSkills() : a.getKeywords());
            m.put("avatarUrl", a.getAvatarUrl());
            m.put("videoUrl", a.getVideoUrl());
            m.put("profileVerified", a.isProfileVerified());
            Double resolvedRating = null;
            if (avgAuditionRating > 0) {
                resolvedRating = Math.round(avgAuditionRating * 10.0) / 10.0;
            } else if (latestApp != null && latestApp.getRating() != null) {
                resolvedRating = latestApp.getRating().doubleValue();
            }
            m.put("avgRating", resolvedRating);
            m.put("applicationStatus", latestApp != null ? latestApp.getStatus() : "NOT_APPLIED");
            m.put("assignedRole", latestApp != null ? latestApp.getAssignedRole() : null);
            return m;
        }).toList();

        return ResponseEntity.ok(Map.of("actors", comparison));
    }

    @GetMapping("/selection-summary")
    public ResponseEntity<?> getSelectionSummary(HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        List<CastingProject> projects = projectRepo.findByCompanyIdOrderByPostedDateDescIdDesc(company.getId());
        List<Long> projIds = projects.stream().map(CastingProject::getId).toList();
        List<ProjectApplication> apps = projIds.isEmpty() ? List.of() : appRepo.findByProjectIdInOrderByAppliedAtDesc(projIds);
        Map<Long, ArtistProfile> artistById = artistRepo.findAll().stream().collect(Collectors.toMap(ArtistProfile::getId, a -> a));
        Map<Long, String> projectTitles = projects.stream().collect(Collectors.toMap(CastingProject::getId, CastingProject::getProjectTitle));

        List<Map<String, Object>> shortlisted = new ArrayList<>();
        List<Map<String, Object>> selected = new ArrayList<>();
        List<Map<String, Object>> backup = new ArrayList<>();

        for (ProjectApplication pa : apps) {
            ArtistProfile a = artistById.get(pa.getArtistId());
            if (a == null) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("applicationId", pa.getId());
            item.put("projectId", pa.getProjectId());
            item.put("projectTitle", projectTitles.getOrDefault(pa.getProjectId(), "Casting Project"));
            item.put("roleName", pa.getAssignedRole() != null ? pa.getAssignedRole() : pa.getRoleName());
            item.put("status", pa.getStatus());
            item.put("rating", pa.getRating());
            item.put("internalComment", pa.getInternalComment());
            item.put("backupCandidate", pa.isBackupCandidate());
            item.put("artist", Map.of(
                    "id", a.getId(),
                    "fullName", a.getFullName(),
                    "category", a.getCategory(),
                    "city", a.getCity(),
                    "age", a.getAge(),
                    "avatarUrl", a.getAvatarUrl(),
                    "videoUrl", a.getVideoUrl() == null ? "" : a.getVideoUrl(),
                    "profileVerified", a.isProfileVerified()
            ));
            if ("SELECTED".equalsIgnoreCase(pa.getStatus())) selected.add(item);
            else if ("BACKUP".equalsIgnoreCase(pa.getStatus()) || pa.isBackupCandidate()) backup.add(item);
            else if ("SHORTLISTED".equalsIgnoreCase(pa.getStatus())) shortlisted.add(item);
        }

        return ResponseEntity.ok(Map.of(
                "projects", projects.stream().map(p -> Map.of("id", p.getId(), "projectTitle", p.getProjectTitle())).toList(),
                "shortlisted", shortlisted,
                "selected", selected,
                "backup", backup
        ));
    }

    // ================= AUDITION MANAGEMENT =================

    @GetMapping("/auditions")
    public ResponseEntity<?> listAuditions(@RequestParam(required = false, defaultValue = "ALL") String status,
                                           @RequestParam(required = false, defaultValue = "ALL") String type,
                                           @RequestParam(required = false) Long projectId,
                                           HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        List<AuditionSchedule> list = auditionRepo.findByCompanyIdOrderByScheduledDateAscIdDesc(company.getId());
        Map<Long, ArtistProfile> artistById = artistRepo.findAll().stream().collect(Collectors.toMap(ArtistProfile::getId, a -> a));
        Map<Long, CastingProject> projById = projectRepo.findByCompanyIdOrderByPostedDateDescIdDesc(company.getId())
                .stream().collect(Collectors.toMap(CastingProject::getId, p -> p));

        List<Map<String, Object>> result = list.stream()
                .filter(au -> "ALL".equalsIgnoreCase(status) || au.getStatus().equalsIgnoreCase(status))
                .filter(au -> "ALL".equalsIgnoreCase(type) || au.getAuditionType().equalsIgnoreCase(type))
                .filter(au -> projectId == null || au.getProjectId().equals(projectId))
                .map(au -> toAuditionView(au, artistById.get(au.getArtistId()), projById.get(au.getProjectId())))
                .toList();

        return ResponseEntity.ok(Map.of("auditions", result));
    }

    @PostMapping("/auditions")
    public ResponseEntity<?> scheduleAudition(@RequestBody Map<String, Object> body, HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        Long projectId = Long.valueOf(String.valueOf(body.get("projectId")));
        Long artistId = Long.valueOf(String.valueOf(body.get("artistId")));
        CastingProject project = projectRepo.findByIdAndCompanyId(projectId, company.getId())
                .orElseThrow(() -> new IllegalArgumentException("Project not found"));
        ArtistProfile artist = artistRepo.findById(artistId)
                .orElseThrow(() -> new IllegalArgumentException("Artist not found"));

        AuditionSchedule au = new AuditionSchedule();
        au.setCompanyId(company.getId());
        au.setProjectId(project.getId());
        au.setArtistId(artist.getId());
        au.setAuditionType(String.valueOf(body.getOrDefault("auditionType", "Online")));
        au.setScheduledDate(LocalDate.parse(String.valueOf(body.get("scheduledDate"))));
        au.setScheduledTime(String.valueOf(body.getOrDefault("scheduledTime", "11:00")));
        au.setLocationOrLink(String.valueOf(body.getOrDefault("locationOrLink", "https://meet.entertainmentworld.in/room/ew-live")));
        au.setStatus("SCHEDULED");
        au.setAuditionVideoUrl(artist.getVideoUrl() != null ? artist.getVideoUrl() : "/assets/video/audition-1.mp4");
        au.setNotes(String.valueOf(body.getOrDefault("notes", "")));
        AuditionSchedule saved = auditionRepo.save(au);

        // Sync application status to INVITED
        appRepo.findByProjectIdAndArtistId(project.getId(), artist.getId()).ifPresent(pa -> {
            if ("APPLIED".equalsIgnoreCase(pa.getStatus()) || "SUGGESTED".equalsIgnoreCase(pa.getStatus())) {
                pa.setStatus("INVITED");
                appRepo.save(pa);
            }
        });

        // Log Audition Invitation message & company notification
        CommunicationMessage msg = new CommunicationMessage();
        msg.setCompanyId(company.getId());
        msg.setArtistId(artist.getId());
        msg.setProjectId(project.getId());
        msg.setMessageType("AUDITION_INVITE");
        msg.setSubject("Audition Invitation: " + project.getProjectTitle());
        msg.setBody("You are invited for an " + saved.getAuditionType() + " audition on " + saved.getScheduledDate()
                + " at " + saved.getScheduledTime() + ". Location/Link: " + saved.getLocationOrLink());
        messageRepo.save(msg);

        notificationService.notifyCompany(company.getId(), company.getCompanyEmail(),
                "Audition Scheduled",
                saved.getAuditionType() + " audition scheduled for " + artist.getFullName() + " on " + saved.getScheduledDate() + ".");

        return ResponseEntity.status(HttpStatus.CREATED).body(toAuditionView(saved, artist, project));
    }

    @PutMapping("/auditions/{id}")
    public ResponseEntity<?> updateAudition(@PathVariable Long id,
                                            @RequestBody Map<String, Object> body,
                                            HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        AuditionSchedule au = auditionRepo.findByIdAndCompanyId(id, company.getId())
                .orElseThrow(() -> new IllegalArgumentException("Audition not found"));

        if (body.containsKey("auditionType")) au.setAuditionType(String.valueOf(body.get("auditionType")));
        if (body.containsKey("scheduledDate") && body.get("scheduledDate") != null && !String.valueOf(body.get("scheduledDate")).isBlank()) {
            au.setScheduledDate(LocalDate.parse(String.valueOf(body.get("scheduledDate"))));
        }
        if (body.containsKey("scheduledTime")) au.setScheduledTime(String.valueOf(body.get("scheduledTime")));
        if (body.containsKey("locationOrLink")) au.setLocationOrLink(String.valueOf(body.get("locationOrLink")));
        if (body.containsKey("status")) au.setStatus(String.valueOf(body.get("status")).toUpperCase(Locale.ROOT));
        if (body.containsKey("feedback")) au.setFeedback(String.valueOf(body.get("feedback")));
        if (body.containsKey("notes")) au.setNotes(String.valueOf(body.get("notes")));
        if (body.containsKey("rating") && body.get("rating") != null && !String.valueOf(body.get("rating")).isBlank()) {
            au.setRating(Math.max(1, Math.min(5, Integer.parseInt(String.valueOf(body.get("rating"))))));
        }

        AuditionSchedule saved = auditionRepo.save(au);
        ArtistProfile artist = artistRepo.findById(saved.getArtistId()).orElse(null);
        CastingProject project = projectRepo.findById(saved.getProjectId()).orElse(null);
        return ResponseEntity.ok(toAuditionView(saved, artist, project));
    }

    @DeleteMapping("/auditions/{id}")
    public ResponseEntity<?> deleteAudition(@PathVariable Long id, HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        AuditionSchedule au = auditionRepo.findByIdAndCompanyId(id, company.getId())
                .orElseThrow(() -> new IllegalArgumentException("Audition not found"));
        auditionRepo.delete(au);
        return ResponseEntity.ok(Map.of("message", "Audition removed"));
    }

    // ================= COMMUNICATION HISTORY =================

    @GetMapping("/messages")
    public ResponseEntity<?> getMessages(HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        Map<Long, ArtistProfile> artistById = artistRepo.findAll().stream().collect(Collectors.toMap(ArtistProfile::getId, a -> a));
        Map<Long, CastingProject> projById = projectRepo.findByCompanyIdOrderByPostedDateDescIdDesc(company.getId())
                .stream().collect(Collectors.toMap(CastingProject::getId, p -> p));

        List<Map<String, Object>> list = messageRepo.findByCompanyIdOrderBySentAtDesc(company.getId()).stream().map(m -> {
            ArtistProfile a = artistById.get(m.getArtistId());
            CastingProject p = m.getProjectId() != null ? projById.get(m.getProjectId()) : null;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", m.getId());
            row.put("artistId", m.getArtistId());
            row.put("artistName", a != null ? a.getFullName() : "Artist");
            row.put("artistAvatar", a != null ? a.getAvatarUrl() : "");
            row.put("projectId", m.getProjectId());
            row.put("projectTitle", p != null ? p.getProjectTitle() : "General Casting");
            row.put("messageType", m.getMessageType());
            row.put("subject", m.getSubject());
            row.put("body", m.getBody());
            row.put("deliveryChannel", m.getDeliveryChannel());
            row.put("sentAt", m.getSentAt());
            return row;
        }).toList();

        return ResponseEntity.ok(Map.of("messages", list));
    }

    @PostMapping("/messages")
    public ResponseEntity<?> sendMessage(@RequestBody Map<String, Object> body, HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        Long artistId = Long.valueOf(String.valueOf(body.get("artistId")));
        ArtistProfile artist = artistRepo.findById(artistId)
                .orElseThrow(() -> new IllegalArgumentException("Artist not found"));

        CommunicationMessage msg = new CommunicationMessage();
        msg.setCompanyId(company.getId());
        msg.setArtistId(artist.getId());
        if (body.get("projectId") != null && !String.valueOf(body.get("projectId")).isBlank()) {
            msg.setProjectId(Long.valueOf(String.valueOf(body.get("projectId"))));
        }
        msg.setMessageType(String.valueOf(body.getOrDefault("messageType", "DIRECT_MESSAGE")));
        msg.setSubject(String.valueOf(body.getOrDefault("subject", "")).trim());
        msg.setBody(String.valueOf(body.getOrDefault("body", "")).trim());
        if (msg.getSubject().isBlank() || msg.getBody().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Subject and message body are required."));
        }
        CommunicationMessage saved = messageRepo.save(msg);

        notificationService.notifyCompany(company.getId(), company.getCompanyEmail(),
                "Message Sent to " + artist.getFullName(),
                saved.getSubject());

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // ================= REPORTS & ANALYTICS (REAL DB + EXCEL + PDF) =================

    @GetMapping("/reports")
    public ResponseEntity<?> getReports(HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        Map<String, Object> report = buildReportPayload(company);
        return ResponseEntity.ok(report);
    }

    @GetMapping("/reports/export-excel")
    public ResponseEntity<byte[]> exportReportExcel(HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        Map<String, Object> rep = buildReportPayload(company);
        StringBuilder sb = new StringBuilder("\uFEFF");
        sb.append("Entertainment World - Casting Company Analytics Report\n");
        sb.append("Company\t").append(company.getCompanyName()).append("\tGenerated\t").append(LocalDate.now()).append("\n\n");

        sb.append("PROJECT-WISE APPLICATION FUNNEL\n");
        sb.append("Project Title\tCategory\tStatus\tTotal Apps\tShortlisted\tInvited\tSelected\tBackup\tRejected\n");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> projRows = (List<Map<String, Object>>) rep.get("projectReports");
        for (Map<String, Object> r : projRows) {
            sb.append(clean(r.get("projectTitle"))).append('\t')
              .append(clean(r.get("targetCategory"))).append('\t')
              .append(clean(r.get("status"))).append('\t')
              .append(r.get("totalApplications")).append('\t')
              .append(r.get("shortlisted")).append('\t')
              .append(r.get("invited")).append('\t')
              .append(r.get("selected")).append('\t')
              .append(r.get("backup")).append('\t')
              .append(r.get("rejected")).append('\n');
        }

        sb.append("\nACTOR REGISTRATION BY CATEGORY\nCategory\tTotal Registered\n");
        @SuppressWarnings("unchecked")
        Map<String, Long> actorCats = (Map<String, Long>) rep.get("actorCategoryCounts");
        actorCats.forEach((k, v) -> sb.append(clean(k)).append('\t').append(v).append('\n'));

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"entertainment-world-casting-report.xls\"")
                .contentType(MediaType.parseMediaType("application/vnd.ms-excel; charset=UTF-8"))
                .body(sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/reports/export-pdf")
    public ResponseEntity<byte[]> exportReportPdf(HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        Map<String, Object> rep = buildReportPayload(company);
        List<String> lines = new ArrayList<>();
        lines.add("Casting Company: " + company.getCompanyName() + " (" + company.getCity() + ")");
        lines.add("Generated Date: " + LocalDate.now() + "   |   Pass: " + company.getActivePassName());
        lines.add("----------------------------------------------------------------------");
        lines.add("1. ACTOR REGISTRATION SUMMARY");
        lines.add("Total Registered Actors: " + rep.get("totalRegisteredActors") + "   |   Verified Profiles: " + rep.get("verifiedActorsCount"));
        @SuppressWarnings("unchecked")
        Map<String, Long> actorCats = (Map<String, Long>) rep.get("actorCategoryCounts");
        actorCats.forEach((k, v) -> lines.add("   - " + k + ": " + v));
        lines.add("");
        lines.add("2. PROJECT-WISE APPLICATION & SELECTION REPORT");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> projRows = (List<Map<String, Object>>) rep.get("projectReports");
        for (Map<String, Object> r : projRows) {
            lines.add("   * " + r.get("projectTitle") + " [" + r.get("status") + "]");
            lines.add("     Apps: " + r.get("totalApplications") + " | Shortlisted: " + r.get("shortlisted")
                    + " | Invited: " + r.get("invited") + " | Selected: " + r.get("selected") + " | Backup: " + r.get("backup"));
        }
        lines.add("");
        lines.add("3. AUDITION & FINANCIAL SUMMARY");
        @SuppressWarnings("unchecked")
        Map<String, Object> audStats = (Map<String, Object>) rep.get("auditionStats");
        lines.add("Total Auditions: " + audStats.get("total") + " | Scheduled: " + audStats.get("scheduled")
                + " | Completed: " + audStats.get("completed") + " | Avg Rating: " + audStats.get("avgRating"));
        lines.add("Total Production Expenses: Rs. " + rep.get("totalExpensesInr")
                + " | Pass Spend: Rs. " + rep.get("totalSubscriptionSpendInr"));

        byte[] pdfBytes = pdfService.generateReportPdf("Entertainment World - Casting Analytics Report", lines);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"entertainment-world-casting-report.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    // ================= TEAM MANAGEMENT =================

    @GetMapping("/team")
    public ResponseEntity<?> listTeam(HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        List<CastingProject> projects = projectRepo.findByCompanyIdOrderByPostedDateDescIdDesc(company.getId());
        return ResponseEntity.ok(Map.of(
                "members", teamRepo.findByCompanyIdOrderByAddedAtDesc(company.getId()),
                "projects", projects.stream().map(p -> Map.of("id", p.getId(), "projectTitle", p.getProjectTitle())).toList()
        ));
    }

    @PostMapping("/team")
    public ResponseEntity<?> addTeamMember(@RequestBody Map<String, String> body, HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        TeamMember m = new TeamMember();
        m.setCompanyId(company.getId());
        m.setFullName(body.getOrDefault("fullName", "").trim());
        m.setEmail(body.getOrDefault("email", "").trim());
        m.setPhone(body.getOrDefault("phone", "").trim());
        m.setRoleTitle(body.getOrDefault("roleTitle", "Casting Assistant"));
        m.setPermissions(body.getOrDefault("permissions", "Schedule Auditions,View Reports"));
        m.setAssignedProjectIds(body.getOrDefault("assignedProjectIds", ""));
        m.setStatus(body.getOrDefault("status", "ACTIVE"));
        if (m.getFullName().isBlank() || m.getEmail().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Team member name and email are required."));
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(teamRepo.save(m));
    }

    @PutMapping("/team/{id}")
    public ResponseEntity<?> updateTeamMember(@PathVariable Long id,
                                              @RequestBody Map<String, String> body,
                                              HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        TeamMember m = teamRepo.findByIdAndCompanyId(id, company.getId())
                .orElseThrow(() -> new IllegalArgumentException("Team member not found"));
        if (body.containsKey("roleTitle")) m.setRoleTitle(body.get("roleTitle"));
        if (body.containsKey("permissions")) m.setPermissions(body.get("permissions"));
        if (body.containsKey("assignedProjectIds")) m.setAssignedProjectIds(body.get("assignedProjectIds"));
        if (body.containsKey("status")) m.setStatus(body.get("status"));
        return ResponseEntity.ok(teamRepo.save(m));
    }

    @DeleteMapping("/team/{id}")
    public ResponseEntity<?> deleteTeamMember(@PathVariable Long id, HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        TeamMember m = teamRepo.findByIdAndCompanyId(id, company.getId())
                .orElseThrow(() -> new IllegalArgumentException("Team member not found"));
        teamRepo.delete(m);
        return ResponseEntity.ok(Map.of("message", "Team member removed"));
    }

    // ================= CONTRACTS, DOC VERIFICATION & EXPENSES =================

    @GetMapping("/contracts")
    public ResponseEntity<?> listContracts(HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        Map<Long, ArtistProfile> artistById = artistRepo.findAll().stream().collect(Collectors.toMap(ArtistProfile::getId, a -> a));
        Map<Long, CastingProject> projById = projectRepo.findByCompanyIdOrderByPostedDateDescIdDesc(company.getId())
                .stream().collect(Collectors.toMap(CastingProject::getId, p -> p));

        List<Map<String, Object>> contracts = contractRepo.findByCompanyIdOrderByCreatedAtDesc(company.getId()).stream().map(c -> {
            ArtistProfile a = artistById.get(c.getArtistId());
            CastingProject p = projById.get(c.getProjectId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", c.getId());
            row.put("contractTitle", c.getContractTitle());
            row.put("roleName", c.getRoleName());
            row.put("artistId", c.getArtistId());
            row.put("artistName", a != null ? a.getFullName() : "Artist");
            row.put("projectId", c.getProjectId());
            row.put("projectTitle", p != null ? p.getProjectTitle() : "Project");
            row.put("compensationInr", c.getCompensationInr());
            row.put("paymentBasis", c.getPaymentBasis());
            row.put("contractStatus", c.getContractStatus());
            row.put("documentVerificationStatus", c.getDocumentVerificationStatus());
            row.put("contractFilePath", c.getContractFilePath());
            row.put("startDate", c.getStartDate());
            row.put("endDate", c.getEndDate());
            row.put("notes", c.getNotes());
            return row;
        }).toList();

        return ResponseEntity.ok(Map.of("contracts", contracts));
    }

    @PostMapping(value = "/contracts", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> createContract(
            @RequestParam Long projectId,
            @RequestParam Long artistId,
            @RequestParam String contractTitle,
            @RequestParam String roleName,
            @RequestParam BigDecimal compensationInr,
            @RequestParam(defaultValue = "Per project") String paymentBasis,
            @RequestParam(defaultValue = "DRAFT") String contractStatus,
            @RequestParam(defaultValue = "PENDING") String documentVerificationStatus,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String notes,
            @RequestParam(value = "contractFile", required = false) MultipartFile contractFile,
            HttpSession session
    ) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        ArtistContract c = new ArtistContract();
        c.setCompanyId(company.getId());
        c.setProjectId(projectId);
        c.setArtistId(artistId);
        c.setContractTitle(contractTitle.trim());
        c.setRoleName(roleName.trim());
        c.setCompensationInr(compensationInr);
        c.setPaymentBasis(paymentBasis);
        c.setContractStatus(contractStatus);
        c.setDocumentVerificationStatus(documentVerificationStatus);
        if (startDate != null && !startDate.isBlank()) c.setStartDate(LocalDate.parse(startDate));
        if (endDate != null && !endDate.isBlank()) c.setEndDate(LocalDate.parse(endDate));
        c.setNotes(notes);
        if (contractFile != null && !contractFile.isEmpty()) {
            c.setContractFilePath(fileStorage.store(contractFile, "contracts"));
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(contractRepo.save(c));
    }

    @PutMapping("/contracts/{id}")
    public ResponseEntity<?> updateContract(@PathVariable Long id,
                                            @RequestBody Map<String, String> body,
                                            HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        ArtistContract c = contractRepo.findByIdAndCompanyId(id, company.getId())
                .orElseThrow(() -> new IllegalArgumentException("Contract not found"));
        if (body.containsKey("contractStatus")) c.setContractStatus(body.get("contractStatus"));
        if (body.containsKey("documentVerificationStatus")) c.setDocumentVerificationStatus(body.get("documentVerificationStatus"));
        if (body.containsKey("notes")) c.setNotes(body.get("notes"));
        return ResponseEntity.ok(contractRepo.save(c));
    }

    @DeleteMapping("/contracts/{id}")
    public ResponseEntity<?> deleteContract(@PathVariable Long id, HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        ArtistContract c = contractRepo.findByIdAndCompanyId(id, company.getId())
                .orElseThrow(() -> new IllegalArgumentException("Contract not found"));
        contractRepo.delete(c);
        return ResponseEntity.ok(Map.of("message", "Contract removed"));
    }

    @GetMapping("/expenses")
    public ResponseEntity<?> listExpenses(HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        List<ProductionExpense> expenses = expenseRepo.findByCompanyIdOrderByExpenseDateDescIdDesc(company.getId());
        BigDecimal totalProductionSpend = expenses.stream().map(ProductionExpense::getAmountInr)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paidSpend = expenses.stream()
                .filter(e -> "PAID".equalsIgnoreCase(e.getPaymentStatus()))
                .map(ProductionExpense::getAmountInr)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pendingSpend = expenses.stream()
                .filter(e -> "PENDING".equalsIgnoreCase(e.getPaymentStatus()))
                .map(ProductionExpense::getAmountInr)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return ResponseEntity.ok(Map.of(
                "expenses", expenses,
                "totalProductionSpend", totalProductionSpend,
                "paidSpend", paidSpend,
                "pendingSpend", pendingSpend,
                "subscriptionPayments", paymentRepo.findByCompanyIdOrderByPaidAtDesc(company.getId())
        ));
    }

    @PostMapping("/expenses")
    public ResponseEntity<?> addExpense(@RequestBody Map<String, Object> body, HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        ProductionExpense e = new ProductionExpense();
        e.setCompanyId(company.getId());
        if (body.get("projectId") != null && !String.valueOf(body.get("projectId")).isBlank()) {
            e.setProjectId(Long.valueOf(String.valueOf(body.get("projectId"))));
        }
        e.setCategory(String.valueOf(body.getOrDefault("category", "Artist Fee")));
        e.setDescription(String.valueOf(body.getOrDefault("description", "")).trim());
        e.setAmountInr(new BigDecimal(String.valueOf(body.getOrDefault("amountInr", "0"))));
        e.setPaymentStatus(String.valueOf(body.getOrDefault("paymentStatus", "PAID")));
        if (body.get("expenseDate") != null && !String.valueOf(body.get("expenseDate")).isBlank()) {
            e.setExpenseDate(LocalDate.parse(String.valueOf(body.get("expenseDate"))));
        }
        if (e.getDescription().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Expense description is required."));
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(expenseRepo.save(e));
    }

    @PatchMapping("/expenses/{id}/status")
    public ResponseEntity<?> updateExpenseStatus(@PathVariable Long id,
                                                 @RequestBody Map<String, String> body,
                                                 HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        ProductionExpense e = expenseRepo.findByIdAndCompanyId(id, company.getId())
                .orElseThrow(() -> new IllegalArgumentException("Expense not found"));
        e.setPaymentStatus(body.getOrDefault("paymentStatus", "PAID").toUpperCase(Locale.ROOT));
        return ResponseEntity.ok(expenseRepo.save(e));
    }

    @DeleteMapping("/expenses/{id}")
    public ResponseEntity<?> deleteExpense(@PathVariable Long id, HttpSession session) {
        CastingCompany company = authHelper.requirePaidDashboardCompany(session);
        ProductionExpense e = expenseRepo.findByIdAndCompanyId(id, company.getId())
                .orElseThrow(() -> new IllegalArgumentException("Expense not found"));
        expenseRepo.delete(e);
        return ResponseEntity.ok(Map.of("message", "Expense deleted"));
    }

    // ================= HELPERS =================

    private Map<String, Object> toAuditionView(AuditionSchedule au, ArtistProfile a, CastingProject p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", au.getId());
        m.put("projectId", au.getProjectId());
        m.put("projectTitle", p != null ? p.getProjectTitle() : "Casting Project");
        m.put("artistId", au.getArtistId());
        m.put("artistName", a != null ? a.getFullName() : "Artist");
        m.put("artistCategory", a != null ? a.getCategory() : "");
        m.put("artistAvatar", a != null ? a.getAvatarUrl() : "");
        m.put("auditionType", au.getAuditionType());
        m.put("scheduledDate", au.getScheduledDate());
        m.put("scheduledTime", au.getScheduledTime());
        m.put("locationOrLink", au.getLocationOrLink());
        m.put("status", au.getStatus());
        m.put("auditionVideoUrl", au.getAuditionVideoUrl());
        m.put("feedback", au.getFeedback());
        m.put("rating", au.getRating());
        m.put("notes", au.getNotes());
        return m;
    }

    private Map<String, Object> buildReportPayload(CastingCompany company) {
        List<ArtistProfile> artists = artistRepo.findAll();
        Map<String, Long> actorCategoryCounts = new LinkedHashMap<>();
        artists.forEach(a -> actorCategoryCounts.merge(a.getCategory(), 1L, Long::sum));

        List<CastingProject> projects = projectRepo.findByCompanyIdOrderByPostedDateDescIdDesc(company.getId());
        List<Long> projIds = projects.stream().map(CastingProject::getId).toList();
        List<ProjectApplication> allApps = projIds.isEmpty() ? List.of() : appRepo.findByProjectIdInOrderByAppliedAtDesc(projIds);

        List<Map<String, Object>> projectReports = projects.stream().map(pr -> {
            List<ProjectApplication> pApps = allApps.stream().filter(pa -> pa.getProjectId().equals(pr.getId())).toList();
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("projectId", pr.getId());
            r.put("projectTitle", pr.getProjectTitle());
            r.put("targetCategory", pr.getTargetCategory());
            r.put("status", pr.getStatus());
            r.put("totalApplications", pApps.size());
            r.put("shortlisted", pApps.stream().filter(x -> "SHORTLISTED".equalsIgnoreCase(x.getStatus())).count());
            r.put("invited", pApps.stream().filter(x -> "INVITED".equalsIgnoreCase(x.getStatus())).count());
            r.put("selected", pApps.stream().filter(x -> "SELECTED".equalsIgnoreCase(x.getStatus())).count());
            r.put("backup", pApps.stream().filter(x -> "BACKUP".equalsIgnoreCase(x.getStatus()) || x.isBackupCandidate()).count());
            r.put("rejected", pApps.stream().filter(x -> "REJECTED".equalsIgnoreCase(x.getStatus())).count());
            return r;
        }).toList();

        List<AuditionSchedule> auditions = auditionRepo.findByCompanyIdOrderByScheduledDateAscIdDesc(company.getId());
        double avgRating = auditions.stream().filter(a -> a.getRating() != null)
                .mapToInt(AuditionSchedule::getRating).average().orElse(0.0);
        Map<String, Object> auditionStats = new LinkedHashMap<>();
        auditionStats.put("total", auditions.size());
        auditionStats.put("online", auditions.stream().filter(a -> "Online".equalsIgnoreCase(a.getAuditionType())).count());
        auditionStats.put("offline", auditions.stream().filter(a -> "Offline".equalsIgnoreCase(a.getAuditionType())).count());
        auditionStats.put("scheduled", auditions.stream().filter(a -> "SCHEDULED".equalsIgnoreCase(a.getStatus()) || "RESCHEDULED".equalsIgnoreCase(a.getStatus())).count());
        auditionStats.put("completed", auditions.stream().filter(a -> "COMPLETED".equalsIgnoreCase(a.getStatus())).count());
        auditionStats.put("cancelled", auditions.stream().filter(a -> "CANCELLED".equalsIgnoreCase(a.getStatus())).count());
        auditionStats.put("avgRating", Math.round(avgRating * 10.0) / 10.0);

        BigDecimal totalExpenses = expenseRepo.findByCompanyIdOrderByExpenseDateDescIdDesc(company.getId()).stream()
                .map(ProductionExpense::getAmountInr).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalSubs = paymentRepo.findByCompanyIdOrderByPaidAtDesc(company.getId()).stream()
                .map(SubscriptionPayment::getTotalPaidInr).reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("totalRegisteredActors", artists.size());
        res.put("verifiedActorsCount", artists.stream().filter(ArtistProfile::isProfileVerified).count());
        res.put("actorCategoryCounts", actorCategoryCounts);
        res.put("projectReports", projectReports);
        res.put("auditionStats", auditionStats);
        res.put("totalExpensesInr", totalExpenses);
        res.put("totalSubscriptionSpendInr", totalSubs);
        return res;
    }

    private String clean(Object val) {
        return val == null ? "" : String.valueOf(val).replace('\t', ' ').replace('\n', ' ');
    }
}
