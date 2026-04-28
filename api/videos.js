import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.WASABI_REGION || 'ap-southeast-1',
  endpoint: `https://s3.${process.env.WASABI_REGION || 'ap-southeast-1'}.wasabisys.com`,
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY_ID,
    secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.WASABI_BUCKET_NAME;

export default async function handler(req, res) {
  // CORS biar aman
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const { action, key, cursor } = req.query;

  try {
    if (action === 'list') {
      // List video dengan pagination (max 50 per request)
      const command = new ListObjectsV2Command({
        Bucket: BUCKET,
        MaxKeys: 50,
        ContinuationToken: cursor || undefined,
        Prefix: req.query.prefix || '',
      });

      const data = await s3.send(command);
      
      const videos = (data.Contents || [])
        .filter(item => item.Key.endsWith('.mp4'))
        .map(item => ({
          key: item.Key,
          name: item.Key.split('/').pop(),
          size: item.Size,
          lastModified: item.LastModified,
        }));

      return res.json({
        videos,
        nextCursor: data.NextContinuationToken || null,
        total: data.KeyCount,
      });
    }

    if (action === 'url' && key) {
      // Generate presigned URL (berlaku 1 jam)
      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: decodeURIComponent(key),
      });

      const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
      return res.json({ url });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (err) {
    console.error('Wasabi error:', err);
    return res.status(500).json({ error: err.message });
  }
}
