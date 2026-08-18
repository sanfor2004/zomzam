# Contributing to Zomzam

Thank you for your interest in contributing to Zomzam! This project is more than just another web application; it is built on what we call the **Zenith-Tier Architecture**. We maintain strict standards for performance, security, and cinematic UI/UX.

By participating in this project, you agree to abide by these standards.

## 1. Architectural Sovereignty
- **The Zomzam Kit**: Zomzam ships with its own robust component library (`src/components/ui`). **Do not introduce third-party UI libraries** like shadcn/ui, Radix UI, Framer Motion, Bootstrap, or Material UI. 
- If a primitive you need doesn't exist, build it inline. If it's needed twice, promote it to the Zomzam Kit following the existing `variant`/`size` patterns (e.g., see `Button.tsx`).
- **GSAP for Motion**: We use GSAP + `@gsap/react` for all complex animations. They are centralized in `src/lib/gsap.ts`. Do not import GSAP or register plugins outside of this centralized file.

## 2. Aesthetic Engineering
- We do not use defaults. Everything must feel Premium and Bespoke.
- Follow the visual tokens laid out in `BrandGuideLine.md` and `src/app/globals.css`.
- Rely on Tailwind v4 CSS-first tokens. Use `cn()` from `@/lib/utils` for conditional class merging.

## 3. Database & Backend Integrity
- **Trust-Zero API Architecture**: Ensure all API routes appropriately use the `withAuth()` or `withError()` gates located in `src/lib/api-auth.ts`.
- **SQL Best Practices**: All database queries MUST use parameterized inputs to prevent SQL injection.
- If you are altering the schema, update `scripts/db-sync.ts`. Ensure your schema changes are idempotent (e.g., checking if columns exist before adding).

## 4. Submitting a Pull Request
1. Fork the repository and create your branch from `main`.
2. Ensure you have run `npm run lint` and `npm run test` before submitting.
3. Your PR title should clearly describe the feature or bug fix.
4. Your PR description must outline *why* this change is needed and *how* you implemented it.
5. If your PR includes UI changes, attach screenshots or screen recordings showcasing the new design, including its behavior in Dark Mode and Light Mode.

Thank you for helping keep Zomzam at the zenith of digital craftsmanship!
