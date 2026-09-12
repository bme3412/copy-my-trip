#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { CopyMyTripMediaStack } from '../lib/media-stack.js'

const app = new cdk.App()

new CopyMyTripMediaStack(app, 'CopyMyTripMedia', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: 'Private media origin and CloudFront delivery for Copy My Trip',
  terminationProtection: true,
})
