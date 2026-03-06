@echo off
cd /d d:\code\minigame-1
set PORT=3001
node server.js >> server.out.log 2>> server.err.log
