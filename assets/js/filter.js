document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.filter_sidebar');
    if (!sidebar) return;
    const setOpen = SiteUI.drawer(sidebar, document.querySelector('.filter'), sidebar.querySelector('.close'), 'Product filters');
    sidebar.querySelectorAll('.filter_content__box').forEach((box, index) => {
        const heading = box.querySelector('.filter_heading');
        const panel = box.querySelector('.filter_select');
        panel.id = `filter-options-${index}`;
        panel.hidden = true;
        heading.setAttribute('aria-controls', panel.id);
        heading.setAttribute('aria-expanded', 'false');
        heading.addEventListener('click', () => {
            panel.hidden = !panel.hidden;
            box.classList.toggle('show', !panel.hidden);
            heading.setAttribute('aria-expanded', String(!panel.hidden));
        });
    });
    sidebar.querySelector('.show-btn button')?.addEventListener('click', () => {
        // The source catalog has no metadata to apply these options reliably.
        if (sidebar.querySelector('input:checked')) SiteUI.status(document.querySelector('.product_box__content'), 'These filters are currently unavailable. You can browse the collection or search by product name.');
        setOpen?.(false);
    });
});
