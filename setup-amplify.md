# AWS Amplify Setup Instructions

To use AWS Location Service instead of the free geocoding service, you need to set up Amplify:

## 1. Install Amplify CLI (if not already installed)
```bash
npm install -g @aws-amplify/cli
```

## 2. Configure AWS credentials
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region
```

## 3. Generate Amplify configuration
```bash
npx ampx sandbox
```

This will:
- Deploy the geo resources to AWS
- Generate `amplify_outputs.json` with your configuration
- Enable AWS Location Service geocoding and maps

## 4. Benefits of AWS Location Service:
- ✅ Much higher rate limits (1000+ requests/second)
- ✅ Better performance and reliability
- ✅ Professional-grade maps with street names
- ✅ Integrated with your AWS account
- ✅ No usage policy restrictions
- ✅ Better error handling and monitoring

## 5. Fallback
If you can't set up AWS Location Service right now, the app will fall back to the previous implementation.
