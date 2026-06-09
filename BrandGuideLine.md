# Zomzam Brand Guidelines & Design Tokens 💎

This document defines the Zenith-Tier Brand Guide and Aesthetic Standards for Zomzam. All future components, features, and refactors must strictly align with this layout and interaction grammar.

---

## 1. Cognitive Persona (Target Audience)
* **Target Audience**: High-performing software engineers, builders, and entrepreneurs who value high-productivity workflows, capital growth, and extreme visual feedback.
* **Mental Model Target**:
  * **Zero Mystery**: Immediate response (<100ms) on every user action. Focus states must never feel ambiguous.
  * **Clean Space**: Modular task queues. Avoid busy dashboards or cluttered headers.
  * **Sovereignty**: The user must feel in control. Data flows should be transparent, editable, and clear.

---

## 2. Aesthetic North Star (The "Vibe")
* **Design Persona**: **Minimalist Apple & OLED Dark Fusion**
* **Aesthetic Principles**:
  * Seamless Glassmorphism (`backdrop-filter`).
  * Deep dark background surfaces with multi-layered, organic shadows (no solid black border outlines).
  * Zomzam Orange primary accents coupled with warm violet and amber sub-themes to create visual energy.

---

## 3. Atomic Design Tokens

### A. Color Palette (HSL-Based)
```css
:root {
  /* Primary & Accent (Zomzam Orange) */
  --primary-hue: 18;
  --primary-saturation: 86%;
  --primary-lightness: 50%;
  --primary: hsl(var(--primary-hue), var(--primary-saturation), var(--primary-lightness)); /* #EE5712 */

  /* Neutral Surface Palette (OLED optimized dark mode) */
  --bg-dark: hsl(220, 18%, 8%);         /* #0D0F13 */
  --bg-dark-card: hsl(220, 17%, 12%);    /* #161920 */
  --bg-dark-border: hsl(220, 15%, 18%);  /* #252A34 */
  
  --bg-light: hsl(220, 20%, 97%);       /* #F5F6F8 */
  --bg-light-card: hsl(0, 0%, 100%);    /* #FFFFFF */
  --bg-light-border: hsl(220, 15%, 90%); /* #E3E5EB */

  /* Semantic Alerts */
  --success: hsl(142, 70%, 45%);        /* Emerald */
  --warning: hsl(38, 92%, 50%);         /* Amber */
  --error: hsl(350, 89%, 60%);          /* Rose Red */
}
```

### B. Typography (Fluid Hierarchy)
We leverage standard clamp scales to render layouts fluidly across viewport widths:
* **Display Font**: *Montserrat / Outfit* (Cinematic, bold headlines).
* **Body Font**: *Inter / Geist Sans* (High-legibility reading).
* **Mono Font**: *JetBrains Mono / Fira Code* (Technical values and timers).

```css
/* Typography Scale Tokens */
--text-display: clamp(2.5rem, 5vw + 1rem, 4.5rem);
--text-title: clamp(1.5rem, 3vw + 0.5rem, 2.5rem);
--text-headline: clamp(1.2rem, 1.5vw + 0.5rem, 1.75rem);
--text-body: clamp(0.95rem, 0.2vw + 0.8rem, 1.0625rem);
--text-footnote: 0.75rem;
```

### C. Depth & Elevation
* **Glassmorphism 2.0**:
  ```css
  background: rgba(22, 25, 32, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  ```
* **Shadow Physics**:
  Multi-layered biological shadow structure instead of harsh outline definitions:
  ```css
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.05),
    0 4px 12px rgba(0, 0, 0, 0.08),
    0 12px 24px -4px rgba(0, 0, 0, 0.12);
  ```

---

## 4. Signifier Library
* **Buttons**:
  * Minimum interactive size of **44x44px** to conform with HIG standard rules.
  * Active states should scale down slightly (`active:scale-[0.98]`) with a 150ms transform curve.
* **Indicators**:
  * Pulse glow animations for active status alerts (e.g., Live User Seen, active Pomodoro session).
  * Color must never be the sole indicator of state; always couple it with secondary metrics (e.g., text label or distinct icon symbols).

---

## 5. Motion Lexical

To maintain a buttery-smooth 60FPS user experience, animations are categorized into three durations:

| Curve Name | Duration | Easing Formula | Use Case |
| :--- | :--- | :--- | :--- |
| **Micro-interaction** | 100ms - 150ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Hover triggers, button scale downs, checkbox toggling |
| **Standard Transition** | 250ms - 350ms | `cubic-bezier(0.25, 1, 0.5, 1)` | Modals, planning cards, panel slides |
| **Cinematic Reveal** | 400ms - 600ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Page entrances, dashboard loading reveals, confetti drops |

---
*Align all CSS configurations, tailwind stylesheets, and React modules with these tokens.*
