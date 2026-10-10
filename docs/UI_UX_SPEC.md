# NetX — UI/UX Design Specification

## 1. UI/UX Design Direction

NetX should have a **simple, modern, polished desktop UI/UX**.

The application is a network utility, so the interface should prioritize:

* Clarity
* Ease of navigation
* Readability
* Information hierarchy
* Fast interaction
* Professional appearance
* Consistency

The UI should feel like a **real, finished desktop application**, not a prototype or generic AI-generated dashboard.

---

# 2. UI Reference / Inspiration

A visual reference image will be provided during development.

The reference image is intended **only as design inspiration**.

### Important

Do **NOT** reproduce the reference image exactly.

Do not copy:

* Exact layout
* Exact component placement
* Exact colors
* Exact typography
* Exact spacing
* Exact icons
* Exact cards
* Exact navigation
* Exact proportions
* Exact visual elements

Instead, analyze the reference and identify the design principles that make it visually appealing.

Use those principles to create an **original and improved NetX interface**.

The final interface should:

> Be inspired by the reference, but clearly be its own design.

If there is an opportunity to improve the reference's usability, hierarchy, spacing, navigation, or information presentation, improve it.

The reference should influence the **design direction**, not become a template to copy.

---

# 3. Overall UX Philosophy

NetX should follow a simple principle:

> **Simple for beginners, useful for advanced users.**

A normal user should be able to open NetX and immediately understand:

* Whether they are connected
* Their current download speed
* Their current upload speed
* Their ping
* Their network status
* Their current data usage

More advanced functionality should be accessible through dedicated sections without making the main dashboard overwhelming.

---

# 4. Appearance Modes

NetX must support three appearance modes:

### Light

A light interface.

### Dark

A dark interface.

### System / Auto

Automatically follow the user's Windows appearance preference.

Example:

```text
Appearance

○ Light
○ Dark
● System
```

When System/Auto is selected:

```text
Windows Light Mode
        ↓
     NetX Light


Windows Dark Mode
        ↓
     NetX Dark
```

The application should detect Windows theme changes and update appropriately.

The selected appearance setting must persist after restarting NetX.

---

# 5. Design Consistency

The entire application must use a consistent design system.

Create reusable design tokens/components for:

* Colors
* Typography
* Spacing
* Borders
* Radius
* Buttons
* Inputs
* Navigation
* Cards
* Tables
* Graphs
* Status indicators
* Dialogs
* Notifications

Avoid individually styling every page without a shared design system.

This will make future updates much easier.

---

# 6. Application Structure

The application should use a simple navigation structure.

Suggested sections:

```text
NETX

Dashboard

Speed Test

Data Usage

Applications

Connections

Wi-Fi

Network

Tools

Diagnostics

──────────────

Settings
```

The exact visual implementation should be determined from the provided reference and improved where appropriate.

The navigation must remain easy to understand.

---

# 7. Dashboard UX

The Dashboard should provide the most important information at a glance.

The user should not need to navigate through multiple pages to understand their current connection.

The Dashboard should include:

### Connection Status

* Internet status
* Connected network
* Connection type
* Current IP where appropriate

### Current Performance

* Download speed
* Upload speed
* Ping

### Network Activity

* Real-time bandwidth graph
* Download activity
* Upload activity

### Data Usage

* Today's usage
* Current month's usage

### Quick Actions

Examples:

```text
Start Speed Test
Run Diagnostics
View Data Usage
```

Only the most useful information should appear on the dashboard.

Detailed information should remain on dedicated pages.

---

# 8. Information Hierarchy

Every screen should have a clear hierarchy.

For example:

```text
Page Title

Primary information

Supporting information

Detailed information

Actions
```

Important values such as:

```text
84.2 Mbps
12.7 Mbps
24 ms
229.1 GB
```

should be visually prominent.

Technical information such as:

```text
Gateway
DNS
Interface
IP
MAC
```

should be visually secondary.

---

# 9. UI Components

Use reusable components throughout the application.

Examples:

### Metric

```text
Download

84.2 Mbps
```

### Status

```text
● Connected
```

### Action

```text
[ Start Test ]
```

