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

/** Extract unique speaker names from transcript segments */
export function extractSpeakerNames(segments: AttioTranscriptSegment[]): string[] {
  const names = new Set<string>();
  for (const seg of segments) {
    const name = seg.speaker?.name;
    if (name && name !== 'Unknown') names.add(name);
  }
  return [...names];
}

// Known host emails — MAS / Keen Digital team
const HOST_EMAILS = new Set([
  'tim@keen.digital',
  'tim@modernagencysales.com',
  'vlad@modernagencysales.com',
]);
const HOST_COMPANY = 'Modern Agency Sales / Keen Digital';

/**
 * Build a speaker_map from meeting participants + transcript speaker names.
 * Maps each speaker to a role (host/client/guest) and company where possible.
 */
export function buildSpeakerMap(
  participants: AttioMeetingParticipant[],
  speakerNames: string[]
): Record<string, { role: string; company: string | null; email: string | null }> | null {
  if (speakerNames.length === 0) return null;

  const speakerMap: Record<string, { role: string; company: string | null; email: string | null }> = {};

  for (const name of speakerNames) {
    const nameLower = name.toLowerCase();
    const nameParts = nameLower.split(/\s+/).filter((p) => p.length > 0);

    // First check if this is a known host by name
    const isKnownHost = nameLower === 'tim keen' || nameLower === 'vlad timinski';

    // Try to match speaker name to a participant email
    // Use first name + last name matching against email local part
    // Require the first name to match at the START of the email local part,
    // or match the full last name anywhere in the email
    const matchedParticipant = participants.find((p) => {
      if (!p.email_address) return false;
      const emailLocal = p.email_address.split('@')[0].toLowerCase().replace(/[._-]/g, '');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : null;

      // Strong match: first name starts the email local part
      if (firstName.length > 2 && emailLocal.startsWith(firstName)) return true;
      // Strong match: last name (4+ chars) appears in email
      if (lastName && lastName.length >= 4 && emailLocal.includes(lastName)) return true;
      return false;
    });

    const email = matchedParticipant?.email_address || null;
    const isHost = isKnownHost || (email ? HOST_EMAILS.has(email) : false);

    let role = 'unknown';
    if (isHost) {
      role = 'host';
    } else if (email) {
      role = 'client';
    } else {
      role = 'guest';
    }

    speakerMap[name] = {
      role,
      company: isHost ? HOST_COMPANY : null,
      email,
    };
  }

  return Object.keys(speakerMap).length > 0 ? speakerMap : null;
}

/** Create a singleton Attio client using env var */
export function createAttioClient(): AttioClient {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) throw new Error('ATTIO_API_KEY environment variable is not set');
  return new AttioClient(apiKey);
}
