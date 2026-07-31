# Ward Meeting OS

## Architecture & Design Document

### Version 0.1 (Draft)

## 1. Vision

### Purpose

Ward Meeting OS is a planning, preparation, collaboration, publication,
and historical record system for meetings held within a ward of The
Church of Jesus Christ of Latter-day Saints.

The application is designed to reduce duplicated effort, improve
coordination, simplify conducting meetings, and automatically generate
public-facing meeting information from the same planning data.

The system should scale from a single ward to many wards without
changing the application's source code.

## 2. Design Principles

### Single Source of Truth

Information should only be entered once and reused everywhere.

### Views Instead of Duplicate Data

The same meeting data is rendered into different views (Planning,
Conducting, Public) without duplication.

### Meetings Drive Everything

Meetings are the core object. People, callings, planning, publication,
and history all support meetings.

### Notion Stores Data

Notion is the system of record. Next.js provides the user experience and
application logic.

## 3. Core Entities

-   Ward
-   People
-   Callings
-   Meeting Types
-   Meetings
-   Templates
-   Meeting Sections
-   Meeting Elements
-   Planning Sources

### Planning Sources

Examples include: - Music Planning - Speaker Planning - Rotational
Assignments - Prayer History - Agenda Items - Announcements

## 4. Meeting Lifecycle

``` text
Template
   ↓
Planning
   ↓
Review
   ↓
Ready
   ↓
Live
   ↓
Archived
```

## 5. Meeting Views

### Planning View

Leadership-only workspace for building the meeting.

### Conducting View

A guided script for the conductor with prompts, timing, and notes.

### Public View

A simplified meeting program containing only public information.

### Printable Views

-   Conducting Sheet
-   Bulletin
-   Minutes
-   Reports

## 6. Meeting Types

### Sacrament Meeting

Presentation-oriented meeting with: - Planning View - Conducting View -
Public View

Planning includes speakers, music, prayers, ward business,
announcements, and recognitions.

### Bishopric Meeting

Collaborative working meeting supporting: - Agenda - Minutes - Action
Items - Calling discussions - Calendar review - Future planning

### Ward Council

Collaborative planning meeting with assignments and minutes.

### Youth Council

Collaborative planning meeting.

## 7. Permissions

Examples:

-   Bishop: Full access
-   Bishopric Counselors: Full meeting editing
-   Executive Secretary: Agenda and planning management
-   Ward Clerk: Minutes and agenda management
-   Invited Participants: Submit agenda items
-   Ward Members: View published meetings only

## 8. Dynamic Content

Rotational assignments populate meetings automatically but may be
overridden for a single meeting without changing the rotation schedule.

## 9. Action Items

Working meetings produce actionable follow-up tasks with: - Assigned
person - Due date - Status

## 10. Publication Model

Private planning data is rendered into a public meeting program using a
meeting-specific obscured URL.

## 11. Technology Stack

-   Next.js
-   TypeScript
-   Tailwind CSS
-   Notion
-   GitHub
-   Vercel

## 12. Long-Term Vision

Future modules may include:

-   Calling Planning
-   Ministering
-   Budget Requests
-   Activity Planning
-   Interview Scheduling
-   Reports
-   Stake Support
-   Multi-Ward Management

## 13. Core User Stories

-   As a bishopric counselor, I want a complete conducting view that
    guides me through the meeting.
-   As an executive secretary, I want to prepare agendas quickly and
    collect agenda items throughout the week.
-   As a ward clerk, I want to record minutes and action items during
    leadership meetings.
-   As a music coordinator, I want long-term planning to automatically
    populate future meetings.
-   As a ward member, I want to access a simple public meeting program
    without authentication.

## 14. Guiding Philosophy

The application should always answer:

1.  What meeting are we preparing?
2.  What still needs to happen?
3.  What should each participant see?
4.  What historical record should remain?

------------------------------------------------------------------------

**Living Document**

This document is intended to evolve as the application grows and should
be maintained under version control.
