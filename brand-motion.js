const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const hero = document.getElementById('hero');
const title = hero?.querySelector('.hero-title');

if (hero && title) {
    let frame = 0;
    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;
    let active = false;
    let pointerX = 0;
    let pointerY = 0;
    let letters = [];
    const collect = () => {
        letters = [...title.querySelectorAll('.char')];
        if (letters.length) observer.disconnect();
    };
    const observer = new MutationObserver(collect);
    observer.observe(title, {childList: true, subtree: true});
    collect();

    function draw() {
        frame = 0;
        x += (targetX - x) * 0.12;
        y += (targetY - y) * 0.12;
        hero.style.setProperty('--brand-x', `${(x * 4).toFixed(2)}px`);
        hero.style.setProperty('--brand-y', `${(y * 3).toFixed(2)}px`);
        hero.style.setProperty('--brand-yaw', `${(x * 1.4).toFixed(2)}deg`);
        hero.style.setProperty('--brand-pitch', `${(-y * 1).toFixed(2)}deg`);
        for (const letter of letters) {
            const rect = letter.getBoundingClientRect();
            const distance = Math.hypot(pointerX - rect.left - rect.width / 2, pointerY - rect.top - rect.height / 2);
            const glow = active ? Math.max(0, 1 - distance / 240) : 0;
            letter.style.setProperty('--letter-light', glow.toFixed(3));
        }
        if (Math.abs(targetX - x) + Math.abs(targetY - y) > 0.001) frame = requestAnimationFrame(draw);
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const reset = () => {
        active = false;
        targetX = targetY = 0;
        if (reduced.matches || document.hidden) x = y = 0;
        schedule();
    };
    hero.addEventListener('pointermove', e => {
        if (reduced.matches || !finePointer.matches || e.pointerType === 'touch') return;
        const rect = hero.getBoundingClientRect();
        targetX = (e.clientX - rect.left) / rect.width * 2 - 1;
        targetY = (e.clientY - rect.top) / rect.height * 2 - 1;
        pointerX = e.clientX;
        pointerY = e.clientY;
        active = true;
        schedule();
    }, {passive: true});
    hero.addEventListener('pointerleave', reset);
    reduced.addEventListener('change', reset);
    finePointer.addEventListener('change', reset);
    document.addEventListener('visibilitychange', reset);
    new IntersectionObserver(entries => { if (!entries[0].isIntersecting) reset(); }).observe(hero);
}

document.querySelectorAll('.project-card:not(.project-card-static)').forEach(card => {
    let frame = 0;
    let x = 0;
    let y = 0;
    const reset = () => {
        cancelAnimationFrame(frame); frame = 0;
        card.classList.remove('is-motion-active');
        for (const name of ['--tilt-x', '--tilt-y', '--image-x', '--image-y']) card.style.removeProperty(name);
    };
    card.addEventListener('pointermove', event => {
        if (!finePointer.matches || reduced.matches || event.pointerType === 'touch') return;
        const rect = card.getBoundingClientRect();
        x = (event.clientX - rect.left) / rect.width - 0.5;
        y = (event.clientY - rect.top) / rect.height - 0.5;
        if (!frame) frame = requestAnimationFrame(() => {
            frame = 0;
            card.classList.add('is-motion-active');
            card.style.setProperty('--tilt-x', `${(-y * 4).toFixed(2)}deg`);
            card.style.setProperty('--tilt-y', `${(x * 4).toFixed(2)}deg`);
            card.style.setProperty('--image-x', `${(x * -10).toFixed(2)}px`);
            card.style.setProperty('--image-y', `${(y * -10).toFixed(2)}px`);
        });
    }, {passive: true});
    card.addEventListener('pointerleave', reset);
    card.addEventListener('pointercancel', reset);
    reduced.addEventListener('change', reset);
    finePointer.addEventListener('change', reset);
});
