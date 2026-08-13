package buffer

import (
	"fmt"
	"testing"
	"time"

	"github.com/skyops/skyops/backend/pkg/models"
)

func TestBoundedBufferOverflow(t *testing.T) {
	buf := NewBoundedBuffer(5)

	for i := 0; i < 10; i++ {
		buf.Push(&models.K8sEvent{
			ID:      fmt.Sprintf("evt-%d", i),
			Message: fmt.Sprintf("Event message %d", i),
		})
	}

	if buf.Size() != 5 {
		t.Fatalf("Expected buffer size 5, got %d", buf.Size())
	}

	if buf.DroppedCount() != 5 {
		t.Fatalf("Expected 5 dropped events, got %d", buf.DroppedCount())
	}

	flushed := buf.Flush()
	if len(flushed) != 5 {
		t.Fatalf("Expected 5 flushed events, got %d", len(flushed))
	}

	// First event in buffer should now be evt-5 because evt 0-4 were dropped
	if flushed[0].ID != "evt-5" {
		t.Fatalf("Expected oldest remaining event to be evt-5, got %s", flushed[0].ID)
	}

	if buf.Size() != 0 {
		t.Fatalf("Expected buffer to be empty after flush, got %d", buf.Size())
	}
}

func TestExponentialBackoff(t *testing.T) {
	b := NewBackoff(1*time.Second, 10*time.Second)

	d1 := b.Next() // 1s
	d2 := b.Next() // 2s
	d3 := b.Next() // 4s

	if d1 != 1*time.Second || d2 != 2*time.Second || d3 != 4*time.Second {
		t.Fatalf("Unexpected backoff intervals: %v, %v, %v", d1, d2, d3)
	}

	b.Reset()
	if d := b.Next(); d != 1*time.Second {
		t.Fatalf("Expected 1s after reset, got %v", d)
	}
}
