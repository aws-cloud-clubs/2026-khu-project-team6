// Set test environment variables before any tests run
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.SES_FROM_EMAIL = 'noreply@test.haruman.com';
process.env.BEDROCK_REGION = 'ap-northeast-2';
process.env.S3_BUCKET = 'test-haruman-bucket';
process.env.WS_ENDPOINT = 'https://test.execute-api.ap-northeast-2.amazonaws.com/test';
