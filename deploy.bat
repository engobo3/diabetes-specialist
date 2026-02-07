@echo off
REM Deployment Script for Diabetes Specialist App - Messaging System v2.0
REM Run this batch file to start automated deployment

setlocal enabledelayedexpansion

cls
echo.
echo =================================================
echo      AUTOMATED DEPLOYMENT - MESSAGING v2.0
echo =================================================
echo.

REM Check if Node.js is installed
node -v >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js not found!
    echo Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

REM Check if Firebase is installed
firebase --version >nul 2>&1
if errorlevel 1 (
    echo Error: Firebase CLI not found!
    echo Install with: npm install -g firebase-tools
    pause
    exit /b 1
)

echo Starting deployment process...
echo.

REM Run the Node.js deployment script
node deploy.js

if errorlevel 1 (
    echo.
    echo Deployment failed!
    pause
    exit /b 1
)

echo.
echo Deployment completed successfully!
echo You can now visit your app URL to test.
pause
