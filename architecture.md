# Ward Meeting OS

## Architecture & Design Document

### Version 0.2 (Draft)

> This document holds the long-term vision and design principles.
> For the current implementation's actual state (tables, roles, open
> items, in-progress work), see [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) —
> when the two disagree, `PROJECT_CONTEXT.md` describes what's really
> built and this document should be updated to match.

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

### Supabase Stores Data

Supabase (Postgres) is the system of record, with row-level security
enforced on every table. Next.js provides the user experience and
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

Current implementation:

-   Bishopric (bishop, counselors, executive secretary, and ward clerk):
    one shared role with full meeting editing. The app does not yet
    distinguish between these four people individually — see
    `PROJECT_CONTEXT.md`'s Table Admin queue for the open item tracking
    this gap (matters most for who can add
    Recognitions/Advancements/Baptisms/New Members records).
-   Music Planner, Communications Specialist, and the granular youth
    roles (YW Presidency/Advisor/Specialist, YM Advisor/Specialist):
    scoped to their own planning areas.
-   Invited Participants: Submit agenda items (not yet built — planned
    as a share-token, no-login view).
-   Ward Members: View published meetings only, unauthenticated.

## 8. Dynamic Content

Rotational assignments populate meetings automatically but may be
overridden for a single meeting without changing the rotation schedule.

## 9. Action Items

Working meetings produce actionable follow-up tasks with: - Assigned
person - Due date - Status

## 10. Publication Model

Private planning data is rendered into public routes gated by row-level
security: narrow anon-access policies expose only records already
filtered to what's meant to be public (e.g. `confirmed = true`,
`status = 'published'`), matching what the public UI filters to
client-side. Meeting-specific obscured/share-token URLs (security
through an unguessable link) remain the planned model for the
not-yet-built invited-participant agenda views, but are not how the
public meeting program itself is protected today.

## 11. Technology Stack

-   Next.js
-   TypeScript
-   Tailwind CSS
-   Supabase (Postgres + Auth)
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
