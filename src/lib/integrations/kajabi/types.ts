// Kajabi API uses JSON:API specification
// Base URL: https://api.kajabi.com/v1
// Auth: Bearer token
// Content-Type: application/vnd.api+json

export interface KajabiContactAttributes {
  name?: string;
  email: string;
  subscribed?: boolean;
}

export interface KajabiCreateContactPayload {
  data: {
    type: 'contacts';
    attributes: KajabiContactAttributes;
    relationships: {
      site: {
        data: { type: 'sites'; id: string };
      };
    };
  };
}

export interface KajabiContactResponse {
  data: {
    id: string;
    type: 'contacts';
    attributes: {
      name: string | null;
      email: string;
      subscribed: boolean;
    };
  };
}

export interface KajabiTagRelationship {
  data: Array<{ type: 'tags'; id: string }>;
}

export interface KajabiTag {
  id: string;
  type: 'contact_tags';
  attributes: {
    name: string;
  };
}

export interface KajabiTagsListResponse {
  data: KajabiTag[];
}

export interface KajabiSyncParams {
  userId: string;
  funnelPageId: string;
  lead: {
    email: string;
    name?: string | null;
  };
}
