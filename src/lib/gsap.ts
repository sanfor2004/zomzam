// src/lib/gsap.ts
// Single source of truth for GSAP. Importing this module registers every plugin
// exactly once (guarded to the browser), so components never double-register
// across Fast Refresh. Plugins are all free and bundled in the `gsap` package.
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);
}

export { gsap, useGSAP, ScrollTrigger, SplitText };
