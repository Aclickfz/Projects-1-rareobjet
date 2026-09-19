document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.myNav_content');
    const menuButton = document.querySelector('.menu_icon');
    const mobileNav = document.querySelector('.mobile_nav');
    const closeButton = document.querySelector('.close-icon');
    const searchButton = document.querySelector('.search-icon');
    const searchBox = document.querySelector('.search--input');

    const setMenuState = (isOpen) => {
        if (!mobileNav) return;
        mobileNav.classList.toggle('active', isOpen);
        mobileNav.setAttribute('aria-hidden', String(!isOpen));
        document.body.classList.toggle('nav-open', isOpen);
    };

    if (header) {
        const updateHeader = () => header.classList.toggle('sticky', window.scrollY > 8);
        window.addEventListener('scroll', updateHeader, { passive: true });
        updateHeader();
    }

    menuButton?.addEventListener('click', () => setMenuState(true));
    closeButton?.addEventListener('click', () => setMenuState(false));
    mobileNav?.addEventListener('click', (event) => {
        if (event.target === mobileNav) setMenuState(false);
    });

    searchButton?.addEventListener('click', () => {
        if (!searchBox) return;
        searchBox.classList.toggle('show');
        if (searchBox.classList.contains('show')) {
            searchBox.querySelector('input')?.focus();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setMenuState(false);
            searchBox?.classList.remove('show');
        }
    });

    document.querySelectorAll('.dropBtn').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.dropBtn').forEach((item) => {
                if (item !== button) item.classList.remove('megaDrop_active');
            });
            button.classList.toggle('megaDrop_active');
        });
    });

    document.querySelectorAll('.megadropBtn').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.megadropBtn').forEach((item) => {
                if (item !== button) item.classList.remove('active');
            });
            button.classList.toggle('active');
        });
    });
});

function myFunction(smallImg) {
    const fullImg = document.getElementById('imgBox');
    if (fullImg && smallImg) fullImg.src = smallImg.src;
}