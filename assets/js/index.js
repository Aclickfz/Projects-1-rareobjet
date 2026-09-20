/* Shared storefront interactions. Customer data is never stored by this script. */
window.SiteUI = {
    status(container, message) {
        let status = container.querySelector(':scope > .ui-status');
        if (!status) {
            status = document.createElement('p');
            status.className = 'ui-status';
            status.setAttribute('role', 'status');
            container.append(status);
        }
        status.textContent = message;
    },
    drawer(overlay, trigger, closeButton, label) {
        if (!overlay || !trigger || !closeButton) return null;
        const panel = overlay.firstElementChild;
        let previousFocus;
        let inertElements = [];
        overlay.inert = true;
        overlay.setAttribute('aria-hidden', 'true');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', label);
        panel.tabIndex = -1;
        if (!overlay.id) overlay.id = label.toLowerCase().replace(/\s/g, '-');
        trigger.setAttribute('aria-controls', overlay.id);
        trigger.setAttribute('aria-expanded', 'false');
        const setOpen = open => {
            if (open === overlay.classList.contains('active')) return;
            overlay.classList.toggle('active', open);
            overlay.inert = !open;
            overlay.setAttribute('aria-hidden', String(!open));
            trigger.setAttribute('aria-expanded', String(open));
            document.body.classList.toggle('drawer-open', open);
            if (open) {
                previousFocus = document.activeElement;
                panel.setAttribute('aria-modal', 'true');
                for (let node = overlay; node.parentElement; node = node.parentElement) {
                    for (const sibling of node.parentElement.children) {
                        if (sibling !== node && !sibling.inert && !['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) {
                            sibling.inert = true;
                            inertElements.push(sibling);
                        }
                    }
                    if (node.parentElement === document.body) break;
                }
                closeButton.focus();
            } else {
                panel.removeAttribute('aria-modal');
                inertElements.forEach(element => { element.inert = false; });
                inertElements = [];
                previousFocus?.focus();
            }
        };
        trigger.addEventListener('click', () => setOpen(true));
        closeButton.addEventListener('click', () => setOpen(false));
        overlay.addEventListener('click', event => { if (event.target === overlay) setOpen(false); });
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
            if (event.key !== 'Tab') return;
            const focusable = [...panel.querySelectorAll('a[href], button, input, select, textarea, [tabindex="0"]')]
                .filter(element => !element.disabled && !element.closest('[hidden]') && element.getClientRects().length);
            const first = focusable[0];
            const last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        });
        return setOpen;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const mobileFooter = window.matchMedia('(max-width: 767.98px)');
    document.querySelectorAll('[data-footer-toggle]').forEach(heading => {
        const panel = document.getElementById(heading.dataset.footerToggle);
        if (!panel) return;
        const label = document.createElement('span');
        label.className = 'footer-heading-label';
        label.textContent = heading.textContent;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'footer-toggle';
        button.setAttribute('aria-controls', panel.id);
        button.append(document.createTextNode(heading.textContent));
        const icon = document.createElement('span');
        icon.className = 'footer-toggle-icon';
        icon.setAttribute('aria-hidden', 'true');
        button.append(icon);
        heading.replaceChildren(label, button);
        let expanded = false;
        const update = () => {
            const visible = !mobileFooter.matches || expanded;
            panel.hidden = !visible;
            button.setAttribute('aria-expanded', String(visible));
            icon.textContent = visible ? '\u2212' : '+';
        };
        button.addEventListener('click', () => { expanded = !expanded; update(); });
        mobileFooter.addEventListener('change', update);
        update();
    });

    const menuState = SiteUI.drawer(document.querySelector('.mobile_nav'), document.querySelector('.menu_icon'), document.querySelector('.close-icon'), 'Navigation');
    const desktopNavigation = window.matchMedia('(min-width: 1200px)');
    desktopNavigation.addEventListener('change', event => { if (event.matches) menuState?.(false); });
    const navigation = document.querySelector('.bottom-menu');
    if (navigation) {
        navigation.classList.add('navigation-ready');
        const dropdowns = [];
        const closeAll = () => dropdowns.forEach(dropdown => dropdown.setOpen(false));
        navigation.querySelectorAll(':scope > ul > .dropmenu').forEach((item, index) => {
            const link = item.querySelector(':scope > a');
            const panel = item.querySelector(':scope > .dropmenu_list');
            if (!link || !panel) return;
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'nav-dropdown-toggle';
            toggle.setAttribute('aria-label', `${link.textContent.trim()} submenu`);
            panel.id = `desktop-submenu-${index}`;
            toggle.setAttribute('aria-controls', panel.id);
            toggle.innerHTML = '<i class="bx bx-chevron-down" aria-hidden="true"></i>';
            link.after(toggle);
            let closeTimer;
            const setOpen = open => {
                clearTimeout(closeTimer);
                item.classList.toggle('is-open', open);
                toggle.setAttribute('aria-expanded', String(open));
                panel.inert = !open;
                panel.setAttribute('aria-hidden', String(!open));
            };
            const open = () => {
                if (!desktopNavigation.matches) return;
                dropdowns.forEach(dropdown => { if (dropdown.item !== item) dropdown.setOpen(false); });
                setOpen(true);
            };
            dropdowns.push({ item, setOpen });
            setOpen(false);
            item.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') open(); });
            item.addEventListener('pointerleave', () => {
                closeTimer = setTimeout(() => { if (!item.contains(document.activeElement)) setOpen(false); }, 120);
            });
            item.addEventListener('focusin', event => { if (event.target !== toggle) open(); });
            item.addEventListener('focusout', event => { if (!item.contains(event.relatedTarget)) setOpen(false); });
            toggle.addEventListener('click', () => { if (item.classList.contains('is-open')) setOpen(false); else open(); });
            link.addEventListener('click', event => {
                if (link.getAttribute('href') === '#') { event.preventDefault(); open(); }
            });
            item.addEventListener('keydown', event => {
                if (event.key === 'Escape') { event.preventDefault(); toggle.focus(); setOpen(false); }
                if (event.key === 'ArrowDown' && (event.target === link || event.target === toggle)) {
                    event.preventDefault(); open(); panel.querySelector('a')?.focus();
                }
            });
        });
        document.addEventListener('click', event => { if (!navigation.contains(event.target)) closeAll(); });
        desktopNavigation.addEventListener('change', closeAll);
        const updatePosition = () => navigation.style.setProperty('--nav-bottom', `${Math.max(0, navigation.getBoundingClientRect().bottom)}px`);
        window.addEventListener('resize', updatePosition, { passive: true });
        window.addEventListener('scroll', updatePosition, { passive: true });
        updatePosition();
    }
    document.querySelectorAll('.dropBtn, .megadropBtn').forEach((item, index) => {
        const button = item.querySelector(':scope > button');
        const panel = item.querySelector(':scope > .megaDrop, :scope > .megadropBtn_list');
        if (!button || !panel) return;
        panel.id = `mobile-submenu-${index}`;
        panel.hidden = true;
        button.setAttribute('aria-controls', panel.id);
        button.setAttribute('aria-expanded', 'false');
        let animation;
        button.addEventListener('click', () => {
            const open = button.getAttribute('aria-expanded') !== 'true';
            const previousHeight = panel.getBoundingClientRect().height;
            animation?.cancel();
            button.setAttribute('aria-expanded', String(open));
            panel.inert = !open;
            panel.hidden = false;
            const activeClass = item.classList.contains('dropBtn') ? 'megaDrop_active' : 'active';
            item.classList.add(activeClass);
            const finish = () => { panel.hidden = !open; item.classList.toggle(activeClass, open); };
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
            animation = panel.animate([{ height: `${previousHeight}px` }, { height: `${open ? panel.scrollHeight : 0}px` }], { duration: 180, easing: 'ease-out' });
            animation.onfinish = finish;
        });
    });

    const searchButton = document.querySelector('.search-icon');
    const searchBox = document.querySelector('.search--input');
    if (searchButton && searchBox) {
        searchBox.id = 'mobile-search';
        searchButton.setAttribute('aria-controls', searchBox.id);
        searchButton.setAttribute('aria-expanded', 'false');
        searchButton.addEventListener('click', () => {
            const open = searchBox.classList.toggle('show');
            searchButton.setAttribute('aria-expanded', String(open));
            if (open) searchBox.querySelector('input')?.focus();
        });
        searchBox.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                searchBox.classList.remove('show');
                searchButton.setAttribute('aria-expanded', 'false');
                searchButton.focus();
            }
        });
    }

    document.querySelectorAll('.bottom-menu > ul > li > a, .mobile_menu > ul > li > a').forEach(link => {
        if (new URL(link.href).pathname === location.pathname) link.setAttribute('aria-current', 'page');
    });
    document.querySelectorAll('input[type="password"]').forEach(input => {
        const wrapper = document.createElement('div');
        wrapper.className = 'password-field';
        input.before(wrapper);
        wrapper.append(input);
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'password-toggle';
        toggle.textContent = 'Show';
        toggle.setAttribute('aria-label', 'Show password');
        toggle.setAttribute('aria-pressed', 'false');
        toggle.addEventListener('click', () => {
            const visible = input.type === 'password';
            input.type = visible ? 'text' : 'password';
            toggle.textContent = visible ? 'Hide' : 'Show';
            toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
            toggle.setAttribute('aria-pressed', String(visible));
        });
        wrapper.append(toggle);
    });
    // Placeholder forms have no service endpoint; never report a successful transaction.
    document.querySelectorAll('form[data-static-form]').forEach(form => form.addEventListener('submit', event => {
        event.preventDefault();
        SiteUI.status(form, form.dataset.staticForm);
    }));

    document.querySelectorAll('.purchase-quantity, .cart-quantity__num').forEach(group => {
        const input = group.querySelector('input');
        const normalize = () => {
            input.value = Math.min(99, Math.max(1, Math.trunc(Number(input.value)) || 1));
            group.querySelector('[data-step="-1"]').disabled = Number(input.value) <= 1;
            group.querySelector('[data-step="1"]').disabled = Number(input.value) >= 99;
        };
        group.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {
            input.value = Number(input.value) + Number(button.dataset.step);
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }));
        input.addEventListener('change', normalize);
        normalize();
    });
    const cart = document.querySelector('.cart_wrapper__content-details');
    if (cart) {
        const total = document.querySelector('.checkout-section_content h6');
        const money = number => `Rs. ${number.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        cart.querySelectorAll('.table_flax').forEach(row => {
            const price = row.querySelector('.product_details p').textContent.match(/\d[\d,]*(?:\.\d+)?/);
            row.dataset.unitPrice = price ? Number(price[0].replace(/,/g, '')) : 0;
            row.querySelector('.del-btn button').addEventListener('click', event => {
                event.preventDefault();
                row.remove();
                updateCart();
                (cart.querySelector('.del-btn button') || cart.querySelector('.cart-empty a'))?.focus();
            });
        });
        const updateCart = () => {
            let sum = 0;
            let count = 0;
            cart.querySelectorAll('.table_flax').forEach(row => {
                const quantity = Number(row.querySelector('input').value);
                const lineTotal = quantity * Number(row.dataset.unitPrice);
                row.querySelector('.cart_total h6').textContent = money(lineTotal);
                sum += lineTotal;
                count += quantity;
            });
            if (total) total.lastChild.textContent = money(sum);
            document.querySelectorAll('.menu_mob .cart span, .menu .cart-no:last-child span').forEach(badge => { badge.textContent = `(${count})`; });
            const checkout = document.querySelector('.checkout-section');
            if (checkout) checkout.hidden = count === 0;
            if (!count && !cart.querySelector('.cart-empty')) {
                const empty = document.createElement('div');
                empty.className = 'cart-empty ui-status';
                empty.setAttribute('role', 'status');
                empty.innerHTML = '<p>Your cart is empty.</p><a href="product.html" class="global_btn">Continue shopping</a>';
                cart.append(empty);
            }
        };
        cart.addEventListener('change', updateCart);
        updateCart();
    }

    const query = new URLSearchParams(location.search).get('q')?.trim();
    if (query && document.querySelector('.product_box')) {
        let count = 0;
        document.querySelectorAll('.product_box .card__inner').forEach(card => {
            const matches = card.textContent.toLowerCase().includes(query.toLowerCase());
            card.parentElement.hidden = !matches;
            if (matches) count++;
        });
        SiteUI.status(document.querySelector('.product_heading'), count ? `${count} results for “${query}”` : `No results for “${query}”. Try another search or browse the categories below.`);
        document.querySelectorAll('input[name="q"]').forEach(input => { input.value = query; });
    }
    document.querySelectorAll('.vertical_img button').forEach(button => button.addEventListener('click', () => {
        myFunction(button.querySelector('img'));
        document.querySelectorAll('.vertical_img button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    }));
    const wishlist = document.querySelector('.whishlist_content');
    if (wishlist) {
        const updateCount = () => {
            const count = wishlist.querySelectorAll('.whishlist-box').length;
            document.querySelector('.whishlist_header__left p').textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
            document.querySelectorAll('.menu a[href="whishlist.html"] + span').forEach(badge => { badge.textContent = `(${count})`; });
            if (!count) SiteUI.status(wishlist, 'Your favourites list is empty. Browse the collection for more inspiration.');
        };
        wishlist.querySelectorAll('.heart').forEach(button => button.addEventListener('click', () => {
            button.closest('.whishlist-box').parentElement.remove();
            updateCount();
            const next = wishlist.querySelector('.heart');
            if (next) next.focus();
            else document.querySelector('.whishlist_header__right a')?.focus();
        }));
        updateCount();
    }
    document.querySelectorAll('.order-now > a, .order-now > button').forEach(button => button.addEventListener('click', event => {
        if (button.tagName === 'A' && button.getAttribute('href') !== '#') return;
        event.preventDefault();
        SiteUI.status(button.parentElement, 'Online ordering is currently unavailable. Please contact us for help with this product.');
    }));
    document.querySelectorAll('.catalog-heart').forEach(button => button.addEventListener('click', () => {
        SiteUI.status(document.querySelector('.product_box__content'), 'Saving favourites is currently unavailable. Please try again later.');
    }));
    const sort = document.querySelector('.product_row__right select');
    const grid = document.querySelector('.product_box__content > .row');
    if (sort && grid) {
        const originalOrder = [...grid.children];
        const price = card => Number(card.querySelector('.card__inner_content span')?.textContent.replace(/[^\d.]/g, '')) || 0;
        sort.addEventListener('change', () => {
            const cards = [...originalOrder];
            if (sort.value === 'price-low') cards.sort((a, b) => price(a) - price(b));
            if (sort.value === 'price-high') cards.sort((a, b) => price(b) - price(a));
            if (sort.value === 'name') cards.sort((a, b) => a.querySelector('.card__inner_content a').textContent.localeCompare(b.querySelector('.card__inner_content a').textContent));
            grid.append(...cards);
        });
    }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMedia = () => document.querySelectorAll('video').forEach(video => { if (motion.matches) video.pause(); });
    motion.addEventListener('change', updateMedia);
    updateMedia();
    if ('IntersectionObserver' in window && !motion.matches) {
        const observer = new IntersectionObserver(entries => entries.forEach(entry => {
            if (entry.isIntersecting) { entry.target.classList.add('reveal'); observer.unobserve(entry.target); }
        }), { threshold: .1 });
        document.querySelectorAll('.main_heading, .mission_section__left, .sign_wrapper__content').forEach(element => observer.observe(element));
    }
});

function myFunction(smallImg) {
    const fullImg = document.getElementById('imgBox');
    if (fullImg && smallImg) { fullImg.src = smallImg.src; fullImg.alt = smallImg.alt; }
}
