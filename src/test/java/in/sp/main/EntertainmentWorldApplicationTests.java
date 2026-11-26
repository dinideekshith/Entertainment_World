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

        mockMvc.perform(post("/api/dashboard/projects")
                        .session(companySession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"projectTitle\":\"Starlight Musical\",\"projectType\":\"Casting Call\",\"targetCategory\":\"Actor\",\"projectDetails\":\"Lead casting\",\"location\":\"Mumbai\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/dashboard/artists/search")
                        .session(companySession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"Actor\",\"videoOnly\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total", greaterThan(0)));

        mockMvc.perform(get("/api/dashboard/artists/export-excel").session(companySession))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("entertainment-world-artists.xls")));

        mockMvc.perform(get("/api/dashboard/transactions").session(companySession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.purchaseHistory", hasSize(1)));
    }
}
