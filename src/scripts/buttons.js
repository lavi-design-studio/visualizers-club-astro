// The site's buttons drawn in as its rules are (motion.js rulesIn): the plate, its type with it, from
// both ends to the middle, as it comes into view; once. (Its turning about under the pointer is CSS:
// .btn::after, landing.css.) Not under reduced motion: there they are simply there
import { gsap } from 'gsap';

const SIDES = a => `polygon(0% 0%, ${a}% 0%, ${a}% 100%, ${100 - a}% 100%, ${100 - a}% 0%, 100% 0%, 100% 100%, 0% 100%)`;

export function buttonsIn(els) {
  els = els.filter(Boolean);
  if (!els.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.set(els, { clipPath: SIDES(0) });
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    gsap.to(e.target, { clipPath: SIDES(50), duration: .9, ease: 'expo.inOut', delay: .2, clearProps: 'clipPath' });
  }), { rootMargin: '0px 0px -12% 0px' });
  els.forEach(e => io.observe(e));
}
