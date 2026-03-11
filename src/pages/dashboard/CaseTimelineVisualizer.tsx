// ============================================================================
// Phase 173 — Event Timeline Visualizer
// Dashboard page at /dashboard/case-timeline
// Displays officer actions, suspect actions, policy references, camera events
// in a unified interactive timeline.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimelineEvent {
  eventId: string;
  timestamp: string;
  eventType: string;
  description: string;
  sourceType: string;
  confidence: number;
  policyReferences: string[];
  significance: 'routine' | 'notable' | 'significant' | 'critical';
}

interface TimelineCluster {
  clusterId: string;
  clusterName: string;
  timestamp: string;
  durationSeconds: number;
  significance: 'routine' | 'notable' | 'significant' | 'critical';
  description: string;
  eventCount: number;
}

interface CameraSource {
  sourceId: string;
  sourceType: string;
  label: string;
  startTimestamp: string;
  endTimestamp: string;
}

interface TimelineData {
  events: TimelineEvent[];
  clusters: TimelineCluster[];
  cameras: CameraSource[];
  totalDurationSeconds: number;
  startTime: string;
  endTime: string;
}

type FilterCategory = 'all' | 'officer_actions' | 'subject_actions' | 'policy' | 'camera' | 'critical';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIGNIFICANCE_COLORS: Record<string, string> = {
  routine: '#6B7280',
  notable: '#3B82F6',
  significant: '#F59E0B',
  critical: '#EF4444',
};


const EVENT_CATEGORIES: Record<FilterCategory, string> = {
  all: 'All Events',
  officer_actions: 'Officer Actions',
  subject_actions: 'Subject Actions',
  policy: 'Policy References',
  camera: 'Camera Events',
  critical: 'Critical Moments',
};

// ---------------------------------------------------------------------------
// Mock data for development
// ---------------------------------------------------------------------------

