import { google } from 'googleapis';

/**
 * Decodes base64url formatted data returned by Gmail API
 */
function decodeBase64Url(data) {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/**
 * Extracts HTML/text body from a nested Gmail message object
 */
export function getMessageBody(message) {
  const payload = message.payload;
  if (!payload) return '';

  // Case 1: Simple payload with direct body
  if (payload.body && payload.body.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Case 2: Multipart payload (recurse through parts)
  if (payload.parts) {
    return parseParts(payload.parts);
  }

  return '';
}

function parseParts(parts) {
  let htmlBody = '';
  let textBody = '';

  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body && part.body.data) {
      htmlBody = decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/plain' && part.body && part.body.data) {
      textBody = decodeBase64Url(part.body.data);
    } else if (part.parts) {
      const nested = parseParts(part.parts);
      if (nested) return nested;
    }
  }

  return htmlBody || textBody;
}

/**
 * Lists messages for the authenticated client matching a query/label
 */
export async function listMessages(authClient, q = '', pageToken = null) {
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  const res = await gmail.users.messages.list({
    userId: 'me',
    q,
    pageToken
  });
  return {
    messages: res.data.messages || [],
    nextPageToken: res.data.nextPageToken || null
  };
}

/**
 * Retrieves the full message metadata and content payload
 */
export async function getMessage(authClient, messageId) {
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full'
  });
  return res.data;
}
