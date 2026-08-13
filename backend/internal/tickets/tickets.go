package tickets

import (
	"fmt"
	"time"

	"github.com/dhandesaurav52/skyops-k8s-inc-id/backend/pkg/models"
)

type Manager struct {
	nextTicketNum int
}

func NewManager(startNum int) *Manager {
	if startNum < 1001 {
		startNum = 1001
	}
	return &Manager{nextTicketNum: startNum}
}

func (m *Manager) CreateTicketFromIncident(inc *models.Incident, assignee string) *models.Ticket {
	now := time.Now().UTC()
	ticketID := fmt.Sprintf("SKY-%d", m.nextTicketNum)
	m.nextTicketNum++

	priority := "P2"
	if inc.Severity == models.SeverityCritical {
		priority = "P0"
	} else if inc.Severity == models.SeverityHigh {
		priority = "P1"
	}

	ticket := &models.Ticket{
		ID:             ticketID,
		IncidentID:     inc.ID,
		OrganizationID: inc.OrganizationID,
		Title:          fmt.Sprintf("[%s] %s", inc.Severity, inc.Title),
		Description:    fmt.Sprintf("Correlated Incident %s:\n\nSummary: %s\nImpact: %s\nRoot Cause: %s", inc.ID, inc.Summary, inc.Impact, inc.RootCause),
		Severity:       inc.Severity,
		Priority:       priority,
		Assignee:       assignee,
		Status:         models.TicketOpen,
		ClusterID:      inc.ClusterID,
		ClusterName:    inc.ClusterName,
		Namespace:      inc.Namespace,
		Resource:       fmt.Sprintf("%s/%s", inc.ResourceType, inc.ResourceName),
		Comments: []models.CommentItem{
			{
				ID:        fmt.Sprintf("cmt-1"),
				Author:    "SkyOps Engine",
				Message:   fmt.Sprintf("Ticket automatically created from incident %s", inc.ID),
				CreatedAt: now,
			},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	return ticket
}

func (m *Manager) AddComment(ticket *models.Ticket, author, message string) {
	now := time.Now().UTC()
	comment := models.CommentItem{
		ID:        fmt.Sprintf("cmt-%d", len(ticket.Comments)+1),
		Author:    author,
		Message:   message,
		CreatedAt: now,
	}
	ticket.Comments = append(ticket.Comments, comment)
	ticket.UpdatedAt = now
}
