import app from '../server.ts';

export default function handler(req: any, res: any) {
  // Ensure req.url has /api prefix so app.use('/api', apiRouter) handles it
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return (app as any)(req, res);
}