### Graph

```text
Network Activity
────────────────────
        ╭──╮
    ╭───╯  ╰──╮
────╯         ╰──
```

### Table

Used for:

* Applications
* Connections
* Devices
* Speed test history

Components should maintain consistent styling across all pages.

---

# 10. Dashboard Cards

Cards may be used where they improve information organization.

However, avoid turning every piece of information into a separate floating card.

The interface should use:

* Whitespace
* Sections
* Dividers
* Typography
* Subtle containers

to establish hierarchy.

The reference image should guide the visual treatment.

---

# 11. Speed Test UX

The Speed Test page should be simple.

### Before test

```text
Speed Test

Check your internet connection.

Ping
—

Download
—

Upload
—

[ Start Test ]
```

### During test

Display the current test stage and progress.

Example:

```text
Testing download speed...

67.4 Mbps

██████████████░░░░
```

### After test

```text
Speed Test Complete

84.2 Mbps
Download

12.7 Mbps
Upload

24 ms
Ping

[ Test Again ]
```

The test interface should not overwhelm the user with technical information.

---

# 12. Data Usage UX

The Data Usage page should present information in an easy-to-understand manner.

Show:

* Today
* This week
* This month
* Historical usage

Example:

```text
Data Usage

October

229.1 GB
Total

Downloaded
186.4 GB

Uploaded
42.7 GB
```

Include a simple graph for historical usage.

Allow switching between:

```text
Day
Week
Month
```

---

# 13. Diagnostics UX

The Diagnostics page should guide the user through the process.

Initial state:

```text
Network Diagnostics

Check your connection for common problems.

[ Run Diagnostics ]
```

During:

```text
Checking connection...

✓ Network adapter
✓ Gateway
◌ DNS
○ Internet
```

Result:

```text
Connection looks healthy.

✓ Network adapter
✓ Gateway
✓ DNS
✓ Internet

[ Run Again ]
```

If a problem exists, explain it in simple language.

Do not only display technical error codes.

---

# 14. Loading States

Every operation that takes time must have a clear loading state.

Examples:

* Speed test
* Diagnostics
* LAN scan
* DNS lookup
* Traceroute

Never leave the interface appearing frozen.

Loading states should be subtle and consistent with the reference-inspired design.

---

# 15. Empty States

Pages without data should provide useful guidance.

Example:

```text
No Speed Tests Yet

Run your first speed test to begin
building your network history.

[ Start Speed Test ]
```

Empty states should tell the user:

1. What is missing
2. Why it matters
3. What they can do next

---

# 16. Error States

Errors should be understandable.

Instead of:

```text
Error 500
```

use:

```text
Unable to perform speed test.

Your internet connection may be unavailable.

[ Try Again ]
```

Technical details may be available through an optional:

```text
View technical details
```

section.

---

# 17. Accessibility

The interface should support:

* Keyboard navigation
* Visible focus states
* Good contrast
* Readable text
* Tooltips where necessary
* Accessible labels
* Screen-reader-friendly controls where practical

Important information should never be communicated through color alone.

For example:

```text
● Connected
```

rather than displaying only a green circle.

---

# 18. Animation

Animations should be subtle and purposeful.

Use animation for:

* Loading
* Graph updates
* Button feedback
* Navigation transitions
* Theme changes

Avoid excessive animation.

The application should feel fast and responsive.

---

# 19. Responsive Desktop Behavior

NetX is primarily a Windows desktop application.

The UI should still respond properly when the user:

* Resizes the window
* Maximizes the window
* Uses a laptop display
* Uses a large external monitor

Avoid:

* Horizontal overflow
* Overlapping components
* Cut-off content
* Excessive empty space

If necessary, the sidebar may collapse at smaller window sizes.

---

# 20. Settings UX

Settings should be organized and easy to understand.

Suggested categories:

```text
Settings

Appearance
Startup
Notifications
Monitoring
Data
Privacy
About
```

Appearance:

```text
Theme

○ Light
○ Dark
● System
```

Startup:

```text
Start with Windows       [ ON ]
Start minimized          [ OFF ]
```

Notifications:

```text
Connection changes       [ ON ]
Usage alerts             [ ON ]
```

