package buffer

import (
	"sync"
	"time"

	"github.com/skyops/skyops/backend/pkg/models"
)

type BoundedBuffer struct {
	mu       sync.Mutex
	events   []*models.K8sEvent
	maxSize  int
	dropped  int64
}

func NewBoundedBuffer(maxSize int) *BoundedBuffer {
	if maxSize <= 0 {
		maxSize = 1000
	}
	return &BoundedBuffer{
		events:  make([]*models.K8sEvent, 0, maxSize),
		maxSize: maxSize,
	}
}

func (b *BoundedBuffer) Push(evt *models.K8sEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.events) >= b.maxSize {
		// Drop oldest event to enforce bounded memory usage
		b.events = b.events[1:]
		b.dropped++
	}
	b.events = append(b.events, evt)
}

func (b *BoundedBuffer) Flush() []*models.K8sEvent {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.events) == 0 {
		return nil
	}

	flushed := make([]*models.K8sEvent, len(b.events))
	copy(flushed, b.events)
	b.events = b.events[:0]
	return flushed
}

func (b *BoundedBuffer) Size() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.events)
}

func (b *BoundedBuffer) DroppedCount() int64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.dropped
}

type Backoff struct {
	MinInterval time.Duration
	MaxInterval time.Duration
	Factor      float64
	current     time.Duration
}

func NewBackoff(min, max time.Duration) *Backoff {
	return &Backoff{
		MinInterval: min,
		MaxInterval: max,
		Factor:      2.0,
		current:     min,
	}
}

func (b *Backoff) Next() time.Duration {
	d := b.current
	b.current = time.Duration(float64(b.current) * b.Factor)
	if b.current > b.MaxInterval {
		b.current = b.MaxInterval
	}
	return d
}

func (b *Backoff) Reset() {
	b.current = b.MinInterval
}
