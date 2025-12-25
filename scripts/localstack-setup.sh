#!/bin/bash
echo "Setting up LocalStack S3..."
awslocal s3 mb s3://dev-cloud-sync-bucket
echo "Bucket created."