Data:

```text
Keep history for         [ 30 days ▼ ]
```

---

# 21. System Tray UX

If system-tray functionality is enabled, it should remain unobtrusive.

Example:

```text
NETX

Download: 84.2 Mbps
Upload:   12.7 Mbps

────────────

Open NetX

Pause Monitoring

Settings

Exit
```

The tray should provide quick access without becoming a second complicated interface.

---

# 22. Visual Quality Requirements

Before considering the UI complete, review it for:

* Alignment
* Consistent spacing
* Typography hierarchy
* Visual balance
* Button consistency
* Icon consistency
* Empty states
* Loading states
* Error states
* Dark mode
* Light mode
* System/Auto mode
* Window resizing

The application should look polished at the end of every major development phase, not only at the final release.

---

# 23. Reference Image Rule

When the reference image is provided:

### DO

* Study its visual hierarchy
* Study its spacing
* Study its navigation approach
* Study its information density
* Study its component organization
* Study its overall visual feel
* Identify what makes the interface attractive
* Adapt those principles to NetX
* Improve the UX where appropriate

### DO NOT

* Copy the exact design
* Recreate the screenshot
* Duplicate the exact layout
* Copy exact colors
* Copy exact components
* Copy branding
* Copy logos
* Make NetX look like a clone

The final result should be:

> **Reference-inspired + original + improved + designed specifically for NetX.**

---

# 24. Final UX Goal

A user opening NetX should immediately understand:

```text
Am I connected?
       ↓
How fast is my connection?
       ↓
How much data am I using?
       ↓
Is anything wrong?
       ↓
What can I do about it?
```

The application should answer those questions with minimal interaction.

The interface should be **simple enough for an ordinary user while still providing powerful tools for technically advanced users.**


---

# 25. Reference Analysis & NetX Original Design Adaptation

## Principles Extracted from the Reference Image

1. **High-Contrast Anchored Sidebar**: A solid, deeply saturated navigation sidebar paired with a bright, breathable content canvas creates immediate structural clarity. The active route uses a high-contrast pill fill so the user never loses their place.
2. **Visual Connection Chain**: Representing network connectivity as a multi-stage horizontal flow (`Adapter` → `Gateway` → `DNS` → `Internet`) with clear status badges and dashed link lines makes network health intuitive to beginners.
3. **Action-Integrated Status Strip**: Pairing a plain-language health summary banner directly with a primary action button (`Start Speed Test` / `Run Diagnostics`) bridges status awareness and action.
4. **Hairline Key-Value Telemetry Lists**: Grouping technical parameters (`Connection Type`, `IP Address`, `Subnet Mask`, `Default Gateway`, `DNS Server`) into a clean vertical table with subtle horizontal row dividers avoids "card soup" while keeping secondary technical data aligned and readable.
5. **Scannable Entity Rows**: Pairing a soft icon badge, primary title + monospace subtitle on the left, and a compact pill badge on the right works cleanly for Connected Devices, Active Applications, and Wi-Fi Networks.

## How NetX Improves & Differentiates (No Copying)

1. **Distinct Visual Identity & Color System**:
   * Replaces the reference's green/orange router palette with NetX's own desktop utility palette (supporting **Light**, **Dark**, and **System/Auto** modes with CSS custom properties).
   * Uses tabular numerals (`font-variant-numeric: tabular-nums`) and crisp monospace formatting for live speeds, ping, IP addresses, and byte counters.
2. **True Desktop Application Chrome (No Web Footer/Support Clutter)**:
   * Removes web-page artifacts from the reference (copyright footers, social media icons, "Contact Support" marketing card).
   * Uses the lower sidebar area for a **Live Monitoring Status Pod** (showing real-time Down/Up throughput and monitoring state) above the `Settings` navigation item.
3. **Performance & Bandwidth First on the Dashboard**:
   * Elevates live **Download Mbps**, **Upload Mbps**, **Ping (ms)**, **Real-Time Bandwidth Graph**, and **Today / Monthly Data Usage** to first-class citizens on the Dashboard alongside the 4-hop **Connection Health Path** and **Network Status** details.
