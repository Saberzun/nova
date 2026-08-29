package common

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

type StreamEndReason string

// StreamEventObserver receives upstream events before downstream delivery.
// Implementations keep request-local billing evidence and must be safe for a
// concurrent Freeze call when the client disconnects.
type StreamEventObserver interface {
	Observe(data string, sequence uint64)
	Freeze(cutoffSequence uint64)
}

const (
	StreamEndReasonNone        StreamEndReason = ""
	StreamEndReasonDone        StreamEndReason = "done"
	StreamEndReasonTimeout     StreamEndReason = "timeout"
	StreamEndReasonClientGone  StreamEndReason = "client_gone"
	StreamEndReasonScannerErr  StreamEndReason = "scanner_error"
	StreamEndReasonHandlerStop StreamEndReason = "handler_stop"
	StreamEndReasonEOF         StreamEndReason = "eof"
	StreamEndReasonPanic       StreamEndReason = "panic"
	StreamEndReasonPingFail    StreamEndReason = "ping_fail"
)

const maxStreamErrorEntries = 20

type StreamErrorEntry struct {
	Message   string
	Timestamp time.Time
}

type StreamStatus struct {
	EndReason StreamEndReason
	EndError  error
	endOnce   sync.Once

	mu                   sync.Mutex
	Errors               []StreamErrorEntry
	ErrorCount           int
	nextSequence         uint64
	cutoffSequence       uint64
	cutoffFrozen         bool
	inspectionIncomplete bool
}

type StreamStatusSnapshot struct {
	EndReason  StreamEndReason
	EndError   error
	Errors     []StreamErrorEntry
	ErrorCount int
}

func NewStreamStatus() *StreamStatus {
	return &StreamStatus{}
}

func (s *StreamStatus) SetEndReason(reason StreamEndReason, err error) {
	if s == nil {
		return
	}
	s.endOnce.Do(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		s.EndReason = reason
		s.EndError = err
	})
}

func (s *StreamStatus) GetEndReason() StreamEndReason {
	if s == nil {
		return StreamEndReasonNone
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.EndReason
}

func (s *StreamStatus) Snapshot() StreamStatusSnapshot {
	if s == nil {
		return StreamStatusSnapshot{}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return StreamStatusSnapshot{
		EndReason:  s.EndReason,
		EndError:   s.EndError,
		Errors:     append([]StreamErrorEntry(nil), s.Errors...),
		ErrorCount: s.ErrorCount,
	}
}

// NextEventSequence assigns the linearization point at which the scanner
// accepts an upstream event for downstream processing.
func (s *StreamStatus) ObserveEvent(observer StreamEventObserver, data string) bool {
	if s == nil {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cutoffFrozen {
		return false
	}
	s.nextSequence++
	if observer != nil {
		observer.Observe(data, s.nextSequence)
	}
	return true
}

// FreezeCutoff prevents events accepted after client disconnect from entering
// billing evidence. Events at or below the cutoff remain eligible for parsing.
func (s *StreamStatus) FreezeCutoff() uint64 {
	if s == nil {
		return 0
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.cutoffFrozen {
		s.cutoffSequence = s.nextSequence
		s.cutoffFrozen = true
	}
	return s.cutoffSequence
}

func (s *StreamStatus) FreezeCutoffWithObserver(observer StreamEventObserver) uint64 {
	if s == nil {
		return 0
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.cutoffFrozen {
		s.cutoffSequence = s.nextSequence
		s.cutoffFrozen = true
		if observer != nil {
			observer.Freeze(s.cutoffSequence)
		}
	}
	return s.cutoffSequence
}

func (s *StreamStatus) MarkInspectionIncomplete() {
	if s == nil {
		return
	}
	s.mu.Lock()
	s.inspectionIncomplete = true
	s.mu.Unlock()
}

func (s *StreamStatus) InspectionComplete() bool {
	if s == nil {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return !s.inspectionIncomplete
}

// CorrectClientGoneToDone repairs the race where a client closes immediately
// after a protocol terminal event but before the scanner records completion.
func (s *StreamStatus) CorrectClientGoneToDone(normalTerminalSeen bool) bool {
	if s == nil {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if !normalTerminalSeen || s.EndReason != StreamEndReasonClientGone {
		return false
	}
	s.EndReason = StreamEndReasonDone
	s.EndError = nil
	return true
}

func (s *StreamStatus) CutoffSequence() (uint64, bool) {
	if s == nil {
		return 0, false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.cutoffSequence, s.cutoffFrozen
}

func (s *StreamStatus) RecordError(msg string) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ErrorCount++
	if len(s.Errors) < maxStreamErrorEntries {
		s.Errors = append(s.Errors, StreamErrorEntry{
			Message:   msg,
			Timestamp: time.Now(),
		})
	}
}

func (s *StreamStatus) HasErrors() bool {
	if s == nil {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.ErrorCount > 0
}

func (s *StreamStatus) TotalErrorCount() int {
	if s == nil {
		return 0
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.ErrorCount
}

func (s *StreamStatus) IsNormalEnd() bool {
	snapshot := s.Snapshot()
	if s == nil {
		return true
	}
	return snapshot.EndReason == StreamEndReasonDone ||
		snapshot.EndReason == StreamEndReasonEOF ||
		snapshot.EndReason == StreamEndReasonHandlerStop
}

func (s *StreamStatus) Summary() string {
	if s == nil {
		return "StreamStatus<nil>"
	}
	snapshot := s.Snapshot()
	b := &strings.Builder{}
	fmt.Fprintf(b, "reason=%s", snapshot.EndReason)
	if snapshot.EndError != nil {
		fmt.Fprintf(b, " end_error=%q", snapshot.EndError.Error())
	}
	if snapshot.ErrorCount > 0 {
		fmt.Fprintf(b, " soft_errors=%d", snapshot.ErrorCount)
	}
	return b.String()
}
