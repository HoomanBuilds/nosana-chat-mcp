import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.status(200).json({
    status: 'ok',
    message: 'Server is healthy!',
    timestamp: new Date().toISOString()
  });
}