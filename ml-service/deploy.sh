#!/bin/bash
# Deploy Diabetic Foot Risk ML Service to Google Cloud Run
# Prerequisites: gcloud CLI installed and authenticated
#   Install: https://cloud.google.com/sdk/docs/install
#   Auth:    gcloud auth login && gcloud config set project diabetes-specialist

set -e

PROJECT_ID="diabetes-specialist"
SERVICE_NAME="foot-risk-service"
REGION="us-central1"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "=== Diabetic Foot Risk ML Service Deployment ==="
echo ""

# Step 1: Verify gcloud is available
if ! command -v gcloud &> /dev/null; then
    echo "ERROR: gcloud CLI not found."
    echo "Install it from: https://cloud.google.com/sdk/docs/install"
    echo "Then run: gcloud auth login && gcloud config set project ${PROJECT_ID}"
    exit 1
fi

# Step 2: Verify models exist
if [ ! -f "models/foot_risk_regressor.pkl" ] || [ ! -f "models/foot_risk_classifier.pkl" ]; then
    echo "Models not found. Training..."
    cd training
    python generate_data.py
    python train_model.py
    cd ..
fi

echo "Models found:"
ls -la models/*.pkl

# Step 3: Build and push Docker image
echo ""
echo "Building Docker image..."
gcloud builds submit --tag "${IMAGE}" --project "${PROJECT_ID}"

# Step 4: Deploy to Cloud Run
echo ""
echo "Deploying to Cloud Run..."
SERVICE_URL=$(gcloud run deploy "${SERVICE_NAME}" \
    --image "${IMAGE}" \
    --region "${REGION}" \
    --project "${PROJECT_ID}" \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3 \
    --format "value(status.url)")

echo ""
echo "=== DEPLOYMENT SUCCESSFUL ==="
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "Next step: Add this to your server/.env file:"
echo "  FOOT_RISK_SERVICE_URL=${SERVICE_URL}"
echo ""

# Step 5: Test the deployed service
echo "Testing health endpoint..."
curl -s "${SERVICE_URL}/health" | python -m json.tool
echo ""
echo "Done!"
