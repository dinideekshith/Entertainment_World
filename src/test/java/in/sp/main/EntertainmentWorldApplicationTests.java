package in.sp.main;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
class EntertainmentWorldApplicationTests {

    @Autowired
    private WebApplicationContext wac;

    @Test
    void fullRegistrationAdminApprovalPassPaymentAndDashboardFlow() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
        String uniqueEmail = "studio." + UUID.randomUUID().toString().substring(0, 8) + "@example.in";

        MockMultipartFile logo = new MockMultipartFile("companyLogo", "logo.png", "image/png", new byte[]{1, 2, 3, 4});
        MockMultipartFile gst = new MockMultipartFile("gstCertificate", "gst.pdf", "application/pdf", "GST".getBytes(StandardCharsets.UTF_8));
        MockMultipartFile regCert = new MockMultipartFile("companyRegistrationCertificate", "reg.pdf", "application/pdf", "REG".getBytes(StandardCharsets.UTF_8));
        MockMultipartFile panDoc = new MockMultipartFile("panDocument", "pan.pdf", "application/pdf", "PAN".getBytes(StandardCharsets.UTF_8));
        MockMultipartFile addrDoc = new MockMultipartFile("businessAddressProof", "addr.pdf", "application/pdf", "ADDR".getBytes(StandardCharsets.UTF_8));
        MockMultipartFile authDoc = new MockMultipartFile("authorizationLetter", "auth.pdf", "application/pdf", "AUTH".getBytes(StandardCharsets.UTF_8));

        // 1. Register new Casting Company
        MvcResult regRes = mockMvc.perform(multipart("/api/auth/register")
                        .file(logo).file(gst).file(regCert).file(panDoc).file(addrDoc).file(authDoc)
                        .param("representativeName", "Anirudh Kulkarni")
                        .param("companyName", "Horizon CineCraft Pvt Ltd")
                        .param("companyEmail", uniqueEmail)
                        .param("contactNumber", "+91 98200 12345")
                        .param("password", "Secret@123")
                        .param("confirmPassword", "Secret@123")
                        .param("website", "https://horizoncinecraft.in")
                        .param("companyAddress", "101 Film Studio Park, Andheri West")
                        .param("city", "Mumbai")
                        .param("state", "Maharashtra")
                        .param("country", "India")
                        .param("yearEstablished", "2020")
                        .param("companyDescription", "Independent film and OTT casting studio.")
                        .param("gstNumber", "27AABCH1234F1Z2")
                        .param("panNumber", "AABCH1234F")
                        .param("termsAccepted", "true"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.company.accountStatus").value("Pending"))
                .andExpect(jsonPath("$.redirectTarget").value("/company-status.html"))
                .andReturn();

        MockHttpSession companySession = (MockHttpSession) regRes.getRequest().getSession(false);

        // Extract company ID from /api/auth/me
        String meJson = mockMvc.perform(get("/api/auth/me").session(companySession))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long companyId = Long.parseLong(meJson.replaceAll(".*\"id\":(\\d+).*", "$1"));

        // 2. Unapproved company cannot access passes or dashboard yet
        mockMvc.perform(get("/api/subscription/passes").session(companySession))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/dashboard/overview").session(companySession))
                .andExpect(status().isForbidden());

        // 3. Super Admin logs in and verifies all 8 Admin fields
        MvcResult adminLogin = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@entertainmentworld.in\",\"password\":\"Admin@123\",\"portal\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.redirectTarget").value("/admin/dashboard.html"))
                .andReturn();
        MockHttpSession adminSession = (MockHttpSession) adminLogin.getRequest().getSession(false);

