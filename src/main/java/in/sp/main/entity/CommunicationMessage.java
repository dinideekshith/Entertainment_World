package in.sp.main.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Persisted communication log between a Casting Company and Artists.
 */
@Entity
@Table(name = "communication_messages")
public class CommunicationMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long companyId;

    @Column(nullable = false)
    private Long artistId;

    private Long projectId;

    @Column(nullable = false, length = 40)
    private String messageType = "DIRECT_MESSAGE"; // DIRECT_MESSAGE, AUDITION_INVITE, SELECTION_NOTICE, REJECTION_NOTICE

    @Column(nullable = false, length = 180)
    private String subject;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(nullable = false, length = 30)
    private String deliveryChannel = "IN_APP_EMAIL";

    @Column(nullable = false)
    private boolean readByActor = false;

    @Column(nullable = false)
    private LocalDateTime sentAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }

    public Long getArtistId() { return artistId; }
    public void setArtistId(Long artistId) { this.artistId = artistId; }

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public String getMessageType() { return messageType; }
    public void setMessageType(String messageType) { this.messageType = messageType; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }

    public String getDeliveryChannel() { return deliveryChannel; }
    public void setDeliveryChannel(String deliveryChannel) { this.deliveryChannel = deliveryChannel; }

    public boolean isReadByActor() { return readByActor; }
    public void setReadByActor(boolean readByActor) { this.readByActor = readByActor; }

    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }
}
