import React, { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api.js';
import './styles.css';

// Presentational icons for the login screen (client/src/main.jsx login block only)
const IconMail = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-9Z" stroke="currentColor" strokeWidth="1.4" />
    <path d="M4 5.5 10 10.5 16 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconLock = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M6.5 9V6.5a3.5 3.5 0 1 1 7 0V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconUser = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.4" />
    <path d="M3.5 17c.9-3.4 3.6-5 6.5-5s5.6 1.6 6.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconEye = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const IconEyeOff = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.5 2.5l15 15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M8.3 4.7C8.85 4.57 9.42 4.5 10 4.5c5.5 0 8.5 5.5 8.5 5.5a13.6 13.6 0 0 1-2.9 3.6M5.4 6.4A13.7 13.7 0 0 0 1.5 10s3 5.5 8.5 5.5c1.1 0 2.1-.22 3-.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.1 8.1a2.4 2.4 0 0 0 3.4 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 10.5 8 14.5 16 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconAlert = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10 6.5v4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="13.4" r="0.9" fill="currentColor" />
  </svg>
);

// Shared presentational icon set (dashboard + future page redesigns)
const IconBriefcase = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2.5" y="6.5" width="15" height="10" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
    <path d="M7 6.5V5a1.8 1.8 0 0 1 1.8-1.8h2.4A1.8 1.8 0 0 1 13 5v1.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M2.5 10.5h15" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const IconSend = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.5 2.5 9.2 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17.5 2.5 12 17.5 9.2 11 2.5 8.2 17.5 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const IconCalendarCheck = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2.5" y="4" width="15" height="13.5" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
    <path d="M2.5 8h15M6 2.3v3M14 2.3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M6.8 12.2 9 14.3l4.2-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconAward = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="7.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M7.5 11.3 6.2 17.5 10 15.3l3.8 2.2-1.3-6.2" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const IconUsers = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7.2" cy="6.3" r="2.8" stroke="currentColor" strokeWidth="1.4" />
    <path d="M1.8 16.5c.75-2.9 3-4.3 5.4-4.3s4.65 1.4 5.4 4.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M12.8 4.2a2.8 2.8 0 0 1 0 5.5M14.3 12.5c2.15.4 3.55 1.7 4.1 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconClockAlert = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="9.5" cy="10.5" r="7" stroke="currentColor" strokeWidth="1.4" />
    <path d="M9.5 6.5v4.3l2.8 1.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="9.5" cy="10.5" r="7" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const IconBell = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 14.5V9a5 5 0 0 1 10 0v5.5l1.5 2H3.5l1.5-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M8 17a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconX = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const IconBarChart = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.5 16.5v-5M9.5 16.5v-9M15.5 16.5v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M2 16.5h16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconEdit = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.5 3.5 16.5 7.5 7 17H3v-4L12.5 3.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M11 5 15 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M5 5.5 5.7 16a1.5 1.5 0 0 0 1.5 1.4h5.6a1.5 1.5 0 0 0 1.5-1.4L15 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.3 8.7v5M11.7 8.7v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconRefresh = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.5 10a6.5 6.5 0 0 1-11.2 4.5M3.5 10a6.5 6.5 0 0 1 11.2-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M14.2 4.8h2.6v2.6M5.8 15.2H3.2v-2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconGraduationCap = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 7.5 10 4l8 3.5-8 3.5-8-3.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M5.5 9.2v3.3c0 1.2 2 2.2 4.5 2.2s4.5-1 4.5-2.2V9.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M17.5 7.5v4.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconLink = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8.2 11.8a3 3 0 0 0 4.2.2l2.3-2.3a3 3 0 0 0-4.2-4.2l-1.3 1.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11.8 8.2a3 3 0 0 0-4.2-.2L5.3 10.3a3 3 0 0 0 4.2 4.2l1.3-1.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconBuilding = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="2.5" width="9" height="15" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <path d="M13 8h2.5a1 1 0 0 1 1 1v7.5H13" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M6.5 5.5h1.2M6.5 8.3h1.2M6.5 11.1h1.2M9.3 5.5h1.2M9.3 8.3h1.2M9.3 11.1h1.2M6.5 14h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const IconMapPin = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 17.5s5.5-4.9 5.5-9.1a5.5 5.5 0 1 0-11 0c0 4.2 5.5 9.1 5.5 9.1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <circle cx="10" cy="8.3" r="2" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const IconSearch = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.4" />
    <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconSliders = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 5.5h9M15.5 5.5h1.5M3 14.5h5M11.5 14.5h5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="12.5" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="8.5" cy="14.5" r="2" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const IconLayers = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2.5 17.5 7 10 11.5 2.5 7 10 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M2.5 11 10 15.5 17.5 11M2.5 15 10 19.5 17.5 15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconUpload = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 13V3.5M6.5 6.8 10 3.3l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.5 13.5v2a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconFile = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5.5 2.5h6L15.5 6.5v11a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M11.5 2.5V6a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const IconArrowLeft = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 10H4M4 10 9 5M4 10l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconChevronRight = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconStar = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2.8 12.3 7.6l5.2.8-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7 5.2-.8L10 2.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
);

const IconInbox = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 11.5 5.3 4.3A1.5 1.5 0 0 1 6.7 3.3h6.6a1.5 1.5 0 0 1 1.4 1L17 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M3 11.5h4.2l1 2h3.6l1-2H17V15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15v-3.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const IconCheckCircle = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.4" />
    <path d="M6.8 10.2 9 12.4l4.2-4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconAlertTriangle = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 3.2 18 16.8H2L10 3.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M10 8.3v3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="14.2" r="0.9" fill="currentColor" />
  </svg>
);

const IconXCircle = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.4" />
    <path d="M7.5 7.5l5 5M12.5 7.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconClock = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10 6v4.3l2.8 1.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconLightbulb = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.3 8.3a3.7 3.7 0 1 1 6.4 2.5c-.6.6-1 1.1-1 2v.2H8.3v-.2c0-.9-.4-1.4-1-2a3.7 3.7 0 0 1-1-2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M8.4 15.5h3.2M8.8 17.2h2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconGlobe = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.4" />
    <path d="M2.75 10h14.5M10 2.75c1.9 2 2.9 4.6 2.9 7.25S11.9 15.25 10 17.25c-1.9-2-2.9-4.6-2.9-7.25S8.1 4.75 10 2.75Z" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const IconTie = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.5 3.5h7L12.3 6h-4.6L6.5 3.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M8 6l-2 8 4 3.5 4-3.5-2-8" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const IconZap = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 2.5 4.5 11.5h4.2L8.3 17.5l7.2-9.8h-4.3L11 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const IconPlay = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.5 4.2v11.6l9-5.8-9-5.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const IconExternalLink = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8.5 4.5h-3A1.5 1.5 0 0 0 4 6v9.5A1.5 1.5 0 0 0 5.5 17H15a1.5 1.5 0 0 0 1.5-1.5v-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 3.5H16.5V9M16.3 3.7 9.5 10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconGauge = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 14.5a7 7 0 1 1 14 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M10 14.5 13 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="10" cy="14.5" r="1.1" fill="currentColor" />
  </svg>
);

const IconPlug = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 2.5v4M13 2.5v4M5.5 6.5h9v3a4.5 4.5 0 0 1-9 0v-3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M10 13.5V17.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconTarget = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="10" cy="10" r="1" fill="currentColor" />
  </svg>
);

const IconDollarSign = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2.5v15M13.5 5.8c-.5-.9-1.7-1.5-3.2-1.5-2 0-3.5 1.1-3.5 2.7 0 3.4 6.9 1.7 6.9 5 0 1.6-1.6 2.7-3.6 2.7-1.6 0-2.9-.6-3.5-1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconDownload = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 3v9.5M6.5 9.2 10 12.7l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.5 13.5v2a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconPause = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="4" width="3.2" height="12" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <rect x="11.8" y="4" width="3.2" height="12" rx="1" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const IconTelegram = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.3 3.3 2.8 8.9c-.8.3-.8 1.5.1 1.8l3.5 1.1 1.4 4.4c.2.6.9.7 1.3.2l1.9-2.1 3.7 2.7c.6.4 1.4.1 1.6-.6l2.4-11.4c.2-.9-.7-1.6-1.4-1.3ZM7.2 11.4l7-4.7c.3-.2.6.2.3.4l-5.8 5.5-.2 2.6-1-3.3Z" fill="currentColor" />
  </svg>
);

// Pure presentational helper — formats a ISO date string as a short relative label.
// Falls back to a locale date once the value is more than a week old.
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// Dashboard "Recent Activity" feed mixes three record types from the API —
// this maps each to a consistent icon/label/color for display only.
const DASH_ACTIVITY_META = {
  application_event: { label: 'Application', icon: IconBriefcase, chip: 'dash-chip--primary' },
  outreach_event: { label: 'Outreach', icon: IconSend, chip: 'dash-chip--accent' },
  notification: { label: 'Notification', icon: IconBell, chip: 'dash-chip--info' }
};

// Pure presentational helper — first-letter initials for an avatar chip, e.g. "Jane Doe" -> "JD"
function getInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Fixed color cycle for the Role Distribution segmented bar/legend — display only.
const CONN_ROLE_PALETTE = [
  'var(--primary)', 'var(--info)', 'var(--accent)', 'var(--warning)',
  'var(--danger)', '#a78bfa', 'var(--success)', '#f472b6', 'var(--secondary)', '#60a5fa'
];

// Business-hierarchy display order for the Seniority Distribution chart — display only.
// Values not listed here (unexpected/legacy data) sort after all known levels.
const CONN_SENIORITY_ORDER = ['founder', 'executive', 'director', 'manager', 'lead', 'senior', 'mid', 'junior', 'intern', 'unknown'];

// Mirrors CAREER_LEVELS in server/src/services/resume-ai-enrichment.service.js.
const CAREER_LEVELS = ['intern', 'entry', 'mid', 'senior', 'lead', 'principal', 'executive'];

// Maps an Application's status value to a badge color variant — display only.
const APPLICATION_STATUS_VARIANT = {
  saved: 'badge-secondary',
  applying: 'badge-info',
  applied: 'badge-info',
  recruiter_contact: 'badge-primary',
  screening: 'badge-primary',
  interview: 'badge-warning',
  offer: 'badge-success',
  accepted: 'badge-success',
  rejected: 'badge-danger',
  withdrawn: 'badge-secondary'
};

// Maps an Outreach record's status value to a badge color variant — display only.
const OUTREACH_STATUS_VARIANT = {
  not_contacted: 'badge-secondary',
  researching: 'badge-info',
  contacted: 'badge-info',
  replied: 'badge-primary',
  conversation: 'badge-primary',
  referral_requested: 'badge-warning',
  referral_received: 'badge-success',
  closed: 'badge-success'
};

// Maps a Job's status value to a badge color variant — display only.
const JOB_STATUS_VARIANT = {
  new: 'badge-info',
  saved: 'badge-warning',
  applied: 'badge-success'
};

// Maps an ingestion/integration health state to an icon + badge color variant — display only.
const JOB_HEALTH_META = {
  healthy: { icon: IconCheckCircle, variant: 'badge-success', label: 'Healthy' },
  active: { icon: IconCheckCircle, variant: 'badge-success', label: 'Active' },
  connected: { icon: IconCheckCircle, variant: 'badge-success', label: 'Connected' },
  degraded: { icon: IconAlertTriangle, variant: 'badge-warning', label: 'Degraded' },
  failed: { icon: IconXCircle, variant: 'badge-danger', label: 'Failed' },
  disconnected: { icon: IconXCircle, variant: 'badge-secondary', label: 'Not Connected' },
  unknown: { icon: IconClock, variant: 'badge-secondary', label: 'Unknown' }
};

