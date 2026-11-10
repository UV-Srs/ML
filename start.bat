@echo off
title Supply Chain Intelligence System
echo Starting Supply Chain Delivery Risk & Loss Prevention Portal...

if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe run_app.py
) else (
    python run_app.py
)

pause
