/** @param {Element} block */
export default function decorate(block) {
  [...block.children].forEach((row, i) => {
    const cell = row.firstElementChild;
    if (!cell) return;
    row.className = 'rule';
    row.style.setProperty('--rule-delay', `${i * 140}ms`);

    const badge = document.createElement('span');
    badge.className = 'rule-number';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = String(i + 1).padStart(2, '0');
    cell.prepend(badge);
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('rule-revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.35, rootMargin: '0px 0px -10% 0px' });

  block.querySelectorAll('.rule').forEach((rule) => observer.observe(rule));
}
