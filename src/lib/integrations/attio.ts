// Attio CRM API Client
// Docs: https://docs.attio.com/rest-api/overview

import { BaseApiClient, type ApiResponse } from './base-client';

// --- Attio API Types ---

interface AttioMeetingParticipant {
  email_address: string;
  status: 'accepted' | 'tentative' | 'declined' | 'pending';
  is_organizer: boolean;
}

interface AttioMeeting {
  id: { meeting_id: string };
  title: string | null;
  description: string | null;
  start: { datetime: string; timezone?: string } | null;
  end: { datetime: string; timezone?: string } | null;
  participants: AttioMeetingParticipant[];
  created_at: string;
}

interface AttioTranscriptSegment {
  speech: string;
  start_time: number;
  end_time: number;
  speaker: { name: string };
}

interface AttioTranscriptPageData {
  id: {
    workspace_id: string;
    meeting_id: string;
    call_recording_id: string;
  };
  transcript: AttioTranscriptSegment[];
}

interface AttioTranscriptPage {
  data: AttioTranscriptPageData;
  pagination: { next_cursor: string | null };
}

interface AttioCallRecording {
  id: {
    workspace_id: string;
    meeting_id: string;
    call_recording_id: string;
  };
  status: 'processing' | 'completed' | 'failed';
  web_url: string;
  created_at: string;
}

interface AttioPaginatedResponse<T> {
  data: T[];
  pagination: { next_cursor: string | null };
}

// --- Webhook event types ---

export interface AttioCallRecordingCreatedEvent {
  event_type: 'call-recording.created';
  id: {
    workspace_id: string;
    meeting_id: string;
    call_recording_id: string;
  };
  actor: {
    type: string;
    id: string | null;
  };
}

// --- Client ---

export class AttioClient extends BaseApiClient {
  constructor(apiKey: string) {
    super({
      baseUrl: 'https://api.attio.com/v2',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }

  async getMeeting(meetingId: string): Promise<ApiResponse<AttioMeeting>> {
    return this.get<AttioMeeting>(`/meetings/${meetingId}`);
  }

  async listMeetings(cursor?: string): Promise<ApiResponse<AttioPaginatedResponse<AttioMeeting>>> {
    const params = new URLSearchParams();
    params.set('limit', '200');
    params.set('sort', 'start_desc');
    if (cursor) params.set('cursor', cursor);
    return this.get<AttioPaginatedResponse<AttioMeeting>>(`/meetings?${params}`);
  }

  async getCallRecording(
    meetingId: string,
    callRecordingId: string
  ): Promise<ApiResponse<AttioCallRecording>> {
    return this.get<AttioCallRecording>(
      `/meetings/${meetingId}/call_recordings/${callRecordingId}`
    );
  }

  async listCallRecordings(
    meetingId: string,
    cursor?: string
  ): Promise<ApiResponse<AttioPaginatedResponse<AttioCallRecording>>> {
    const params = new URLSearchParams();
    params.set('limit', '200');
    if (cursor) params.set('cursor', cursor);
    return this.get<AttioPaginatedResponse<AttioCallRecording>>(
      `/meetings/${meetingId}/call_recordings?${params}`
    );
  }

  /**
   * Fetch the full call transcript (paginated word-level segments).
   * Returns all segments concatenated across all pages.
   */
  async getFullTranscript(
    meetingId: string,
    callRecordingId: string
  ): Promise<ApiResponse<AttioTranscriptSegment[]>> {
    const allSegments: AttioTranscriptSegment[] = [];
    let cursor: string | null = null;

    do {
      const params = cursor ? `?cursor=${cursor}` : '';
      const res = await this.get<AttioTranscriptPage>(
        `/meetings/${meetingId}/call_recordings/${callRecordingId}/transcript${params}`
      );

      if (res.error || !res.data) {
        return { data: null, error: res.error, status: res.status };
      }

      const page = res.data as unknown as AttioTranscriptPage;
      const segments = page.data?.transcript || [];
      allSegments.push(...segments);
      cursor = page.pagination?.next_cursor || null;
    } while (cursor);

    return { data: allSegments, error: null, status: 200 };
  }
}

// --- Helpers ---

/**
 * Assemble word-level transcript segments into a readable transcript string.
 * Groups consecutive words by speaker into paragraphs.
 */
export function assembleTranscript(segments: AttioTranscriptSegment[]): string {
  if (segments.length === 0) return '';

  let transcript = '';
  let currentSpeaker: string | null = null;
  let currentLine = '';

  for (const seg of segments) {
    const speaker = seg.speaker?.name || 'Unknown';
    if (speaker !== currentSpeaker) {
      if (currentLine) {
        transcript += `${currentSpeaker}: ${currentLine.trim()}\n\n`;
      }
      currentSpeaker = speaker;
      currentLine = seg.speech + ' ';
    } else {
      currentLine += seg.speech + ' ';
    }
  }
  if (currentLine) {
    transcript += `${currentSpeaker}: ${currentLine.trim()}\n\n`;
  }

  return transcript.trim();
}

/** Calculate duration in minutes from meeting start/end */
export function calcDurationMinutes(
  start: AttioMeeting['start'],
  end: AttioMeeting['end']
): number | null {
  if (!start?.datetime || !end?.datetime) return null;
  const ms = new Date(end.datetime).getTime() - new Date(start.datetime).getTime();
  return Math.round(ms / 60_000);
}

/** Extract participant email list from meeting */
export function extractParticipants(meeting: AttioMeeting): string[] {
  return meeting.participants
    .filter((p) => p.email_address)
    .map((p) => p.email_address);
}

/** Create a singleton Attio client using env var */
export function createAttioClient(): AttioClient {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error('ATTIO_API_KEY environment variable is not set');
  return new AttioClient(apiKey);
}