// Maps a Connection's relationshipStatus value to a badge color variant — display only.
const CONN_STATUS_VARIANT = {
  not_contacted: 'badge-secondary',
  researching: 'badge-info',
  contacted: 'badge-info',
  replied: 'badge-primary',
  conversation: 'badge-primary',
  referral_requested: 'badge-warning',
  referral_received: 'badge-success',
  closed: 'badge-success'
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);

  // Modal controllers
  const [modal, setModal] = useState(null); // 'connection', 'job', 'application', 'outreach', 'csv'
  const [editItem, setEditItem] = useState(null);
  const [editingConnectionAi, setEditingConnectionAi] = useState(false);
  const [loadingConnectionAi, setLoadingConnectionAi] = useState(false);

  // AI Outreach Assistant States
  const [aiIntent, setAiIntent] = useState('referral_request');
  const [aiTone, setAiTone] = useState('professional');
  const [aiLength, setAiLength] = useState('short');
  const [aiDraft, setAiDraft] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiWarnings, setAiWarnings] = useState([]);

  const handleEnrichConnectionAi = async (connectionId) => {
    setLoadingConnectionAi(true);
    try {
      await api.request(`/connections/${connectionId}/ai-enrich`, { method: 'POST' });
      const detailRes = await api.request(`/connections/${connectionId}`);
      setEditItem(detailRes.data);
    } catch (err) {
      alert(err.message || 'AI enrichment failed.');
    } finally {
      setLoadingConnectionAi(false);
    }
  };

  const handleSaveConnectionAiCorrections = async (connectionId, corrections) => {
    try {
      await api.request(`/connections/${connectionId}/ai-corrections`, {
        method: 'PUT',
        body: JSON.stringify(corrections)
      });
      const detailRes = await api.request(`/connections/${connectionId}`);
      setEditItem(detailRes.data);
      setEditingConnectionAi(false);
    } catch (err) {
      alert(err.message || 'Failed to save corrections.');
    }
  };

  const handleGenerateAiDraft = async (force = false) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await api.request('/outreach/ai-drafts/generate', {
        method: 'POST',
        body: {
          jobId: editItem?.job_id || null,
          connectionId: editItem?.id || null,
          intent: aiIntent,
          tone: aiTone,
          length: aiLength,
          forceGenerate: force
        }
      });
      if (res.success) {
        const payload = res.data;
        if (!payload.allowed) {
          setAiWarnings(payload.warnings || []);
        } else {
          setAiDraft(payload.draft);
          setAiWarnings(payload.warnings || []);
          // Populate notes textarea automatically
          const notesTextarea = document.querySelector('textarea[name="notes"]');
          if (notesTextarea) {
            notesTextarea.value = payload.draft.message;
          }
        }
      }
    } catch (err) {
      if (err.message === 'AI_PROVIDER_UNAVAILABLE') {
        setAiError('AI draft generation is temporarily unavailable. You can still create outreach manually.');
      } else {
        setAiError(err.message || 'Generation failed.');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (aiDraft?.id) {
      try {
        await api.request(`/outreach/ai-drafts/${aiDraft.id}/discard`, { method: 'POST' });
      } catch (e) {
        console.warn('Discard failed:', e.message);
      }
    }
    setAiDraft(null);
    setAiWarnings([]);
    const notesTextarea = document.querySelector('textarea[name="notes"]');
    if (notesTextarea) {
      notesTextarea.value = '';
    }
  };

  // Core States
  const [stats, setStats] = useState({
    totalJobs: 0, newJobs: 0, savedJobs: 0, applications: 0,
    interviews: 0, offers: 0, totalConnections: 0, followUpsDue: 0,
    recentActivity: []
  });
  const [profile, setProfile] = useState({
    name: '', phone: '', location: '', targetRoles: [],
    targetCompanies: [], preferredLocations: [], remotePreference: '',
    experience: '', skills: [], salaryPreference: '', bio: '',
    professionalTitle: '', careerLevel: '', education: [], certifications: [],
    links: { linkedin: '', github: '', portfolio: '' }
  });
  const [skillDraft, setSkillDraft] = useState('');
  const [resumes, setResumes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [outreachList, setOutreachList] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Pagination & Filter States
  const [connFilters, setConnFilters] = useState({ page: 1, pageSize: 10, q: '', company: '', title: '' });
  const [connMeta, setConnMeta] = useState({ total: 0, totalPages: 1 });
  const [jobFilters, setJobFilters] = useState({ page: 1, pageSize: 10, q: '', company: '', location: '', status: '', archived: false });
  const [jobMeta, setJobMeta] = useState({ total: 0, totalPages: 1 });
  const [connSearchMode, setConnSearchMode] = useState('keyword');
  const [semanticConnResults, setSemanticConnResults] = useState(null);
  const [searchingSemantic, setSearchingSemantic] = useState(false);
  const [jobSearchMode, setJobSearchMode] = useState('keyword');
  const [semanticJobResults, setSemanticJobResults] = useState(null);
  const [searchingJobSemantic, setSearchingJobSemantic] = useState(false);
  const [syncingEmbeddings, setSyncingEmbeddings] = useState(false);
  const [jobSubTab, setJobSubTab] = useState('list'); // 'list', 'sources'
  const [searchProfiles, setSearchProfiles] = useState([]);
  const [gmailStatus, setGmailStatus] = useState(null);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState(null);
  const [telegramLinkingCode, setTelegramLinkingCode] = useState(null);
  const [incomingJobs, setIncomingJobs] = useState([]);
  const [loadingIncoming, setLoadingIncoming] = useState(false);
  const [reviewJob, setReviewJob] = useState(null);
  const [ingestionMonitor, setIngestionMonitor] = useState(null);
  const [deduplicationLogs, setDeduplicationLogs] = useState([]);
  const [preferences, setPreferences] = useState({
    notificationsEnabled: true,
    notifyHighlyRelevant: true,
    notifyStrongReferral: true,
    notifyTargetCompany: true,
    dailyDigestEnabled: true,
    notifyLowRelevance: false,
    minimumMatchScore: 80,
    preferredJobLocations: [],
    preferredJobRoles: [],
    remotePreference: ''
  });

  const [editingAiEnrichment, setEditingAiEnrichment] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [resumeAnalysis, setResumeAnalysis] = useState(null);
  const [loadingResumeAnalysis, setLoadingResumeAnalysis] = useState(false);
  const [resumeExtraction, setResumeExtraction] = useState(null);
  const [loadingResumeExtraction, setLoadingResumeExtraction] = useState(false);
  const [applyFieldSelection, setApplyFieldSelection] = useState([]);
  const [applyingToProfile, setApplyingToProfile] = useState(false);
  const [applyResultMessage, setApplyResultMessage] = useState('');

  // Connection detail states
  const [activeConnectionId, setActiveConnectionId] = useState(null);
  const [connectionDetail, setConnectionDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newTagText, setNewTagText] = useState('');

  // Overview dashboard states
  const [connectionSubTab, setConnectionSubTab] = useState('overview'); // 'overview', 'all', 'companies', 'saved_views', 'follow_ups'
  const [dashboardOverview, setDashboardOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState(null);
  const [aiOpsData, setAiOpsData] = useState(null);
  const [loadingAiOps, setLoadingAiOps] = useState(false);
  const [adminQueueData, setAdminQueueData] = useState(null);
  const [modelsData, setModelsData] = useState(null);
  const [loadingModels, setLoadingModels] = useState(false);

  // Company directory states
  const [companies, setCompanies] = useState([]);
  const [companiesMeta, setCompaniesMeta] = useState({ total: 0, totalPages: 1 });
  const [companiesPage, setCompaniesPage] = useState(1);
  const [companySearch, setCompanySearch] = useState('');
  const [companySortBy, setCompanySortBy] = useState('connections');
  const [companySortOrder, setCompanySortOrder] = useState('desc');
  const [activeCompanyKey, setActiveCompanyKey] = useState(null);
  const [companyDetailData, setCompanyDetailData] = useState(null);
  const [loadingCompanyDetail, setLoadingCompanyDetail] = useState(false);

  // PDF Enrichment states
  const [enrichmentPreview, setEnrichmentPreview] = useState(null);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState(null);
  const [pdfObjectURL, setPdfObjectURL] = useState(null);
  const [showOriginalPdf, setShowOriginalPdf] = useState(false);

  const closeEnrichmentModal = () => {
    if (pdfObjectURL) {
      URL.revokeObjectURL(pdfObjectURL);
      setPdfObjectURL(null);
    }
    setEnrichmentPreview(null);
    setEnrichmentError(null);
    setModal(null);
  };

  // Saved Views States
  const [savedViews, setSavedViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState('all'); // 'all', 'high_priority', 'never_contacted', 'follow_ups', or view UUID
  const [activeViewName, setActiveViewName] = useState('All Connections');
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewDesc, setNewViewDesc] = useState('');

  // Job Network Workspace States
  const [jobNetworkSubTab, setJobNetworkSubTab] = useState('overview'); // 'overview', 'application', 'network'
  const [jobNetworkDetails, setJobNetworkDetails] = useState(null);
  const [jobNetworkFilters, setJobNetworkFilters] = useState({
    page: 1,
    limit: 10,
    roleCategory: '',
    seniority: '',
    relationshipStatus: '',
    relationshipStrength: '',
    priority: '',
    sortBy: 'referralScore',
    sortOrder: 'desc'
  });
  // eslint-disable-next-line no-unused-vars
  const [jobNetworkMeta, setJobNetworkMeta] = useState({ total: 0, totalPages: 1 });
  const [jobNetworkLoading, setJobNetworkLoading] = useState(false);

  // Auth Forms State
  const [authTab, setAuthTab] = useState('login'); // 'login', 'register', 'forgot'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  // UI-only: submit spinner + password visibility for the redesigned login screen
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Handle auto logout
  useEffect(() => {
    api.onLogout = () => {
      setIsAuthenticated(false);
      setUser(null);
    };
    if (api.accessToken) {
      loadSession();
    }
  }, []);

  useEffect(() => {
    if (modal !== 'outreach') {
      setAiIntent('referral_request');
      setAiTone('professional');
      setAiLength('short');
      setAiDraft(null);
      setAiLoading(false);
      setAiError(null);
      setAiWarnings([]);
    }
  }, [modal]);

  // Reload data when active tab changes or filters change
  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'dashboard') loadDashboard();
      if (activeTab === 'profile') loadProfile();
      if (activeTab === 'resumes') loadResumes();
      if (activeTab === 'connections') loadConnections();
      if (activeTab === 'jobs') {
        loadJobs();
        loadSearchProfiles();
        loadGmailStatus();
        loadTelegramStatus();
        loadIncomingJobs();
        loadIngestionMonitor();
        loadDeduplicationLogs();
        loadPreferences();
      }
      if (activeTab === 'applications') loadApplications();
      if (activeTab === 'outreach') loadOutreach();
      if (activeTab === 'ai-ops') loadAiOps();
      loadNotifications();
    }
  }, [isAuthenticated, activeTab, connFilters, jobFilters, jobFilters.archived]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'connection-detail' && activeConnectionId) {
      loadConnectionDetail(activeConnectionId);
    }
  }, [isAuthenticated, activeTab, activeConnectionId]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'connections' && connectionSubTab === 'overview') {
      loadDashboardOverview();
    }
  }, [isAuthenticated, activeTab, connectionSubTab]);

  const loadDashboardOverview = async () => {
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const res = await api.request('/connections/overview');
      setDashboardOverview(res.data);
    } catch (e) {
      setOverviewError(e.message || 'Failed to load dashboard overview.');
    } finally {
      setLoadingOverview(false);
    }
  };

  const loadSavedViews = async () => {
    try {
      const res = await api.request('/connections/views');
      setSavedViews(res.data || []);
    } catch (e) {
      console.error('Failed to load saved views', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && activeTab === 'connections' && connectionSubTab === 'companies') {
      loadCompanies();
    }
  }, [isAuthenticated, activeTab, connectionSubTab, companiesPage, companySearch, companySortBy, companySortOrder]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'connections' && activeCompanyKey) {
      loadCompanyDetail(activeCompanyKey);
    }
  }, [isAuthenticated, activeTab, activeCompanyKey]);

  const loadCompanies = async () => {
    try {
      const res = await api.listCompanies({
        search: companySearch,
        page: companiesPage,
        limit: 25,
        sortBy: companySortBy,
        sortOrder: companySortOrder
      });
      setCompanies(res.data);
      setCompaniesMeta(res.meta || { total: res.data.length, totalPages: 1 });
    } catch (e) {
      console.error(e);
    }
  };

  const loadCompanyDetail = async (key) => {
    setLoadingCompanyDetail(true);
    try {
      const res = await api.getCompanyDetail(key);
      setCompanyDetailData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCompanyDetail(false);
    }
  };

  // URL synchronization
  const updateURLFromFilters = (filters) => {
    const query = new URLSearchParams();
    Object.keys(filters).forEach((key) => {
      const val = filters[key];
      if (val !== undefined && val !== null && val !== '') {
        if (Array.isArray(val)) {
          if (val.length > 0) {
            query.set(key, val.join(','));
          }
        } else {
          query.set(key, val);
        }
      }
    });
    const newRelativePathQuery = window.location.pathname + '?' + query.toString();
    window.history.pushState(null, '', newRelativePathQuery);
  };

  const loadFiltersFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    const filters = { page: 1, pageSize: 10 };

    if (params.get('q')) filters.q = params.get('q');
    if (params.get('company')) filters.company = params.get('company');
    if (params.get('title')) filters.title = params.get('title');
    if (params.get('hasEmail')) filters.hasEmail = params.get('hasEmail') === 'true';
    if (params.get('relationshipStatus')) filters.relationshipStatus = params.get('relationshipStatus');
    if (params.get('followUpDue')) filters.followUpDue = params.get('followUpDue') === 'true';

    if (params.get('companies')) filters.companies = params.get('companies').split(',');
    if (params.get('seniority')) filters.seniority = params.get('seniority').split(',');
    if (params.get('roleCategory')) filters.roleCategory = params.get('roleCategory').split(',');
    if (params.get('priority')) filters.priority = params.get('priority').split(',');

    if (params.get('sortBy')) filters.sortBy = params.get('sortBy');
    if (params.get('sortOrder')) filters.sortOrder = params.get('sortOrder');

    return filters;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail_connected') === 'true') {
      alert(`Gmail successfully connected: ${params.get('email') || ''}`);
      // Clean query params
      window.history.replaceState({}, document.title, window.location.pathname);
      loadGmailStatus();
    } else if (params.get('gmail_error')) {
      alert(`Failed to connect Gmail: ${params.get('gmail_error')}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (window.location.search) {
      const parsedFilters = loadFiltersFromURL();
      setConnFilters(prev => ({ ...prev, ...parsedFilters }));
      setConnectionSubTab('all');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'connections') {
      updateURLFromFilters(connFilters);
    }
  }, [connFilters, activeTab]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'connections') {
      loadSavedViews();
    }
  }, [isAuthenticated, activeTab]);

  const handleSaveView = async () => {
    if (!newViewName.trim()) return;
    try {
      const payload = {
        name: newViewName.trim(),
        description: newViewDesc.trim() || null,
        filters: {
          q: connFilters.q || undefined,
          company: connFilters.company || undefined,
          companies: connFilters.companies || undefined,
          title: connFilters.title || undefined,
          seniority: connFilters.seniority || undefined,
          roleCategory: connFilters.roleCategory || undefined,
          relationshipStatus: connFilters.relationshipStatus || undefined,
          priority: connFilters.priority || undefined,
          hasEmail: connFilters.hasEmail !== undefined ? connFilters.hasEmail : undefined,
          followUpDue: connFilters.followUpDue || undefined,
        },
        sort: {
          sortBy: connFilters.sortBy || 'connectedDate',
          sortOrder: connFilters.sortOrder || 'desc',
        }
      };

      let res;
      if (activeViewId && activeViewId !== 'all' && activeViewId !== 'high_priority' && activeViewId !== 'never_contacted' && activeViewId !== 'follow_ups') {
        res = await api.request(`/connections/views/${activeViewId}`, {
          method: 'PUT',
          body: payload
        });
        alert('View updated successfully!');
      } else {
        res = await api.request('/connections/views', {
          method: 'POST',
          body: payload
        });
        alert('New view saved successfully!');
      }
      setShowSaveViewModal(false);
      setNewViewName('');
      setNewViewDesc('');
      loadSavedViews();
      if (res && res.data) {
        setActiveViewId(res.data.id);
        setActiveViewName(res.data.name);
      }
    } catch (e) {
      alert(e.message);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleSaveAsNewView = async () => {
    const name = prompt('Enter a name for the new saved view:');
    if (!name || !name.trim()) return;
    try {
      const payload = {
        name: name.trim(),
        filters: {
          q: connFilters.q || undefined,
          company: connFilters.company || undefined,
          companies: connFilters.companies || undefined,
          title: connFilters.title || undefined,
          seniority: connFilters.seniority || undefined,
          roleCategory: connFilters.roleCategory || undefined,
          relationshipStatus: connFilters.relationshipStatus || undefined,
          priority: connFilters.priority || undefined,
          hasEmail: connFilters.hasEmail !== undefined ? connFilters.hasEmail : undefined,
          followUpDue: connFilters.followUpDue || undefined,
        },
        sort: {
          sortBy: connFilters.sortBy || 'connectedDate',
          sortOrder: connFilters.sortOrder || 'desc',
        }
      };

      const res = await api.request('/connections/views', {
        method: 'POST',
        body: payload
      });
      alert('View saved successfully!');
      loadSavedViews();
      if (res && res.data) {
        setActiveViewId(res.data.id);
        setActiveViewName(res.data.name);
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDuplicateView = async (id) => {
    try {
      await api.request(`/connections/views/${id}/duplicate`, { method: 'POST' });
      alert('View duplicated successfully!');
      loadSavedViews();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDeleteView = async (id) => {
    if (!confirm('Are you sure you want to delete this saved view? Connections will not be deleted.')) return;
    try {
      await api.request(`/connections/views/${id}`, { method: 'DELETE' });
      alert('View deleted successfully!');
      if (activeViewId === id) {
        handleApplyBuiltinView('all');
      }
      loadSavedViews();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleRenameView = async (id, currentName) => {
    const name = prompt('Enter new name:', currentName);
    if (!name || !name.trim() || name.trim() === currentName) return;
    try {
      await api.request(`/connections/views/${id}`, {
        method: 'PUT',
        body: { name: name.trim() }
      });
      alert('View renamed successfully!');
      if (activeViewId === id) {
        setActiveViewName(name.trim());
      }
      loadSavedViews();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleLoadSavedView = (view) => {
    setActiveViewId(view.id);
    setActiveViewName(view.name);

    const filters = {
      page: 1,
      pageSize: 10,
      q: view.filtersJson.q || '',
      company: view.filtersJson.company || '',
      companies: view.filtersJson.companies || [],
      title: view.filtersJson.title || '',
      seniority: view.filtersJson.seniority || [],
      roleCategory: view.filtersJson.roleCategory || [],
      relationshipStatus: view.filtersJson.relationshipStatus || '',
      priority: view.filtersJson.priority || [],
      hasEmail: view.filtersJson.hasEmail,
      followUpDue: view.filtersJson.followUpDue,
      sortBy: view.sortJson.sortBy || 'connectedDate',
      sortOrder: view.sortJson.sortOrder || 'desc',
    };

    setConnFilters(filters);
    setConnectionSubTab('all');
    api.request(`/connections/views/${view.id}`).catch(() => { });
  };

  const handleApplyBuiltinView = (type) => {
    setActiveViewId(type);
    let filters = { page: 1, pageSize: 10, q: '', company: '', title: '' };
    if (type === 'all') {
      setActiveViewName('All Connections');
    } else if (type === 'high_priority') {
      setActiveViewName('High Priority');
      filters.priority = ['high'];
    } else if (type === 'never_contacted') {
      setActiveViewName('Never Contacted');
      filters.relationshipStatus = 'not_contacted';
    } else if (type === 'follow_ups') {
      setActiveViewName('Follow-ups Due');
      filters.followUpDue = true;
    }
    setConnFilters(filters);
    setConnectionSubTab('all');
  };

  const loadConnectionDetail = async (id) => {
    setShowOriginalPdf(false);
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await api.request(`/connections/${id}`);
      setConnectionDetail(res.data);
    } catch (e) {
      setDetailError(e.message || 'Failed to load connection details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !activeConnectionId) return;
    try {
      await api.request('/notes', {
        method: 'POST',
        body: {
          entityType: 'connection',
          entityId: activeConnectionId,
          content: newNoteContent.trim()
        }
      });
      setNewNoteContent('');
      loadConnectionDetail(activeConnectionId);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddTag = async (tagText) => {
    if (!tagText.trim() || !activeConnectionId || !connectionDetail) return;
    const currentTags = connectionDetail.tags || [];
    if (currentTags.includes(tagText.trim())) {
      alert('Tag already exists on this connection.');
      return;
    }
    const updatedTags = [...currentTags, tagText.trim()];
    try {
      await api.request(`/connections/${activeConnectionId}`, {
        method: 'PUT',
        body: {
          name: connectionDetail.name,
          tags: updatedTags
        }
      });
      setNewTagText('');
      loadConnectionDetail(activeConnectionId);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    if (!activeConnectionId || !connectionDetail) return;
    const currentTags = connectionDetail.tags || [];
    const updatedTags = currentTags.filter(t => t !== tagToRemove);
    try {
      await api.request(`/connections/${activeConnectionId}`, {
        method: 'PUT',
        body: {
          name: connectionDetail.name,
          tags: updatedTags
        }
      });
      loadConnectionDetail(activeConnectionId);
    } catch (err) {
      alert(err.message);
    }
  };

  const loadSession = async () => {
    try {
      const res = await api.getMe();
      setUser(res.data.user);
      setIsAuthenticated(true);
    } catch {
      api.clearTokens();
    }
  };

  const loadDashboard = async () => {
    try {
      const res = await api.getDashboardStats();
      setStats(res);
    } catch (e) {
      console.error(e);
    }
  };

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      if (data) setProfile(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadResumes = async () => {
    try {
      const data = await api.listResumes();
      setResumes(data);
      if (data.length > 0 && !selectedResumeId) {
        const active = data.find(r => r.isActive);
        setSelectedResumeId(active ? active.id : data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadResumeFitAnalysis = async (jobId) => {
    setLoadingResumeAnalysis(true);
    try {
      const res = await api.request(`/jobs/${jobId}/resume-analysis`);
      setResumeAnalysis(res.data);
    } catch (e) {
      console.error(e);
      setResumeAnalysis({
        matchedSkills: [],
        missingSkills: [],
        strengths: [],
        potentialGaps: [],
        analysisSummary: e.message || 'Failed to load analysis.',
        compatibilityAssessment: 'unknown'
      });
    } finally {
      setLoadingResumeAnalysis(false);
    }
  };

  const loadResumeExtraction = async (resumeId) => {
    setLoadingResumeExtraction(true);
    setApplyResultMessage('');
    try {
      const data = await api.getResumeAiEnrichment(resumeId);
      setResumeExtraction(data && data.id ? data : null);
      setApplyFieldSelection([]);
    } catch (e) {
      console.error(e);
      setResumeExtraction(null);
    } finally {
      setLoadingResumeExtraction(false);
    }
  };

  const handleRetryResumeExtraction = async (resumeId) => {
    setLoadingResumeExtraction(true);
    try {
      await api.retryResumeAiEnrichment(resumeId);
      await loadResumeExtraction(resumeId);
    } catch (e) {
      console.error(e);
      setLoadingResumeExtraction(false);
    }
  };

  const toggleApplyField = (field) => {
    setApplyFieldSelection((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const handleApplyResumeToProfile = async (resumeId) => {
    if (applyFieldSelection.length === 0) return;
    setApplyingToProfile(true);
    setApplyResultMessage('');
    try {
      await api.applyResumeToProfile(resumeId, applyFieldSelection);
      await loadProfile();
      setApplyResultMessage('Applied to your profile.');
      setApplyFieldSelection([]);
    } catch (e) {
      console.error(e);
      setApplyResultMessage(e.message || 'Failed to apply resume data to profile.');
    } finally {
      setApplyingToProfile(false);
    }
  };

  const loadConnections = async () => {
    try {
      const res = await api.listConnections(connFilters);
      setConnections(res.data);
      setConnMeta(res.meta || { total: res.data.length, totalPages: 1 });
    } catch (e) {
      console.error(e);
    }
  };

  const loadJobs = async () => {
    try {
      const res = await api.listJobs(jobFilters);
      setJobs(res.data);
      setJobMeta(res.meta || { total: res.data.length, totalPages: 1 });
    } catch (e) {
      console.error(e);
    }
  };

  const loadSearchProfiles = async () => {
    try {
      const data = await api.listJobSearchProfiles();
      setSearchProfiles(data);
    } catch (e) {
      console.error(e);
    }
  };

  const runSemanticConnSearch = async () => {
    if (!connFilters.q) return;
    setSearchingSemantic(true);
    try {
      const res = await api.request('/search/semantic', {
        method: 'POST',
        body: {
          query: connFilters.q,
          entityTypes: ['connection'],
          limit: 20,
          filters: {
            company: connFilters.company || undefined,
            title: connFilters.title || undefined
          }
        }
      });
      setSemanticConnResults(res.data || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setSearchingSemantic(false);
    }
  };

  const runSemanticJobSearch = async () => {
    if (!jobFilters.q) return;
    setSearchingJobSemantic(true);
    try {
      const res = await api.request('/search/jobs', {
        method: 'POST',
        body: {
          query: jobFilters.q,
          limit: 20
        }
      });
      setSemanticJobResults(res.data || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setSearchingJobSemantic(false);
    }
  };

  const runBackfill = async () => {
    setSyncingEmbeddings(true);
    try {
      const res = await api.request('/search/backfill', { method: 'POST' });
      const stats = res.data;
      alert(`AI Embeddings synced successfully!\n• Connections backfilled: ${stats.connections.processed}\n• Jobs backfilled: ${stats.jobs.processed}\n• Resumes backfilled: ${stats.resumes.processed}`);
    } catch (err) {
      alert(`Failed to sync embeddings: ${err.message}`);
    } finally {
      setSyncingEmbeddings(false);
    }
  };

  const loadAiOps = async () => {
    setLoadingAiOps(true);
    try {
      const res = await api.request('/ai/health');
      setAiOpsData(res.data);

      try {
        const queueRes = await api.request('/admin/ai-queue/status');
        setAdminQueueData(queueRes.data);
      } catch {
        setAdminQueueData(null);
      }
    } catch (err) {
      console.warn('Failed to load AI Operations health data:', err.message);
    } finally {
      setLoadingAiOps(false);
    }
    await loadModels();
  };

  const loadModels = async () => {
    setLoadingModels(true);
    try {
      const res = await api.request('/admin/models');
      setModelsData(res.data);
    } catch {
      setModelsData(null);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleModelEvaluate = async (model) => {
    const evaluationType = prompt('Evaluation type (e.g. generation_benchmark, embedding_benchmark):', `${model.modelType}_benchmark`);
    if (!evaluationType) return;
    const scoreInput = prompt('Overall score (0.0 - 1.0):', '0.9');
    if (scoreInput === null) return;
    const passed = confirm('Did this evaluation pass? OK = passed, Cancel = failed.');
    try {
      await api.request(`/admin/models/${model.id}/evaluate`, {
        method: 'POST',
        body: { evaluationType, overallScore: Number(scoreInput), status: passed ? 'passed' : 'failed' },
      });
      alert('Evaluation recorded.');
      await loadModels();
    } catch (err) {
      alert(`Failed to record evaluation: ${err.message}`);
    }
  };

  const handleModelPromote = async (model) => {
    const environment = prompt('Promote to environment (development, staging, production):', 'staging');
    if (!environment) return;
    try {
      await api.request(`/admin/models/${model.id}/promote`, {
        method: 'POST',
        body: { environment },
      });
      alert(`Promoted ${model.name}:${model.version} to ${environment}.`);
      await loadModels();
    } catch (err) {
      if (err.message.includes('EMBEDDING_DIMENSION_MISMATCH') || err.message.toLowerCase().includes('dimension')) {
        const confirmReindex = confirm(`${err.message}\n\nProceed anyway with an explicit re-index acknowledgement?`);
        if (confirmReindex) {
          try {
            await api.request(`/admin/models/${model.id}/promote`, {
              method: 'POST',
              body: { environment, confirmReindex: true },
            });
            alert(`Promoted ${model.name}:${model.version} to ${environment} (re-index acknowledged).`);
            await loadModels();
          } catch (err2) {
            alert(`Failed to promote: ${err2.message}`);
          }
        }
      } else {
        alert(`Failed to promote: ${err.message}`);
      }
    }
  };

  const handleModelRollback = async (model) => {
    const environment = prompt('Roll back which environment (development, staging, production)?', 'production');
    if (!environment) return;
    if (!confirm(`Roll back the active ${model.modelType} assignment for ${environment} to the previous known-good model?`)) return;
    try {
      await api.request('/admin/models/rollback', {
        method: 'POST',
        body: { modelType: model.modelType, environment },
      });
      alert('Rollback completed.');
      await loadModels();
    } catch (err) {
      alert(`Failed to roll back: ${err.message}`);
    }
  };

  const handleModelArchive = async (model) => {
    const nextStatus = model.status === 'production' ? 'deprecated' : model.status === 'deprecated' ? 'archived' : null;
    if (!nextStatus) {
      alert(`Model must be "production" or "deprecated" to archive (currently "${model.status}").`);
      return;
    }
    if (!confirm(`Transition ${model.name}:${model.version} from "${model.status}" to "${nextStatus}"?`)) return;
    try {
      await api.request(`/admin/models/${model.id}/transition`, {
        method: 'POST',
        body: { targetStatus: nextStatus },
      });
      alert(`Model transitioned to ${nextStatus}.`);
      await loadModels();
    } catch (err) {
      alert(`Failed to transition model: ${err.message}`);
    }
  };

  const handleQueueAction = async (action, jobId = '') => {
    try {
      let url = `/admin/ai-queue/${action}`;
      if (action === 'retry' && jobId) {
        url = `/admin/ai-queue/${jobId}/retry`;
      }
      await api.request(url, { method: 'POST' });
      alert(`Queue action '${action}' completed successfully.`);
      await loadAiOps();
    } catch (err) {
      alert(`Queue action failed: ${err.message}`);
    }
  };

  const loadGmailStatus = async () => {
    try {
      const res = await api.request('/integrations/gmail/status');
      setGmailStatus(res.data);
    } catch (err) {
      console.error('Failed to load Gmail status:', err);
    }
  };

  const loadTelegramStatus = async () => {
    try {
      const res = await api.request('/integrations/telegram/status');
      setTelegramStatus(res.data);
    } catch (err) {
      console.error('Failed to load Telegram status:', err);
    }
  };

  const generateTelegramCode = async () => {
    try {
      const res = await api.request('/integrations/telegram/link');
      setTelegramLinkingCode(res.data.code);
    } catch (err) {
      alert(err.message);
    }
  };

  const loadIngestionMonitor = async () => {
    try {
      const res = await api.request('/dashboard/ingestion-monitor');
      setIngestionMonitor(res.data);
    } catch (err) {
      console.error('Failed to load ingestion monitor stats:', err);
    }
  };

  const loadDeduplicationLogs = async () => {
    try {
      const res = await api.request('/dashboard/deduplication-logs');
      setDeduplicationLogs(res.data);
    } catch (err) {
      console.error('Failed to load deduplication logs:', err);
    }
  };

  const loadPreferences = async () => {
    try {
      const res = await api.request('/preferences');
      if (res.data) {
        setPreferences(res.data);
      }
    } catch (err) {
      console.error('Failed to load user preferences:', err);
    }
  };

  const savePreferences = async (updated) => {
    try {
      const res = await api.request('/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.data) {
        setPreferences(res.data);
        alert('Automation preferences saved successfully!');
      }
    } catch (err) {
      alert('Failed to save automation preferences: ' + err.message);
    }
  };

  const loadIncomingJobs = async () => {
    setLoadingIncoming(true);
    try {
      const res = await api.request('/incoming-jobs');
      setIncomingJobs(res.data);
    } catch (err) {
      console.error('Failed to load incoming jobs:', err);
    } finally {
      setLoadingIncoming(false);
    }
  };

  const handleConnectGmail = () => {
    if (!user || !user.id) {
      alert('Your user session has not loaded yet. Please wait a moment and try again.');
      return;
    }
    // Redirect to backend connect endpoint
    window.location.href = `http://localhost:5000/api/integrations/gmail/connect?userId=${user.id}`;
  };

  const loadApplications = async () => {
    try {
      const data = await api.listApplications();
      setApplications(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadOutreach = async () => {
    try {
      const data = await api.listOutreach();
      setOutreachList(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadNotifications = async () => {
    try {
      const data = await api.listNotifications();
      setNotifications(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadJobNetwork = async (jobId, filters = jobNetworkFilters) => {
    setJobNetworkLoading(true);
    try {
      const query = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          query.set(key, filters[key]);
        }
      });
      const res = await api.request(`/jobs/${jobId}/network?${query.toString()}`);
      setJobNetworkDetails(res.data);
      if (res.data && res.data.pagination) {
        setJobNetworkMeta(res.data.pagination);
      }
    } catch (e) {
      console.error('Failed to load job network workspace', e);
    } finally {
      setJobNetworkLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && modal === 'job_detail' && editItem?.id) {
      loadJobNetwork(editItem.id, jobNetworkFilters);
    }
  }, [isAuthenticated, modal, editItem?.id, jobNetworkFilters]);

  // Auth handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);
    try {
      if (authTab === 'login') {
        await api.login(authEmail, authPassword);
        setIsAuthenticated(true);
        loadSession();
      } else if (authTab === 'register') {
        await api.register(authEmail, authPassword, authName);
        setIsAuthenticated(true);
        loadSession();
      } else if (authTab === 'forgot') {
        await api.requestPasswordReset(authEmail);
        setAuthSuccess('Password reset link requested. Check terminal logs (simulated email)');
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  // Profile Save
  const handleProfileSave = async (e) => {
    e.preventDefault();
    try {
      const formatted = {
        ...profile,
        targetRoles: Array.isArray(profile.targetRoles) ? profile.targetRoles : String(profile.targetRoles).split(',').map(s => s.trim()).filter(Boolean),
        targetCompanies: Array.isArray(profile.targetCompanies) ? profile.targetCompanies : String(profile.targetCompanies).split(',').map(s => s.trim()).filter(Boolean),
        preferredLocations: Array.isArray(profile.preferredLocations) ? profile.preferredLocations : String(profile.preferredLocations).split(',').map(s => s.trim()).filter(Boolean),
        skills: Array.isArray(profile.skills) ? profile.skills : String(profile.skills).split(',').map(s => s.trim()).filter(Boolean)
      };
      await api.updateProfile(formatted);
      alert('Profile updated successfully');
      loadProfile();
    } catch (err) {
      alert(err.message);
    }
  };

  const addSkillFromDraft = () => {
    const value = skillDraft.trim();
    if (!value) return;
    const existing = new Set((profile.skills || []).map((s) => s.toLowerCase()));
    if (!existing.has(value.toLowerCase())) {
      setProfile({ ...profile, skills: [...(profile.skills || []), value] });
    }
    setSkillDraft('');
  };

  const removeSkillAt = (idx) => {
    setProfile({ ...profile, skills: (profile.skills || []).filter((_, i) => i !== idx) });
  };

  const handleSkillDraftKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkillFromDraft();
    } else if (e.key === 'Backspace' && !skillDraft && (profile.skills || []).length > 0) {
      removeSkillAt(profile.skills.length - 1);
    }
  };

  const addEducationEntry = () => {
    setProfile({
      ...profile,
      education: [...(profile.education || []), { institution: '', degree: '', field: '', startYear: '', endYear: '' }]
    });
  };
  const updateEducationEntry = (idx, field, value) => {
    const next = [...(profile.education || [])];
    next[idx] = { ...next[idx], [field]: value };
    setProfile({ ...profile, education: next });
  };
  const removeEducationEntry = (idx) => {
    setProfile({ ...profile, education: (profile.education || []).filter((_, i) => i !== idx) });
  };

  const addCertificationEntry = () => {
    setProfile({
      ...profile,
      certifications: [...(profile.certifications || []), { name: '', issuer: '', issueDate: '' }]
    });
  };
  const updateCertificationEntry = (idx, field, value) => {
    const next = [...(profile.certifications || [])];
    const current = typeof next[idx] === 'string' ? { name: next[idx] } : (next[idx] || {});
    next[idx] = { ...current, [field]: value };
    setProfile({ ...profile, certifications: next });
  };
  const removeCertificationEntry = (idx) => {
    setProfile({ ...profile, certifications: (profile.certifications || []).filter((_, i) => i !== idx) });
  };

  if (!isAuthenticated) {
    const authCopy = {
      login: { title: 'Welcome back', subtitle: 'Sign in to pick up your job search where you left off.' },
      register: { title: 'Create your account', subtitle: 'Set up your career workspace in under a minute.' },
      forgot: { title: 'Reset your password', subtitle: "We'll send a reset link to your inbox." }
    }[authTab];

    return (
      <div className="login-screen">
        <div className="login-brand" aria-hidden="true">
          <div className="login-brand-glow" />
          <div className="login-brand-mark">CareerGraph</div>
          <h2 className="login-brand-heading">Your career, tracked like a real pipeline.</h2>
          <p className="login-brand-sub">
            One workspace for your network, applications, and outreach — with AI doing the busywork.
          </p>
          <ul className="login-feature-list">
            <li><span className="login-feature-icon"><IconCheck /></span>Connection CRM with 9,000+ contacts, scored & searchable</li>
            <li><span className="login-feature-icon"><IconCheck /></span>Job tracking with referral-network matching</li>
            <li><span className="login-feature-icon"><IconCheck /></span>AI-drafted outreach, resume & job enrichment</li>
          </ul>
        </div>

        <div className="login-panel">
          <div className="login-card">
            <div className="login-card-mark">CareerGraph</div>

            {authTab !== 'forgot' && (
              <div className="login-switch" role="tablist" aria-label="Authentication mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === 'login'}
                  className={`login-switch-btn ${authTab === 'login' ? 'active' : ''}`}
                  onClick={() => { setAuthTab('login'); setAuthError(''); setAuthSuccess(''); }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === 'register'}
                  className={`login-switch-btn ${authTab === 'register' ? 'active' : ''}`}
                  onClick={() => { setAuthTab('register'); setAuthError(''); setAuthSuccess(''); }}
                >
                  Sign Up
                </button>
              </div>
            )}

            <div className="login-heading">
              <h1>{authCopy.title}</h1>
              <p>{authCopy.subtitle}</p>
            </div>

            {authError && (
              <div className="login-alert login-alert-danger" role="alert">
                <IconAlert /><span>{authError}</span>
              </div>
            )}
            {authSuccess && (
              <div className="login-alert login-alert-success" role="status">
                <IconCheck /><span>{authSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="login-form" noValidate>
              {authTab === 'register' && (
                <div className="login-field">
                  <label className="login-label" htmlFor="auth-name">Full Name</label>
                  <div className="login-input-wrap">
                    <span className="login-input-icon"><IconUser /></span>
                    <input
                      id="auth-name"
                      type="text"
                      className="login-input"
                      placeholder="Jane Doe"
                      autoComplete="name"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="login-field">
                <label className="login-label" htmlFor="auth-email">Email Address</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon"><IconMail /></span>
                  <input
                    id="auth-email"
                    type="email"
                    className="login-input"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </div>
              </div>

              {authTab !== 'forgot' && (
                <div className="login-field">
                  <div className="login-label-row">
                    <label className="login-label" htmlFor="auth-password">Password</label>
                    {authTab === 'login' && (
                      <button type="button" className="login-inline-link" onClick={() => { setAuthTab('forgot'); setAuthError(''); setAuthSuccess(''); }}>
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="login-input-wrap has-toggle">
                    <span className="login-input-icon"><IconLock /></span>
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      className="login-input"
                      placeholder="••••••••"
                      autoComplete={authTab === 'register' ? 'new-password' : 'current-password'}
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="login-input-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                </div>
              )}

              <button type="submit" className="login-submit" disabled={authLoading}>
                {authLoading && <span className="login-spinner" aria-hidden="true" />}
                <span>
                  {authTab === 'login' && (authLoading ? 'Signing in…' : 'Sign In')}
                  {authTab === 'register' && (authLoading ? 'Creating account…' : 'Create Account')}
                  {authTab === 'forgot' && (authLoading ? 'Sending…' : 'Send Reset Link')}
                </span>
              </button>
            </form>

            <div className="login-foot">
              {authTab === 'login' && (
                <p>New to CareerGraph? <button className="login-inline-link" onClick={() => { setAuthTab('register'); setAuthError(''); setAuthSuccess(''); }}>Create an account</button></p>
              )}
              {authTab === 'register' && (
                <p>Already have an account? <button className="login-inline-link" onClick={() => { setAuthTab('login'); setAuthError(''); setAuthSuccess(''); }}>Sign in</button></p>
              )}
              {authTab === 'forgot' && (
                <p><button className="login-inline-link" onClick={() => { setAuthTab('login'); setAuthError(''); setAuthSuccess(''); }}>← Back to Sign In</button></p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">CareerGraph</div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </button>
          <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            My Profile
          </button>
          <button className={`nav-item ${activeTab === 'resumes' ? 'active' : ''}`} onClick={() => setActiveTab('resumes')}>
            Resume Files
          </button>
          <button className={`nav-item ${activeTab === 'connections' ? 'active' : ''}`} onClick={() => setActiveTab('connections')}>
            Connections CRM
          </button>
          <button className={`nav-item ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}>
            Jobs Tracker
          </button>
          <button className={`nav-item ${activeTab === 'applications' ? 'active' : ''}`} onClick={() => setActiveTab('applications')}>
            Applications
          </button>
          <button className={`nav-item ${activeTab === 'outreach' ? 'active' : ''}`} onClick={() => setActiveTab('outreach')}>
            Outreach CRM
          </button>
          <button className={`nav-item ${activeTab === 'ai-ops' ? 'active' : ''}`} onClick={() => setActiveTab('ai-ops')}>
            AI Operations
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-badge">
            <span className="user-name">{user?.profile?.name || 'User'}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="main-content">

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="dash-page">
            <div className="dash-header">
              <div>
                <h1 className="dash-title">Dashboard Overview</h1>
                <p className="dash-subtitle">Your career pipeline at a glance</p>
              </div>
              <button className="dash-digest-btn" onClick={async () => {
                try {
                  await api.request('/dashboard/digest', { method: 'POST' });
                  alert('Daily email digest triggered! Look at the server terminal console output to inspect the generated digest body.');
                } catch (err) {
                  alert(err.message);
                }
              }}>
                <IconSend />
                Trigger Daily Digest
              </button>
            </div>

            <div className="dash-stats-grid">
              <div className="dash-stat-card">
                <span className="dash-stat-icon dash-stat-icon--primary"><IconBriefcase /></span>
                <div>
                  <div className="dash-stat-label">Total Jobs</div>
                  <div className="dash-stat-value">{stats.totalJobs}</div>
                </div>
              </div>
              <div className="dash-stat-card">
                <span className="dash-stat-icon dash-stat-icon--accent"><IconSend /></span>
                <div>
                  <div className="dash-stat-label">Active Applications</div>
                  <div className="dash-stat-value">{stats.applications}</div>
                </div>
              </div>
              <div className="dash-stat-card">
                <span className="dash-stat-icon dash-stat-icon--info"><IconCalendarCheck /></span>
                <div>
                  <div className="dash-stat-label">Interviews Scheduled</div>
                  <div className="dash-stat-value">{stats.interviews}</div>
                </div>
              </div>
              <div className="dash-stat-card">
                <span className="dash-stat-icon dash-stat-icon--success"><IconAward /></span>
                <div>
                  <div className="dash-stat-label">Offers Received</div>
                  <div className="dash-stat-value">{stats.offers}</div>
                </div>
              </div>
              <div className="dash-stat-card">
                <span className="dash-stat-icon dash-stat-icon--primary"><IconUsers /></span>
                <div>
                  <div className="dash-stat-label">Total Connections</div>
                  <div className="dash-stat-value">{stats.totalConnections}</div>
                </div>
              </div>
              <div className={`dash-stat-card ${stats.followUpsDue > 0 ? 'dash-stat-card--warn' : ''}`}>
                <span className="dash-stat-icon dash-stat-icon--warning"><IconClockAlert /></span>
                <div>
                  <div className="dash-stat-label">Follow-ups Due</div>
                  <div className="dash-stat-value">{stats.followUpsDue}</div>
                </div>
              </div>
            </div>

            <div className="dash-grid">
              <div className="dash-card dash-card--wide">
                <div className="dash-card-head">
                  <h2 className="dash-card-title">Top Referral & Match Opportunities</h2>
                </div>
                {jobs.length === 0 ? (
                  <div className="dash-empty">No jobs tracked yet. Add job posts to see recommendations.</div>
                ) : (
                  <div className="dash-opportunity-list">
                    {[...jobs]
                      .sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0))
                      .slice(0, 3)
                      .map((job) => (
                        <div className="dash-opportunity-row" key={job.id}>
                          <div className="dash-opportunity-info">
                            <span className="dash-opportunity-title">{job.title}</span>
                            <span className="dash-opportunity-company">{job.companyName}</span>
                          </div>
                          <div className="dash-score-bars">
                            <div className="dash-score-bar">
                              <div className="dash-score-bar-label">
                                <span>Match</span><span>{job.matchScore || 0}%</span>
                              </div>
                              <div className="dash-score-track">
                                <div className="dash-score-fill dash-score-fill--match" style={{ width: `${job.matchScore || 0}%` }} />
                              </div>
                            </div>
                            <div className="dash-score-bar">
                              <div className="dash-score-bar-label">
                                <span>Opportunity</span><span>{job.opportunityScore || 0}%</span>
                              </div>
                              <div className="dash-score-track">
                                <div className="dash-score-fill dash-score-fill--opportunity" style={{ width: `${job.opportunityScore || 0}%` }} />
                              </div>
                            </div>
                          </div>
                          <div className="dash-opportunity-action">{job.recommendedAction}</div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              <div className="dash-card dash-card--wide">
                <div className="dash-card-head">
                  <span className="dash-card-icon"><IconBarChart /></span>
                  <h2 className="dash-card-title">Pipeline Snapshot</h2>
                </div>
                <div className="dash-pipeline">
                  {[
                    { label: 'New Jobs', value: stats.newJobs },
                    { label: 'Saved', value: stats.savedJobs },
                    { label: 'Applications', value: stats.applications },
                    { label: 'Interviews', value: stats.interviews },
                    { label: 'Offers', value: stats.offers }
                  ].map((stage) => {
                    const max = Math.max(1, stats.newJobs, stats.savedJobs, stats.applications, stats.interviews, stats.offers);
                    return (
                      <div className="dash-pipeline-row" key={stage.label}>
                        <span className="dash-pipeline-label">{stage.label}</span>
                        <div className="dash-pipeline-track">
                          <div className="dash-pipeline-fill" style={{ width: `${(stage.value / max) * 100}%` }} />
                        </div>
                        <span className="dash-pipeline-value">{stage.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="dash-card">
                <div className="dash-card-head">
                  <h2 className="dash-card-title">Recent Activity</h2>
                </div>
                <div className="dash-activity-list">
                  {stats.recentActivity.length === 0 ? (
                    <div className="dash-empty">No recent activities logged yet.</div>
                  ) : (
                    stats.recentActivity.map((activity, idx) => {
                      const meta = DASH_ACTIVITY_META[activity.type] || DASH_ACTIVITY_META.notification;
                      const ActivityIcon = meta.icon;
                      return (
                        <div className="dash-activity-item" key={idx}>
                          <span className={`dash-chip ${meta.chip}`}><ActivityIcon /></span>
                          <div className="dash-activity-body">
                            <div className="dash-activity-top">
                              <span className="dash-activity-type">{meta.label}</span>
                              <span className="dash-activity-time">{formatRelativeTime(activity.occurredAt || activity.createdAt)}</span>
                            </div>
                            <div className="dash-activity-title">{activity.status || activity.title}</div>
                            {(activity.notes || activity.message) && (
                              <div className="dash-activity-desc">{activity.notes || activity.message}</div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="dash-card">
                <div className="dash-card-head">
                  <span className="dash-card-icon"><IconBell /></span>
                  <h2 className="dash-card-title">Reminders & Notifications</h2>
                </div>
                <div className="dash-notif-list">
                  {notifications.filter(n => !n.isRead).length === 0 ? (
                    <div className="dash-empty">No unread notifications.</div>
                  ) : (
                    notifications.filter(n => !n.isRead).map((notif) => (
                      <div className="dash-notif-item" key={notif.id}>
                        <div className="dash-notif-top">
                          <span className="dash-notif-type">{notif.type}</span>
                          <button
                            className="dash-notif-dismiss"
                            aria-label="Dismiss notification"
                            onClick={async () => {
                              await api.markNotificationRead(notif.id);
                              loadNotifications();
                              loadDashboard();
                            }}
                          >
                            <IconX />
                          </button>
                        </div>
                        <div className="dash-notif-title">{notif.title}</div>
                        <p className="dash-notif-desc">{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="profile-page">
            <div className="profile-header">
              <span className="profile-avatar">{getInitials(profile.name)}</span>
              <div>
                <h1 className="profile-title">My Career Profile</h1>
                <p className="profile-subtitle">Used to calculate job match scores and personalize AI recommendations</p>
              </div>
            </div>

            {(() => {
              const syncedResume = resumes.find((r) => r.id === profile.syncedResumeId);
              return syncedResume ? (
                <div className="profile-sync-banner">
                  <IconCheckCircle />
                  <div className="profile-sync-banner-body">
                    <strong>Synced from {syncedResume.fileName}</strong>
                    <span>
                      {profile.resumeConfidence != null ? `Confidence ${Math.round(profile.resumeConfidence * 100)}% · ` : ''}
                      {profile.lastResumeSyncedAt ? `Last synced ${formatRelativeTime(profile.lastResumeSyncedAt)}` : ''}
                    </span>
                  </div>
                  <button type="button" className="profile-sync-banner-action" onClick={() => setActiveTab('resumes')}>
                    View Resume
                  </button>
                </div>
              ) : (
                <div className="profile-sync-banner profile-sync-banner--empty">
                  <IconRefresh />
                  <div className="profile-sync-banner-body">
                    <strong>No resume synced yet</strong>
                    <span>Upload a resume and run extraction to auto-fill this profile.</span>
                  </div>
                  <button type="button" className="profile-sync-banner-action" onClick={() => setActiveTab('resumes')}>
                    Go to Resume Files
                  </button>
                </div>
              );
            })()}

            <form onSubmit={handleProfileSave} className="profile-form">
              <div className="profile-section">
                <div className="profile-section-head">
                  <span className="profile-section-icon"><IconUser /></span>
                  <h2 className="profile-section-title">Personal Details</h2>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-input"
                      value={profile.phone || ''}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input
                      type="text"
                      className="form-input"
                      value={profile.location || ''}
                      onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Remote Preference</label>
                    <select
                      className="form-input"
                      value={profile.remotePreference || ''}
                      onChange={(e) => setProfile({ ...profile, remotePreference: e.target.value })}
                    >
                      <option value="">Choose preference...</option>
                      <option value="remote">Remote Only</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="onsite">On-Site</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <div className="profile-section-head">
                  <span className="profile-section-icon"><IconBriefcase /></span>
                  <h2 className="profile-section-title">Professional Identity</h2>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Professional Title</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Backend Engineer"
                      value={profile.professionalTitle || ''}
                      onChange={(e) => setProfile({ ...profile, professionalTitle: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Career Level</label>
                    <select
                      className="form-input"
                      value={profile.careerLevel || ''}
                      onChange={(e) => setProfile({ ...profile, careerLevel: e.target.value })}
                    >
                      <option value="">Not set</option>
                      {CAREER_LEVELS.map((level) => (
                        <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <div className="profile-section-head">
                  <span className="profile-section-icon"><IconTarget /></span>
                  <h2 className="profile-section-title">Career Targets</h2>
                </div>
                <div className="form-group">
                  <label className="form-label">Target Roles (Comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.targetRoles}
                    onChange={(e) => setProfile({ ...profile, targetRoles: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Target Companies (Comma-separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.targetCompanies}
                    onChange={(e) => setProfile({ ...profile, targetCompanies: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Skills</label>
                  <div className="skill-tag-field">
                    {(profile.skills || []).map((skill, idx) => (
                      <span className="skill-tag" key={`${skill}-${idx}`}>
                        {skill}
                        <button
                          type="button"
                          className="skill-tag-remove"
                          aria-label={`Remove ${skill}`}
                          onClick={() => removeSkillAt(idx)}
                        >
                          <IconX />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      className="skill-tag-input"
                      placeholder={(profile.skills || []).length === 0 ? 'Type a skill and press Enter…' : 'Add another…'}
                      value={skillDraft}
                      onChange={(e) => setSkillDraft(e.target.value)}
                      onKeyDown={handleSkillDraftKeyDown}
                      onBlur={addSkillFromDraft}
                    />
                  </div>
                  <p className="form-hint">Press Enter or comma to add a skill. Backspace removes the last one.</p>
                </div>
              </div>

              <div className="profile-section">
                <div className="profile-section-head">
                  <span className="profile-section-icon"><IconDollarSign /></span>
                  <h2 className="profile-section-title">Experience &amp; Compensation</h2>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Years of Experience</label>
                    <input
                      type="text"
                      className="form-input"
                      value={profile.experience || ''}
                      onChange={(e) => setProfile({ ...profile, experience: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Salary Expectation</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. $120k/yr"
                      value={profile.salaryPreference || ''}
                      onChange={(e) => setProfile({ ...profile, salaryPreference: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <div className="profile-section-head">
                  <span className="profile-section-icon"><IconGraduationCap /></span>
                  <h2 className="profile-section-title">Education</h2>
                </div>
                {(profile.education || []).length === 0 && (
                  <div className="profile-list-empty">No education entries yet.</div>
                )}
                {(profile.education || []).map((edu, idx) => (
                  <div className="profile-list-row" key={idx}>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Institution</label>
                        <input
                          type="text"
                          className="form-input"
                          value={edu.institution || ''}
                          onChange={(e) => updateEducationEntry(idx, 'institution', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Degree</label>
                        <input
                          type="text"
                          className="form-input"
                          value={edu.degree || ''}
                          onChange={(e) => updateEducationEntry(idx, 'degree', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Field of Study</label>
                        <input
                          type="text"
                          className="form-input"
                          value={edu.field || ''}
                          onChange={(e) => updateEducationEntry(idx, 'field', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Start – End Year</label>
                        <div className="profile-list-row-inline">
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Start"
                            value={edu.startYear || ''}
                            onChange={(e) => updateEducationEntry(idx, 'startYear', e.target.value)}
                          />
                          <input
                            type="text"
                            className="form-input"
                            placeholder="End"
                            value={edu.endYear || ''}
                            onChange={(e) => updateEducationEntry(idx, 'endYear', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="profile-list-row-remove"
                      aria-label="Remove education entry"
                      onClick={() => removeEducationEntry(idx)}
                    >
                      <IconX /> Remove
                    </button>
                  </div>
                ))}
                <button type="button" className="profile-list-add-btn" onClick={addEducationEntry}>
                  + Add Education
                </button>
              </div>

              <div className="profile-section">
                <div className="profile-section-head">
                  <span className="profile-section-icon"><IconAward /></span>
                  <h2 className="profile-section-title">Certifications</h2>
                </div>
                {(profile.certifications || []).length === 0 && (
                  <div className="profile-list-empty">No certifications added yet.</div>
                )}
                {(profile.certifications || []).map((cert, idx) => {
                  const c = typeof cert === 'string' ? { name: cert } : cert;
                  return (
                    <div className="profile-list-row" key={idx}>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Name</label>
                          <input
                            type="text"
                            className="form-input"
                            value={c.name || ''}
                            onChange={(e) => updateCertificationEntry(idx, 'name', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Issuer</label>
                          <input
                            type="text"
                            className="form-input"
                            value={c.issuer || ''}
                            onChange={(e) => updateCertificationEntry(idx, 'issuer', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Issue Date</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. 2023"
                            value={c.issueDate || ''}
                            onChange={(e) => updateCertificationEntry(idx, 'issueDate', e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="profile-list-row-remove"
                        aria-label="Remove certification"
                        onClick={() => removeCertificationEntry(idx)}
                      >
                        <IconX /> Remove
                      </button>
                    </div>
                  );
                })}
                <button type="button" className="profile-list-add-btn" onClick={addCertificationEntry}>
                  + Add Certification
                </button>
              </div>

              <div className="profile-section">
                <div className="profile-section-head">
                  <span className="profile-section-icon"><IconLink /></span>
                  <h2 className="profile-section-title">Online Presence</h2>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">LinkedIn</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="linkedin.com/in/..."
                      value={profile.links?.linkedin || ''}
                      onChange={(e) => setProfile({ ...profile, links: { ...profile.links, linkedin: e.target.value } })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GitHub</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="github.com/..."
                      value={profile.links?.github || ''}
                      onChange={(e) => setProfile({ ...profile, links: { ...profile.links, github: e.target.value } })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Portfolio</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="yourname.dev"
                    value={profile.links?.portfolio || ''}
                    onChange={(e) => setProfile({ ...profile, links: { ...profile.links, portfolio: e.target.value } })}
                  />
                </div>
              </div>

              <div className="profile-section">
                <div className="profile-section-head">
                  <span className="profile-section-icon"><IconEdit /></span>
                  <h2 className="profile-section-title">Short Bio / Pitch</h2>
                </div>
                <div className="form-group">
                  <textarea
                    className="form-input"
                    rows="4"
                    value={profile.bio || ''}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="profile-btn profile-btn--primary">Save Profile Changes</button>
            </form>
          </div>
        )}

        {/* RESUME FILES TAB */}
        {activeTab === 'resumes' && (
          <div className="resume-page">
            <div className="resume-header">
              <div>
                <h1 className="resume-title">Resume Manager</h1>
                <p className="resume-subtitle">Keep your resume versions organized and pick which one AI matching uses</p>
              </div>
              <button className="resume-btn resume-btn--primary" onClick={() => setModal('resume')}>
                <IconUpload />
                Upload New Resume
              </button>
            </div>

            {resumes.length === 0 ? (
              <div className="resume-empty">
                <span className="resume-empty-icon"><IconFile /></span>
                No resumes uploaded yet. Click upload to get started.
              </div>
            ) : (
              <div className="resume-list">
                {resumes.map((res) => {
                  const isSelected = selectedResumeId === res.id;
                  return (
                    <div
                      key={res.id}
                      className={`resume-card ${isSelected ? 'resume-card--selected' : ''}`}
                      onClick={() => { setSelectedResumeId(res.id); setEditingAiEnrichment(false); loadResumeExtraction(res.id); }}
                    >
                      <span className="resume-card-icon"><IconFile /></span>
                      <div className="resume-card-body">
                        <div className="resume-card-top">
                          <span className="resume-card-name">{res.fileName}</span>
                          <span className="resume-card-version">v{res.version}</span>
                        </div>
                        <div className="resume-card-meta">
                          <span>{new Date(res.createdAt).toLocaleDateString()}</span>
                          {res.isActive ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <button
                              className="resume-set-active-btn"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await api.setActiveResume(res.id);
                                loadResumes();
                              }}
                            >
                              Set Active
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="resume-card-actions">
                        <a
                          href={api.getResumeDownloadUrl(res.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="resume-icon-btn"
                          aria-label="Download resume"
                          title="Download"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <IconDownload />
                        </a>
                        <button
                          className="resume-icon-btn resume-icon-btn--danger"
                          aria-label="Delete resume"
                          title="Delete"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm('Delete this resume?')) {
                              await api.deleteResume(res.id);
                              if (selectedResumeId === res.id) { setSelectedResumeId(null); setResumeExtraction(null); }
                              loadResumes();
                            }
                          }}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedResumeId && (
              <div className="resume-extract-panel">
                <div className="resume-extract-head">
                  <span className="resume-extract-icon"><IconZap /></span>
                  <h2 className="resume-extract-title">AI-Extracted Details</h2>
                </div>

                {loadingResumeExtraction ? (
                  <div className="resume-extract-notice">Loading extracted resume data...</div>
                ) : !resumeExtraction ? (
                  <div className="resume-extract-notice">
                    No AI extraction available for this resume yet.
                    <button
                      className="resume-btn resume-btn--ghost"
                      onClick={() => handleRetryResumeExtraction(selectedResumeId)}
                    >
                      <IconRefresh /> Run Extraction
                    </button>
                  </div>
                ) : resumeExtraction.status === 'pending' || resumeExtraction.status === 'processing' ? (
                  <div className="resume-extract-notice">
                    Extraction status: <strong>{resumeExtraction.status}</strong>. This updates automatically once complete.
                  </div>
                ) : resumeExtraction.status === 'failed' ? (
                  <div className="resume-extract-notice resume-extract-notice--danger">
                    <p>Extraction failed{resumeExtraction.errorCode ? ` (${resumeExtraction.errorCode})` : ''}.</p>
                    {resumeExtraction.rawResponse && (
                      <p className="resume-extract-error-detail">{resumeExtraction.rawResponse}</p>
                    )}
                    <button
                      className="resume-btn resume-btn--ghost"
                      onClick={() => handleRetryResumeExtraction(selectedResumeId)}
                    >
                      <IconRefresh /> Retry Extraction
                    </button>
                  </div>
                ) : (
                  <>
                    {resumeExtraction.needsReview && (
                      <div className="resume-extract-notice resume-extract-notice--warning">
                        ⚠ Low-confidence extraction — please review these details before relying on them.
                      </div>
                    )}
                    {profile.syncedResumeId === selectedResumeId && (
                      <div className="resume-synced-badge">
                        <IconCheckCircle /> Already auto-synced to your profile
                      </div>
                    )}

                    <div className="resume-extract-grid">
                      <div className="resume-extract-section">
                        <span className="resume-extract-label">Professional Title</span>
                        <span className="resume-extract-value">
                          {resumeExtraction.userCorrectedProfessionalTitle || resumeExtraction.professionalTitle || 'N/A'}
                        </span>
                      </div>
                      <div className="resume-extract-section">
                        <span className="resume-extract-label">Career Level</span>
                        <span className="resume-extract-value">
                          {resumeExtraction.userCorrectedCareerLevel || resumeExtraction.careerLevel || 'N/A'}
                        </span>
                      </div>
                      <div className="resume-extract-section">
                        <span className="resume-extract-label">Total Experience</span>
                        <span className="resume-extract-value">
                          {resumeExtraction.totalExperienceYears != null ? `${resumeExtraction.totalExperienceYears} yr` : 'N/A'}
                        </span>
                      </div>
                      <div className="resume-extract-section">
                        <span className="resume-extract-label">Confidence</span>
                        <span className="resume-extract-value">{Math.round((resumeExtraction.confidence || 0) * 100)}%</span>
                      </div>
                    </div>

                    {resumeExtraction.contactInfo && (
                      <div className="resume-extract-section">
                        <span className="resume-extract-label">Contact Info</span>
                        <div className="resume-extract-contact-grid">
                          {resumeExtraction.contactInfo.email && (
                            <span className="resume-extract-contact-item">{resumeExtraction.contactInfo.email}</span>
                          )}
                          {resumeExtraction.contactInfo.phone && (
                            <span className="resume-extract-contact-item">{resumeExtraction.contactInfo.phone}</span>
                          )}
                          {resumeExtraction.contactInfo.linkedin && (
                            <span className="resume-extract-contact-item">{resumeExtraction.contactInfo.linkedin}</span>
                          )}
                          {resumeExtraction.contactInfo.github && (
                            <span className="resume-extract-contact-item">{resumeExtraction.contactInfo.github}</span>
                          )}
                          {resumeExtraction.contactInfo.portfolio && (
                            <span className="resume-extract-contact-item">{resumeExtraction.contactInfo.portfolio}</span>
                          )}
                          {!resumeExtraction.contactInfo.email && !resumeExtraction.contactInfo.phone &&
                            !resumeExtraction.contactInfo.linkedin && !resumeExtraction.contactInfo.github &&
                            !resumeExtraction.contactInfo.portfolio && (
                              <span className="resume-extract-empty">None detected</span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="resume-extract-section">
                      <span className="resume-extract-label">Skills ({(resumeExtraction.userCorrectedSkills || resumeExtraction.skills || []).length})</span>
                      <div className="resume-extract-chips">
                        {(resumeExtraction.userCorrectedSkills || resumeExtraction.skills || []).length === 0 ? (
                          <span className="resume-extract-empty">None detected</span>
                        ) : (
                          (resumeExtraction.userCorrectedSkills || resumeExtraction.skills || []).map((s) => (
                            <span key={s} className="badge badge-secondary">{s}</span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="resume-extract-section">
                      <span className="resume-extract-label">Experience ({(resumeExtraction.experience || []).length})</span>
                      {(resumeExtraction.experience || []).length === 0 ? (
                        <span className="resume-extract-empty">None detected</span>
                      ) : (
                        <ul className="resume-extract-list">
                          {resumeExtraction.experience.map((exp, idx) => (
                            <li key={idx}>
                              <strong>{exp.title || 'Role'}</strong> at {exp.company || 'Company'} ({exp.startDate || '?'} &ndash; {exp.isCurrent ? 'Present' : (exp.endDate || '?')})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="resume-extract-section">
                      <span className="resume-extract-label">Education ({(resumeExtraction.education || []).length})</span>
                      {(resumeExtraction.education || []).length === 0 ? (
                        <span className="resume-extract-empty">None detected</span>
                      ) : (
                        <ul className="resume-extract-list">
                          {resumeExtraction.education.map((edu, idx) => (
                            <li key={idx}>
                              <strong>{edu.degree || 'Degree'}</strong>{edu.field ? ` in ${edu.field}` : ''} &mdash; {edu.institution || 'Institution'}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="resume-extract-section">
                      <span className="resume-extract-label">Certifications ({(resumeExtraction.certifications || []).length})</span>
                      {(resumeExtraction.certifications || []).length === 0 ? (
                        <span className="resume-extract-empty">None detected</span>
                      ) : (
                        <ul className="resume-extract-list">
                          {resumeExtraction.certifications.map((cert, idx) => {
                            const c = typeof cert === 'string' ? { name: cert } : cert;
                            return (
                              <li key={idx}>
                                <strong>{c.name || 'Certification'}</strong>
                                {c.issuer ? ` — ${c.issuer}` : ''}
                                {c.issueDate ? ` (${c.issueDate})` : ''}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="resume-extract-section">
                      <span className="resume-extract-label">Summary</span>
                      <p className="resume-extract-summary">
                        {resumeExtraction.userCorrectedSummary || resumeExtraction.summary || 'No summary available.'}
                      </p>
                    </div>

                    <div className="resume-apply-panel">
                      <div className="resume-apply-head">
                        <IconCheckCircle />
                        <span>Apply extracted data to My Profile</span>
                      </div>
                      <p className="resume-apply-hint">Select which fields to merge into your profile. Nothing is changed until you apply.</p>
                      <div className="resume-apply-fields">
                        {[
                          { key: 'skills', label: 'Skills' },
                          { key: 'targetRoles', label: 'Target Roles (from title)' },
                          { key: 'professionalTitle', label: 'Professional Title' },
                          { key: 'careerLevel', label: 'Career Level' },
                          { key: 'experience', label: 'Years of Experience' },
                          { key: 'bio', label: 'Bio / Summary' },
                          { key: 'education', label: 'Education' },
                          { key: 'certifications', label: 'Certifications' },
                          { key: 'contactInfo', label: 'Contact Links' },
                        ].map((f) => (
                          <label key={f.key} className="resume-apply-checkbox-row">
                            <input
                              type="checkbox"
                              checked={applyFieldSelection.includes(f.key)}
                              onChange={() => toggleApplyField(f.key)}
                            />
                            {f.label}
                          </label>
                        ))}
                      </div>
                      <button
                        className="resume-btn resume-btn--primary"
                        disabled={applyFieldSelection.length === 0 || applyingToProfile}
                        onClick={() => handleApplyResumeToProfile(selectedResumeId)}
                      >
                        {applyingToProfile ? 'Applying...' : 'Apply Selected to My Profile'}
                      </button>
                      {applyResultMessage && <div className="resume-apply-result">{applyResultMessage}</div>}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* CONNECTIONS CRM TAB */}
        {activeTab === 'connections' && (
          <div className="conn-page">
            <div className="conn-header">
              <div>
                <h1 className="conn-title">Connections CRM</h1>
                <p className="conn-subtitle">Your professional network, organized and scored</p>
              </div>
              <div className="conn-header-actions">
                <button className="conn-btn conn-btn--ghost" onClick={() => setModal('csv')}>
                  <IconUpload />
                  Import CSV
                </button>
                <button className="conn-btn conn-btn--ghost" onClick={() => {
                  setEnrichmentPreview(null);
                  setEnrichmentError(null);
                  setModal('linkedin_pdf');
                }}>
                  <IconFile />
                  Import LinkedIn PDF
                </button>
                <button className="conn-btn conn-btn--primary" onClick={() => { setEditItem(null); setModal('connection'); }}>
                  <IconUsers />
                  Add Connection
                </button>
              </div>
            </div>

            {/* Sub Tabs Selection */}
            <div className="conn-subnav">
              <button
                className={`conn-subnav-btn ${connectionSubTab === 'overview' ? 'active' : ''}`}
                onClick={() => { setConnectionSubTab('overview'); setActiveCompanyKey(null); }}
              >
                <IconBarChart />
                Network Overview
              </button>
              <button
                className={`conn-subnav-btn ${connectionSubTab === 'all' && !connFilters.followUpDue ? 'active' : ''}`}
                onClick={() => { setConnFilters({ ...connFilters, followUpDue: undefined, page: 1 }); setConnectionSubTab('all'); setActiveCompanyKey(null); }}
              >
                <IconUsers />
                All Connections
              </button>
              <button
                className={`conn-subnav-btn ${connectionSubTab === 'companies' ? 'active' : ''}`}
                onClick={() => { setConnectionSubTab('companies'); setActiveCompanyKey(null); }}
              >
                <IconBuilding />
                Companies
              </button>
              <button
                className={`conn-subnav-btn ${connectionSubTab === 'saved_views' ? 'active' : ''}`}
                onClick={() => { setConnectionSubTab('saved_views'); setActiveCompanyKey(null); }}
              >
                <IconLayers />
                Saved Views
              </button>
              <button
                className={`conn-subnav-btn ${connectionSubTab === 'all' && connFilters.followUpDue ? 'active' : ''}`}
                onClick={() => { setConnFilters({ ...connFilters, followUpDue: true, page: 1 }); setConnectionSubTab('all'); setActiveCompanyKey(null); }}
              >
                <IconClockAlert />
                Follow-ups Due
                {dashboardOverview?.followUps && (dashboardOverview.followUps.overdue + dashboardOverview.followUps.today) > 0 && (
                  <span className="conn-subnav-badge">{dashboardOverview.followUps.overdue + dashboardOverview.followUps.today}</span>
                )}
              </button>
            </div>

            {/* OVERVIEW SUB-TAB */}
            {connectionSubTab === 'overview' && (
              <div>
                {loadingOverview && <div className="conn-empty">Loading network insights...</div>}
                {overviewError && <div className="conn-empty conn-empty--error">{overviewError}</div>}

                {!loadingOverview && !overviewError && dashboardOverview && (
                  <div>
                    {/* KPI Cards Grid */}
                    <div className="conn-stat-grid">
                      <div className="conn-stat-card">
                        <span className="conn-stat-icon conn-stat-icon--primary"><IconUsers /></span>
                        <div>
                          <div className="conn-stat-label">Total Connections</div>
                          <div className="conn-stat-value">{dashboardOverview.summary.totalConnections}</div>
                        </div>
                      </div>
                      <div className="conn-stat-card">
                        <span className="conn-stat-icon conn-stat-icon--accent"><IconBuilding /></span>
                        <div>
                          <div className="conn-stat-label">Companies</div>
                          <div className="conn-stat-value">{dashboardOverview.summary.companies}</div>
                        </div>
                      </div>
                      <div className={`conn-stat-card ${dashboardOverview.summary.highPriority > 0 ? 'conn-stat-card--warn' : ''}`}>
                        <span className="conn-stat-icon conn-stat-icon--warning"><IconStar /></span>
                        <div>
                          <div className="conn-stat-label">High Priority</div>
                          <div className="conn-stat-value">{dashboardOverview.summary.highPriority}</div>
                        </div>
                      </div>
                      <div className="conn-stat-card">
                        <span className="conn-stat-icon conn-stat-icon--info"><IconInbox /></span>
                        <div>
                          <div className="conn-stat-label">Never Contacted</div>
                          <div className="conn-stat-value">{dashboardOverview.summary.neverContacted}</div>
                        </div>
                      </div>
                      <div className={`conn-stat-card ${dashboardOverview.summary.followUpsDue > 0 ? 'conn-stat-card--danger' : ''}`}>
                        <span className="conn-stat-icon conn-stat-icon--danger"><IconClockAlert /></span>
                        <div>
                          <div className="conn-stat-label">Follow-ups Due</div>
                          <div className="conn-stat-value">{dashboardOverview.summary.followUpsDue}</div>
                        </div>
                      </div>
                      <div className="conn-stat-card">
                        <span className="conn-stat-icon conn-stat-icon--success"><IconMail /></span>
                        <div>
                          <div className="conn-stat-label">With Email</div>
                          <div className="conn-stat-value">{dashboardOverview.summary.withEmail}</div>
                        </div>
                      </div>
                    </div>

                    {/* Second Row: Growth & Followups */}
                    <div className="conn-grid-2-1">
                      {/* Growth timeline list */}
                      <div className="conn-panel">
                        <div className="conn-panel-head">
                          <span className="conn-panel-icon"><IconBarChart /></span>
                          <h2 className="conn-panel-title">Network Growth History</h2>
                        </div>
                        {dashboardOverview.growth && dashboardOverview.growth.length > 0 ? (
                          <div className="conn-growth-list">
                            {dashboardOverview.growth.slice(-6).map((item) => (
                              <div key={item.month} className="conn-growth-row">
                                <span className="conn-growth-month">{item.month}</span>
                                <div className="conn-growth-track">
                                  <div className="conn-growth-fill" style={{ width: `${Math.min(100, (item.total / dashboardOverview.summary.totalConnections) * 100)}%` }} />
                                </div>
                                <span className="conn-growth-value">
                                  {item.total} total (+{item.added})
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="conn-empty">No connection dates recorded.</div>
                        )}
                      </div>

                      {/* Follow-up center card */}
                      <div className="conn-panel">
                        <div className="conn-panel-head">
                          <span className="conn-panel-icon"><IconClockAlert /></span>
                          <h2 className="conn-panel-title">Follow-up Summary</h2>
                        </div>
                        <div className="conn-followup-list">
                          <div className="conn-followup-row conn-followup-row--danger">
                            <span className="conn-followup-label"><span className="conn-dot conn-dot--danger" />Overdue</span>
                            <strong>{dashboardOverview.followUps.overdue}</strong>
                          </div>
                          <div className="conn-followup-row conn-followup-row--warning">
                            <span className="conn-followup-label"><span className="conn-dot conn-dot--warning" />Today</span>
                            <strong>{dashboardOverview.followUps.today}</strong>
                          </div>
                          <div className="conn-followup-row conn-followup-row--info">
                            <span className="conn-followup-label"><span className="conn-dot conn-dot--info" />This Week</span>
                            <strong>{dashboardOverview.followUps.thisWeek}</strong>
                          </div>
                          <button
                            className="conn-btn conn-btn--ghost conn-btn--block"
                            onClick={() => {
                              setConnFilters({ ...connFilters, followUpDue: true, page: 1 });
                              setConnectionSubTab('all');
                            }}
                          >
                            View All Due Follow-ups
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Top Companies */}
                    <div className="conn-panel">
                      <div className="conn-panel-head">
                        <span className="conn-panel-icon"><IconBuilding /></span>
                        <h2 className="conn-panel-title">Top Companies</h2>
                        <span className="conn-panel-note">Sized by connections</span>
                      </div>
                      {dashboardOverview.topCompanies && dashboardOverview.topCompanies.length > 0 ? (
                        <>
                          <div className="conn-company-hero-grid">
                            {dashboardOverview.topCompanies.slice(0, 3).map((c) => (
                              <div
                                key={c.normalizedName}
                                className="conn-company-hero-tile"
                                onClick={() => {
                                  setConnFilters({ ...connFilters, company: c.name, page: 1 });
                                  setConnectionSubTab('all');
                                }}
                              >
                                <span className="conn-company-hero-name">{c.name}</span>
                                <span className="conn-company-hero-count">{c.count}</span>
                              </div>
                            ))}
                          </div>
                          {dashboardOverview.topCompanies.length > 3 && (
                            <div className="conn-company-grid">
                              {dashboardOverview.topCompanies.slice(3).map((c) => (
                                <div
                                  key={c.normalizedName}
                                  className="conn-company-tile"
                                  onClick={() => {
                                    setConnFilters({ ...connFilters, company: c.name, page: 1 });
                                    setConnectionSubTab('all');
                                  }}
                                >
                                  <span className="conn-company-tile-name">{c.name}</span>
                                  <span className="conn-company-tile-count">{c.count}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="conn-empty">No company aggregates available.</div>
                      )}
                    </div>

                    {/* Role Distribution */}
                    <div className="conn-panel">
                      <div className="conn-panel-head">
                        <span className="conn-panel-icon"><IconBriefcase /></span>
                        <h2 className="conn-panel-title">Role Distribution</h2>
                      </div>
                      {dashboardOverview.roles && dashboardOverview.roles.length > 0 ? (() => {
                        const roleTotal = dashboardOverview.roles.reduce((sum, r) => sum + r.count, 0) || 1;
                        return (
                          <>
                            <div className="conn-role-bar">
                              {dashboardOverview.roles.map((r, idx) => (
                                <div
                                  key={r.category}
                                  className="conn-role-bar-segment"
                                  title={`${r.category.replace('_', ' ')}: ${r.count}`}
                                  style={{ width: `${(r.count / roleTotal) * 100}%`, background: CONN_ROLE_PALETTE[idx % CONN_ROLE_PALETTE.length] }}
                                  onClick={() => {
                                    setConnFilters({ ...connFilters, roleCategory: [r.category], page: 1 });
                                    setConnectionSubTab('all');
                                  }}
                                />
                              ))}
                            </div>
                            <div className="conn-role-legend">
                              {dashboardOverview.roles.map((r, idx) => (
                                <div
                                  key={r.category}
                                  className="conn-role-legend-item"
                                  onClick={() => {
                                    setConnFilters({ ...connFilters, roleCategory: [r.category], page: 1 });
                                    setConnectionSubTab('all');
                                  }}
                                >
                                  <span className="conn-role-swatch" style={{ background: CONN_ROLE_PALETTE[idx % CONN_ROLE_PALETTE.length] }} />
                                  <span className="conn-role-legend-label">{r.category.replace('_', ' ')}</span>
                                  <span className="conn-role-legend-value">{r.count}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })() : (
                        <div className="conn-empty">No role category aggregates available.</div>
                      )}
                    </div>

                    {/* Seniority Distribution */}
                    <div className="conn-panel">
                      <div className="conn-panel-head">
                        <span className="conn-panel-icon"><IconAward /></span>
                        <h2 className="conn-panel-title">Seniority Distribution</h2>
                      </div>
                      {dashboardOverview.seniority && dashboardOverview.seniority.length > 0 ? (() => {
                        const sorted = [...dashboardOverview.seniority].sort((a, b) => {
                          const ai = CONN_SENIORITY_ORDER.indexOf(a.level);
                          const bi = CONN_SENIORITY_ORDER.indexOf(b.level);
                          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                        });
                        const maxCount = Math.max(1, ...sorted.map(s => s.count));
                        return (
                          <div className="conn-seniority-list">
                            {sorted.map(s => (
                              <div
                                key={s.level}
                                className="conn-seniority-row"
                                onClick={() => {
                                  setConnFilters({ ...connFilters, seniority: [s.level], page: 1 });
                                  setConnectionSubTab('all');
                                }}
                              >
                                <div className="conn-seniority-track">
                                  <div className="conn-seniority-fill" style={{ width: `${(s.count / maxCount) * 100}%` }} />
                                </div>
                                <span className="conn-seniority-label">{s.level.replace('_', ' ')}</span>
                                <span className="conn-seniority-value">{s.count}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })() : (
                        <div className="conn-empty">No seniority level aggregates available.</div>
                      )}
                    </div>

                    {/* Relationship Health */}
                    <div className="conn-panel">
                      <div className="conn-panel-head">
                        <span className="conn-panel-icon"><IconUsers /></span>
                        <h2 className="conn-panel-title">Relationship Health</h2>
                      </div>
                      {dashboardOverview.relationships && dashboardOverview.relationships.length > 0 ? (() => {
                        const total = dashboardOverview.summary.totalConnections || 0;
                        const notContacted = dashboardOverview.relationships.find(r => r.status === 'not_contacted')?.count || 0;
                        const contacted = Math.max(0, total - notContacted);
                        const pct = total > 0 ? Math.round((notContacted / total) * 100) : 0;
                        return (
                          <>
                            <div className="conn-health-stat">
                              <span className="conn-health-pct">{pct}%</span>
                              <span className="conn-health-desc">of {total.toLocaleString()} connections never contacted</span>
                            </div>
                            <div className="conn-health-bar">
                              <div className="conn-health-bar-segment conn-health-bar-segment--danger" style={{ width: `${pct}%` }} />
                              <div className="conn-health-bar-segment conn-health-bar-segment--success" style={{ width: `${100 - pct}%` }} />
                            </div>
                            <div className="conn-health-legend">
                              <span><span className="conn-dot conn-dot--danger" />Not contacted &middot; {notContacted.toLocaleString()}</span>
                              <span><span className="conn-dot conn-dot--success" />Contacted &middot; {contacted.toLocaleString()}</span>
                            </div>
                            <button
                              className="conn-btn conn-btn--ghost conn-btn--block"
                              onClick={() => {
                                setConnFilters({ ...connFilters, relationshipStatus: 'not_contacted', page: 1 });
                                setConnectionSubTab('all');
                              }}
                            >
                              Start outreach to cold connections ↗
                            </button>
                          </>
                        );
                      })() : (
                        <div className="conn-empty">No relationship status aggregates available.</div>
                      )}
                    </div>

                    {/* Fifth Row: High Priority Connections */}
                    <div className="conn-panel">
                      <div className="conn-panel-head">
                        <span className="conn-panel-icon"><IconStar /></span>
                        <h2 className="conn-panel-title">High Priority Connections</h2>
                      </div>
                      <div className="conn-list">
                        {dashboardOverview.highPriorityConnections && dashboardOverview.highPriorityConnections.length > 0 ? (
                          dashboardOverview.highPriorityConnections.map((h) => (
                            <div
                              key={h.id}
                              className="conn-person-row"
                              onClick={() => {
                                setActiveConnectionId(h.id);
                                setActiveTab('connection-detail');
                              }}
                            >
                              <span className="conn-avatar">{getInitials(h.name)}</span>
                              <div className="conn-person-info">
                                <span className="conn-person-name">{h.name}</span>
                                <span className="conn-person-meta">{h.title || 'No Title'} &bull; {h.company || 'Unknown Company'}</span>
                              </div>
                              <span className="badge badge-success">Score: {h.connectionScore}</span>
                            </div>
                          ))
                        ) : (
                          <div className="conn-empty">No high priority connections set. Go to All Connections to mark priority.</div>
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}
            {connectionSubTab === 'companies' && activeCompanyKey && (
              <div>
                <button
                  className="conn-back-btn"
                  onClick={() => { setActiveCompanyKey(null); setCompanyDetailData(null); }}
                >
                  <IconArrowLeft />
                  Back to Company Directory
                </button>

                {loadingCompanyDetail && <div className="conn-empty">Loading company stats...</div>}

                {!loadingCompanyDetail && companyDetailData && (
                  <div>
                    <div className="conn-company-head">
                      <span className="conn-avatar conn-avatar--lg"><IconBuilding /></span>
                      <div>
                        <h1 className="conn-title">{companyDetailData.companyName}</h1>
                        <p className="conn-subtitle">{companyDetailData.totalConnections} contacts in your network</p>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="conn-stat-grid">
                      <div className="conn-stat-card conn-stat-card--link" onClick={() => {
                        setConnFilters({ ...connFilters, companies: [companyDetailData.companyName], page: 1 });
                        setConnectionSubTab('all');
                      }}>
                        <span className="conn-stat-icon conn-stat-icon--primary"><IconUsers /></span>
                        <div>
                          <div className="conn-stat-label">Total Connections</div>
                          <div className="conn-stat-value">{companyDetailData.totalConnections}</div>
                          <div className="conn-stat-link-text">View all <IconChevronRight /></div>
                        </div>
                      </div>
                      <div className="conn-stat-card conn-stat-card--link" onClick={() => {
                        setConnFilters({ ...connFilters, companies: [companyDetailData.companyName], roleCategory: ['recruiting'], page: 1 });
                        setConnectionSubTab('all');
                      }}>
                        <span className="conn-stat-icon conn-stat-icon--accent"><IconSend /></span>
                        <div>
                          <div className="conn-stat-label">Recruiters</div>
                          <div className="conn-stat-value">{companyDetailData.recruiters}</div>
                          <div className="conn-stat-link-text">View list <IconChevronRight /></div>
                        </div>
                      </div>
                      <div className="conn-stat-card conn-stat-card--link" onClick={() => {
                        setConnFilters({ ...connFilters, companies: [companyDetailData.companyName], roleCategory: ['engineering'], page: 1 });
                        setConnectionSubTab('all');
                      }}>
                        <span className="conn-stat-icon conn-stat-icon--info"><IconBriefcase /></span>
                        <div>
                          <div className="conn-stat-label">Engineering Leaders</div>
                          <div className="conn-stat-value">{companyDetailData.engineeringLeaders}</div>
                          <div className="conn-stat-link-text">View list <IconChevronRight /></div>
                        </div>
                      </div>
                      <div className="conn-stat-card conn-stat-card--link" onClick={() => {
                        setConnFilters({ ...connFilters, companies: [companyDetailData.companyName], priority: ['high'], page: 1 });
                        setConnectionSubTab('all');
                      }}>
                        <span className="conn-stat-icon conn-stat-icon--warning"><IconStar /></span>
                        <div>
                          <div className="conn-stat-label">High Priority</div>
                          <div className="conn-stat-value">{companyDetailData.highPriority}</div>
                          <div className="conn-stat-link-text">View list <IconChevronRight /></div>
                        </div>
                      </div>
                      <div className="conn-stat-card conn-stat-card--link" onClick={() => {
                        setConnFilters({ ...connFilters, companies: [companyDetailData.companyName], relationshipStatus: 'not_contacted', page: 1 });
                        setConnectionSubTab('all');
                      }}>
                        <span className="conn-stat-icon conn-stat-icon--danger"><IconInbox /></span>
                        <div>
                          <div className="conn-stat-label">Not Contacted</div>
                          <div className="conn-stat-value">{companyDetailData.notContacted}</div>
                          <div className="conn-stat-link-text">View list <IconChevronRight /></div>
                        </div>
                      </div>
                    </div>

                    <div className="conn-grid-2">
                      {/* Role distribution */}
                      <div className="conn-panel">
                        <div className="conn-panel-head">
                          <span className="conn-panel-icon"><IconBriefcase /></span>
                          <h2 className="conn-panel-title">Role Distribution</h2>
                        </div>
                        <div className="conn-list">
                          {companyDetailData.rolesDistribution && companyDetailData.rolesDistribution.length > 0 ? (
                            companyDetailData.rolesDistribution.map(r => (
                              <div
                                key={r.category}
                                className="conn-list-row"
                                onClick={() => {
                                  setConnFilters({ ...connFilters, companies: [companyDetailData.companyName], roleCategory: [r.category], page: 1 });
                                  setConnectionSubTab('all');
                                }}
                              >
                                <span className="conn-list-row-label conn-list-row-label--capitalize">{r.category.replace('_', ' ')}</span>
                                <span className="badge badge-info">{r.count}</span>
                              </div>
                            ))
                          ) : (
                            <div className="conn-empty">No roles logged.</div>
                          )}
                        </div>
                      </div>

                      {/* Seniority distribution */}
                      <div className="conn-panel">
                        <div className="conn-panel-head">
                          <span className="conn-panel-icon"><IconAward /></span>
                          <h2 className="conn-panel-title">Seniority Level</h2>
                        </div>
                        <div className="conn-list">
                          {companyDetailData.seniorityDistribution && companyDetailData.seniorityDistribution.length > 0 ? (
                            companyDetailData.seniorityDistribution.map(s => (
                              <div
                                key={s.level}
                                className="conn-list-row"
                                onClick={() => {
                                  setConnFilters({ ...connFilters, companies: [companyDetailData.companyName], seniority: [s.level], page: 1 });
                                  setConnectionSubTab('all');
                                }}
                              >
                                <span className="conn-list-row-label conn-list-row-label--capitalize">{s.level}</span>
                                <span className="badge badge-success">{s.count}</span>
                              </div>
                            ))
                          ) : (
                            <div className="conn-empty">No seniority logged.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AI Derived Expertise aggregated dashboard */}
                    <div className="conn-panel">
                      <div className="conn-panel-head">
                        <h2 className="conn-panel-title">AI-Derived Technical Expertise / Domains</h2>
                      </div>
                      <p className="conn-panel-desc">Aggregate count of contacts matching these technical expertise tags (derived by Ollama profile analysis).</p>

                      {companyDetailData.aiExpertise && companyDetailData.aiExpertise.length > 0 ? (
                        <div className="conn-chip-grid">
                          {companyDetailData.aiExpertise.map(exp => (
                            <div key={exp.name} className="conn-chip-card">
                              <span>{exp.name}</span>
                              <span className="badge badge-primary">{exp.count}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="conn-empty">No AI-derived expertise analysis available yet. Enrich your connections at this company to see aggregate insights.</div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )}

            {connectionSubTab === 'companies' && !activeCompanyKey && (
              <div>
                <div className="conn-toolbar">
                  <div className="conn-search-field">
                    <IconSearch />
                    <input
                      type="text"
                      placeholder="Search companies..."
                      value={companySearch}
                      onChange={(e) => { setCompanySearch(e.target.value); setCompaniesPage(1); }}
                    />
                  </div>
                  <div className="conn-toolbar-sort">
                    <span>Sort by</span>
                    <select
                      className="form-input"
                      value={companySortBy}
                      onChange={(e) => { setCompanySortBy(e.target.value); setCompaniesPage(1); }}
                    >
                      <option value="connections">Connections Count</option>
                      <option value="companyName">Company Name</option>
                      <option value="seniorPlus">Senior+ Staff</option>
                      <option value="engineering">Engineering</option>
                      <option value="recruiter">Recruiting</option>
                      <option value="highPriority">High Priority</option>
                    </select>
                    <select
                      className="form-input"
                      value={companySortOrder}
                      onChange={(e) => { setCompanySortOrder(e.target.value); setCompaniesPage(1); }}
                    >
                      <option value="desc">Descending</option>
                      <option value="asc">Ascending</option>
                    </select>
                  </div>
                </div>

                <div className="conn-panel conn-panel--flush">
                  {companies.length === 0 ? (
                    <div className="conn-empty">No companies found in network.</div>
                  ) : (
                    <div className="data-table-container">
                      <table className="data-table conn-table">
                        <thead>
                          <tr>
                            <th>Company</th>
                            <th>Connections</th>
                            <th>Senior+</th>
                            <th>Engineering</th>
                            <th>Recruiters</th>
                            <th>Contacted</th>
                            <th>Not Contacted</th>
                            <th>High Priority</th>
                          </tr>
                        </thead>
                        <tbody>
                          {companies.map(c => (
                            <tr key={c.companyKey}>
                              <td>
                                <button
                                  className="conn-table-link"
                                  onClick={() => setActiveCompanyKey(c.companyKey)}
                                >
                                  <span className="conn-avatar conn-avatar--sm"><IconBuilding /></span>
                                  {c.companyName}
                                </button>
                              </td>
                              <td className="conn-cell-strong">{c.connectionCount}</td>
                              <td>{c.seniorPlusCount}</td>
                              <td>{c.engineeringCount}</td>
                              <td>{c.recruiterCount}</td>
                              <td className="conn-cell-success">{c.contactedCount}</td>
                              <td>{c.notContactedCount}</td>
                              <td className="conn-cell-warning">{c.highPriorityCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {companiesMeta.totalPages > 1 && (
                  <div className="conn-pagination">
                    <button
                      className="conn-btn conn-btn--ghost"
                      disabled={companiesPage === 1}
                      onClick={() => setCompaniesPage(companiesPage - 1)}
                    >
                      Prev
                    </button>
                    <span className="conn-pagination-status">
                      Page {companiesPage} of {companiesMeta.totalPages}
                    </span>
                    <button
                      className="conn-btn conn-btn--ghost"
                      disabled={companiesPage === companiesMeta.totalPages}
                      onClick={() => setCompaniesPage(companiesPage + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

            {connectionSubTab === 'saved_views' && (
              <div>
                <div className="conn-section-head">
                  <h2 className="conn-section-title">Your Saved Reusable Segments</h2>
                  <button className="conn-btn conn-btn--primary" onClick={() => {
                    setConnectionSubTab('all');
                    setConnFilters({
                      page: 1,
                      limit: 50,
                      search: '',
                      companies: '',
                      positions: '',
                      seniority: '',
                      roleCategory: '',
                      relationshipStatus: '',
                      relationshipStrength: '',
                      priority: '',
                      hasEmail: undefined,
                      followUpDue: undefined
                    });
                  }}>
                    Create Custom View
                  </button>
                </div>

                {savedViews.length === 0 ? (
                  <div className="conn-panel">
                    <div className="conn-empty">No saved connection views found. Set filters in All Connections and click &quot;Save view&quot;.</div>
                  </div>
                ) : (
                  <div className="conn-view-list">
                    {savedViews.map(view => (
                      <div key={view.id} className="conn-view-card">
                        <span className="conn-view-icon"><IconLayers /></span>
                        <div className="conn-view-info">
                          <span className="conn-view-name">{view.name}</span>
                          <p className="conn-view-desc">{view.description || 'No description provided'}</p>
                        </div>
                        <div className="conn-view-actions">
                          <button
                            className="conn-btn conn-btn--ghost"
                            onClick={() => handleLoadSavedView(view)}
                          >
                            Open view
                          </button>
                          <button
                            className="conn-icon-btn conn-icon-btn--danger"
                            aria-label="Delete saved view"
                            onClick={async () => {
                              if (confirm('Delete this saved view?')) {
                                await api.request(`/connections/views/${view.id}`, { method: 'DELETE' });
                                loadSavedViews();
                              }
                            }}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* DIRECTORY LIST SUB-TAB */}
            {connectionSubTab === 'all' && (
              <div>
                {/* Saved Views Control Panel */}
                <div className="conn-segment-bar">
                  <div className="conn-segment-left">
                    <span className="conn-segment-tag">Active Segment</span>
                    <select
                      className="conn-segment-select"
                      value={activeViewId || 'all'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'all' || val === 'high_priority' || val === 'never_contacted' || val === 'follow_ups') {
                          handleApplyBuiltinView(val);
                        } else {
                          const found = savedViews.find(v => v.id === val);
                          if (found) handleLoadSavedView(found);
                        }
                      }}
                    >
                      <optgroup label="System Views">
                        <option value="all">All Connections</option>
                        <option value="high_priority">High Priority Only</option>
                        <option value="never_contacted">Never Contacted</option>
                        <option value="follow_ups">Follow-ups Due</option>
                      </optgroup>
                      {savedViews.length > 0 && (
                        <optgroup label="Custom Saved Views">
                          {savedViews.map(view => (
                            <option key={view.id} value={view.id}>{view.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>

                    <span className="conn-segment-name">
                      {activeViewName}
                      {activeViewId && activeViewId !== 'all' && activeViewId !== 'high_priority' && activeViewId !== 'never_contacted' && activeViewId !== 'follow_ups' && (
                        <span className="conn-segment-dirty">
                          {(() => {
                            const active = savedViews.find(v => v.id === activeViewId);
                            if (active) {
                              const cleanFilters = (f) => ({
                                q: f.q || '',
                                company: f.company || '',
                                title: f.title || '',
                                hasEmail: f.hasEmail,
                                relationshipStatus: f.relationshipStatus || '',
                                followUpDue: !!f.followUpDue,
                                companies: f.companies || [],
                                seniority: f.seniority || [],
                                roleCategory: f.roleCategory || [],
                                priority: f.priority || []
                              });
                              const diff = JSON.stringify(cleanFilters(connFilters)) !== JSON.stringify(cleanFilters(active.filtersJson)) ||
                                (connFilters.sortBy || 'connectedDate') !== (active.sortJson.sortBy || 'connectedDate') ||
                                (connFilters.sortOrder || 'desc') !== (active.sortJson.sortOrder || 'desc');
                              return diff ? ' * (unsaved changes)' : '';
                            }
                            return '';
                          })()}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="conn-segment-actions">
                    {activeViewId && activeViewId !== 'all' && activeViewId !== 'high_priority' && activeViewId !== 'never_contacted' && activeViewId !== 'follow_ups' && (
                      <>
                        <button className="conn-btn conn-btn--primary conn-btn--sm" onClick={handleSaveView}>Save Changes</button>
                        <button className="conn-btn conn-btn--ghost conn-btn--sm" onClick={() => handleRenameView(activeViewId, activeViewName)}>Rename</button>
                        <button className="conn-btn conn-btn--ghost conn-btn--sm" onClick={() => handleDuplicateView(activeViewId)}>Duplicate</button>
                        <button className="conn-icon-btn conn-icon-btn--danger" aria-label="Delete view" onClick={() => handleDeleteView(activeViewId)}><IconTrash /></button>
                      </>
                    )}
                    <button className="conn-btn conn-btn--ghost conn-btn--sm" onClick={() => {
                      setNewViewName(activeViewId && activeViewId !== 'all' && activeViewId !== 'high_priority' && activeViewId !== 'never_contacted' && activeViewId !== 'follow_ups' ? `${activeViewName} Copy` : 'My Custom View');
                      setShowSaveViewModal(true);
                    }}>Save View As...</button>
                    <button
                      className="conn-btn conn-btn--accent conn-btn--sm"
                      onClick={runBackfill}
                      disabled={syncingEmbeddings}
                    >
                      <IconRefresh />
                      {syncingEmbeddings ? 'Syncing...' : 'Sync AI Embeddings'}
                    </button>
                  </div>
                </div>

                {/* Active Filter Chips */}
                {(() => {
                  const chips = [];
                  if (connFilters.q) chips.push({ label: `Search: ${connFilters.q}`, key: 'q', value: '' });
                  if (connFilters.company) chips.push({ label: `Company: ${connFilters.company}`, key: 'company', value: '' });
                  if (connFilters.title) chips.push({ label: `Title: ${connFilters.title}`, key: 'title', value: '' });
                  if (connFilters.hasEmail !== undefined) chips.push({ label: connFilters.hasEmail ? 'Has Email' : 'No Email', key: 'hasEmail', value: undefined });
                  if (connFilters.relationshipStatus) chips.push({ label: `Status: ${connFilters.relationshipStatus}`, key: 'relationshipStatus', value: undefined });
                  if (connFilters.followUpDue) chips.push({ label: `Follow-up Due`, key: 'followUpDue', value: undefined });

                  if (connFilters.companies && connFilters.companies.length > 0) {
                    connFilters.companies.forEach(c => {
                      chips.push({ label: `Company: ${c}`, key: 'companies', value: c });
                    });
                  }
                  if (connFilters.seniority && connFilters.seniority.length > 0) {
                    connFilters.seniority.forEach(s => {
                      chips.push({ label: `Seniority: ${s}`, key: 'seniority', value: s });
                    });
                  }
                  if (connFilters.roleCategory && connFilters.roleCategory.length > 0) {
                    connFilters.roleCategory.forEach(r => {
                      chips.push({ label: `Role: ${r}`, key: 'roleCategory', value: r });
                    });
                  }
                  if (connFilters.priority && connFilters.priority.length > 0) {
                    connFilters.priority.forEach(p => {
                      chips.push({ label: `Priority: ${p}`, key: 'priority', value: p });
                    });
                  }

                  if (chips.length === 0) return null;

                  return (
                    <div className="conn-chip-row">
                      <span className="conn-chip-row-label">Active Filters</span>
                      {chips.map((chip, idx) => (
                        <span key={idx} className="conn-filter-chip">
                          {chip.label}
                          <button
                            type="button"
                            className="conn-filter-chip-remove"
                            aria-label={`Remove filter ${chip.label}`}
                            onClick={() => {
                              if (chip.key === 'companies' || chip.key === 'seniority' || chip.key === 'roleCategory' || chip.key === 'priority') {
                                setConnFilters({
                                  ...connFilters,
                                  [chip.key]: connFilters[chip.key].filter(v => v !== chip.value),
                                  page: 1
                                });
                              } else {
                                setConnFilters({
                                  ...connFilters,
                                  [chip.key]: chip.value,
                                  page: 1
                                });
                              }
                            }}
                          >
                            <IconX />
                          </button>
                        </span>
                      ))}
                      <button
                        className="conn-clear-filters-btn"
                        onClick={() => {
                          setConnFilters({ page: 1, pageSize: 10, q: '', company: '', title: '' });
                        }}
                      >
                        Clear All
                      </button>
                    </div>
                  );
                })()}

                {/* Filter Bar */}
                <div className="conn-filter-bar">
                  <div className="conn-filter-field conn-filter-field--wide">
                    <label className="conn-filter-label-row">
                      <span className="form-label">Search Query</span>
                      <span className="conn-search-mode-toggle">
                        <button
                          type="button"
                          className={connSearchMode === 'keyword' ? 'active' : ''}
                          onClick={() => { setConnSearchMode('keyword'); setSemanticConnResults(null); }}
                        >Keyword</button>
                        <button
                          type="button"
                          className={connSearchMode === 'semantic' ? 'active' : ''}
                          onClick={() => { setConnSearchMode('semantic'); }}
                        >Semantic</button>
                      </span>
                    </label>
                    <div className="conn-search-field">
                      <IconSearch />
                      <input
                        type="text"
                        placeholder={connSearchMode === 'semantic' ? "Find people with experience in..." : "Name, title, company..."}
                        value={connFilters.q || ''}
                        onChange={(e) => {
                          setConnFilters({ ...connFilters, q: e.target.value, page: 1 });
                          if (connSearchMode === 'keyword') setSemanticConnResults(null);
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && connSearchMode === 'semantic') {
                            await runSemanticConnSearch();
                          }
                        }}
                      />
                      {connSearchMode === 'semantic' && (
                        <button className="conn-btn conn-btn--primary conn-btn--sm" onClick={runSemanticConnSearch} disabled={searchingSemantic}>
                          {searchingSemantic ? '...' : 'Search'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="conn-filter-field">
                    <label className="form-label">Filter Company</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Google"
                      value={connFilters.company || ''}
                      onChange={(e) => setConnFilters({ ...connFilters, company: e.target.value, page: 1 })}
                    />
                  </div>
                  <div className="conn-filter-field">
                    <label className="form-label">Filter Title/Role</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Engineer"
                      value={connFilters.title || ''}
                      onChange={(e) => setConnFilters({ ...connFilters, title: e.target.value, page: 1 })}
                    />
                  </div>
                  <div className="conn-filter-field">
                    <label className="form-label">Email Filter</label>
                    <select
                      className="form-input"
                      value={connFilters.hasEmail === undefined ? '' : String(connFilters.hasEmail)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConnFilters({
                          ...connFilters,
                          hasEmail: val === '' ? undefined : val === 'true',
                          page: 1
                        });
                      }}
                    >
                      <option value="">All Connections</option>
                      <option value="true">Has Email Only</option>
                      <option value="false">No Email Only</option>
                    </select>
                  </div>
                  <div className="conn-filter-field">
                    <label className="form-label">Relationship Status</label>
                    <select
                      className="form-input"
                      value={connFilters.relationshipStatus || ''}
                      onChange={(e) => setConnFilters({ ...connFilters, relationshipStatus: e.target.value || undefined, page: 1 })}
                    >
                      <option value="">All Statuses</option>
                      <option value="not_contacted">Not Contacted</option>
                      <option value="researching">Researching</option>
                      <option value="contacted">Contacted</option>
                      <option value="replied">Replied</option>
                      <option value="conversation">Conversation</option>
                      <option value="referral_requested">Referral Requested</option>
                      <option value="referral_received">Referral Received</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div className="conn-filter-field">
                    <label className="form-label">Sort By</label>
                    <select
                      className="form-input"
                      value={connFilters.sortBy || 'connectedDate'}
                      onChange={(e) => setConnFilters({ ...connFilters, sortBy: e.target.value, page: 1 })}
                    >
                      <option value="connectedDate">Connected Date</option>
                      <option value="connectionScore">Connection Score</option>
                      <option value="name">Name</option>
                      <option value="company">Company</option>
                      <option value="title">Title</option>
                      <option value="lastContactedDate">Last Contacted</option>
                      <option value="nextFollowUpDate">Next Follow-up</option>
                      <option value="priority">Priority</option>
                    </select>
                  </div>
                  <div className="conn-filter-field conn-filter-field--narrow">
                    <label className="form-label">Sort Order</label>
                    <select
                      className="form-input"
                      value={connFilters.sortOrder || 'desc'}
                      onChange={(e) => setConnFilters({ ...connFilters, sortOrder: e.target.value, page: 1 })}
                    >
                      <option value="desc">Descending</option>
                      <option value="asc">Ascending</option>
                    </select>
                  </div>
                  <div className="conn-filter-field conn-filter-field--checkbox">
                    <input
                      type="checkbox"
                      id="followUpDueOnly"
                      checked={!!connFilters.followUpDue}
                      onChange={(e) => setConnFilters({ ...connFilters, followUpDue: e.target.checked ? true : undefined, page: 1 })}
                    />
                    <label htmlFor="followUpDueOnly" className="form-label">Follow-up Due</label>
                  </div>
                  <div className="conn-filter-actions">
                    <button className="conn-btn conn-btn--primary" onClick={loadConnections}>Apply</button>
                    <button
                      className="conn-btn conn-btn--ghost"
                      onClick={() => {
                        setConnFilters({ page: 1, pageSize: 10, q: '', company: '', title: '' });
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Collapsible Advanced Filters Drawer */}
                <details className="conn-filters-drawer">
                  <summary><IconSliders /> Advanced Attribute Filters</summary>
                  <div className="conn-filters-drawer-grid">
                    <div className="conn-checkbox-group">
                      <h4>Seniority</h4>
                      {['mid', 'senior', 'junior', 'intern', 'lead', 'manager', 'director', 'executive', 'founder', 'unknown'].map(lvl => (
                        <label key={lvl}>
                          <input
                            type="checkbox"
                            checked={connFilters.seniority?.includes(lvl) || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const current = connFilters.seniority || [];
                              setConnFilters({
                                ...connFilters,
                                seniority: checked ? [...current, lvl] : current.filter(v => v !== lvl),
                                page: 1
                              });
                            }}
                          />
                          {lvl}
                        </label>
                      ))}
                    </div>
                    <div className="conn-checkbox-group">
                      <h4>Role Category</h4>
                      {['engineering', 'data', 'product', 'recruiting', 'sales', 'marketing', 'design', 'finance', 'other'].map(cat => (
                        <label key={cat}>
                          <input
                            type="checkbox"
                            checked={connFilters.roleCategory?.includes(cat) || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const current = connFilters.roleCategory || [];
                              setConnFilters({
                                ...connFilters,
                                roleCategory: checked ? [...current, cat] : current.filter(v => v !== cat),
                                page: 1
                              });
                            }}
                          />
                          {cat.replace('_', ' ')}
                        </label>
                      ))}
                    </div>
                    <div className="conn-checkbox-group">
                      <h4>Priority</h4>
                      {['high', 'medium', 'low', 'none'].map(prio => (
                        <label key={prio}>
                          <input
                            type="checkbox"
                            checked={connFilters.priority?.includes(prio) || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const current = connFilters.priority || [];
                              setConnFilters({
                                ...connFilters,
                                priority: checked ? [...current, prio] : current.filter(v => v !== prio),
                                page: 1
                              });
                            }}
                          />
                          {prio}
                        </label>
                      ))}
                    </div>
                  </div>
                </details>

                <div className="conn-panel conn-panel--flush">
                  {(semanticConnResults !== null ? semanticConnResults : connections).length === 0 ? (
                    <div className="conn-empty">No connection CRM records matching query.</div>
                  ) : (
                    <div className="data-table-container">
                      <table className="data-table conn-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Company & Title</th>
                            <th>Email / Location</th>
                            <th>Relationship Status</th>
                            <th className="conn-table-actions-head">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(semanticConnResults !== null
                            ? semanticConnResults.map(r => ({ ...r.connection, similarity: r.similarity, matchedConcepts: r.matchedConcepts }))
                            : connections
                          ).map((c) => (
                            <tr key={c.id}>
                              <td>
                                <div className="conn-name-cell">
                                  <span className="conn-avatar conn-avatar--sm">{getInitials(c.name)}</span>
                                  <div>
                                    <div className="conn-cell-strong">{c.name}</div>
                                    {c.similarity !== undefined && (
                                      <div className="conn-similarity-note">
                                        Similarity: {Math.round(c.similarity * 100)}% {c.matchedConcepts?.length > 0 && `(${c.matchedConcepts.join(', ')})`}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div>{c.title || 'No Title'}</div>
                                <div className="conn-cell-sub">{c.company || 'Unknown'}</div>
                              </td>
                              <td>
                                <div>{c.email || 'No email'}</div>
                                <div className="conn-cell-sub">{c.location || 'Unknown'}</div>
                              </td>
                              <td>
                                <span className={`badge ${CONN_STATUS_VARIANT[c.relationshipStatus] || 'badge-secondary'}`}>
                                  {(c.relationshipStatus || 'not_contacted').replace('_', ' ')}
                                </span>
                              </td>
                              <td>
                                <div className="conn-row-actions">
                                  <button
                                    className="conn-icon-btn"
                                    aria-label="View connection"
                                    title="View"
                                    onClick={() => {
                                      setActiveConnectionId(c.id);
                                      setActiveTab('connection-detail');
                                    }}
                                  >
                                    <IconEye />
                                  </button>
                                  <button
                                    className="conn-icon-btn"
                                    aria-label="Log outreach"
                                    title="Log Outreach"
                                    onClick={() => {
                                      setEditItem(c);
                                      setModal('outreach');
                                    }}
                                  >
                                    <IconSend />
                                  </button>
                                  <button
                                    className="conn-icon-btn"
                                    aria-label="Edit connection"
                                    title="Edit"
                                    onClick={() => {
                                      setEditItem(c);
                                      setModal('connection');
                                    }}
                                  >
                                    <IconEdit />
                                  </button>
                                  <button
                                    className="conn-icon-btn conn-icon-btn--danger"
                                    aria-label="Delete connection"
                                    title="Delete"
                                    onClick={async () => {
                                      if (confirm('Delete this connection record?')) {
                                        await api.deleteConnection(c.id);
                                        loadConnections();
                                      }
                                    }}
                                  >
                                    <IconTrash />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Pagination */}
                      <div className="conn-pagination">
                        <button
                          className="conn-btn conn-btn--ghost"
                          disabled={connFilters.page <= 1}
                          onClick={() => setConnFilters({ ...connFilters, page: connFilters.page - 1 })}
                        >
                          Previous
                        </button>
                        <span className="conn-pagination-status">Page {connFilters.page} of {connMeta.totalPages || 1}</span>
                        <button
                          className="conn-btn conn-btn--ghost"
                          disabled={connFilters.page >= connMeta.totalPages}
                          onClick={() => setConnFilters({ ...connFilters, page: connFilters.page + 1 })}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* JOBS TRACKER TAB */}
        {activeTab === 'jobs' && (
          <div className="job-page">
            <div className="job-header">
              <div>
                <h1 className="job-title">Jobs Tracker</h1>
                <p className="job-subtitle">Track postings, sources, and the inbound review queue</p>
              </div>
              <button className="job-btn job-btn--primary" onClick={() => { setEditItem(null); setModal('job'); }}>
                <IconBriefcase />
                Track New Job
              </button>
            </div>

            <div className="job-subnav">
              <button
                className={`job-subnav-btn ${jobSubTab === 'list' ? 'active' : ''}`}
                onClick={() => setJobSubTab('list')}
              >
                <IconBriefcase />
                All Jobs
              </button>
              <button
                className={`job-subnav-btn ${jobSubTab === 'sources' ? 'active' : ''}`}
                onClick={() => setJobSubTab('sources')}
              >
                <IconSliders />
                Settings &amp; Job Sources
              </button>
              <button
                className={`job-subnav-btn ${jobSubTab === 'review' ? 'active' : ''}`}
                onClick={() => { setJobSubTab('review'); loadIncomingJobs(); }}
              >
                <IconInbox />
                Incoming Queue
                {incomingJobs.filter(j => j.status === 'pending_review').length > 0 && (
                  <span className="job-subnav-badge">{incomingJobs.filter(j => j.status === 'pending_review').length}</span>
                )}
              </button>
            </div>

            {jobSubTab === 'list' && (
              <div>
                <div className="job-filter-bar">
                  <div className="job-filter-field job-filter-field--wide">
                    <label className="job-filter-label-row">
                      <span className="form-label">Job Title / Keyword</span>
                      <span className="job-search-mode-toggle">
                        <button
                          type="button"
                          className={jobSearchMode === 'keyword' ? 'active' : ''}
                          onClick={() => { setJobSearchMode('keyword'); setSemanticJobResults(null); }}
                        >Keyword</button>
                        <button
                          type="button"
                          className={jobSearchMode === 'semantic' ? 'active' : ''}
                          onClick={() => { setJobSearchMode('semantic'); }}
                        >Semantic</button>
                      </span>
                    </label>
                    <div className="job-search-field">
                      <IconSearch />
                      <input
                        type="text"
                        placeholder={jobSearchMode === 'semantic' ? "Find backend roles focused on..." : "Job title..."}
                        value={jobFilters.q}
                        onChange={(e) => {
                          setJobFilters({ ...jobFilters, q: e.target.value, page: 1 });
                          if (jobSearchMode === 'keyword') setSemanticJobResults(null);
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && jobSearchMode === 'semantic') {
                            await runSemanticJobSearch();
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="job-filter-field">
                    <label className="form-label">Location</label>
                    <input
                      type="text"
                      className="form-input"
                      value={jobFilters.location}
                      onChange={(e) => setJobFilters({ ...jobFilters, location: e.target.value, page: 1 })}
                    />
                  </div>
                  <div className="job-filter-field">
                    <label className="form-label">Status</label>
                    <select
                      className="form-input"
                      value={jobFilters.status}
                      onChange={(e) => setJobFilters({ ...jobFilters, status: e.target.value, page: 1 })}
                    >
                      <option value="">All statuses</option>
                      <option value="new">New</option>
                      <option value="saved">Saved</option>
                      <option value="applied">Applied</option>
                    </select>
                  </div>
                  <div className="job-filter-actions">
                    <button className="job-btn job-btn--primary" onClick={jobSearchMode === 'semantic' ? runSemanticJobSearch : loadJobs}>
                      {searchingJobSemantic ? '...' : 'Search'}
                    </button>
                  </div>
                </div>

                <div className="job-panel job-panel--flush">
                  {(semanticJobResults !== null ? semanticJobResults : jobs).length === 0 ? (
                    <div className="job-empty">No jobs found matching conditions.</div>
                  ) : (
                    <div className="data-table-container">
                      <table className="data-table job-table">
                        <thead>
                          <tr>
                            <th>Job Title</th>
                            <th>Company Name</th>
                            <th>Location</th>
                            <th>Post Status</th>
                            <th className="job-table-actions-head">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(semanticJobResults !== null
                            ? semanticJobResults.map(r => ({ ...r.job, similarity: r.similarity, matchedConcepts: r.matchedConcepts }))
                            : jobs
                          ).map((job) => (
                            <tr key={job.id}>
                              <td>
                                <div className="job-cell-strong">{job.title}</div>
                                {job.similarity !== undefined && (
                                  <div className="job-similarity-note">
                                    Similarity: {Math.round(job.similarity * 100)}% {job.matchedConcepts?.length > 0 && `(${job.matchedConcepts.join(', ')})`}
                                  </div>
                                )}
                              </td>
                              <td>
                                {job.companyName}
                                <span className="badge badge-secondary job-source-tag">
                                  {job.source || 'manual'}
                                </span>
                              </td>
                              <td>{job.location || 'Remote'}</td>
                              <td>
                                <span className={`badge ${JOB_STATUS_VARIANT[job.status] || 'badge-info'}`}>{job.status}</span>
                              </td>
                              <td>
                                <div className="job-row-actions">
                                  <button
                                    className="job-icon-btn"
                                    aria-label="View job"
                                    title="View"
                                    onClick={async () => {
                                      try {
                                        const data = await api.request(`/jobs/${job.id}`);
                                        setEditItem(data.data);
                                        setModal('job_detail');
                                      } catch (err) {
                                        alert(err.message);
                                      }
                                    }}
                                  >
                                    <IconEye />
                                  </button>
                                  <button
                                    className="job-icon-btn"
                                    aria-label="Save or apply"
                                    title="Save / Apply"
                                    onClick={async () => {
                                      await api.createApplication(job.id, 'saved');
                                      alert('Job saved to applications!');
                                    }}
                                  >
                                    <IconSend />
                                  </button>
                                  <button
                                    className="job-icon-btn"
                                    aria-label="Edit job"
                                    title="Edit"
                                    onClick={() => {
                                      setEditItem(job);
                                      setModal('job');
                                    }}
                                  >
                                    <IconEdit />
                                  </button>
                                  <button
                                    className="job-icon-btn job-icon-btn--danger"
                                    aria-label="Delete job"
                                    title="Delete"
                                    onClick={async () => {
                                      if (confirm('Delete this job?')) {
                                        await api.deleteJob(job.id);
                                        loadJobs();
                                      }
                                    }}
                                  >
                                    <IconTrash />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Pagination */}
                      <div className="job-pagination">
                        <button
                          className="job-btn job-btn--ghost"
                          disabled={jobFilters.page <= 1}
                          onClick={() => setJobFilters({ ...jobFilters, page: jobFilters.page - 1 })}
                        >
                          Previous
                        </button>
                        <span className="job-pagination-status">Page {jobFilters.page} of {jobMeta.totalPages || 1}</span>
                        <button
                          className="job-btn job-btn--ghost"
                          disabled={jobFilters.page >= jobMeta.totalPages}
                          onClick={() => setJobFilters({ ...jobFilters, page: jobFilters.page + 1 })}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {jobSubTab === 'sources' && (
              <div>
                {/* 2.7-A & 2.7-G: INGESTION MONITORING PANEL */}
                <div className="job-panel">
                  <div className="job-panel-head">
                    <span className="job-panel-icon"><IconGauge /></span>
                    <h2 className="job-panel-title">Job Ingestion Monitor & Health</h2>
                  </div>
                  <p className="job-panel-desc">
                    Track status, synchronization timestamps, health, and throughput metrics across all automated connectors.
                  </p>

                  {ingestionMonitor ? (
                    <div>
                      {/* Health Matrix Table */}
                      <div className="data-table-container job-health-table-wrap">
                        <table className="data-table job-table">
                          <thead>
                            <tr>
                              <th>Source</th>
                              <th>Health Status</th>
                              <th>Last Synced</th>
                              <th>New Jobs (Today)</th>
                              <th>Failures</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ingestionMonitor.sources.map(s => {
                              const meta = JOB_HEALTH_META[s.status] || JOB_HEALTH_META.unknown;
                              const HealthIcon = meta.icon;
                              return (
                                <tr key={s.name}>
                                  <td className="job-cell-strong">{s.name}</td>
                                  <td>
                                    <span className={`badge ${meta.variant} job-health-badge`}>
                                      <HealthIcon /> {meta.label}
                                    </span>
                                  </td>
                                  <td className="job-cell-sub">
                                    {s.lastSync ? new Date(s.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                  </td>
                                  <td className="job-cell-strong">{s.newJobs || '—'}</td>
                                  <td className={s.failed > 0 ? 'job-cell-danger' : 'job-cell-sub'}>{s.failed || 0}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Today's Ingestion Metrics Summary */}
                      <h3 className="job-subheading">Today&apos;s Ingestion</h3>
                      <div className="job-metric-strip">
                        <div className="job-metric-tile">
                          <div className="job-metric-label">Messages Received</div>
                          <div className="job-metric-value">{ingestionMonitor.stats.messagesReceived}</div>
                        </div>
                        <div className="job-metric-tile">
                          <div className="job-metric-label">Jobs Detected</div>
                          <div className="job-metric-value">{ingestionMonitor.stats.jobsDetected}</div>
                        </div>
                        <div className="job-metric-tile">
                          <div className="job-metric-label">Jobs Created</div>
                          <div className="job-metric-value">{ingestionMonitor.stats.jobsCreated}</div>
                        </div>
                        <div className="job-metric-tile">
                          <div className="job-metric-label">Duplicates</div>
                          <div className="job-metric-value">{ingestionMonitor.stats.duplicates}</div>
                        </div>
                        <div className="job-metric-tile">
                          <div className="job-metric-label">Pending Review</div>
                          <div className="job-metric-value job-metric-value--accent">{ingestionMonitor.stats.pendingReview}</div>
                        </div>
                        <div className="job-metric-tile">
                          <div className="job-metric-label">Failed</div>
                          <div className={`job-metric-value ${ingestionMonitor.stats.failed > 0 ? 'job-metric-value--danger' : 'job-metric-value--muted'}`}>{ingestionMonitor.stats.failed}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="job-empty">Loading ingestion status metrics...</div>
                  )}
                </div>

                <div className="job-panel">
                  <div className="job-panel-head">
                    <span className="job-panel-icon"><IconGlobe /></span>
                    <h2 className="job-panel-title">Job Sources: Adzuna API Integration</h2>
                  </div>
                  <p className="job-panel-desc">
                    Adzuna is connected in your backend configurations. Run manual sync below or let the scheduled background runner fetch jobs automatically every 4 hours.
                  </p>

                  <div className="job-integration-card">
                    <div className="job-integration-info">
                      <div className="job-integration-label">Adzuna Status</div>
                      <div className="job-integration-status job-integration-status--connected">
                        <IconCheckCircle /> Active / Configured
                      </div>
                    </div>
                    <button
                      className="job-btn job-btn--primary"
                      onClick={async () => {
                        try {
                          const summary = await api.syncAdzunaJobs();
                          alert(`Adzuna Sync Complete!\nProcessed: ${summary.processed}\nCreated: ${summary.created}\nUpdated: ${summary.updated}\nDuplicates: ${summary.duplicate}\nFailed: ${summary.failed}`);
                          loadJobs();
                          loadIngestionMonitor();
                        } catch (err) {
                          alert(err.message);
                        }
                      }}
                    >
                      <IconRefresh />
                      Sync Adzuna Jobs Now
                    </button>
                  </div>
                </div>

                <div className="job-panel">
                  <div className="job-panel-head">
                    <span className="job-panel-icon"><IconMail /></span>
                    <h2 className="job-panel-title">LinkedIn Job Alerts</h2>
                  </div>
                  <p className="job-panel-desc">
                    Connect Gmail to fetch and parse job listings from LinkedIn alert emails under the <strong>CareerGraph/LinkedInJobs</strong> label.
                  </p>

                  <div className="job-integration-card">
                    {gmailStatus?.connected ? (
                      <>
                        <div className="job-integration-info">
                          {gmailStatus.status === 'expired' ? (
                            <div className="job-integration-status job-integration-status--warning">
                              <IconClockAlert /> Connection expired: {gmailStatus.email}
                            </div>
                          ) : (
                            <div className="job-integration-status job-integration-status--connected">
                              <IconCheckCircle /> Connected: {gmailStatus.email}
                            </div>
                          )}
                          <div className="job-integration-meta">
                            Label: CareerGraph/LinkedInJobs &bull; Last Sync: {gmailStatus.lastSyncAt ? new Date(gmailStatus.lastSyncAt).toLocaleString() : 'Never'}
                          </div>
                        </div>
                        <div className="job-integration-actions">
                          {gmailStatus.status === 'expired' ? (
                            <button className="job-btn job-btn--primary" onClick={handleConnectGmail}>
                              <IconPlug />
                              Reconnect Gmail
                            </button>
                          ) : (
                            <button
                              className="job-btn job-btn--primary"
                              disabled={gmailSyncing}
                              onClick={async () => {
                                setGmailSyncing(true);
                                try {
                                  const res = await api.request('/integrations/gmail/jobs/sync', { method: 'POST' });
                                  alert(`Gmail Sync Complete!\nEmails Processed: ${res.data.emailsProcessed}\nJobs Found: ${res.data.jobsFound}\nCreated: ${res.data.created}\nUpdated: ${res.data.updated}\nDuplicates: ${res.data.duplicates}\nFailed: ${res.data.failed}`);
                                  loadGmailStatus();
                                  loadJobs();
                                  loadIngestionMonitor();
                                } catch (err) {
                                  if (err.code === 'GMAIL_REAUTH_REQUIRED') {
                                    loadGmailStatus();
                                  }
                                  alert(err.message);
                                } finally {
                                  setGmailSyncing(false);
                                }
                              }}
                            >
                              <IconRefresh />
                              {gmailSyncing ? 'Syncing...' : 'Sync Now'}
                            </button>
                          )}
                          <button
                            className="job-icon-btn job-icon-btn--danger"
                            aria-label="Disconnect Gmail"
                            title="Disconnect"
                            onClick={async () => {
                              if (confirm('Disconnect Gmail integration?')) {
                                try {
                                  await api.request('/integrations/gmail/disconnect', { method: 'POST' });
                                  loadGmailStatus();
                                  loadIngestionMonitor();
                                } catch (err) {
                                  alert(err.message);
                                }
                              }
                            }}
                          >
                            <IconX />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="job-integration-status job-integration-status--off">
                          <IconXCircle /> Not Connected
                        </span>
                        <button
                          className="job-btn job-btn--primary"
                          onClick={handleConnectGmail}
                        >
                          <IconPlug />
                          Connect Gmail
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="job-panel">
                  <div className="job-panel-head">
                    <span className="job-panel-icon"><IconTelegram /></span>
                    <h2 className="job-panel-title">Telegram Job Tracker</h2>
                  </div>
                  <p className="job-panel-desc">
                    Connect your Telegram account to CareerGraph to manually forward or copy-paste job postings directly into your private bot chat.
                  </p>

                  <div className="job-integration-card">
                    {telegramStatus?.connected ? (
                      <>
                        <div className="job-integration-info">
                          <div className="job-integration-status job-integration-status--connected">
                            <IconCheckCircle /> Connected: @{telegramStatus.telegramUsername || telegramStatus.telegramUserId}
                          </div>
                          <div className="job-integration-meta">
                            Bot: @{telegramStatus.botUsername} &bull; Linked: {new Date(telegramStatus.linkedAt).toLocaleDateString()}
                          </div>
                          <div className="job-integration-stats">
                            <div><strong>{telegramStatus.stats.received}</strong> <span>Received</span></div>
                            <div><strong>{telegramStatus.stats.jobsCreated}</strong> <span>Created</span></div>
                            <div><strong>{telegramStatus.stats.duplicates}</strong> <span>Duplicates</span></div>
                            <div><strong>{telegramStatus.stats.pendingReview}</strong> <span>Pending Review</span></div>
                          </div>
                        </div>
                        <button
                          className="job-icon-btn job-icon-btn--danger"
                          aria-label="Disconnect Telegram"
                          title="Disconnect"
                          onClick={async () => {
                            if (confirm('Disconnect Telegram integration?')) {
                              try {
                                await api.request('/integrations/telegram/disconnect', { method: 'POST' });
                                loadTelegramStatus();
                                loadIngestionMonitor();
                              } catch (err) {
                                alert(err.message);
                              }
                            }
                          }}
                        >
                          <IconX />
                        </button>
                      </>
                    ) : (
                      <div className="job-integration-connect">
                        <div className="job-integration-connect-row">
                          <span className="job-integration-status job-integration-status--off">
                            <IconXCircle /> Not Connected
                          </span>
                          <button
                            className="job-btn job-btn--primary"
                            onClick={generateTelegramCode}
                          >
                            <IconPlug />
                            Generate Linking Code
                          </button>
                        </div>
                        {telegramLinkingCode && (
                          <div className="job-linking-code-box">
                            <p>
                              1. Open Telegram and search for <strong>@{telegramStatus?.botUsername || 'CareerGraphJobBot'}</strong>
                            </p>
                            <p>
                              2. Send the command:
                            </p>
                            <div className="job-linking-code">
                              /start {telegramLinkingCode}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2.7-I: USER AUTOMATION PREFERENCES PANEL */}
                <div className="job-panel">
                  <div className="job-panel-head">
                    <span className="job-panel-icon"><IconSliders /></span>
                    <h2 className="job-panel-title">Job Discovery Automation Preferences</h2>
                  </div>
                  <p className="job-panel-desc">
                    Configure automatic notifications, filtering rules, and quality thresholds for new job matches.
                  </p>

                  <div className="job-pref-box">
                    <div className="job-pref-list">
                      <label className="job-pref-item">
                        <input
                          type="checkbox"
                          checked={preferences.notificationsEnabled}
                          onChange={(e) => savePreferences({ ...preferences, notificationsEnabled: e.target.checked })}
                        />
                        <span className="job-pref-item-strong">Enable Real-time Job Notifications</span>
                      </label>

                      {preferences.notificationsEnabled && (
                        <div className="job-pref-sublist">
                          <label className="job-pref-item">
                            <input
                              type="checkbox"
                              checked={preferences.notifyHighlyRelevant}
                              onChange={(e) => savePreferences({ ...preferences, notifyHighlyRelevant: e.target.checked })}
                            />
                            <span>Notify for highly relevant jobs (matching score &ge; threshold)</span>
                          </label>

                          <label className="job-pref-item">
                            <input
                              type="checkbox"
                              checked={preferences.notifyStrongReferral}
                              onChange={(e) => savePreferences({ ...preferences, notifyStrongReferral: e.target.checked })}
                            />
                            <span>Notify when strong referral exists at the company</span>
                          </label>

                          <label className="job-pref-item">
                            <input
                              type="checkbox"
                              checked={preferences.notifyTargetCompany}
                              onChange={(e) => savePreferences({ ...preferences, notifyTargetCompany: e.target.checked })}
                            />
                            <span>Notify for target companies list matching roles</span>
                          </label>

                          <label className="job-pref-item">
                            <input
                              type="checkbox"
                              checked={preferences.dailyDigestEnabled}
                              onChange={(e) => savePreferences({ ...preferences, dailyDigestEnabled: e.target.checked })}
                            />
                            <span>Include new jobs in CareerGraph Daily Digest email</span>
                          </label>

                          <label className="job-pref-item">
                            <input
                              type="checkbox"
                              checked={preferences.notifyLowRelevance}
                              onChange={(e) => savePreferences({ ...preferences, notifyLowRelevance: e.target.checked })}
                            />
                            <span>Notify for low-relevance jobs (score &lt; 40)</span>
                          </label>

                          <div className="job-pref-slider-block">
                            <label className="form-label">
                              Minimum Match Score for Notification: <strong>{preferences.minimumMatchScore || 80}</strong>
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              className="job-pref-slider"
                              value={preferences.minimumMatchScore || 80}
                              onChange={(e) => setPreferences({ ...preferences, minimumMatchScore: parseInt(e.target.value) })}
                              onMouseUp={(e) => savePreferences({ ...preferences, minimumMatchScore: parseInt(e.target.value) })}
                              onTouchEnd={(e) => savePreferences({ ...preferences, minimumMatchScore: parseInt(e.target.value) })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="job-panel">
                  <div className="job-panel-head">
                    <span className="job-panel-icon"><IconSearch /></span>
                    <h2 className="job-panel-title">Job Search Profiles</h2>
                  </div>
                  <p className="job-panel-desc">
                    Configure search queries. The Adzuna sync service will run queries for each active profile to discover relevant roles.
                  </p>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const data = Object.fromEntries(formData.entries());
                    try {
                      await api.createJobSearchProfile({
                        name: data.name,
                        keywords: data.keywords || '',
                        location: data.location || '',
                        remotePreference: data.remotePreference || '',
                        experienceLevel: data.experienceLevel || '',
                        employmentType: data.employmentType || '',
                        excludedKeywords: data.excludedKeywords || '',
                        isActive: true
                      });
                      loadSearchProfiles();
                      e.target.reset();
                      alert('Search profile created!');
                    } catch (err) {
                      alert(err.message);
                    }
                  }} className="job-inset-box job-inset-box--form">
                    <h3 className="job-subheading">Add Search Profile</h3>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Profile Name *</label>
                        <input type="text" name="name" className="form-input" placeholder="e.g. React Roles" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Keywords / Query *</label>
                        <input type="text" name="keywords" className="form-input" placeholder="e.g. React, Frontend" required />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Location</label>
                        <input type="text" name="location" className="form-input" placeholder="e.g. San Francisco" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Remote Preference</label>
                        <select name="remotePreference" className="form-input">
                          <option value="">No Preference</option>
                          <option value="remote">Remote Only</option>
                          <option value="hybrid">Hybrid</option>
                          <option value="onsite">Onsite Only</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Excluded Keywords</label>
                        <input type="text" name="excludedKeywords" className="form-input" placeholder="e.g. Senior, Ruby" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Employment Type</label>
                        <select name="employmentType" className="form-input">
                          <option value="">Any Type</option>
                          <option value="full-time">Full-time</option>
                          <option value="part-time">Part-time</option>
                          <option value="contract">Contract</option>
                        </select>
                      </div>
                    </div>

                    <button type="submit" className="job-btn job-btn--primary">Create Profile</button>
                  </form>

                  {/* List of profiles */}
                  <div className="job-profile-list">
                    {searchProfiles.length === 0 ? (
                      <div className="job-empty">No search profiles configured yet. Default parameters matching your Profile targets will be used during sync.</div>
                    ) : (
                      searchProfiles.map(p => (
                        <div key={p.id} className="job-profile-card">
                          <div className="job-profile-info">
                            <div className="job-profile-name">
                              {p.name}
                              <span className={`badge ${p.isActive ? 'badge-success' : 'badge-secondary'}`}>
                                {p.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <div className="job-profile-meta">
                              <strong>Keywords:</strong> {p.keywords} &bull;
                              <strong> Location:</strong> {p.location || 'Anywhere'} &bull;
                              <strong> Remote:</strong> {p.remotePreference || 'Any'}
                            </div>
                            {p.excludedKeywords && (
                              <div className="job-profile-excluded">
                                <strong>Excluded:</strong> {p.excludedKeywords}
                              </div>
                            )}
                          </div>
                          <div className="job-profile-actions">
                            <button
                              className="job-btn job-btn--ghost job-btn--sm"
                              onClick={async () => {
                                try {
                                  await api.updateJobSearchProfile(p.id, { ...p, isActive: !p.isActive });
                                  loadSearchProfiles();
                                } catch (err) {
                                  alert(err.message);
                                }
                              }}
                            >
                              Toggle Status
                            </button>
                            <button
                              className="job-icon-btn job-icon-btn--danger"
                              aria-label="Delete search profile"
                              title="Delete"
                              onClick={async () => {
                                if (confirm('Delete this search profile?')) {
                                  try {
                                    await api.deleteJobSearchProfile(p.id);
                                    loadSearchProfiles();
                                  } catch (err) {
                                    alert(err.message);
                                  }
                                }
                              }}
                            >
                              <IconTrash />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2.7-H: DEDUPLICATION AUDIT LOGS */}
                <div className="job-panel">
                  <div className="job-panel-head">
                    <span className="job-panel-icon"><IconInbox /></span>
                    <h2 className="job-panel-title">Deduplication & Quality Logs</h2>
                  </div>
                  <p className="job-panel-desc">
                    Audit history of automatically rejected duplicate job postings and their match reasons.
                  </p>

                  <div className="job-dedup-box">
                    {deduplicationLogs.length === 0 ? (
                      <div className="job-empty">
                        No duplicates detected yet. Your tracker is completely clean!
                      </div>
                    ) : (
                      <div className="job-dedup-list">
                        {deduplicationLogs.map(l => (
                          <div key={l.id} className="job-dedup-row">
                            <div>
                              <span className="job-cell-strong">{l.duplicateText}</span>
                              <span className="job-dedup-source">
                                via {l.source}
                              </span>
                            </div>
                            <div className="job-dedup-meta">
                              <span className="badge badge-secondary">
                                {l.reason}
                              </span>
                              <span className="job-dedup-time">
                                {new Date(l.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {jobSubTab === 'review' && (
              <div className="job-panel">
                <div className="job-panel-head">
                  <span className="job-panel-icon"><IconInbox /></span>
                  <h2 className="job-panel-title">Incoming Jobs Review Queue</h2>
                </div>
                <p className="job-panel-desc">
                  These jobs were sent from Telegram but could not be parsed with high confidence. Review and edit details below to track them.
                </p>

                {loadingIncoming ? (
                  <div className="job-empty">Loading review queue...</div>
                ) : incomingJobs.filter(j => j.status === 'pending_review').length === 0 ? (
                  <div className="job-empty">No jobs pending review. All caught up!</div>
                ) : (
                  <div className="job-review-list">
                    {incomingJobs.filter(j => j.status === 'pending_review').map(item => (
                      <div key={item.id} className="job-review-card">
                        <div className="job-review-body">
                          <div className="job-review-title-row">
                            <h3>{item.parsedData?.title || 'Unknown Role'}</h3>
                            <span className="badge badge-warning">Pending Review</span>
                          </div>
                          <div className="job-review-meta">
                            Company: <strong>{item.parsedData?.companyName || 'Unknown'}</strong> &bull; Location: {item.parsedData?.location || 'Unknown'}
                          </div>

                          <div className="job-review-raw-box">
                            <div className="job-review-raw-label">Raw Message Text:</div>
                            <pre>
                              {item.rawText}
                            </pre>
                          </div>
                        </div>

                        <div className="job-review-actions">
                          <button
                            className="job-btn job-btn--primary job-btn--sm"
                            onClick={() => setReviewJob(item)}
                          >
                            <IconEdit />
                            Review &amp; Ingest
                          </button>
                          <button
                            className="job-icon-btn job-icon-btn--danger"
                            aria-label="Ignore this job posting"
                            title="Ignore"
                            onClick={async () => {
                              if (confirm('Ignore this job posting?')) {
                                try {
                                  await api.request(`/incoming-jobs/${item.id}/ignore`, { method: 'POST' });
                                  loadIncomingJobs();
                                } catch (err) {
                                  alert(err.message);
                                }
                              }
                            }}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* APPLICATIONS TAB */}
        {activeTab === 'applications' && (
          <div className="app-page">
            <div className="app-header">
              <div>
                <h1 className="app-title">Active Job Applications</h1>
                <p className="app-subtitle">Track every application&apos;s pipeline stage in one place</p>
              </div>
            </div>

            <div className="app-panel app-panel--flush">
              {applications.length === 0 ? (
                <div className="app-empty">No active applications currently tracked. Save a job to start.</div>
              ) : (
                <div className="data-table-container">
                  <table className="data-table app-table">
                    <thead>
                      <tr>
                        <th>Job Role</th>
                        <th>Company</th>
                        <th>Status</th>
                        <th>Applied On</th>
                        <th className="app-table-actions-head">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((app) => (
                        <tr key={app.id}>
                          <td className="app-cell-strong">{app.job?.title}</td>
                          <td>{app.job?.companyName}</td>
                          <td>
                            <span className={`badge ${APPLICATION_STATUS_VARIANT[app.status] || 'badge-secondary'}`}>
                              {(app.status || '').replace('_', ' ')}
                            </span>
                          </td>
                          <td className="app-cell-sub">{app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : 'Not applied yet'}</td>
                          <td>
                            <div className="app-row-actions">
                              <button
                                className="app-icon-btn"
                                aria-label="Update application status"
                                title="Update Status"
                                onClick={() => {
                                  setEditItem(app);
                                  setModal('application');
                                }}
                              >
                                <IconEdit />
                              </button>
                              <button
                                className="app-icon-btn app-icon-btn--danger"
                                aria-label="Delete application"
                                title="Delete"
                                onClick={async () => {
                                  if (confirm('Delete this application? This cannot be undone.')) {
                                    await api.deleteApplication(app.id);
                                    loadApplications();
                                  }
                                }}
                              >
                                <IconTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OUTREACH CRM TAB */}
        {activeTab === 'outreach' && (
          <div className="outreach-page">
            <div className="outreach-header">
              <div>
                <h1 className="outreach-title">Outreach Tracking Logs</h1>
                <p className="outreach-subtitle">Every logged touchpoint with your network, in one timeline</p>
              </div>
            </div>

            <div className="outreach-panel outreach-panel--flush">
              {outreachList.length === 0 ? (
                <div className="outreach-empty">No outreach campaigns logged. Go to Connections CRM to initiate.</div>
              ) : (
                <div className="data-table-container">
                  <table className="data-table outreach-table">
                    <thead>
                      <tr>
                        <th>Connection Name</th>
                        <th>Latest Status</th>
                        <th>Follow Up Date</th>
                        <th>Notes Summary</th>
                        <th className="outreach-table-actions-head">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outreachList.map((o) => (
                        <tr key={o.id}>
                          <td className="outreach-cell-strong">{o.connection?.name || 'Contact'}</td>
                          <td>
                            <span className={`badge ${OUTREACH_STATUS_VARIANT[o.status] || 'badge-secondary'}`}>
                              {(o.status || '').replace('_', ' ')}
                            </span>
                          </td>
                          <td className="outreach-cell-sub">{o.followUpDate || 'None set'}</td>
                          <td className="outreach-cell-sub">{o.notes || 'No outreach comments'}</td>
                          <td>
                            <div className="outreach-row-actions">
                              <button
                                className="outreach-icon-btn"
                                aria-label="Update outreach"
                                title="Update Outreach"
                                onClick={() => {
                                  setEditItem(o);
                                  setModal('outreach_update');
                                }}
                              >
                                <IconEdit />
                              </button>
                              <button
                                className="outreach-icon-btn outreach-icon-btn--danger"
                                aria-label="Delete outreach"
                                title="Delete"
                                onClick={async () => {
                                  if (confirm('Delete this outreach record? This cannot be undone.')) {
                                    await api.deleteOutreach(o.id);
                                    loadOutreach();
                                  }
                                }}
                              >
                                <IconTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI OBSERVABILITY & OPERATIONS TAB */}
        {activeTab === 'ai-ops' && (
          <div className="aiops-page">
            <div className="aiops-header">
              <div>
                <h1 className="aiops-title">AI Observability &amp; Operations</h1>
                <p className="aiops-subtitle">Live provider health, queue throughput, and operator controls</p>
              </div>
              <button className="aiops-btn aiops-btn--primary" onClick={loadAiOps} disabled={loadingAiOps || loadingModels}>
                <IconRefresh />
                {loadingAiOps || loadingModels ? 'Refreshing...' : 'Refresh Health'}
              </button>
            </div>

            {loadingAiOps && !aiOpsData ? (
              <div className="aiops-empty">Loading real-time operational telemetry...</div>
            ) : !aiOpsData ? (
              <div className="aiops-empty">No telemetry data returned. Ensure server is active.</div>
            ) : (
              <div>
                {/* 1. Global System Status Alerts */}
                {aiOpsData.anomalies && aiOpsData.anomalies.length > 0 && (
                  <div className="aiops-anomaly-box">
                    <h3 className="aiops-anomaly-title"><IconAlertTriangle /> Active Operational Anomalies Detected</h3>
                    <ul className="aiops-anomaly-list">
                      {aiOpsData.anomalies.map((anom, idx) => (
                        <li key={idx}>{anom.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 2. Overview Row */}
                <div className="aiops-stat-grid">
                  <div className="aiops-stat-card aiops-stat-card--accent">
                    <span className="aiops-stat-label">AI Health Status</span>
                    <div className="aiops-stat-badge-row">
                      <span className={`badge badge-${aiOpsData.state === 'HEALTHY' ? 'success' : aiOpsData.state === 'DEGRADED' ? 'warning' : 'danger'} aiops-state-badge`}>
                        {aiOpsData.state}
                      </span>
                    </div>
                  </div>
                  <div className="aiops-stat-card">
                    <span className="aiops-stat-label">Active Provider / Model</span>
                    <span className="aiops-stat-value aiops-stat-value--md">
                      {aiOpsData.provider.toUpperCase()} <span className="aiops-stat-value-sub">({aiOpsData.model})</span>
                    </span>
                  </div>
                  <div className="aiops-stat-card">
                    <span className="aiops-stat-label">Latency (P50 / P95)</span>
                    <span className="aiops-stat-value">
                      {aiOpsData.latency?.p50 ? `${(aiOpsData.latency.p50 / 1000).toFixed(2)}s` : '0s'}
                      <span className="aiops-stat-value-sub">
                        / {aiOpsData.latency?.p95 ? `${(aiOpsData.latency.p95 / 1000).toFixed(2)}s` : '0s'}
                      </span>
                    </span>
                  </div>
                  <div className="aiops-stat-card">
                    <span className="aiops-stat-label">AI Response Quality</span>
                    <span className="aiops-stat-value aiops-stat-value--accent">
                      {aiOpsData.averageQuality ? `${Math.round(aiOpsData.averageQuality * 100)}%` : '100%'}
                    </span>
                  </div>
                </div>

                {/* 3. Operational Queue Analytics & Operator Control Console */}
                <div className="aiops-section-head">
                  <span className="aiops-section-icon"><IconGauge /></span>
                  <h2 className="aiops-section-title">Hardened Production Queue Controller</h2>
                </div>

                {aiOpsData.queueLatency && (
                  <div className="aiops-stat-grid">
                    <div className="aiops-stat-card aiops-stat-card--accent">
                      <span className="aiops-stat-label">Avg Queue Wait</span>
                      <span className="aiops-stat-value aiops-stat-value--md">
                        {aiOpsData.queueLatency.averageQueueWait ? `${(aiOpsData.queueLatency.averageQueueWait / 1000).toFixed(2)}s` : '0.00s'}
                      </span>
                    </div>
                    <div className="aiops-stat-card aiops-stat-card--teal">
                      <span className="aiops-stat-label">Avg AI Compute (Ollama)</span>
                      <span className="aiops-stat-value aiops-stat-value--md">
                        {aiOpsData.queueLatency.averageQueueProcessing ? `${(aiOpsData.queueLatency.averageQueueProcessing / 1000).toFixed(2)}s` : '0.00s'}
                      </span>
                    </div>
                    <div className="aiops-stat-card aiops-stat-card--neutral">
                      <span className="aiops-stat-label">Avg Total Job Latency</span>
                      <span className="aiops-stat-value aiops-stat-value--md">
                        {aiOpsData.queueLatency.averageQueueTotal ? `${(aiOpsData.queueLatency.averageQueueTotal / 1000).toFixed(2)}s` : '0.00s'}
                      </span>
                    </div>
                  </div>
                )}

                {adminQueueData ? (
                  <div className="aiops-console-panel">
                    <div className="aiops-console-head">
                      <span className="aiops-section-icon"><IconSliders /></span>
                      <h3>Operator Control Console</h3>
                    </div>
                    <p className="aiops-console-desc">
                      Manage Redis/BullMQ background execution limits, pause queue processors, or trigger failure recoveries.
                    </p>

                    <div className="aiops-console-actions">
                      {adminQueueData.isPaused ? (
                        <button className="aiops-btn aiops-btn--success" onClick={() => handleQueueAction('resume')}>
                          <IconPlay />
                          Resume Queue
                        </button>
                      ) : (
                        <button className="aiops-btn aiops-btn--warning" onClick={() => handleQueueAction('pause')}>
                          <IconPause />
                          Pause Queue
                        </button>
                      )}

                      <button className="aiops-btn aiops-btn--primary" onClick={() => handleQueueAction('retry-all')}>
                        <IconRefresh />
                        Retry Failed Jobs
                      </button>

                      <button className="aiops-btn aiops-btn--danger" onClick={() => handleQueueAction('clean')}>
                        <IconTrash />
                        Clean History
                      </button>
                    </div>

                    <div className="aiops-console-block">
                      <h4>Job Processing Counts</h4>
                      <div className="aiops-count-grid">
                        <div className="aiops-count-tile">
                          <span className="aiops-count-label">Waiting</span>
                          <div className="aiops-count-value">{adminQueueData.counts?.waiting || 0}</div>
                        </div>
                        <div className="aiops-count-tile">
                          <span className="aiops-count-label">Active</span>
                          <div className="aiops-count-value aiops-count-value--warning">{adminQueueData.counts?.active || 0}</div>
                        </div>
                        <div className="aiops-count-tile">
                          <span className="aiops-count-label">Delayed</span>
                          <div className="aiops-count-value">{adminQueueData.counts?.delayed || 0}</div>
                        </div>
                        <div className="aiops-count-tile">
                          <span className="aiops-count-label">Completed</span>
                          <div className="aiops-count-value aiops-count-value--success">{adminQueueData.counts?.completed || 0}</div>
                        </div>
                        <div className="aiops-count-tile">
                          <span className="aiops-count-label">Failed</span>
                          <div className="aiops-count-value aiops-count-value--danger">{adminQueueData.counts?.failed || 0}</div>
                        </div>
                      </div>
                    </div>

                    {adminQueueData.activeWorkers && adminQueueData.activeWorkers.length > 0 && (
                      <div className="aiops-console-block">
                        <h4>Active Worker Node Registry ({adminQueueData.activeWorkers.length})</h4>
                        <div className="data-table-container">
                          <table className="data-table aiops-table">
                            <thead>
                              <tr>
                                <th>Worker Node ID</th>
                                <th>Status</th>
                                <th>Active Jobs</th>
                                <th>Total Processed</th>
                                <th>Total Failed</th>
                                <th>Heartbeat</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminQueueData.activeWorkers.map((wrk) => (
                                <tr key={wrk.workerId}>
                                  <td className="aiops-cell-mono">{wrk.workerId}</td>
                                  <td>
                                    <span className={`badge badge-${wrk.status === 'active' ? 'success' : 'warning'}`}>
                                      {wrk.status}
                                    </span>
                                  </td>
                                  <td>{wrk.activeJobs}</td>
                                  <td>{wrk.processedJobs}</td>
                                  <td className={wrk.failedJobs > 0 ? 'aiops-cell-danger' : ''}>{wrk.failedJobs}</td>
                                  <td className="aiops-cell-sub">
                                    {new Date(wrk.lastHeartbeat).toLocaleTimeString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aiops-locked-panel">
                    <span className="aiops-locked-icon"><IconLock /></span>
                    <p>
                      Operator Control Console requires elevated permissions. Log in with an operator-whitelisted email.
                    </p>
                  </div>
                )}

                {/* 4. Background Job Queue Monitors */}
                <div className="aiops-section-head">
                  <span className="aiops-section-icon"><IconRefresh /></span>
                  <h2 className="aiops-section-title">Background Job Queue Monitors</h2>
                </div>
                <div className="aiops-queue-grid">
                  {Object.entries(aiOpsData.queue?.details || {}).map(([qName, qDetails]) => (
                    <div key={qName} className="aiops-queue-card">
                      <h4 className="aiops-queue-card-title">
                        {qName.replace('_', ' ')} Queue
                      </h4>
                      <div className="aiops-queue-rows">
                        <div className="aiops-queue-row">
                          <span>Pending Items:</span>
                          <span className="aiops-queue-row-value">{qDetails.pending || 0}</span>
                        </div>
                        <div className="aiops-queue-row">
                          <span>Status:</span>
                          <span className={`badge badge-${qDetails.processing ? 'warning' : 'success'}`}>
                            {qDetails.processing ? 'Processing' : 'Idle'}
                          </span>
                        </div>
                        <div className="aiops-queue-row">
                          <span>Accumulated Failures:</span>
                          <span className={qDetails.failed > 0 ? 'aiops-cell-danger' : 'aiops-queue-row-value'}>
                            {qDetails.failed || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 5. Quality SLO Indicators */}
                <div className="aiops-section-head">
                  <span className="aiops-section-icon"><IconBarChart /></span>
                  <h2 className="aiops-section-title">Quality SLO Baselines &amp; Runtime State</h2>
                </div>
                <div className="aiops-panel aiops-panel--flush">
                  <div className="data-table-container">
                    <table className="data-table aiops-table">
                      <thead>
                        <tr>
                          <th>SLO Target Metric</th>
                          <th>Target Value</th>
                          <th>Current Performance</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="aiops-cell-strong">System Availability Rate</td>
                          <td>&gt; 99.0%</td>
                          <td>{aiOpsData.available ? '100%' : '0%'}</td>
                          <td><span className={`badge badge-${aiOpsData.available ? 'success' : 'danger'}`}>{aiOpsData.available ? 'PASSING' : 'FAILING'}</span></td>
                        </tr>
                        <tr>
                          <td className="aiops-cell-strong">Success rate thresholds</td>
                          <td>&gt; 90.0%</td>
                          <td>{aiOpsData.metrics?.requests_total > 0 ? `${Math.round((aiOpsData.metrics.requests_success / aiOpsData.metrics.requests_total) * 100)}%` : '100%'}</td>
                          <td><span className="badge badge-success">PASSING</span></td>
                        </tr>
                        <tr>
                          <td className="aiops-cell-strong">P95 Generation Latency</td>
                          <td>&lt; 10s</td>
                          <td>{aiOpsData.latency?.p95 ? `${(aiOpsData.latency.p95 / 1000).toFixed(2)}s` : '0s'}</td>
                          <td><span className={`badge badge-${(aiOpsData.latency?.p95 || 0) < 10000 ? 'success' : 'warning'}`}>{(aiOpsData.latency?.p95 || 0) < 10000 ? 'PASSING' : 'WARNING'}</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 6. MLflow experiment tracking status (Phase 4F) -- deep
                    analysis stays in the MLflow UI itself; this is just a
                    compact "is it up, what ran last" card. */}
                <div className="aiops-section-head">
                  <span className="aiops-section-icon"><IconBarChart /></span>
                  <h2 className="aiops-section-title">MLflow Experiment Tracking</h2>
                </div>
                <div className="aiops-stat-grid">
                  <div className="aiops-stat-card aiops-stat-card--accent">
                    <span className="aiops-stat-label">MLflow</span>
                    <div className="aiops-stat-badge-row">
                      <span className={`badge badge-${aiOpsData.mlflow?.status === 'connected' ? 'success' : aiOpsData.mlflow?.status === 'disabled' ? 'secondary' : 'danger'} aiops-state-badge`}>
                        {aiOpsData.mlflow?.status === 'connected' ? 'Connected' : aiOpsData.mlflow?.status === 'disabled' ? 'Disabled' : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                  <div className="aiops-stat-card">
                    <span className="aiops-stat-label">Last Experiment</span>
                    <span className="aiops-stat-value aiops-stat-value--md">{aiOpsData.mlflow?.lastExperiment || '—'}</span>
                  </div>
                  <div className="aiops-stat-card">
                    <span className="aiops-stat-label">Last Run</span>
                    <span className="aiops-stat-value aiops-stat-value--md">{aiOpsData.mlflow?.lastRun ? aiOpsData.mlflow.lastRun.slice(0, 12) : '—'}</span>
                    <span className="aiops-stat-value-sub">{aiOpsData.mlflow?.lastRunStatus || ''}</span>
                  </div>
                  <div className="aiops-stat-card">
                    <span className="aiops-stat-label">Last Run Model</span>
                    <span className="aiops-stat-value aiops-stat-value--md">{aiOpsData.mlflow?.lastRunModel || '—'}</span>
                  </div>
                </div>

                {/* 7. Model Registry & Lifecycle (Phase 4E) */}
                <div className="aiops-section-head">
                  <span className="aiops-section-icon"><IconSliders /></span>
                  <h2 className="aiops-section-title">Model Registry &amp; Lifecycle</h2>
                </div>
                {modelsData ? (
                  <div className="aiops-panel aiops-panel--flush">
                    <div className="data-table-container">
                      <table className="data-table aiops-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Version</th>
                            <th>Type</th>
                            <th>Provider</th>
                            <th>Status</th>
                            <th>Latest Eval</th>
                            <th>Assigned Envs</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modelsData.length === 0 ? (
                            <tr><td colSpan={8} className="aiops-cell-sub">No models registered yet. Use `npm run models:register -- --seed-defaults` to register current production models.</td></tr>
                          ) : (
                            modelsData.map((model) => (
                              <tr key={model.id}>
                                <td className="aiops-cell-strong">{model.name}</td>
                                <td>{model.version}</td>
                                <td>{model.modelType}</td>
                                <td>{model.provider}</td>
                                <td>
                                  <span className={`badge badge-${model.status === 'production' ? 'success' : model.status === 'archived' ? 'danger' : model.status === 'deprecated' ? 'warning' : 'secondary'}`}>
                                    {model.status}
                                  </span>
                                </td>
                                <td>
                                  {model.latestEvaluation ? (
                                    <span className={`badge badge-${model.latestEvaluation.status === 'passed' ? 'success' : 'danger'}`}>
                                      {model.latestEvaluation.status} {model.latestEvaluation.overallScore != null ? `(${Math.round(model.latestEvaluation.overallScore * 100)}%)` : ''}
                                    </span>
                                  ) : (
                                    <span className="aiops-cell-sub">No evaluation</span>
                                  )}
                                </td>
                                <td className="aiops-cell-sub">{model.currentEnvironments?.length ? model.currentEnvironments.join(', ') : '—'}</td>
                                <td>
                                  <div className="aiops-console-actions aiops-console-actions--compact">
                                    <button className="aiops-btn aiops-btn--sm aiops-btn--neutral" onClick={() => handleModelEvaluate(model)}>Evaluate</button>
                                    <button className="aiops-btn aiops-btn--sm aiops-btn--primary" onClick={() => handleModelPromote(model)}>Promote</button>
                                    <button className="aiops-btn aiops-btn--sm aiops-btn--warning" onClick={() => handleModelRollback(model)}>Rollback</button>
                                    <button className="aiops-btn aiops-btn--sm aiops-btn--danger" onClick={() => handleModelArchive(model)}>Archive</button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="aiops-locked-panel">
                    <span className="aiops-locked-icon"><IconLock /></span>
                    <p>
                      Model registry administration requires elevated permissions. Log in with an operator-whitelisted email.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CONNECTION DETAIL TAB */}
        {activeTab === 'connection-detail' && (
          <div>
            <button className="conn-back-btn" onClick={() => setActiveTab('connections')}>
              <IconArrowLeft />
              Back to Connections
            </button>

            {loadingDetail && <div className="conn-empty">Loading connection details...</div>}
            {detailError && <div className="conn-empty conn-empty--error">{detailError}</div>}

            {!loadingDetail && !detailError && connectionDetail && (
              <div>
                <div className="conn-detail-grid">

                  {/* Left Column */}
                  <div className="conn-detail-col">

                    {/* PERSON Profile Panel */}
                    <div className="conn-panel">
                      <div className="conn-detail-header">
                        <span className="conn-avatar conn-avatar--lg">{getInitials(connectionDetail.name)}</span>
                        <div className="conn-detail-header-info">
                          <h1 className="conn-title">{connectionDetail.name}</h1>
                          <p className="conn-detail-headline-text">{connectionDetail.title || 'No Title'}</p>
                          <p className="conn-subtitle">{connectionDetail.company || 'Unknown Company'}</p>
                        </div>
                        {connectionDetail.profileUrl && (
                          <a
                            href={connectionDetail.profileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="conn-btn conn-btn--ghost"
                          >
                            LinkedIn ↗
                          </a>
                        )}
                      </div>

                      <div className="conn-detail-actions">
                        <button
                          className="conn-btn conn-btn--primary"
                          onClick={() => {
                            setEditItem(connectionDetail);
                            setModal('connection');
                          }}
                        >
                          <IconEdit />
                          Edit Connection
                        </button>
                        <button
                          className="conn-btn conn-btn--ghost"
                          onClick={() => {
                            setEditItem(connectionDetail);
                            setModal('outreach');
                          }}
                        >
                          <IconSend />
                          Log Outreach
                        </button>
                      </div>
                    </div>

                    {/* LinkedIn PDF Enrichment Panel */}
                    <div className="conn-panel">
                      <div className="conn-panel-head">
                        <span className="conn-panel-icon"><IconFile /></span>
                        <h2 className="conn-panel-title">Enrich via LinkedIn PDF</h2>
                      </div>
                      <p className="conn-panel-desc">
                        Upload a LinkedIn profile PDF to automatically extract and enrich headline, summary, links, and top skills for {connectionDetail.name}.
                      </p>
                      <label className="conn-detail-upload-box">
                        <IconUpload />
                        <span>Click to choose a PDF file</span>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            setEnrichmentLoading(true);
                            setEnrichmentError(null);
                            setModal('linkedin_pdf');
                            try {
                              const objectUrl = URL.createObjectURL(file);
                              setPdfObjectURL(objectUrl);
                              const res = await api.importLinkedInPdf(file);
                              setEnrichmentPreview(res.data);
                            } catch (err) {
                              setEnrichmentError(err.message || 'Failed to parse PDF profile.');
                            } finally {
                              setEnrichmentLoading(false);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {/* PROFESSIONAL Information */}
                    <div className="conn-panel">
                      <div className="conn-panel-head">
                        <span className="conn-panel-icon"><IconBriefcase /></span>
                        <h2 className="conn-panel-title">Professional Profile</h2>
                      </div>
                      <div className="conn-detail-field-grid">
                        <div className="conn-detail-field">
                          <div className="conn-detail-field-label">Company</div>
                          <div className="conn-detail-field-value">{connectionDetail.company || 'Not Specified'}</div>
                        </div>
                        <div className="conn-detail-field">
                          <div className="conn-detail-field-label">Position</div>
                          <div className="conn-detail-field-value">{connectionDetail.title || 'Not Specified'}</div>
                        </div>
                        <div className="conn-detail-field">
                          <div className="conn-detail-field-label">Location</div>
                          <div className="conn-detail-field-value">
                            <IconMapPin /> {connectionDetail.location || 'Not Specified'}
                          </div>
                        </div>
                        <div className="conn-detail-field">
                          <div className="conn-detail-field-label">Email</div>
                          <div className="conn-detail-field-value">{connectionDetail.email || 'Not Specified'}</div>
                        </div>
                        <div className="conn-detail-field">
                          <div className="conn-detail-field-label">Connected Since</div>
                          <div className="conn-detail-field-value">
                            {connectionDetail.connectedDate ? new Date(connectionDetail.connectedDate).toLocaleDateString() : 'Not Specified'}
                          </div>
                        </div>
                        <div className="conn-detail-field">
                          <div className="conn-detail-field-label">Seniority Level (Derived)</div>
                          <div className="conn-detail-field-value conn-detail-field-value--accent">
                            {connectionDetail.seniorityLevel || 'Mid'}
                          </div>
                        </div>
                        <div className="conn-detail-field">
                          <div className="conn-detail-field-label">Role Category (Derived)</div>
                          <div className="conn-detail-field-value conn-detail-field-value--accent">
                            {connectionDetail.roleCategory || 'Engineering'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ENRICHED PROFILE INFORMATION */}
                    {(connectionDetail.headline || connectionDetail.profileSummary || (connectionDetail.skills && connectionDetail.skills.length > 0) || (connectionDetail.externalLinks && connectionDetail.externalLinks.length > 0)) && (
                      <div className="conn-panel conn-panel--intel">
                        <div className="conn-panel-head">
                          <span className="conn-panel-icon conn-panel-icon--success"><IconStar /></span>
                          <h2 className="conn-panel-title">Enriched LinkedIn Profile Intel</h2>
                        </div>

                        {connectionDetail.headline && (
                          <div className="conn-intel-block">
                            <div className="conn-intel-label">Headline</div>
                            <div className="conn-intel-headline">{connectionDetail.headline}</div>
                          </div>
                        )}

                        {connectionDetail.profileSummary && (
                          <div className="conn-intel-block">
                            <div className="conn-intel-label">Profile Summary</div>
                            <div className="conn-intel-summary">{connectionDetail.profileSummary}</div>
                          </div>
                        )}

                        {connectionDetail.skills && connectionDetail.skills.length > 0 && (
                          <div className="conn-intel-block">
                            <div className="conn-intel-label">Extracted Skills</div>
                            <div className="tags-list">
                              {connectionDetail.skills.map(s => (
                                <span key={s} className="badge badge-success">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {connectionDetail.externalLinks && connectionDetail.externalLinks.length > 0 && (
                          <div className="conn-intel-block">
                            <div className="conn-intel-label">Profile Links</div>
                            <div className="conn-intel-links">
                              {connectionDetail.externalLinks.map(link => (
                                <a key={link} href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer">
                                  {link}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {connectionDetail.languages && connectionDetail.languages.length > 0 && (
                          <div className="conn-intel-block">
                            <div className="conn-intel-label">Languages</div>
                            <div className="tags-list">
                              {connectionDetail.languages.map(l => (
                                <span key={l} className="badge badge-info">{l}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {connectionDetail.certifications && connectionDetail.certifications.length > 0 && (
                          <div className="conn-intel-block">
                            <div className="conn-intel-label">Certifications</div>
                            <div className="tags-list">
                              {connectionDetail.certifications.map(c => (
                                <span key={c} className="badge badge-secondary">{c}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {connectionDetail.projects && connectionDetail.projects.length > 0 && (
                          <div className="conn-intel-block">
                            <div className="conn-intel-label">Projects</div>
                            <div className="conn-project-list">
                              {connectionDetail.projects.map(p => (
                                <div key={p} className="conn-project-item">{p}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {connectionDetail.experience && connectionDetail.experience.length > 0 && (
                          <div className="conn-intel-block conn-intel-block--divider">
                            <div className="conn-intel-label">Experience Timeline</div>
                            <div className="conn-mini-timeline">
                              {connectionDetail.experience.map((exp, idx) => (
                                <div key={idx} className="conn-mini-timeline-item conn-mini-timeline-item--primary">
                                  <div className="conn-mini-timeline-title">{exp.title}</div>
                                  <div className="conn-mini-timeline-org">{exp.company}</div>
                                  <div className="conn-mini-timeline-meta">{exp.dateRange} {exp.location && `| ${exp.location}`}</div>
                                  {exp.description && (
                                    <div className="conn-mini-timeline-desc">
                                      {exp.description}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {connectionDetail.education && connectionDetail.education.length > 0 && (
                          <div className="conn-intel-block conn-intel-block--divider">
                            <div className="conn-intel-label">Education Milestones</div>
                            <div className="conn-mini-timeline">
                              {connectionDetail.education.map((edu, idx) => (
                                <div key={idx} className="conn-mini-timeline-item conn-mini-timeline-item--info">
                                  <div className="conn-mini-timeline-title">{edu.institution}</div>
                                  <div className="conn-mini-timeline-org conn-mini-timeline-org--info">
                                    {edu.degree} {edu.field && ` - ${edu.field}`}
                                  </div>
                                  {(edu.startYear || edu.endYear) && (
                                    <div className="conn-mini-timeline-meta">
                                      {edu.startYear} - {edu.endYear || 'Present'}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {connectionDetail.profilePdfKey && (
                          <div className="conn-intel-block conn-intel-block--divider">
                            <button
                              type="button"
                              className="conn-btn conn-btn--ghost"
                              onClick={() => setShowOriginalPdf(!showOriginalPdf)}
                            >
                              <IconFile />
                              {showOriginalPdf ? 'Hide LinkedIn PDF' : 'View Original LinkedIn PDF'}
                            </button>
                            {showOriginalPdf && (
                              <div className="conn-pdf-frame-wrap">
                                <iframe
                                  src={api.getConnectionPdfUrl(connectionDetail.id)}
                                  width="100%"
                                  height="500px"
                                  style={{ border: 'none', borderRadius: '6px', background: '#fff' }}
                                ></iframe>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                  </div>

                  {/* Right Column */}
                  <div className="conn-detail-col">

                    {/* RELATIONSHIP Status & Strength */}
                    <div className="conn-panel">
                      <div className="conn-panel-head">
                        <span className="conn-panel-icon"><IconUsers /></span>
                        <h2 className="conn-panel-title">Relationship CRM</h2>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Relationship Status</label>
                        <select
                          className="form-input"
                          value={connectionDetail.relationshipStatus || 'not_contacted'}
                          onChange={async (e) => {
                            try {
                              await api.request(`/connections/${activeConnectionId}`, {
                                method: 'PUT',
                                body: {
                                  name: connectionDetail.name,
                                  relationshipStatus: e.target.value
                                }
                              });
                              loadConnectionDetail(activeConnectionId);
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                        >
                          <option value="not_contacted">Not Contacted</option>
                          <option value="researching">Researching</option>
                          <option value="contacted">Contacted</option>
                          <option value="replied">Replied</option>
                          <option value="conversation">Conversation</option>
                          <option value="referral_requested">Referral Requested</option>
                          <option value="referral_received">Referral Received</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Relationship Strength</label>
                        <select
                          className="form-input"
                          value={connectionDetail.relationshipStrength || 'cold'}
                          onChange={async (e) => {
                            try {
                              await api.request(`/connections/${activeConnectionId}`, {
                                method: 'PUT',
                                body: {
                                  name: connectionDetail.name,
                                  relationshipStrength: e.target.value
                                }
                              });
                              loadConnectionDetail(activeConnectionId);
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                        >
                          <option value="cold">Cold</option>
                          <option value="warm">Warm</option>
                          <option value="strong">Strong</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">CRM Priority</label>
                        <select
                          className="form-input"
                          value={connectionDetail.priority || 'medium'}
                          onChange={async (e) => {
                            try {
                              await api.request(`/connections/${activeConnectionId}`, {
                                method: 'PUT',
                                body: {
                                  name: connectionDetail.name,
                                  priority: e.target.value
                                }
                              });
                              loadConnectionDetail(activeConnectionId);
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Next Follow-up Date</label>
                        <input
                          type="date"
                          className="form-input"
                          value={connectionDetail.nextFollowUpDate || ''}
                          onChange={async (e) => {
                            try {
                              await api.request(`/connections/${activeConnectionId}`, {
                                method: 'PUT',
                                body: {
                                  name: connectionDetail.name,
                                  nextFollowUpDate: e.target.value || null
                                }
                              });
                              loadConnectionDetail(activeConnectionId);
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                        />
                        {connectionDetail.nextFollowUpDate && (
                          <button
                            className="conn-btn conn-btn--ghost conn-btn--sm conn-btn--block"
                            style={{ marginTop: '8px' }}
                            onClick={async () => {
                              try {
                                await api.request(`/connections/${activeConnectionId}`, {
                                  method: 'PUT',
                                  body: {
                                    name: connectionDetail.name,
                                    nextFollowUpDate: null
                                  }
                                });
                                loadConnectionDetail(activeConnectionId);
                              } catch (err) {
                                alert(err.message);
                              }
                            }}
                          >
                            Clear Follow-up
                          </button>
                        )}
                      </div>
                    </div>

                    {/* INTELLIGENCE Scores */}
                    <div className="conn-panel">
                      <div className="conn-panel-head">
                        <span className="conn-panel-icon"><IconBarChart /></span>
                        <h2 className="conn-panel-title">Network Intelligence</h2>
                      </div>
                      <div className="conn-detail-score-list">
                        <div className="conn-detail-score-row">
                          <span>Connection Score</span>
                          <span className="badge badge-success conn-detail-score-badge">
                            {connectionDetail.connectionScore || 0} / 100
                          </span>
                        </div>
                        <div className="conn-detail-score-row">
                          <span>Profile Completeness</span>
                          <span className="badge badge-info conn-detail-score-badge">
                            {connectionDetail.profileCompleteness || 0}%
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>

                {/* TAGS SECTION */}
                <div className="conn-panel">
                  <div className="conn-panel-head">
                    <h2 className="conn-panel-title">Tags / Labels</h2>
                  </div>
                  <div className="conn-tag-row">
                    {connectionDetail.tags && connectionDetail.tags.length > 0 ? (
                      connectionDetail.tags.map((tag) => (
                        <span key={tag} className="conn-tag">
                          {tag}
                          <button
                            className="conn-tag-remove"
                            aria-label={`Remove tag ${tag}`}
                            onClick={() => handleRemoveTag(tag)}
                          >
                            <IconX />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="conn-tag-empty">No tags added yet.</span>
                    )}

                    <div className="conn-tag-add">
                      <input
                        type="text"
                        placeholder="New tag..."
                        value={newTagText}
                        onChange={(e) => setNewTagText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddTag(newTagText);
                          }
                        }}
                      />
                      <button
                        className="conn-btn conn-btn--primary conn-btn--sm"
                        onClick={() => handleAddTag(newTagText)}
                      >
                        Add Tag
                      </button>
                    </div>
                  </div>
                </div>

                {/* NOTES SECTION */}
                <div className="conn-panel">
                  <div className="conn-panel-head">
                    <span className="conn-panel-icon"><IconInbox /></span>
                    <h2 className="conn-panel-title">Relationship & Interaction Notes</h2>
                  </div>

                  <form onSubmit={handleAddNote} className="conn-note-form">
                    <textarea
                      className="form-input"
                      rows="3"
                      placeholder="Log a new meeting note, update, context details..."
                      required
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                    />
                    <button type="submit" className="conn-btn conn-btn--primary">Add Note</button>
                  </form>

                  <div className="conn-note-list">
                    {connectionDetail.notes && connectionDetail.notes.length > 0 ? (
                      connectionDetail.notes.map((note) => (
                        <div key={note.id} className="conn-note-card">
                          <p className="conn-note-content">{note.content}</p>
                          <div className="conn-note-timestamp">
                            {new Date(note.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="conn-empty">No notes recorded yet. Add one above to keep track of interactions.</div>
                    )}
                  </div>
                </div>

                {/* OUTREACH HISTORY */}
                <div className="conn-panel">
                  <div className="conn-panel-head">
                    <span className="conn-panel-icon"><IconSend /></span>
                    <h2 className="conn-panel-title">Outreach & History Logs</h2>
                  </div>

                  {connectionDetail.outreach && connectionDetail.outreach.length > 0 ? (
                    <div className="timeline conn-timeline">
                      {connectionDetail.outreach.map((event) => (
                        <div className="timeline-event conn-timeline-event" key={event.id}>
                          <div className="conn-timeline-status">
                            {event.status.replace('_', ' ')}
                          </div>
                          <div className="conn-timeline-date">
                            {new Date(event.occurredAt).toLocaleDateString()}
                          </div>
                          {event.notes && <p className="conn-timeline-notes">{event.notes}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="conn-empty">No outreach campaign history recorded yet.</div>
                  )}
                </div>

                {/* RELEVANT OPPORTUNITIES */}
                <div className="conn-panel">
                  <div className="conn-panel-head">
                    <span className="conn-panel-icon"><IconBriefcase /></span>
                    <h2 className="conn-panel-title">Relevant Opportunities at {connectionDetail.company || 'target company'}</h2>
                  </div>

                  {connectionDetail.referralOpportunities && connectionDetail.referralOpportunities.length > 0 ? (
                    <div className="conn-list">
                      {connectionDetail.referralOpportunities.map((opp) => (
                        <div className="conn-list-row conn-list-row--static" key={opp.jobId}>
                          <div>
                            <div className="conn-cell-strong">{opp.jobTitle}</div>
                            <div className="conn-cell-sub">{connectionDetail.company}</div>
                          </div>
                          <span className="badge badge-success">
                            Referral Match: {opp.referralScore}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="conn-empty">No active tracked jobs found matching company {connectionDetail.company || 'Not Specified'}.</div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

      </main >

      {/* ================= MODALS ================= */}

      {/* CSV Import Modal */}
      {
        modal === 'csv' && (
          <div className="modal-overlay">
            <div className="modal-content conn-modal">
              <div className="conn-modal-head">
                <span className="conn-modal-icon"><IconUpload /></span>
                <div>
                  <h2 className="modal-title">Import Connections CSV</h2>
                  <p className="conn-modal-subtitle">Bulk-import contacts from a LinkedIn or CRM export.</p>
                </div>
              </div>
              <label className="conn-detail-upload-box conn-modal-upload">
                <IconFile />
                <span>Click to choose a CSV file</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      try {
                        const res = await api.importConnections(file);
                        alert(`Successfully imported ${res.imported} connections! Duplicates found: ${res.duplicates}`);
                        setModal(null);
                        loadConnections();
                      } catch (err) {
                        alert(err.message);
                      }
                    }
                  }}
                />
              </label>
              <div className="modal-actions">
                <button className="conn-btn conn-btn--ghost" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )
      }

      {/* Resume File Upload Modal */}
      {
        modal === 'resume' && (
          <div className="modal-overlay">
            <div className="modal-content resume-modal">
              <div className="resume-modal-head">
                <span className="resume-modal-icon"><IconFile /></span>
                <h2 className="modal-title">Upload Resume File</h2>
              </div>
              <label className="resume-upload-box">
                <IconUpload />
                <span>Click to choose a PDF or DOCX file</span>
                <input
                  type="file"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      try {
                        await api.uploadResume(file);
                        alert('Resume uploaded successfully!');
                        setModal(null);
                        loadResumes();
                      } catch (err) {
                        alert(err.message);
                      }
                    }
                  }}
                />
              </label>
              <div className="modal-actions">
                <button className="resume-btn resume-btn--ghost" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )
      }

      {/* Add/Edit Connection Modal */}
      {
        modal === 'connection' && (
          <div className="modal-overlay">
            <div className="modal-content conn-modal conn-modal--wide">
              <div className="conn-modal-head">
                <span className="conn-modal-icon"><IconUsers /></span>
                <h2 className="modal-title">{editItem ? 'Edit Connection' : 'Add Connection'}</h2>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());
                try {
                  if (editItem) {
                    await api.updateConnection(editItem.id, data);
                    if (activeTab === 'connection-detail' && activeConnectionId === editItem.id) {
                      loadConnectionDetail(editItem.id);
                    }
                  } else {
                    await api.createConnection(data);
                  }
                  setModal(null);
                  loadConnections();
                } catch (err) {
                  alert(err.message);
                }
              }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" name="name" className="form-input" required defaultValue={editItem?.name || ''} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Company</label>
                    <input type="text" name="company" className="form-input" defaultValue={editItem?.company || ''} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Job Title</label>
                    <input type="text" name="title" className="form-input" defaultValue={editItem?.title || ''} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" name="email" className="form-input" defaultValue={editItem?.email || ''} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input type="text" name="location" className="form-input" defaultValue={editItem?.location || ''} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Next Follow Up Date</label>
                  <input type="date" name="nextFollowUpDate" className="form-input" defaultValue={editItem?.nextFollowUpDate || ''} />
                </div>
                <div className="form-group">
                  <label className="form-label">Headline (LinkedIn / Professional Tagline)</label>
                  <input type="text" name="headline" className="form-input" defaultValue={editItem?.headline || ''} placeholder="e.g. Senior Machine Learning Engineer" />
                </div>
                <div className="form-group">
                  <label className="form-label">Profile Summary</label>
                  <textarea name="profileSummary" className="form-input" rows="3" defaultValue={editItem?.profileSummary || ''} placeholder="Add a short professional bio or summary..." />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Skills (Comma-separated)</label>
                    <input type="text" name="skills" className="form-input" defaultValue={editItem?.skills?.join(', ') || ''} placeholder="React, Node.js, Python" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Profile Links (Comma-separated URLs)</label>
                    <input type="text" name="externalLinks" className="form-input" defaultValue={editItem?.externalLinks?.join(', ') || ''} placeholder="github.com/user, portfolio.com" />
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="conn-btn conn-btn--ghost" onClick={() => setModal(null)}>Cancel</button>
                  <button type="submit" className="conn-btn conn-btn--primary">Save Connection</button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Add/Edit Job Modal */}
      {
        modal === 'job' && (
          <div className="modal-overlay">
            <div className="modal-content job-modal">
              <div className="job-modal-head">
                <span className="job-modal-icon"><IconBriefcase /></span>
                <h2 className="modal-title">{editItem ? 'Edit Job Posting' : 'Track New Job'}</h2>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());
                try {
                  if (editItem) {
                    await api.updateJob(editItem.id, data);
                  } else {
                    await api.createJob(data);
                  }
                  setModal(null);
                  loadJobs();
                } catch (err) {
                  alert(err.message);
                }
              }}>
                <div className="form-group">
                  <label className="form-label">Job Title</label>
                  <input type="text" name="title" className="form-input" required defaultValue={editItem?.title || ''} />
                </div>
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input type="text" name="companyName" className="form-input" required defaultValue={editItem?.companyName || ''} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input type="text" name="location" className="form-input" defaultValue={editItem?.location || ''} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Employment Type</label>
                    <input type="text" name="employmentType" className="form-input" placeholder="e.g. Full-time" defaultValue={editItem?.employmentType || ''} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Job URL</label>
                  <input type="url" name="url" className="form-input" defaultValue={editItem?.url || ''} />
                </div>
                <div className="form-group">
                  <label className="form-label">Job Description</label>
                  <textarea name="description" className="form-input" rows="3" defaultValue={editItem?.description || ''}></textarea>
                </div>
                <div className="modal-actions">
                  <button type="button" className="job-btn job-btn--ghost" onClick={() => setModal(null)}>Cancel</button>
                  <button type="submit" className="job-btn job-btn--primary">Track Job</button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Review & Ingest Telegram Job Modal */}
      {
        reviewJob && (
          <div className="modal-overlay">
            <div className="modal-content job-modal job-modal--wide">
              <div className="job-modal-head">
                <span className="job-modal-icon"><IconInbox /></span>
                <h2 className="modal-title">Review &amp; Ingest Job</h2>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());

                // Map skills string to array
                const skillsArray = data.skills
                  ? data.skills.split(',').map(s => s.trim()).filter(Boolean)
                  : [];

                try {
                  await api.request(`/incoming-jobs/${reviewJob.id}/approve`, {
                    method: 'POST',
                    body: {
                      ...data,
                      skills: skillsArray
                    }
                  });
                  setReviewJob(null);
                  loadIncomingJobs();
                  loadJobs();
                } catch (err) {
                  alert(err.message);
                }
              }}>
                <div className="job-modal-grid-2">
                  <div className="form-group">
                    <label className="form-label">Job Title</label>
                    <input type="text" name="title" className="form-input" required defaultValue={reviewJob.parsedData?.title || ''} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company Name</label>
                    <input type="text" name="companyName" className="form-input" required defaultValue={reviewJob.parsedData?.companyName || ''} />
                  </div>
                </div>

                <div className="job-modal-grid-2">
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input type="text" name="location" className="form-input" defaultValue={reviewJob.parsedData?.location || ''} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Job URL / Application Link</label>
                    <input type="text" name="jobUrl" className="form-input" defaultValue={reviewJob.parsedData?.jobUrl || ''} />
                  </div>
                </div>

                <div className="job-modal-grid-3">
                  <div className="form-group">
                    <label className="form-label">Employment Type</label>
                    <select name="employmentType" className="form-input" defaultValue={reviewJob.parsedData?.employmentType || ''}>
                      <option value="">Select Option</option>
                      <option value="full-time">Full-time</option>
                      <option value="part-time">Part-time</option>
                      <option value="contract">Contract</option>
                      <option value="internship">Internship</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Remote Type</label>
                    <select name="remoteType" className="form-input" defaultValue={reviewJob.parsedData?.remoteType || ''}>
                      <option value="">Select Option</option>
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="onsite">On-site</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Experience Required</label>
                    <input type="text" name="experienceLevel" className="form-input" defaultValue={reviewJob.parsedData?.experience || ''} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Skills (comma-separated)</label>
                  <input type="text" name="skills" className="form-input" defaultValue={reviewJob.parsedData?.skills?.join(', ') || ''} />
                </div>

                <div className="form-group">
                  <label className="form-label">Job Description / Raw Text</label>
                  <textarea name="description" className="form-input" rows="5" defaultValue={reviewJob.rawText}></textarea>
                </div>

                <div className="modal-actions">
                  <button type="button" className="job-btn job-btn--ghost" onClick={() => setReviewJob(null)}>Cancel</button>
                  <button type="submit" className="job-btn job-btn--primary">Approve &amp; Import</button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Application Status Update Modal */}
      {
        modal === 'application' && (
          <div className="modal-overlay">
            <div className="modal-content app-modal">
              <div className="app-modal-head">
                <span className="app-modal-icon"><IconBriefcase /></span>
                <h2 className="modal-title">Update Application Pipeline</h2>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());
                try {
                  await api.updateApplicationStatus(editItem.id, data.status, data.notes);
                  setModal(null);
                  loadApplications();
                  loadDashboard();
                } catch (err) {
                  alert(err.message);
                }
              }}>
                <div className="form-group">
                  <label className="form-label">Current Pipeline Stage</label>
                  <select name="status" className="form-input" defaultValue={editItem?.status || 'saved'}>
                    <option value="saved">Saved</option>
                    <option value="applied">Applied</option>
                    <option value="screening">Screening</option>
                    <option value="interview">Interview</option>
                    <option value="offer">Offer</option>
                    <option value="rejected">Rejected</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Application Event Notes</label>
                  <textarea name="notes" className="form-input" rows="3" placeholder="Add status notes/logs..."></textarea>
                </div>
                <div className="modal-actions">
                  <button type="button" className="app-btn app-btn--ghost" onClick={() => setModal(null)}>Cancel</button>
                  <button type="submit" className="app-btn app-btn--primary">Update Status</button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Log Outreach Modal */}
      {
        modal === 'outreach' && (
          <div className="modal-overlay">
            <div className="modal-content outreach-modal outreach-modal--wide">
              <div className="outreach-modal-head">
                <span className="outreach-modal-icon"><IconSend /></span>
                <h2 className="modal-title">Log Outreach for {editItem?.name}</h2>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                try {
                  await api.createOutreach(
                    editItem.id,
                    formData.get('status'),
                    formData.get('notes'),
                    formData.get('contactDate'),
                    formData.get('followUpDate')
                  );
                  if (aiDraft?.id) {
                    await api.request(`/outreach/ai-drafts/${aiDraft.id}`, {
                      method: 'PATCH',
                      body: { draft: formData.get('notes') }
                    });
                    await api.request(`/outreach/ai-drafts/${aiDraft.id}/save`, {
                      method: 'POST'
                    });
                  }
                  setModal(null);
                  loadOutreach();
                  loadDashboard();
                } catch (err) {
                  alert(err.message);
                }
              }}>
                <div className="form-group">
                  <label className="form-label">Outreach Stage</label>
                  <select name="status" className="form-input" defaultValue="contacted">
                    <option value="not_contacted">Not Contacted</option>
                    <option value="researching">Researching</option>
                    <option value="contacted">Contacted</option>
                    <option value="replied">Replied</option>
                    <option value="conversation">Conversation</option>
                    <option value="referral_requested">Referral Requested</option>
                    <option value="referral_received">Referral Received</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Contact Date</label>
                    <input type="date" name="contactDate" className="form-input" defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Next Follow Up Date</label>
                    <input type="date" name="followUpDate" className="form-input" />
                  </div>
                </div>

                {/* AI OUTREACH ASSISTANT PANEL */}
                <div className="outreach-ai-panel">
                  <h3 className="outreach-ai-heading">
                    <IconZap /> AI Outreach Assistant
                  </h3>

                  {aiError && (
                    <div className="outreach-alert outreach-alert--danger">
                      {aiError}
                    </div>
                  )}

                  {!aiDraft && (
                    <div>
                      <div className="outreach-ai-controls">
                        <div className="form-group outreach-ai-field">
                          <label className="form-label">Intent</label>
                          <select
                            className="form-input"
                            value={aiIntent}
                            onChange={(e) => setAiIntent(e.target.value)}
                          >
                            <option value="referral_request">Referral Request</option>
                            <option value="guidance_request">Guidance Request</option>
                            <option value="introduction">Introduction</option>
                            <option value="networking">Networking</option>
                            <option value="follow_up">Follow Up</option>
                            <option value="thank_you">Thank You</option>
                          </select>
                        </div>
                        <div className="form-group outreach-ai-field">
                          <label className="form-label">Tone</label>
                          <select
                            className="form-input"
                            value={aiTone}
                            onChange={(e) => setAiTone(e.target.value)}
                          >
                            <option value="professional">Professional</option>
                            <option value="friendly">Friendly</option>
                            <option value="concise">Concise</option>
                          </select>
                        </div>
                        <div className="form-group outreach-ai-field">
                          <label className="form-label">Length</label>
                          <select
                            className="form-input"
                            value={aiLength}
                            onChange={(e) => setAiLength(e.target.value)}
                          >
                            <option value="short">Short</option>
                            <option value="medium">Medium</option>
                          </select>
                        </div>
                      </div>

                      {aiWarnings.length > 0 && (
                        <div className="outreach-alert outreach-alert--warning">
                          <strong className="outreach-alert-title"><IconAlertTriangle /> Outreach Warning</strong>
                          <ul className="outreach-alert-list">
                            {aiWarnings.map((w, idx) => (
                              <li key={idx}>{w.message}</li>
                            ))}
                          </ul>
                          <button
                            type="button"
                            className="outreach-btn outreach-btn--warning outreach-btn--block"
                            onClick={() => handleGenerateAiDraft(true)}
                            disabled={aiLoading}
                          >
                            {aiLoading ? 'Generating...' : 'I Understand, Generate Anyway'}
                          </button>
                        </div>
                      )}

                      {aiWarnings.length === 0 && (
                        <button
                          type="button"
                          className="outreach-btn outreach-btn--primary outreach-btn--block"
                          onClick={() => handleGenerateAiDraft(false)}
                          disabled={aiLoading}
                        >
                          <IconZap />
                          {aiLoading ? 'Generating Draft...' : 'Generate AI Outreach Draft'}
                        </button>
                      )}
                    </div>
                  )}

                  {aiDraft && (
                    <div>
                      <div className="outreach-ai-summary">
                        <strong>Selected Intent:</strong> {aiIntent.replace('_', ' ')} &bull; <strong>Tone:</strong> {aiDraft.tone}
                      </div>

                      {aiDraft.personalizationPoints && aiDraft.personalizationPoints.length > 0 && (
                        <div className="outreach-ai-personalization">
                          <div className="outreach-ai-personalization-label">Personalization factors applied:</div>
                          <div className="outreach-ai-personalization-list">
                            {aiDraft.personalizationPoints.map((p, idx) => (
                              <span key={idx} className="badge badge-success outreach-personalization-chip">
                                <IconCheck /> {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="outreach-ai-draft-actions">
                        <button
                          type="button"
                          className="outreach-btn outreach-btn--ghost"
                          onClick={() => handleGenerateAiDraft(true)}
                          disabled={aiLoading}
                        >
                          <IconRefresh />
                          {aiLoading ? 'Regenerating...' : 'Regenerate'}
                        </button>
                        <button
                          type="button"
                          className="outreach-btn outreach-btn--ghost outreach-btn--danger-text"
                          onClick={handleDiscardDraft}
                        >
                          Discard Draft
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Interaction Log / Message Notes</label>
                  <textarea name="notes" className="form-input" rows="3" placeholder="Message content goes here..."></textarea>
                </div>
                <div className="modal-actions">
                  <button type="button" className="outreach-btn outreach-btn--ghost" onClick={() => setModal(null)}>Cancel</button>
                  <button type="submit" className="outreach-btn outreach-btn--primary">Log Outreach</button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Update Outreach Modal */}
      {
        modal === 'outreach_update' && (
          <div className="modal-overlay">
            <div className="modal-content outreach-modal">
              <div className="outreach-modal-head">
                <span className="outreach-modal-icon"><IconEdit /></span>
                <h2 className="modal-title">Update Outreach Logs</h2>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                try {
                  await api.createOutreachEvent(
                    editItem.id,
                    formData.get('status'),
                    formData.get('notes')
                  );
                  setModal(null);
                  loadOutreach();
                  loadDashboard();
                } catch (err) {
                  alert(err.message);
                }
              }}>
                <div className="form-group">
                  <label className="form-label">Outreach Stage</label>
                  <select name="status" className="form-input" defaultValue={editItem?.status}>
                    <option value="not_contacted">Not Contacted</option>
                    <option value="researching">Researching</option>
                    <option value="contacted">Contacted</option>
                    <option value="replied">Replied</option>
                    <option value="conversation">Conversation</option>
                    <option value="referral_requested">Referral Requested</option>
                    <option value="referral_received">Referral Received</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Interaction Log / Message Notes</label>
                  <textarea name="notes" className="form-input" rows="3"></textarea>
                </div>
                <div className="modal-actions">
                  <button type="button" className="outreach-btn outreach-btn--ghost" onClick={() => setModal(null)}>Cancel</button>
                  <button type="submit" className="outreach-btn outreach-btn--primary">Update Outreach</button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Job Detail Intelligence Modal */}
      {
        modal === 'job_detail' && (
          <div className="modal-overlay">
            <div className="modal-content job-modal job-modal--detail">
              <div className="job-detail-head">
                <div className="job-detail-head-title">
                  <span className="job-modal-icon"><IconBriefcase /></span>
                  <h2 className="modal-title">{editItem?.title}</h2>
                </div>
                <div className="job-detail-head-actions">
                  <span className={`badge ${JOB_STATUS_VARIANT[editItem?.status] || 'badge-info'}`}>{editItem?.status}</span>
                  <button
                    className="job-icon-btn"
                    aria-label="Close job workspace"
                    onClick={() => setModal(null)}
                  >
                    <IconX />
                  </button>
                </div>
              </div>
              <div className="job-detail-subhead">
                <div className="job-detail-subhead-meta">
                  {editItem?.companyName} &bull; {editItem?.location}
                </div>
                {(editItem?.url || editItem?.sourceUrl) && (
                  <a
                    href={editItem.url || editItem.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="job-btn job-btn--primary job-btn--sm"
                  >
                    <IconExternalLink />
                    Apply / Visit Job Posting
                  </a>
                )}
              </div>

              {/* Navigation tabs inside the Job details modal */}
              <div className="job-subnav job-subnav--modal">
                <button
                  className={`job-subnav-btn ${jobNetworkSubTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setJobNetworkSubTab('overview')}
                >
                  <IconGauge />
                  Overview &amp; Match
                </button>
                <button
                  className={`job-subnav-btn ${jobNetworkSubTab === 'application' ? 'active' : ''}`}
                  onClick={() => setJobNetworkSubTab('application')}
                >
                  <IconClock />
                  Application Tracker
                </button>
                <button
                  className={`job-subnav-btn ${jobNetworkSubTab === 'network' ? 'active' : ''}`}
                  onClick={() => setJobNetworkSubTab('network')}
                >
                  <IconUsers />
                  Referral Network Workspace
                </button>
                <button
                  className={`job-subnav-btn ${jobNetworkSubTab === 'ai' ? 'active' : ''}`}
                  onClick={() => { setJobNetworkSubTab('ai'); setEditingAiEnrichment(false); }}
                >
                  <IconZap />
                  AI Job Intelligence
                </button>
                <button
                  className={`job-subnav-btn ${jobNetworkSubTab === 'resume_analysis' ? 'active' : ''}`}
                  onClick={() => { setJobNetworkSubTab('resume_analysis'); loadResumeFitAnalysis(editItem.id); }}
                >
                  <IconTie />
                  AI Resume Fit
                </button>
              </div>

              {/* TAB 1: OVERVIEW & MATCH */}
              {jobNetworkSubTab === 'overview' && (
                <div>
                  <div className="job-stat-grid">
                    <div className="job-stat-card">
                      <span className="job-stat-icon job-stat-icon--success"><IconGauge /></span>
                      <div>
                        <div className="job-stat-label">Match Score</div>
                        <div className="job-stat-value">{editItem?.matchScore}%</div>
                      </div>
                    </div>
                    <div className="job-stat-card">
                      <span className="job-stat-icon job-stat-icon--primary"><IconZap /></span>
                      <div>
                        <div className="job-stat-label">Opportunity Score</div>
                        <div className="job-stat-value">{editItem?.opportunityScore}%</div>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Action Recommendation</label>
                    <div className="job-recommendation-box">
                      {editItem?.recommendedAction}
                    </div>
                  </div>

                  <div className="form-row job-tab-gap">
                    <div className="form-group">
                      <label className="form-label">Matched Skills</label>
                      <div className="tags-list">
                        {editItem?.matchedSkills?.length === 0 ? (
                          <span className="job-empty-inline">None matched</span>
                        ) : (
                          editItem?.matchedSkills?.map(s => <span key={s} className="badge badge-success">{s}</span>)
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Missing Skills</label>
                      <div className="tags-list">
                        {editItem?.missingSkills?.length === 0 ? (
                          <span className="job-empty-inline">None missing</span>
                        ) : (
                          editItem?.missingSkills?.map(s => <span key={s} className="badge badge-warning">{s}</span>)
                        )}
                      </div>
                    </div>
                  </div>

                  {editItem?.description && (
                    <div className="form-group job-tab-gap-top">
                      <label className="form-label">Description</label>
                      <div className="job-desc-box">
                        {editItem.description}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: AI JOB INTELLIGENCE */}
              {jobNetworkSubTab === 'ai' && (
                <div>
                  <div className="job-ai-header-row">
                    <h3 className="job-subheading">AI Job Understanding &amp; Enrichment</h3>
                    {editItem?.aiEnrichment && (
                      <button
                        className="job-btn job-btn--ghost job-btn--sm"
                        onClick={async () => {
                          if (confirm('Re-run AI extraction? This takes a few seconds.')) {
                            try {
                              const data = await api.request(`/jobs/${editItem.id}/ai-enrich`, { method: 'POST' });
                              setEditItem(data.data);
                              alert('AI enrichment re-run completed!');
                            } catch (e) {
                              alert(e.message);
                            }
                          }
                        }}
                      >
                        <IconRefresh />
                        Force Re-Enrich Job
                      </button>
                    )}
                  </div>

                  {!editItem?.aiEnrichment ? (
                    <div className="job-ai-state-box">
                      <p>AI Enrichment has not run or is disabled.</p>
                      <button
                        className="job-btn job-btn--primary"
                        onClick={async () => {
                          try {
                            const data = await api.request(`/jobs/${editItem.id}/ai-enrich`, { method: 'POST' });
                            setEditItem(data.data);
                            alert('AI Enrichment initiated!');
                          } catch (e) {
                            alert(e.message);
                          }
                        }}
                      >
                        <IconPlay />
                        Run AI Enrichment Now
                      </button>
                    </div>
                  ) : editItem.aiEnrichment.status === 'pending' || editItem.aiEnrichment.status === 'processing' ? (
                    <div className="job-ai-state-box">
                      <p>AI Ingestion Monitor: Enrichment status is <strong>{editItem.aiEnrichment.status}</strong>...</p>
                      <p className="job-ai-state-hint">Refreshing in a few seconds.</p>
                      <button
                        className="job-btn job-btn--ghost"
                        onClick={async () => {
                          const data = await api.request(`/jobs/${editItem.id}`);
                          setEditItem(data.data);
                        }}
                      >
                        <IconRefresh />
                        Refresh Status
                      </button>
                    </div>
                  ) : editItem.aiEnrichment.status === 'failed' ? (
                    <div className="job-ai-state-box job-ai-state-box--danger">
                      <p className="job-ai-state-danger-title"><IconAlertTriangle /> AI Enrichment Failed</p>
                      <p className="job-ai-state-code">Error Code: <code>{editItem.aiEnrichment.errorCode}</code></p>
                      <p className="job-ai-state-hint">{editItem.aiEnrichment.rawResponse}</p>
                      <button
                        className="job-btn job-btn--primary"
                        style={{ marginTop: '12px' }}
                        onClick={async () => {
                          try {
                            const data = await api.request(`/jobs/${editItem.id}/ai-enrich`, { method: 'POST' });
                            setEditItem(data.data);
                          } catch (e) {
                            alert(e.message);
                          }
                        }}
                      >
                        <IconRefresh />
                        Retry Enrichment
                      </button>
                    </div>
                  ) : (
                    <div>
                      {/* Display Mode or Edit Mode */}
                      {!editingAiEnrichment ? (
                        <div className="job-ai-display">

                          {/* Header Status Bar */}
                          <div className="job-status-bar">
                            <div className="job-status-bar-left">
                              <span className="job-status-dot" />
                              <span className="job-status-text">Enrichment Complete</span>
                            </div>
                            <div className="job-status-meta">
                              Model: <code>{editItem.aiEnrichment.model}</code>
                              <span className="job-status-sep">&bull;</span>
                              Latency: <strong>{editItem.aiEnrichment.latencyMs}ms</strong>
                            </div>
                          </div>

                          {/* 2x2 Info Matrix Cards */}
                          <div className="job-info-grid job-info-grid--2">

                            {/* Classification Card */}
                            <div className="job-info-card">
                              <h4 className="job-info-card-label">Job Classification</h4>

                              <div className="job-kv-grid">
                                <div className="job-kv">
                                  <div className="job-kv-label">Role Category</div>
                                  <div className="job-kv-value">
                                    {editItem.aiEnrichment.userCorrectedRoleCategory || editItem.aiEnrichment.roleCategory || 'N/A'}
                                    {editItem.aiEnrichment.userCorrectedRoleCategory && (
                                      <span className="badge badge-success job-edited-tag">Edited</span>
                                    )}
                                  </div>
                                </div>

                                <div className="job-kv">
                                  <div className="job-kv-label">Seniority</div>
                                  <div className="job-kv-value job-kv-value--capitalize">
                                    {editItem.aiEnrichment.userCorrectedSeniority || editItem.aiEnrichment.seniority || 'N/A'}
                                    {editItem.aiEnrichment.userCorrectedSeniority && (
                                      <span className="badge badge-success job-edited-tag">Edited</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Work Type Card */}
                            <div className="job-info-card">
                              <h4 className="job-info-card-label">Position Parameters</h4>

                              <div className="job-kv-grid">
                                <div className="job-kv">
                                  <div className="job-kv-label">Remote setup</div>
                                  <div className="job-kv-value job-kv-value--capitalize">
                                    {editItem.aiEnrichment.userCorrectedRemoteType || editItem.aiEnrichment.remoteType || 'N/A'}
                                    {editItem.aiEnrichment.userCorrectedRemoteType && (
                                      <span className="badge badge-success job-edited-tag">Edited</span>
                                    )}
                                  </div>
                                </div>

                                <div className="job-kv">
                                  <div className="job-kv-label">Employment Type</div>
                                  <div className="job-kv-value job-kv-value--capitalize">
                                    {editItem.aiEnrichment.userCorrectedEmploymentType || editItem.aiEnrichment.employmentType || 'N/A'}
                                    {editItem.aiEnrichment.userCorrectedEmploymentType && (
                                      <span className="badge badge-success job-edited-tag">Edited</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Experience and Domains */}
                          <div className="job-info-grid job-info-grid--exp">
                            <div className="job-info-card">
                              <div className="job-info-card-label">Required Experience</div>
                              <div className="job-exp-value">
                                {(editItem.aiEnrichment.userCorrectedExperienceMinYears !== null ? editItem.aiEnrichment.userCorrectedExperienceMinYears : editItem.aiEnrichment.experienceMinYears) !== null ? (
                                  `${editItem.aiEnrichment.userCorrectedExperienceMinYears !== null ? editItem.aiEnrichment.userCorrectedExperienceMinYears : editItem.aiEnrichment.experienceMinYears} to ${editItem.aiEnrichment.userCorrectedExperienceMaxYears !== null ? editItem.aiEnrichment.userCorrectedExperienceMaxYears : (editItem.aiEnrichment.experienceMaxYears || 'unspecified')} yrs`
                                ) : 'N/A'}
                              </div>
                            </div>

                            <div className="job-info-card">
                              <div className="job-info-card-label">Target Domains</div>
                              <div className="tags-list">
                                {(editItem.aiEnrichment.userCorrectedDomain || editItem.aiEnrichment.domain || []).length === 0 ? (
                                  <span className="job-empty-inline">None identified</span>
                                ) : (
                                  (editItem.aiEnrichment.userCorrectedDomain || editItem.aiEnrichment.domain || []).map(d => (
                                    <span key={d} className="badge badge-info job-badge-capitalize">{d}</span>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Skills breakdown */}
                          <div className="job-info-card job-info-card--stack">
                            <div>
                              <div className="job-info-card-label">Required Technical Skills</div>
                              <div className="tags-list">
                                {(editItem.aiEnrichment.userCorrectedRequiredSkills || editItem.aiEnrichment.requiredSkills || []).length === 0 ? (
                                  <span className="job-empty-inline">None extracted</span>
                                ) : (
                                  (editItem.aiEnrichment.userCorrectedRequiredSkills || editItem.aiEnrichment.requiredSkills || []).map(s => (
                                    <span key={s} className="badge badge-success">{s}</span>
                                  ))
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="job-info-card-label">Preferred / Desired Skills</div>
                              <div className="tags-list">
                                {(editItem.aiEnrichment.userCorrectedPreferredSkills || editItem.aiEnrichment.preferredSkills || []).length === 0 ? (
                                  <span className="job-empty-inline">None extracted</span>
                                ) : (
                                  (editItem.aiEnrichment.userCorrectedPreferredSkills || editItem.aiEnrichment.preferredSkills || []).map(s => (
                                    <span key={s} className="badge badge-secondary">{s}</span>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>

                          {/* AI Summary Block */}
                          <div className="job-summary-quote">
                            <div className="job-info-card-label">Role Intel Summary</div>
                            <div className="job-summary-quote-text">
                              &ldquo;{editItem.aiEnrichment.userCorrectedSummary || editItem.aiEnrichment.summary || 'No summary available.'}&rdquo;
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="job-tab-actions">
                            <button className="job-btn job-btn--ghost" onClick={() => setEditingAiEnrichment(true)}>
                              <IconEdit />
                              Correct AI Details
                            </button>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          const formData = new FormData(e.target);
                          const data = Object.fromEntries(formData.entries());

                          const payload = {
                            roleCategory: data.roleCategory,
                            seniority: data.seniority,
                            remoteType: data.remoteType,
                            employmentType: data.employmentType,
                            experienceMinYears: data.experienceMinYears ? parseInt(data.experienceMinYears) : null,
                            experienceMaxYears: data.experienceMaxYears ? parseInt(data.experienceMaxYears) : null,
                            requiredSkills: data.requiredSkills ? data.requiredSkills.split(',').map(s => s.trim()).filter(Boolean) : [],
                            preferredSkills: data.preferredSkills ? data.preferredSkills.split(',').map(s => s.trim()).filter(Boolean) : [],
                            domain: data.domain ? data.domain.split(',').map(s => s.trim()).filter(Boolean) : [],
                            summary: data.summary
                          };

                          try {
                            const refreshed = await api.request(`/jobs/${editItem.id}/ai-corrections`, {
                              method: 'PUT',
                              body: payload
                            });
                            setEditItem(refreshed.data);
                            setEditingAiEnrichment(false);
                            loadJobs();
                          } catch (err) {
                            alert(err.message);
                          }
                        }}>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Role Category</label>
                              <input type="text" name="roleCategory" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedRoleCategory || editItem.aiEnrichment.roleCategory || ''} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Seniority</label>
                              <input type="text" name="seniority" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedSeniority || editItem.aiEnrichment.seniority || ''} />
                            </div>
                          </div>

                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Remote Type</label>
                              <select name="remoteType" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedRemoteType || editItem.aiEnrichment.remoteType || ''}>
                                <option value="">Choose remote preference...</option>
                                <option value="remote">Remote</option>
                                <option value="hybrid">Hybrid</option>
                                <option value="onsite">Onsite</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Employment Type</label>
                              <select name="employmentType" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedEmploymentType || editItem.aiEnrichment.employmentType || ''}>
                                <option value="">Choose employment...</option>
                                <option value="full-time">Full-time</option>
                                <option value="part-time">Part-time</option>
                                <option value="contract">Contract</option>
                              </select>
                            </div>
                          </div>

                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Required Skills (comma separated)</label>
                              <input type="text" name="requiredSkills" className="form-input" defaultValue={(editItem.aiEnrichment.userCorrectedRequiredSkills || editItem.aiEnrichment.requiredSkills || []).join(', ')} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Preferred Skills (comma separated)</label>
                              <input type="text" name="preferredSkills" className="form-input" defaultValue={(editItem.aiEnrichment.userCorrectedPreferredSkills || editItem.aiEnrichment.preferredSkills || []).join(', ')} />
                            </div>
                          </div>

                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Min Experience (Years)</label>
                              <input type="number" name="experienceMinYears" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedExperienceMinYears !== null ? editItem.aiEnrichment.userCorrectedExperienceMinYears : editItem.aiEnrichment.experienceMinYears || ''} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Max Experience (Years)</label>
                              <input type="number" name="experienceMaxYears" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedExperienceMaxYears !== null ? editItem.aiEnrichment.userCorrectedExperienceMaxYears : editItem.aiEnrichment.experienceMaxYears || ''} />
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Domains / Industry Keywords (comma separated)</label>
                            <input type="text" name="domain" className="form-input" defaultValue={(editItem.aiEnrichment.userCorrectedDomain || editItem.aiEnrichment.domain || []).join(', ')} />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Summary</label>
                            <textarea name="summary" className="form-input" rows="3" defaultValue={editItem.aiEnrichment.userCorrectedSummary || editItem.aiEnrichment.summary || ''}></textarea>
                          </div>

                          <div className="modal-actions">
                            <button type="button" className="job-btn job-btn--ghost" onClick={() => setEditingAiEnrichment(false)}>Cancel</button>
                            <button type="submit" className="job-btn job-btn--primary">Save Corrections</button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}

              {jobNetworkSubTab === 'resume_analysis' && (
                <div>
                  <h3 className="job-subheading">AI Resume &harr; Job Fit Analysis</h3>

                  {loadingResumeAnalysis ? (
                    <div className="job-ai-state-box">
                      <p>Generating alignment analysis...</p>
                    </div>
                  ) : (
                    <div className="job-ai-display">

                      {/* Compatibility Rating Card */}
                      <div className="job-compat-card">
                        <div>
                          <div className="job-info-card-label">Compatibility Assessment</div>
                          <div className={`job-compat-value job-compat-value--${resumeAnalysis?.compatibilityAssessment === 'high' ? 'high' : resumeAnalysis?.compatibilityAssessment === 'medium' ? 'medium' : 'low'}`}>
                            {resumeAnalysis?.compatibilityAssessment || 'unknown'}
                          </div>
                          {resumeAnalysis?.computedAt && (
                            <div className="job-info-card-label" style={{ marginTop: '6px' }}>
                              Last analyzed {formatRelativeTime(resumeAnalysis.computedAt)}
                            </div>
                          )}
                        </div>
                        <button
                          className="job-btn job-btn--ghost"
                          onClick={() => loadResumeFitAnalysis(editItem.id)}
                        >
                          <IconRefresh />
                          Re-Analyze Fit
                        </button>
                      </div>

                      {/* Summary Bio */}
                      <div className="job-summary-quote">
                        <div className="job-info-card-label">Analysis Summary</div>
                        <p className="job-summary-quote-text job-summary-quote-text--plain">
                          {resumeAnalysis?.analysisSummary}
                        </p>
                      </div>

                      {/* Matched vs Missing Skills */}
                      <div className="job-info-grid job-info-grid--2">
                        <div className="job-info-card">
                          <div className="job-info-card-label">Matched Skills</div>
                          <div className="tags-list">
                            {(resumeAnalysis?.matchedSkills || []).length === 0 ? (
                              <span className="job-empty-inline">No matching skills detected</span>
                            ) : (
                              (resumeAnalysis.matchedSkills || []).map(s => (
                                <span key={s} className="badge badge-success">{s}</span>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="job-info-card">
                          <div className="job-info-card-label">Potential Gaps / Missing Skills</div>
                          <div className="tags-list">
                            {(resumeAnalysis?.missingSkills || []).length === 0 ? (
                              <span className="job-empty-inline">No gaps detected</span>
                            ) : (
                              (resumeAnalysis.missingSkills || []).map(s => (
                                <span key={s} className="badge badge-danger">{s}</span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Strengths List */}
                      <div className="job-info-card">
                        <div className="job-info-card-label">Core Alignment Strengths</div>
                        {(resumeAnalysis?.strengths || []).length === 0 ? (
                          <div className="job-empty-inline">No key strengths highlighted yet.</div>
                        ) : (
                          <ul className="job-plain-list">
                            {(resumeAnalysis.strengths || []).map((str, idx) => (
                              <li key={idx}>{str}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Gaps List */}
                      <div className="job-info-card">
                        <div className="job-info-card-label">Areas of Improvement / Growth</div>
                        {(resumeAnalysis?.potentialGaps || []).length === 0 ? (
                          <div className="job-empty-inline">No potential gaps highlighted.</div>
                        ) : (
                          <ul className="job-plain-list">
                            {(resumeAnalysis.potentialGaps || []).map((gap, idx) => (
                              <li key={idx}>{gap}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: APPLICATION LIFE CYCLE TRACKER */}
              {jobNetworkSubTab === 'application' && (
                <div>
                  {!editItem?.application ? (
                    <div className="job-app-start">
                      <h3 className="job-subheading">Start Tracking Application</h3>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        const data = Object.fromEntries(formData.entries());
                        try {
                          await api.createApplication(editItem.id, data.status, {
                            resumeId: data.resumeId || null,
                            coverLetter: data.coverLetter || '',
                            referralConnectionId: data.referralConnectionId || null,
                            notes: data.notes || '',
                            nextFollowUpDate: data.nextFollowUpDate || null
                          });
                          const updated = await api.request(`/jobs/${editItem.id}`);
                          setEditItem(updated.data);
                          loadJobs();
                          alert('Application tracker initialized!');
                        } catch (err) {
                          alert(err.message);
                        }
                      }}>
                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">Status</label>
                            <select name="status" className="form-input" defaultValue="saved">
                              <option value="saved">Saved</option>
                              <option value="applying">Applying</option>
                              <option value="applied">Applied</option>
                              <option value="recruiter_contact">Recruiter Contact</option>
                              <option value="screening">Screening</option>
                              <option value="interview">Interview</option>
                              <option value="offer">Offer</option>
                              <option value="accepted">Accepted</option>
                              <option value="rejected">Rejected</option>
                              <option value="withdrawn">Withdrawn</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Resume Used</label>
                            <select name="resumeId" className="form-input">
                              <option value="">No Resume Linked</option>
                              {resumes.map(r => <option key={r.id} value={r.id}>{r.fileName}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">Referral Connection</label>
                            <select name="referralConnectionId" className="form-input">
                              <option value="">No Referral</option>
                              {connections.filter(c => c.company?.toLowerCase().includes(editItem.companyName?.toLowerCase())).map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.title})</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Next Follow Up Date</label>
                            <input type="date" name="nextFollowUpDate" className="form-input" />
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Cover Letter</label>
                          <textarea name="coverLetter" className="form-input" rows="3" placeholder="Paste cover letter used..."></textarea>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Initial Notes</label>
                          <textarea name="notes" className="form-input" rows="3" placeholder="Initial thoughts, referral requests, etc..."></textarea>
                        </div>

                        <button type="submit" className="job-btn job-btn--primary job-btn--block">Initialize Application</button>
                      </form>
                    </div>
                  ) : (
                    <div className="job-app-grid">
                      {/* Left Column: Update Form */}
                      <div>
                        <h3 className="job-subheading">Application Details</h3>
                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          const formData = new FormData(e.target);
                          const data = Object.fromEntries(formData.entries());
                          try {
                            await api.updateApplication(editItem.application.id, {
                              status: data.status,
                              resumeId: data.resumeId || null,
                              coverLetter: data.coverLetter || '',
                              referralConnectionId: data.referralConnectionId || null,
                              notes: data.notes || '',
                              nextFollowUpDate: data.nextFollowUpDate || null
                            });
                            const updated = await api.request(`/jobs/${editItem.id}`);
                            setEditItem(updated.data);
                            loadJobs();
                            alert('Application details updated!');
                          } catch (err) {
                            alert(err.message);
                          }
                        }}>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Status</label>
                              <select name="status" className="form-input" defaultValue={editItem.application.status}>
                                <option value="saved">Saved</option>
                                <option value="applying">Applying</option>
                                <option value="applied">Applied</option>
                                <option value="recruiter_contact">Recruiter Contact</option>
                                <option value="screening">Screening</option>
                                <option value="interview">Interview</option>
                                <option value="offer">Offer</option>
                                <option value="accepted">Accepted</option>
                                <option value="rejected">Rejected</option>
                                <option value="withdrawn">Withdrawn</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Resume Used</label>
                              <select name="resumeId" className="form-input" defaultValue={editItem.application.resumeId || ''}>
                                <option value="">No Resume Linked</option>
                                {resumes.map(r => <option key={r.id} value={r.id}>{r.fileName}</option>)}
                              </select>
                            </div>
                          </div>

                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Referral Connection</label>
                              <select name="referralConnectionId" className="form-input" defaultValue={editItem.application.referralConnectionId || ''}>
                                <option value="">No Referral</option>
                                {connections.filter(c => c.company?.toLowerCase().includes(editItem.companyName?.toLowerCase())).map(c => (
                                  <option key={c.id} value={c.id}>{c.name} ({c.title})</option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Next Follow Up Date</label>
                              <input type="date" name="nextFollowUpDate" className="form-input" defaultValue={editItem.application.nextFollowUpDate || ''} />
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Cover Letter</label>
                            <textarea name="coverLetter" className="form-input" rows="3" defaultValue={editItem.application.coverLetter || ''}></textarea>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Notes</label>
                            <textarea name="notes" className="form-input" rows="3" defaultValue={editItem.application.notes || ''}></textarea>
                          </div>

                          <button type="submit" className="job-btn job-btn--primary job-btn--block">Save Updates</button>
                        </form>
                      </div>

                      {/* Right Column: Timeline & Add Event */}
                      <div className="job-app-timeline-col">
                        <h3 className="job-subheading">Application Timeline</h3>

                        {/* Visual Timeline */}
                        <div className="job-app-timeline">
                          {(!editItem.application.events || editItem.application.events.length === 0) ? (
                            <div className="job-empty-inline">No timeline events recorded.</div>
                          ) : (
                            editItem.application.events.map((ev, index) => (
                              <div key={ev.id || index} className="job-app-timeline-item">
                                <div className="job-app-timeline-rail">
                                  <div className="job-app-timeline-dot" />
                                  {index < editItem.application.events.length - 1 && (
                                    <div className="job-app-timeline-connector" />
                                  )}
                                </div>
                                <div>
                                  <div className="job-app-timeline-date">
                                    {new Date(ev.occurredAt).toLocaleDateString()}
                                  </div>
                                  <div className="job-app-timeline-type">
                                    {ev.eventType.replace('_', ' ')}: <span className="badge badge-info">{ev.status}</span>
                                  </div>
                                  {ev.notes && (
                                    <div className="job-app-timeline-note">
                                      &ldquo;{ev.notes}&rdquo;
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Add Custom Event Form */}
                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          const formData = new FormData(e.target);
                          const data = Object.fromEntries(formData.entries());
                          try {
                            await api.createApplicationEvent(editItem.application.id, {
                              eventType: data.eventType,
                              status: data.status,
                              notes: data.notes
                            });
                            const updated = await api.request(`/jobs/${editItem.id}`);
                            setEditItem(updated.data);
                            e.target.reset();
                            alert('Timeline event added!');
                          } catch (err) {
                            alert(err.message);
                          }
                        }} className="job-app-event-form">
                          <h4>Add Timeline Event</h4>
                          <div className="form-group">
                            <label className="form-label">Event Type</label>
                            <select name="eventType" className="form-input" defaultValue="interview_scheduled">
                              <option value="application_submitted">Application Submitted</option>
                              <option value="recruiter_contacted">Recruiter Contacted</option>
                              <option value="referral_requested">Referral Requested</option>
                              <option value="referral_received">Referral Received</option>
                              <option value="interview_scheduled">Interview Scheduled</option>
                              <option value="interview_completed">Interview Completed</option>
                              <option value="offer_received">Offer Received</option>
                              <option value="rejected">Rejected</option>
                              <option value="withdrawn">Withdrawn</option>
                              <option value="follow_up">Follow Up</option>
                              <option value="note">Note / Event</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Associated Stage</label>
                            <select name="status" className="form-input" defaultValue={editItem.application.status}>
                              <option value="saved">Saved</option>
                              <option value="applying">Applying</option>
                              <option value="applied">Applied</option>
                              <option value="recruiter_contact">Recruiter Contact</option>
                              <option value="screening">Screening</option>
                              <option value="interview">Interview</option>
                              <option value="offer">Offer</option>
                              <option value="accepted">Accepted</option>
                              <option value="rejected">Rejected</option>
                              <option value="withdrawn">Withdrawn</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Event Notes</label>
                            <input type="text" name="notes" className="form-input" placeholder="e.g. Round 1 Technical round" />
                          </div>
                          <button type="submit" className="job-btn job-btn--ghost job-btn--block job-btn--sm">Log Event</button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: REFERRAL NETWORK WORKSPACE */}
              {jobNetworkSubTab === 'network' && (
                <div>
                  {jobNetworkLoading ? (
                    <div className="job-ai-state-box">Loading referral candidates...</div>
                  ) : (
                    <div>
                      {/* Summary Metrics */}
                      <div className="job-net-summary-grid">
                        <div className="job-net-summary-tile">
                          <div className="job-net-summary-value job-net-summary-value--primary">
                            {jobNetworkDetails?.summary?.totalConnections || 0}
                          </div>
                          <div className="job-net-summary-label">Connections</div>
                        </div>
                        <div className="job-net-summary-tile">
                          <div className="job-net-summary-value job-net-summary-value--success">
                            {jobNetworkDetails?.summary?.relevantConnections || 0}
                          </div>
                          <div className="job-net-summary-label">Relevant</div>
                        </div>
                        <div className="job-net-summary-tile">
                          <div className="job-net-summary-value job-net-summary-value--warning">
                            {jobNetworkDetails?.summary?.highPotential || 0}
                          </div>
                          <div className="job-net-summary-label">High Potential</div>
                        </div>
                        <div className="job-net-summary-tile">
                          <div className="job-net-summary-value">
                            {jobNetworkDetails?.summary?.recruiters || 0}
                          </div>
                          <div className="job-net-summary-label">Recruiters</div>
                        </div>
                      </div>

                      {/* Filters Bar */}
                      <div className="job-net-filter-bar">
                        <div className="job-net-filter-group">
                          <select
                            className="form-input"
                            value={jobNetworkFilters.roleCategory}
                            onChange={(e) => setJobNetworkFilters({ ...jobNetworkFilters, roleCategory: e.target.value, page: 1 })}
                          >
                            <option value="">All Roles</option>
                            <option value="engineering">Engineering Only</option>
                            <option value="other">Other Roles</option>
                          </select>

                          <select
                            className="form-input"
                            value={jobNetworkFilters.seniority}
                            onChange={(e) => setJobNetworkFilters({ ...jobNetworkFilters, seniority: e.target.value, page: 1 })}
                          >
                            <option value="">All Seniorities</option>
                            <option value="senior">Senior</option>
                            <option value="lead">Lead</option>
                            <option value="manager">Manager</option>
                            <option value="director">Director</option>
                            <option value="executive">Executive</option>
                            <option value="founder">Founder</option>
                          </select>

                          <select
                            className="form-input"
                            value={jobNetworkFilters.relationshipStatus}
                            onChange={(e) => setJobNetworkFilters({ ...jobNetworkFilters, relationshipStatus: e.target.value, page: 1 })}
                          >
                            <option value="">All Statuses</option>
                            <option value="not_contacted">Not Contacted</option>
                            <option value="researching">Researching</option>
                            <option value="contacted">Contacted</option>
                            <option value="replied">Replied</option>
                            <option value="conversation">Conversation</option>
                            <option value="referral_requested">Referral Requested</option>
                            <option value="referral_received">Referral Received</option>
                          </select>

                          <select
                            className="form-input"
                            value={jobNetworkFilters.priority}
                            onChange={(e) => setJobNetworkFilters({ ...jobNetworkFilters, priority: e.target.value, page: 1 })}
                          >
                            <option value="">All Priorities</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                        <div className="job-net-sort-group">
                          <span>Sort</span>
                          <select
                            className="form-input"
                            value={jobNetworkFilters.sortBy}
                            onChange={(e) => setJobNetworkFilters({ ...jobNetworkFilters, sortBy: e.target.value, page: 1 })}
                          >
                            <option value="referralScore">Referral Score</option>
                            <option value="connectionScore">Connection Score</option>
                            <option value="seniority">Seniority</option>
                            <option value="relationshipStrength">Strength</option>
                            <option value="lastContactedDate">Last Contacted</option>
                          </select>
                        </div>
                      </div>

                      {/* Recommended Actions */}
                      {jobNetworkDetails?.candidates?.length > 0 && (
                        <div className="job-net-recommend-box">
                          <div className="job-net-recommend-title"><IconStar /> Recommended Workspace Actions</div>
                          <ul className="job-net-recommend-list">
                            {jobNetworkDetails.candidates.slice(0, 3).map((candidate, idx) => {
                              let action = 'Research relationship details';
                              if (candidate.relationshipStatus === 'not_contacted') {
                                action = `Initiate outreach to request a referral for this ${editItem?.title} role`;
                              } else if (candidate.relationshipStatus === 'contacted') {
                                action = 'Follow up to see if they received your request';
                              } else if (candidate.relationshipStatus === 'referral_received') {
                                action = 'Proceed with submitting application on company portal';
                              }
                              return (
                                <li key={idx}>
                                  <strong>Contact {candidate.connection.name}</strong>: {action}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {/* Candidates List */}
                      {jobNetworkDetails?.candidates?.length === 0 ? (
                        <div className="job-empty">
                          No referral candidates match your filter criteria at {editItem?.companyName}.
                        </div>
                      ) : (
                        <div className="job-net-candidate-list">
                          {jobNetworkDetails?.candidates?.map((candidate) => (
                            <div
                              key={candidate.connection.id}
                              className="job-net-candidate-card"
                            >
                              <div className="job-net-candidate-main">
                                <div className="job-net-candidate-name-row">
                                  <span className="job-net-candidate-name">{candidate.connection.name}</span>
                                  <span className={`badge ${candidate.relationshipStatus === 'not_contacted' ? 'badge-info' : 'badge-success'}`}>
                                    {candidate.relationshipStatus.replace('_', ' ')}
                                  </span>
                                  {candidate.priority && candidate.priority !== 'none' && (
                                    <span className="badge badge-warning">{candidate.priority} priority</span>
                                  )}
                                </div>
                                <div className="job-net-candidate-meta">
                                  {candidate.connection.title} &bull; {candidate.connection.company}
                                </div>
                                {/* Explainable scoring reasons */}
                                <div className="job-net-candidate-reasons">
                                  {candidate.reasons?.map((reason, ridx) => (
                                    <span key={ridx} className="job-net-reason-chip">
                                      <IconCheck /> {reason}
                                    </span>
                                  ))}
                                </div>
                                {/* AI Matching Evidence */}
                                {candidate.aiEvidence && (
                                  <div className="job-net-evidence">
                                    {candidate.aiEvidence.skillAlignment.length > 0 && (
                                      <div className="job-net-evidence-line">
                                        <span className="job-net-evidence-icon job-net-evidence-icon--success"><IconLightbulb /></span> <strong className="job-net-evidence-strong--success">AI Skill Match:</strong> {candidate.aiEvidence.skillAlignment.join(', ')}
                                      </div>
                                    )}
                                    {candidate.aiEvidence.domainAlignment.length > 0 && (
                                      <div className="job-net-evidence-line">
                                        <span className="job-net-evidence-icon job-net-evidence-icon--primary"><IconGlobe /></span> <strong className="job-net-evidence-strong--primary">AI Domain Match:</strong> {candidate.aiEvidence.domainAlignment.join(', ')}
                                      </div>
                                    )}
                                    {candidate.aiEvidence.roleAlignment !== 'neutral' && (
                                      <div className="job-net-evidence-line">
                                        <span className="job-net-evidence-icon"><IconTie /></span> <strong>AI Role Alignment:</strong> <span className={`job-net-role-alignment ${candidate.aiEvidence.roleAlignment === 'strong' ? 'job-net-role-alignment--strong' : 'job-net-role-alignment--medium'}`}>{candidate.aiEvidence.roleAlignment}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="job-net-candidate-score">
                                <div className="job-net-score-row">
                                  <span>Score:</span>
                                  <span className="job-net-score-value">
                                    {candidate.referralScore}
                                  </span>
                                </div>
                                {candidate.semanticSimilarity !== undefined && (
                                  <div className="job-net-relevance">
                                    Relevance: {Math.round(candidate.semanticSimilarity * 100)}%
                                  </div>
                                )}
                              </div>
                              <div className="job-net-candidate-actions">
                                <button
                                  className="job-btn job-btn--ghost job-btn--sm"
                                  onClick={async () => {
                                    try {
                                      const res = await api.request(`/connections/${candidate.connection.id}`);
                                      setEditItem(res.data);
                                      setModal('connection_detail');
                                    } catch (err) {
                                      alert(err.message);
                                    }
                                  }}
                                >
                                  <IconEye />
                                  View CRM
                                </button>
                                <button
                                  className="job-btn job-btn--primary job-btn--sm"
                                  onClick={() => {
                                    setEditItem({
                                      ...candidate.connection,
                                      job_id: editItem.id // pass selected job_id context
                                    });
                                    setModal('outreach');
                                  }}
                                >
                                  <IconSend />
                                  Log Outreach
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button className="job-btn job-btn--ghost" onClick={() => { setModal(null); setJobNetworkSubTab('overview'); }}>Close Intel</button>
              </div>
            </div>
          </div>
        )
      }

      {/* Connection Detail CRM Modal */}
      {
        modal === 'connection_detail' && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 className="card-title">🤝 Connection Intel: {editItem?.name}</h2>
              <div style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{editItem?.title || 'No Title'} at {editItem?.company || 'Unknown Company'}</div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Relationship Details</label>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem' }}>
                    <div>Strength: <strong style={{ color: 'var(--warning)' }}>{editItem?.relationshipStrength || 'Not Rated'}</strong></div>
                    <div style={{ marginTop: '4px' }}>Status: <strong>{editItem?.relationshipStatus || 'Not Contacted'}</strong></div>
                    <div style={{ marginTop: '4px' }}>Follow-up Date: <strong>{editItem?.followUpDate || 'None scheduled'}</strong></div>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">CRM Notes</label>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', minHeight: '80px', maxHeight: '120px', overflowY: 'auto' }}>
                    {editItem?.notes || 'No relationship notes logged.'}
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Referral Opportunities at {editItem?.company || 'their company'}</label>
                {editItem?.referralOpportunities?.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No active tracked jobs found at {editItem?.company}.</div>
                ) : (
                  <div className="activity-list">
                    {editItem?.referralOpportunities?.map(opp => (
                      <div className="activity-item" key={opp.jobId} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{opp.jobTitle}</div>
                        </div>
                        <span className="badge badge-success">Referral Match: {opp.referralScore}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Outreach & Communications History</label>
                {editItem?.outreachHistory?.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No outreach history logged yet.</div>
                ) : (
                  <div className="timeline" style={{ paddingLeft: '10px', marginTop: '10px' }}>
                    {editItem?.outreachHistory?.map(event => (
                      <div className="timeline-event" key={event.id} style={{ fontSize: '0.85rem' }}>
                        <strong>{event.status}</strong> &bull; {new Date(event.occurredAt).toLocaleDateString()}
                        <p style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{event.notes || 'No description'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Professional Profile Panel */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>  AI Professional Profile</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {editItem?.aiEnrichment && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => setEditingConnectionAi(!editingConnectionAi)}
                      >
                        {editingConnectionAi ? 'Cancel Edit' : 'Correct AI Output'}
                      </button>
                    )}
                    <button
                      className="btn btn-primary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      disabled={loadingConnectionAi}
                      onClick={() => handleEnrichConnectionAi(editItem.id)}
                    >
                      {loadingConnectionAi ? 'Analyzing...' : editItem?.aiEnrichment ? 'Re-Run AI' : 'Run AI Enrichment'}
                    </button>
                  </div>
                </div>

                {!editItem?.aiEnrichment ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    No AI profile generated for this connection yet. Click &quot;Run AI Enrichment&quot; to analyze their profile.
                  </div>
                ) : editingConnectionAi ? (
                  /* Human corrections form */
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.target);
                      const parsedTech = fd.get('technologies').split(',').map(t => t.trim()).filter(Boolean);
                      const parsedTechDomains = fd.get('technicalDomains').split(',').map(d => d.trim()).filter(Boolean);
                      const parsedIndDomains = fd.get('industryDomains').split(',').map(d => d.trim()).filter(Boolean);
                      const parsedExpertise = fd.get('expertiseAreas').split(',').map(d => d.trim()).filter(Boolean);

                      await handleSaveConnectionAiCorrections(editItem.id, {
                        professionalRole: fd.get('professionalRole'),
                        roleFamily: fd.get('roleFamily'),
                        careerLevel: fd.get('careerLevel'),
                        leadershipLevel: fd.get('leadershipLevel'),
                        technologies: parsedTech,
                        technicalDomains: parsedTechDomains,
                        industryDomains: parsedIndDomains,
                        expertiseAreas: parsedExpertise,
                        summary: fd.get('summary')
                      });
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Professional Role</label>
                        <input type="text" name="professionalRole" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedProfessionalRole || editItem.aiEnrichment.professionalRole || ''} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Role Family</label>
                        <input type="text" name="roleFamily" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedRoleFamily || editItem.aiEnrichment.roleFamily || ''} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Career Level</label>
                        <input type="text" name="careerLevel" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedCareerLevel || editItem.aiEnrichment.careerLevel || ''} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Leadership Level</label>
                        <input type="text" name="leadershipLevel" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedLeadershipLevel || editItem.aiEnrichment.leadershipLevel || ''} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Technologies (comma separated)</label>
                      <input type="text" name="technologies" className="form-input" defaultValue={(editItem.aiEnrichment.userCorrectedTechnologies || editItem.aiEnrichment.technologies || []).join(', ')} />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Technical Domains (comma separated)</label>
                      <input type="text" name="technicalDomains" className="form-input" defaultValue={(editItem.aiEnrichment.userCorrectedTechnicalDomains || editItem.aiEnrichment.technicalDomains || []).join(', ')} />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Industry Domains (comma separated)</label>
                      <input type="text" name="industryDomains" className="form-input" defaultValue={(editItem.aiEnrichment.userCorrectedIndustryDomains || editItem.aiEnrichment.industryDomains || []).join(', ')} />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Expertise Areas (comma separated)</label>
                      <input type="text" name="expertiseAreas" className="form-input" defaultValue={(editItem.aiEnrichment.userCorrectedExpertiseAreas || editItem.aiEnrichment.expertiseAreas || []).join(', ')} />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Summary</label>
                      <textarea name="summary" className="form-input" rows="2" defaultValue={editItem.aiEnrichment.userCorrectedSummary || editItem.aiEnrichment.summary || ''}></textarea>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end', padding: '6px 12px', fontSize: '0.85rem' }}>Save Corrections</button>
                  </form>
                ) : (
                  /* AI Display View */
                  <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Professional Role</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{editItem.aiEnrichment.userCorrectedProfessionalRole || editItem.aiEnrichment.professionalRole || 'N/A'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Role Family</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{editItem.aiEnrichment.userCorrectedRoleFamily || editItem.aiEnrichment.roleFamily || 'N/A'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Career Level</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{editItem.aiEnrichment.userCorrectedCareerLevel || editItem.aiEnrichment.careerLevel || 'N/A'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Leadership Level</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{editItem.aiEnrichment.userCorrectedLeadershipLevel || editItem.aiEnrichment.leadershipLevel || 'N/A'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>AI Confidence</div>
                        <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{Math.round((editItem.aiEnrichment.confidence || 0) * 100)}%</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Status</div>
                        <div style={{ fontWeight: 600, textTransform: 'capitalize', color: editItem.aiEnrichment.status === 'completed' ? 'var(--success)' : editItem.aiEnrichment.status === 'failed' ? 'var(--danger)' : 'var(--warning)' }}>{editItem.aiEnrichment.status}</div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Technologies</div>
                      <div className="tags-list">
                        {(editItem.aiEnrichment.userCorrectedTechnologies || editItem.aiEnrichment.technologies || []).length === 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>None</span>
                        ) : (
                          (editItem.aiEnrichment.userCorrectedTechnologies || editItem.aiEnrichment.technologies || []).map(t => (
                            <span key={t} className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>{t}</span>
                          ))
                        )}
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Technical Domains</div>
                      <div className="tags-list">
                        {(editItem.aiEnrichment.userCorrectedTechnicalDomains || editItem.aiEnrichment.technicalDomains || []).length === 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>None</span>
                        ) : (
                          (editItem.aiEnrichment.userCorrectedTechnicalDomains || editItem.aiEnrichment.technicalDomains || []).map(d => (
                            <span key={d} className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', fontSize: '0.75rem' }}>{d}</span>
                          ))
                        )}
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Industry Domains</div>
                      <div className="tags-list">
                        {(editItem.aiEnrichment.userCorrectedIndustryDomains || editItem.aiEnrichment.industryDomains || []).length === 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>None</span>
                        ) : (
                          (editItem.aiEnrichment.userCorrectedIndustryDomains || editItem.aiEnrichment.industryDomains || []).map(d => (
                            <span key={d} className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', fontSize: '0.75rem' }}>{d}</span>
                          ))
                        )}
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Expertise Areas</div>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0, color: 'var(--text-secondary)' }}>
                        {(editItem.aiEnrichment.userCorrectedExpertiseAreas || editItem.aiEnrichment.expertiseAreas || []).map((exp, idx) => (
                          <li key={idx} style={{ marginBottom: '2px' }}>{exp}</li>
                        ))}
                        {(editItem.aiEnrichment.userCorrectedExpertiseAreas || editItem.aiEnrichment.expertiseAreas || []).length === 0 && (
                          <li style={{ listStyleType: 'none', marginLeft: '-16px', color: 'var(--text-muted)' }}>None logged</li>
                        )}
                      </ul>
                    </div>

                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>AI Career Summary</div>
                      <p style={{ margin: 0, lineHeight: 1.4, color: 'var(--text-secondary)' }}>{editItem.aiEnrichment.userCorrectedSummary || editItem.aiEnrichment.summary || 'No summary available.'}</p>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Enrich Profile via LinkedIn PDF</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
                  <input
                    type="file"
                    accept=".pdf"
                    className="form-input"
                    style={{ maxWidth: '300px' }}
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setEnrichmentLoading(true);
                      setEnrichmentError(null);
                      setModal('linkedin_pdf');
                      try {
                        const objectUrl = URL.createObjectURL(file);
                        setPdfObjectURL(objectUrl);
                        const res = await api.importLinkedInPdf(file);
                        setEnrichmentPreview(res.data);
                      } catch (err) {
                        setEnrichmentError(err.message || 'Failed to parse PDF profile.');
                      } finally {
                        setEnrichmentLoading(false);
                      }
                    }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Upload PDF to update skills, headline, summary.</span>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button className="btn btn-secondary" onClick={() => setModal(null)}>Close Intel</button>
              </div>
            </div>
          </div>
        )
      }

      {
        modal === 'linkedin_pdf' && (
          <div className="modal-overlay">
            <div className={`modal-content conn-modal ${pdfObjectURL ? 'conn-modal--xwide' : 'conn-modal--wide'}`}>
              <div className="conn-modal-head">
                <span className="conn-modal-icon"><IconFile /></span>
                <h2 className="modal-title">LinkedIn PDF Profile Enrichment</h2>
              </div>

              {enrichmentLoading && (
                <div className="conn-empty">Uploading and parsing LinkedIn PDF...</div>
              )}

              {enrichmentError && (
                <div className="conn-modal-alert conn-modal-alert--danger">
                  <IconAlert />
                  <div>
                    <p>{enrichmentError}</p>
                    <button className="conn-btn conn-btn--ghost conn-btn--sm" style={{ marginTop: '10px' }} onClick={() => setEnrichmentError(null)}>
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {!enrichmentLoading && !enrichmentError && !enrichmentPreview && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const file = e.target.elements.pdfFile.files[0];
                  if (!file) return alert('Please select a file.');
                  setEnrichmentLoading(true);
                  setEnrichmentError(null);
                  try {
                    const objectUrl = URL.createObjectURL(file);
                    setPdfObjectURL(objectUrl);
                    const res = await api.importLinkedInPdf(file);
                    setEnrichmentPreview(res.data);
                  } catch (err) {
                    setEnrichmentError(err.message || 'Failed to parse PDF profile.');
                  } finally {
                    setEnrichmentLoading(false);
                  }
                }}>
                  <p className="conn-modal-subtitle">
                    Upload a LinkedIn profile PDF to match against existing network contacts and enrich their profile summary, headline, or skill arrays.
                  </p>
                  <label className="conn-detail-upload-box conn-modal-upload">
                    <IconUpload />
                    <span>Click to choose a LinkedIn PDF export</span>
                    <input type="file" name="pdfFile" accept=".pdf" required />
                  </label>
                  <div className="modal-actions">
                    <button type="button" className="conn-btn conn-btn--ghost" onClick={closeEnrichmentModal}>Cancel</button>
                    <button type="submit" className="conn-btn conn-btn--primary">Parse PDF</button>
                  </div>
                </form>
              )}

              {!enrichmentLoading && !enrichmentError && enrichmentPreview && (
                <div className={`conn-modal-pdf-layout ${pdfObjectURL ? 'conn-modal-pdf-layout--split' : ''}`}>
                  {pdfObjectURL && (
                    <div className="conn-modal-pdf-pane">
                      <h3 className="conn-modal-pane-title">Uploaded Profile PDF</h3>
                      <iframe src={pdfObjectURL} width="100%" height="450px" style={{ border: 'none', borderRadius: '6px', background: '#fff' }}></iframe>
                    </div>
                  )}

                  <div className="conn-modal-extract-pane">
                    <h3 className="conn-modal-extract-title">
                      Profile Extracted: <span>{enrichmentPreview.parsed.name}</span>
                    </h3>

                    <div className="conn-modal-extract-list">
                      {enrichmentPreview.parsed.headline && <div><strong>Headline:</strong> {enrichmentPreview.parsed.headline}</div>}
                      {enrichmentPreview.parsed.email && <div><strong>Email:</strong> {enrichmentPreview.parsed.email}</div>}
                      {enrichmentPreview.parsed.profileUrl && <div><strong>LinkedIn URL:</strong> <a href={enrichmentPreview.parsed.profileUrl} target="_blank" rel="noreferrer">{enrichmentPreview.parsed.profileUrl}</a></div>}
                      {enrichmentPreview.parsed.skills && <div><strong>Skills Extracted:</strong> {enrichmentPreview.parsed.skills.join(', ')}</div>}
                    </div>

                    {enrichmentPreview.matched.length > 0 ? (
                      <div className="conn-modal-alert conn-modal-alert--warning">
                        <IconAlert />
                        <div>
                          <h4>Existing Contact Matched</h4>
                          <p>
                            We found a matched profile in your CRM network: <strong>{enrichmentPreview.matched[0].name}</strong> at <strong>{enrichmentPreview.matched[0].company || 'No Company'}</strong> ({enrichmentPreview.matched[0].title || 'No Title'}).
                          </p>
                          <div className="conn-modal-alert-actions">
                            <button className="conn-btn conn-btn--primary conn-btn--sm" onClick={async () => {
                              setEnrichmentLoading(true);
                              try {
                                await api.confirmEnrichment({
                                  action: 'enrich',
                                  parsed: enrichmentPreview.parsed,
                                  connectionId: enrichmentPreview.matched[0].id
                                });
                                alert('Connection enriched successfully!');
                                closeEnrichmentModal();
                                loadConnections();
                              } catch (err) {
                                alert(err.message);
                              } finally {
                                setEnrichmentLoading(false);
                              }
                            }}>
                              Enrich Matched Contact
                            </button>
                            <button className="conn-btn conn-btn--ghost conn-btn--sm" onClick={async () => {
                              if (confirm('Create a new duplicate connection anyway?')) {
                                setEnrichmentLoading(true);
                                try {
                                  await api.confirmEnrichment({
                                    action: 'create',
                                    parsed: enrichmentPreview.parsed
                                  });
                                  alert('New duplicate connection created!');
                                  closeEnrichmentModal();
                                  loadConnections();
                                } catch (err) {
                                  alert(err.message);
                                } finally {
                                  setEnrichmentLoading(false);
                                }
                              }
                            }}>
                              Import as New Instead
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="conn-modal-alert conn-modal-alert--success">
                        <IconCheck />
                        <div>
                          <h4>No matches found</h4>
                          <p>
                            This profile does not match any existing contacts in your CRM. Do you want to import them as a new connection?
                          </p>
                          <button className="conn-btn conn-btn--primary conn-btn--sm" onClick={async () => {
                            setEnrichmentLoading(true);
                            try {
                              await api.confirmEnrichment({
                                action: 'create',
                                parsed: enrichmentPreview.parsed
                              });
                              alert('New contact imported successfully!');
                              closeEnrichmentModal();
                              loadConnections();
                            } catch (err) {
                              alert(err.message);
                            } finally {
                              setEnrichmentLoading(false);
                            }
                          }}>
                            Create New Connection
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="modal-actions">
                      <button className="conn-btn conn-btn--ghost" onClick={closeEnrichmentModal}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )
      }

      {
        showSaveViewModal && (
          <div className="modal-overlay">
            <div className="modal-content conn-modal" style={{ maxWidth: '450px' }}>
              <div className="conn-modal-head">
                <span className="conn-modal-icon"><IconLayers /></span>
                <h2 className="modal-title">Save Connection Segment View</h2>
              </div>
              <div className="form-group">
                <label className="form-label">View Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Google Recruiters"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea
                  className="form-input"
                  rows="3"
                  placeholder="Senior Engineering Recruiters in SF"
                  value={newViewDesc}
                  onChange={(e) => setNewViewDesc(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button className="conn-btn conn-btn--ghost" onClick={() => setShowSaveViewModal(false)}>Cancel</button>
                <button className="conn-btn conn-btn--primary" onClick={handleSaveView}>Save View</button>
              </div>
            </div>
          </div>
        )
      }

    </div >
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