function generateMockTimelineData(): TimelineData {
  const events: TimelineEvent[] = [
    {
      eventId: 'evt-1',
      timestamp: '00:00:13',
      eventType: 'vehicle_exit',
      description: 'Officer exits patrol vehicle',
      sourceType: 'bodycam',
      confidence: 0.92,
      policyReferences: [],
      significance: 'routine',
    },
    {
      eventId: 'evt-2',
      timestamp: '00:00:21',
      eventType: 'verbal_command',
      description: 'Officer issues verbal commands to individual',
      sourceType: 'bodycam',
      confidence: 0.88,
      policyReferences: ['Use of Force Policy 3.1'],
      significance: 'notable',
    },
    {
      eventId: 'evt-3',
      timestamp: '00:00:34',
      eventType: 'officer_proximity',
      description: 'Officer approaches within 5 feet of individual',
      sourceType: 'bodycam',
      confidence: 0.85,
      policyReferences: [],
      significance: 'notable',
    },
    {
      eventId: 'evt-4',
      timestamp: '00:00:47',
      eventType: 'physical_contact',
      description: 'Physical contact initiated — officer places hand on individual arm',
      sourceType: 'bodycam',
      confidence: 0.90,
      policyReferences: ['Use of Force Policy 3.2', 'Arrest Procedures 2.4'],
      significance: 'significant',
    },
    {
      eventId: 'evt-5',
      timestamp: '00:01:02',
      eventType: 'weapon_deployment',
      description: 'Officer draws taser — held at low ready',
      sourceType: 'bodycam',
      confidence: 0.93,
      policyReferences: ['Use of Force Policy 4.1', 'Taser Policy 1.2'],
      significance: 'critical',
    },
    {
      eventId: 'evt-6',
      timestamp: '00:01:15',
      eventType: 'de_escalation',
      description: 'Officer holsters taser, issues verbal de-escalation',
      sourceType: 'bodycam',
      confidence: 0.87,
      policyReferences: ['De-escalation Policy 2.1'],
      significance: 'significant',
    },
    {
      eventId: 'evt-7',
      timestamp: '00:01:28',
      eventType: 'handcuffing',
      description: 'Individual placed in handcuffs without resistance',
      sourceType: 'bodycam',
      confidence: 0.91,
      policyReferences: ['Arrest Procedures 3.1'],
      significance: 'notable',
    },
    {
      eventId: 'evt-8',
      timestamp: '00:01:45',
      eventType: 'pat_down',
      description: 'Officer conducts pat-down search',
      sourceType: 'bodycam',
      confidence: 0.86,
      policyReferences: ['Search Policy 1.3'],
      significance: 'notable',
    },
    {
      eventId: 'evt-9',
      timestamp: '00:02:10',
      eventType: 'transport',
      description: 'Individual placed in patrol vehicle',
      sourceType: 'bodycam',
      confidence: 0.94,
      policyReferences: [],
      significance: 'routine',
    },
  ];

  const clusters: TimelineCluster[] = [
    {
      clusterId: 'cluster-1',
      clusterName: 'Initial Contact',
      timestamp: '00:00:13',
      durationSeconds: 21,
      significance: 'notable',
      description: 'Officer exits vehicle, issues commands, approaches individual',
      eventCount: 3,
    },
    {
      clusterId: 'cluster-2',
      clusterName: 'Use of Force Escalation',
      timestamp: '00:00:47',
      durationSeconds: 28,
      significance: 'critical',
      description: 'Physical contact, weapon deployment, de-escalation sequence',
      eventCount: 3,
    },
    {
      clusterId: 'cluster-3',
      clusterName: 'Arrest & Transport',
      timestamp: '00:01:28',
      durationSeconds: 42,
      significance: 'notable',
      description: 'Handcuffing, search, transport to vehicle',
      eventCount: 3,
    },
  ];

  const cameras: CameraSource[] = [
    { sourceId: 'cam-bodycam-1', sourceType: 'bodycam', label: 'Officer Bodycam', startTimestamp: '00:00:00', endTimestamp: '00:03:00' },
    { sourceId: 'cam-dashcam-1', sourceType: 'dashcam', label: 'Patrol Dashcam', startTimestamp: '00:00:00', endTimestamp: '00:03:00' },
  ];

  return {
    events,
    clusters,
    cameras,
    totalDurationSeconds: 130,
    startTime: '00:00:13',
    endTime: '00:02:10',
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CaseTimelineVisualizer() {
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('all');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [caseId, setCaseId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load timeline data
  const loadTimeline = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/forensic/timeline/${id}`);
      if (response.ok) {
        const data = await response.json();
        setTimelineData(data);
      } else {
        // Use mock data in development
        setTimelineData(generateMockTimelineData());
      }
    } catch {
      setTimelineData(generateMockTimelineData());
    }
    setLoading(false);
  }, []);

  // Playback control
  useEffect(() => {
    if (!isPlaying || !timelineData) return;
    const interval = setInterval(() => {
      setPlaybackPosition(prev => {
        if (prev >= timelineData.totalDurationSeconds) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, timelineData]);

  // Filter events
  const filteredEvents = timelineData?.events.filter(event => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'critical') return event.significance === 'critical';
    if (selectedFilter === 'officer_actions') {
      return ['vehicle_exit', 'verbal_command', 'officer_proximity', 'weapon_deployment', 'de_escalation', 'handcuffing', 'pat_down'].includes(event.eventType);
    }
    if (selectedFilter === 'subject_actions') {
      return ['suspect_position', 'resistance', 'compliance'].includes(event.eventType);
    }
    if (selectedFilter === 'policy') return event.policyReferences.length > 0;
    if (selectedFilter === 'camera') return ['bodycam', 'dashcam', 'surveillance'].includes(event.sourceType);
    return true;
  }) ?? [];

  const formatTimestamp = (ts: string) => {
    const parts = ts.split(':');
    if (parts.length === 3) {
      const min = parseInt(parts[1], 10);
      const sec = parseInt(parts[2], 10);
      return `${min}:${String(sec).padStart(2, '0')}`;
    }
    return ts;
  };

  const getConfidenceLabel = (conf: number) => {
    if (conf >= 0.9) return 'High';
    if (conf >= 0.7) return 'Medium';
    return 'Low';
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
          Case Event Timeline
        </h1>
        <p style={{ fontSize: '14px', color: '#6B7280' }}>
          Forensic reconstruction timeline — officer actions, evidence events, and policy references
        </p>
      </div>

      {/* Case ID Input */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <input
          type="text"
          placeholder="Enter Case ID"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            fontSize: '14px',
          }}
        />
        <button
          onClick={() => loadTimeline(caseId)}
          disabled={loading || !caseId}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2563EB',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: loading || !caseId ? 'not-allowed' : 'pointer',
            opacity: loading || !caseId ? 0.5 : 1,
          }}
        >
          {loading ? 'Loading...' : 'Load Timeline'}
        </button>
        <button
          onClick={() => setTimelineData(generateMockTimelineData())}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6B7280',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Demo Data
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', marginBottom: '16px', color: '#DC2626', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {timelineData && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <SummaryCard title="Total Events" value={timelineData.events.length} color="#2563EB" />
            <SummaryCard title="Critical Moments" value={timelineData.events.filter(e => e.significance === 'critical').length} color="#EF4444" />
            <SummaryCard title="Policy Links" value={timelineData.events.filter(e => e.policyReferences.length > 0).length} color="#F59E0B" />
            <SummaryCard title="Camera Sources" value={timelineData.cameras.length} color="#059669" />
          </div>

          {/* Playback Controls */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px',
            padding: '12px 16px', backgroundColor: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB',
          }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                padding: '8px 16px', backgroundColor: isPlaying ? '#EF4444' : '#2563EB',
                color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600,
              }}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={() => { setPlaybackPosition(0); setIsPlaying(false); }}
              style={{
                padding: '8px 16px', backgroundColor: '#6B7280',
                color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer',
              }}
            >
              Reset
            </button>
            <div style={{ flex: 1, height: '8px', backgroundColor: '#E5E7EB', borderRadius: '4px', position: 'relative' }}>
              <div
                style={{
                  width: `${(playbackPosition / timelineData.totalDurationSeconds) * 100}%`,
                  height: '100%', backgroundColor: '#2563EB', borderRadius: '4px',
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <span style={{ fontSize: '13px', color: '#6B7280', fontFamily: 'monospace' }}>
              {Math.floor(playbackPosition / 60)}:{String(playbackPosition % 60).padStart(2, '0')} / {Math.floor(timelineData.totalDurationSeconds / 60)}:{String(timelineData.totalDurationSeconds % 60).padStart(2, '0')}
            </span>
          </div>

          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {(Object.entries(EVENT_CATEGORIES) as [FilterCategory, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSelectedFilter(key)}
                style={{
                  padding: '6px 14px',
                  backgroundColor: selectedFilter === key ? '#2563EB' : '#F3F4F6',
                  color: selectedFilter === key ? 'white' : '#374151',
                  border: '1px solid ' + (selectedFilter === key ? '#2563EB' : '#D1D5DB'),
                  borderRadius: '20px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: selectedFilter === key ? 600 : 400,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Event Clusters */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
              Event Clusters
            </h2>
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
              {timelineData.clusters.map(cluster => (
                <div
                  key={cluster.clusterId}
                  style={{
                    minWidth: '220px',
                    padding: '12px',
                    backgroundColor: 'white',
                    border: `2px solid ${SIGNIFICANCE_COLORS[cluster.significance]}`,
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{cluster.clusterName}</span>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                      backgroundColor: SIGNIFICANCE_COLORS[cluster.significance] + '20',
                      color: SIGNIFICANCE_COLORS[cluster.significance],
                      fontWeight: 600,
                    }}>
                      {cluster.significance}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>{cluster.description}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9CA3AF' }}>
                    <span>{cluster.timestamp}</span>
                    <span>{cluster.eventCount} events</span>
                    <span>{cluster.durationSeconds}s</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Camera Sources Bar */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
              Camera Coverage
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              {timelineData.cameras.map(cam => (
                <div
                  key={cam.sourceId}
                  style={{
                    flex: 1, padding: '10px 14px', backgroundColor: '#EFF6FF',
                    border: '1px solid #BFDBFE', borderRadius: '8px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E40AF' }}>{cam.label}</div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
                    {cam.startTimestamp} — {cam.endTimestamp}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Events */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', marginBottom: '16px' }}>
              Event Timeline ({filteredEvents.length} events)
            </h2>
            <div style={{ position: 'relative', paddingLeft: '40px' }}>
              {/* Vertical line */}
              <div style={{
                position: 'absolute', left: '18px', top: '0', bottom: '0',
                width: '2px', backgroundColor: '#E5E7EB',
              }} />

              {filteredEvents.map((event) => (
                <div
                  key={event.eventId}
                  onClick={() => setSelectedEvent(event)}
                  style={{
                    position: 'relative',
                    marginBottom: '16px',
                    cursor: 'pointer',
                    opacity: selectedEvent && selectedEvent.eventId !== event.eventId ? 0.6 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute', left: '-30px', top: '12px',
                    width: '12px', height: '12px', borderRadius: '50%',
                    backgroundColor: SIGNIFICANCE_COLORS[event.significance],
                    border: '2px solid white',
                    boxShadow: '0 0 0 2px ' + SIGNIFICANCE_COLORS[event.significance],
                    zIndex: 1,
                  }} />

                  {/* Event card */}
                  <div style={{
                    padding: '14px 18px',
                    backgroundColor: selectedEvent?.eventId === event.eventId ? '#EFF6FF' : 'white',
                    border: '1px solid ' + (selectedEvent?.eventId === event.eventId ? '#2563EB' : '#E5E7EB'),
                    borderRadius: '8px',
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontSize: '14px', fontWeight: 700, fontFamily: 'monospace',
                          color: SIGNIFICANCE_COLORS[event.significance],
                        }}>
                          {formatTimestamp(event.timestamp)}
                        </span>
                        <span style={{
                          fontSize: '12px', padding: '2px 8px', borderRadius: '4px',
                          backgroundColor: '#F3F4F6', color: '#4B5563', fontWeight: 500,
                        }}>
                          {event.eventType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                          {event.sourceType}
                        </span>
                        <span style={{
                          fontSize: '11px', padding: '1px 6px', borderRadius: '4px',
                          backgroundColor: event.confidence >= 0.9 ? '#DCFCE7' : event.confidence >= 0.7 ? '#FEF3C7' : '#FEE2E2',
                          color: event.confidence >= 0.9 ? '#166534' : event.confidence >= 0.7 ? '#92400E' : '#991B1B',
                        }}>
                          {getConfidenceLabel(event.confidence)} ({(event.confidence * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 8px 0' }}>
                      {event.description}
                    </p>
                    {event.policyReferences.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {event.policyReferences.map((ref, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                              backgroundColor: '#FEF3C7', color: '#92400E', fontWeight: 500,
                            }}
                          >
                            {ref}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Event Detail */}
          {selectedEvent && (
            <div style={{
              padding: '20px',
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              marginBottom: '24px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                  Event Detail
                </h3>
                <button
                  onClick={() => setSelectedEvent(null)}
                  style={{
                    padding: '4px 12px', backgroundColor: 'white', border: '1px solid #D1D5DB',
                    borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <DetailRow label="Event ID" value={selectedEvent.eventId} />
                <DetailRow label="Timestamp" value={selectedEvent.timestamp} />
                <DetailRow label="Type" value={selectedEvent.eventType.replace(/_/g, ' ')} />
                <DetailRow label="Source" value={selectedEvent.sourceType} />
                <DetailRow label="Confidence" value={`${(selectedEvent.confidence * 100).toFixed(1)}%`} />
                <DetailRow label="Significance" value={selectedEvent.significance} />
              </div>
              <div style={{ marginTop: '12px' }}>
                <DetailRow label="Description" value={selectedEvent.description} />
              </div>
              {selectedEvent.policyReferences.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>Policy References:</span>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {selectedEvent.policyReferences.map((ref, i) => (
                      <li key={i} style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>{ref}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!timelineData && !loading && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          backgroundColor: '#F9FAFB', borderRadius: '12px', border: '1px dashed #D1D5DB',
        }}>
          <p style={{ fontSize: '16px', color: '#6B7280', marginBottom: '8px' }}>
            Enter a Case ID to load the forensic reconstruction timeline
          </p>
          <p style={{ fontSize: '13px', color: '#9CA3AF' }}>
            Or click &quot;Demo Data&quot; to see an example timeline
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div style={{
      padding: '16px', backgroundColor: 'white',
      border: '1px solid #E5E7EB', borderRadius: '8px',
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: '24px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{title}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>{label}: </span>
      <span style={{ fontSize: '13px', color: '#111827' }}>{value}</span>
    </div>
  );
}

export default CaseTimelineVisualizer;