        mockMvc.perform(put("/api/admin/companies/" + companyId + "/verify")
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "accountStatus": "Approved",
                                  "emailVerification": "Verified",
                                  "mobileVerification": "Verified",
                                  "documentVerification": "Verified",
                                  "adminRemarks": "All documents confirmed.",
                                  "verifiedBy": "Vikramaditya Rao (EW-ADMIN-01)",
                                  "verificationDate": "2026-11-26",
                                  "accountSuspension": "Active"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.company.accountStatus").value("Approved"))
                .andExpect(jsonPath("$.company.verifiedBadge").value(true));

        // 4. Approved company can now view the 3 passes, must pay before dashboard
        mockMvc.perform(get("/api/dashboard/overview").session(companySession))
                .andExpect(status().isPaymentRequired());

        mockMvc.perform(get("/api/subscription/passes").session(companySession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passes", hasSize(3)));

        mockMvc.perform(post("/api/subscription/checkout")
                        .session(companySession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"passCode\":\"PASS_3_SUBSCRIPTION\",\"durationMonths\":3,\"paymentMethod\":\"UPI\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.redirectTarget").value("/dashboard.html"))
                .andExpect(jsonPath("$.company.subscriptionActive").value(true));

        // 5. Full Recruiter Dashboard endpoints now unlock cleanly
        mockMvc.perform(get("/api/dashboard/overview").session(companySession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.company.verifiedBadge").value(true));

        MockMultipartFile poster = new MockMultipartFile("projectPoster", "poster.jpg", "image/jpeg", new byte[]{1, 2, 3});
        MockMultipartFile refImg = new MockMultipartFile("referenceImages", "ref1.jpg", "image/jpeg", new byte[]{4, 5, 6});
        MockMultipartFile lookImg = new MockMultipartFile("characterLookReferences", "look1.jpg", "image/jpeg", new byte[]{7, 8, 9});
        MockMultipartFile scriptPdf = new MockMultipartFile("auditionScriptPdf", "script.pdf", "application/pdf", "SCENE 1".getBytes(StandardCharsets.UTF_8));
        MockMultipartFile promoImg = new MockMultipartFile("projectPromotionalImage", "promo.jpg", "image/jpeg", new byte[]{10, 11, 12});

        MvcResult projRes = mockMvc.perform(multipart("/api/dashboard/projects")
                        .file(poster).file(refImg).file(lookImg).file(scriptPdf).file(promoImg)
                        .session(companySession)
                        .param("projectTitle", "Starlight Musical")
                        .param("projectType", "Movie")
                        .param("productionHouseName", "Horizon Banner")
                        .param("castingCompanyName", "Horizon CineCraft Pvt Ltd")
                        .param("projectDetails", "Lead musical drama casting")
                        .param("projectLanguage", "Kannada")
                        .param("projectStage", "Casting Open")
                        .param("targetCategory", "Actor")
                        .param("targetGender", "Male")
                        .param("ageMin", "18")
                        .param("ageMax", "25")
                        .param("heightRequirement", "5'9\" - 6'0\"")
                        .param("preferredAppearance", "Expressive athletic look")
                        .param("experienceLevel", "Both")
                        .param("artistsRequiredCount", "2")
                        .param("roleDescription", "Protagonist singer-actor")
                        .param("characterName", "Vikram")
                        .param("location", "Bengaluru")
                        .param("auditionLocation", "Online Self-Tape")
                        .param("auditionDate", "2026-12-05")
                        .param("auditionType", "Online")
                        .param("shootingStartDate", "2026-12-20")
                        .param("shootingEndDate", "2027-01-15")
                        .param("shootingDuration", "25 Days")
                        .param("availabilityRequirements", "Full 25-day continuous schedule")
                        .param("paymentType", "Paid")
                        .param("budget", "Rs. 25,000")
                        .param("paymentBasis", "Per day")
                        .param("accommodationProvided", "Yes")
                        .param("foodProvided", "Yes")
                        .param("travelExpensesCovered", "Yes")
                        .param("auditionProcess", "Self-tape + Director screen test")
                        .param("auditionInstructions", "Shoot in natural lighting")
                        .param("selfIntroVideoRequired", "Yes")
                        .param("portfolioRequired", "Yes")
                        .param("auditionScript", "Sing two bars then deliver dialogue.")
                        .param("lastDateToApply", "2026-12-03")
                        .param("requiredPhotographs", "2 Headshots + 1 Full Length")
                        .param("introVideoRequirement", "30s intro slate")
                        .param("actingPortfolioRequirement", "Performance reel")
                        .param("previousWorkLinksReq", "YouTube link")
                        .param("applicantContactReq", "Phone & Email")
                        .param("additionalDocumentsReq", "Passport copy")
                        .param("castingDirectorName", "Anirudh Kulkarni")
                        .param("contactEmail", uniqueEmail)
                        .param("contactNumber", "+91 98200 12345")
                        .param("whatsappNumber", "+91 98200 12345")
                        .param("websiteOrSocialLinks", "https://horizoncinecraft.in"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.projectLanguage").value("Kannada"))
                .andExpect(jsonPath("$.productionHouseName").value("Horizon Banner"))
                .andExpect(jsonPath("$.paymentBasis").value("Per day"))
                .andExpect(jsonPath("$.accommodationProvided").value("Yes"))
                .andExpect(jsonPath("$.projectPosterPath").isNotEmpty())
                .andExpect(jsonPath("$.auditionScriptPdfPath").isNotEmpty())
                .andReturn();

        String projJson = projRes.getResponse().getContentAsString();
        long projectId = Long.parseLong(projJson.replaceAll(".*\"id\":(\\d+).*", "$1"));

        // Project Edit, Pause, Publish
        mockMvc.perform(put("/api/dashboard/projects/" + projectId)
                        .session(companySession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"projectTitle\":\"Starlight Musical Revised\",\"budget\":\"Rs. 30,000\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.project.projectTitle").value("Starlight Musical Revised"));

        mockMvc.perform(patch("/api/dashboard/projects/" + projectId + "/status")
                        .session(companySession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PAUSED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.project.status").value("PAUSED"));

        mockMvc.perform(patch("/api/dashboard/projects/" + projectId + "/status")
                        .session(companySession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACTIVE\"}"))
                .andExpect(status().isOk());

        // Search Artists with skills/name/experience filters + Actor Verification + Compare
        String searchJson = mockMvc.perform(post("/api/dashboard/artists/search")
                        .session(companySession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"Actor\",\"videoOnly\":true,\"skills\":\"drama\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total", greaterThan(0)))
                .andReturn().getResponse().getContentAsString();
        long artistId = Long.parseLong(searchJson.replaceAll(".*\"id\":(\\d+).*", "$1"));

        mockMvc.perform(post("/api/dashboard/artists/" + artistId + "/verify")
                        .session(companySession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"profileVerified\":true,\"verificationStatus\":\"Verified\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.artist.profileVerified").value(true));

        mockMvc.perform(post("/api/dashboard/artists/compare")
                        .session(companySession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"artistIds\":[" + artistId + "]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actors", hasSize(1)));

        // Application Review (Select + Rating + Comment)
        String appsJson = mockMvc.perform(get("/api/dashboard/applications?projectId=" + projectId).session(companySession))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long appId = Long.parseLong(appsJson.replaceAll(".*\"applicationId\":(\\d+).*", "$1"));

        mockMvc.perform(post("/api/dashboard/applications/" + appId + "/review")
                        .session(companySession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"SELECTED\",\"rating\":5,\"assignedRole\":\"Vikram\",\"internalComment\":\"Great presence\",\"notifyActor\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SELECTED"));

        // Auditions CRUD
        String audJson = mockMvc.perform(post("/api/dashboard/auditions")
                        .session(companySession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"projectId\":" + projectId + ",\"artistId\":" + artistId + ",\"auditionType\":\"Online\",\"scheduledDate\":\"2026-12-06\",\"scheduledTime\":\"14:00\",\"locationOrLink\":\"https://meet.entertainmentworld.in/room/test\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long auditionId = Long.parseLong(audJson.replaceAll(".*\"id\":(\\d+).*", "$1"));

        mockMvc.perform(put("/api/dashboard/auditions/" + auditionId)
                        .session(companySession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\",\"rating\":5,\"feedback\":\"Strong audition\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        // Communication Messages, Selection Summary, Team, Contracts, Expenses, Reports PDF & Excel
        mockMvc.perform(post("/api/dashboard/messages")
                        .session(companySession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"artistId\":" + artistId + ",\"projectId\":" + projectId + ",\"messageType\":\"SELECTION_NOTICE\",\"subject\":\"Welcome Aboard\",\"body\":\"Confirmed for lead shoot\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/dashboard/selection-summary").session(companySession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.selected", hasSize(greaterThan(0))));

        mockMvc.perform(post("/api/dashboard/team")
                        .session(companySession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Kiran Rao\",\"email\":\"kiran@horizon.in\",\"roleTitle\":\"Casting Assistant\",\"assignedProjectIds\":\"" + projectId + "\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(multipart("/api/dashboard/contracts")
                        .session(companySession)
                        .param("projectId", String.valueOf(projectId))
                        .param("artistId", String.valueOf(artistId))
                        .param("contractTitle", "Lead Performer Contract")
                        .param("roleName", "Vikram")
                        .param("compensationInr", "150000")
                        .param("contractStatus", "SIGNED")
                        .param("documentVerificationStatus", "VERIFIED"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/dashboard/expenses")
                        .session(companySession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"projectId\":" + projectId + ",\"category\":\"Audition Studio\",\"description\":\"Camera test booking\",\"amountInr\":12000,\"paymentStatus\":\"PAID\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/dashboard/overview").session(companySession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kpis.totalRegisteredActors", greaterThan(0)))
                .andExpect(jsonPath("$.kpis.selectedActors", greaterThan(0)))
                .andExpect(jsonPath("$.chartData.applicationsByStatus.SELECTED", greaterThan(0)));

        mockMvc.perform(get("/api/dashboard/reports").session(companySession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectReports", hasSize(greaterThan(0))));

        mockMvc.perform(get("/api/dashboard/reports/export-excel").session(companySession))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("entertainment-world-casting-report.xls")));

        byte[] pdfBytes = mockMvc.perform(get("/api/dashboard/reports/export-pdf").session(companySession))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("entertainment-world-casting-report.pdf")))
                .andReturn().getResponse().getContentAsByteArray();
        org.junit.jupiter.api.Assertions.assertTrue(new String(pdfBytes, 0, 8, StandardCharsets.US_ASCII).startsWith("%PDF-1.4"));

        mockMvc.perform(get("/api/dashboard/artists/export-excel").session(companySession))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("entertainment-world-artists.xls")));

        mockMvc.perform(get("/api/dashboard/transactions").session(companySession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.purchaseHistory", hasSize(1)));

        mockMvc.perform(delete("/api/dashboard/projects/" + projectId).session(companySession))
                .andExpect(status().isOk());
    }
}
