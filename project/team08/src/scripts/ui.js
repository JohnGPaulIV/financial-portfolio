(() => {
    const MOBILE_BREAKPOINT = 600;

    const getNavLinks = (header) => {
        const links = [];
        const seen = new Set();
        const navLinkNodes = header.querySelectorAll('.nav-links a, header > nav a, nav a');

        navLinkNodes.forEach((anchor) => {
            const href = anchor.getAttribute('href');
            const label = anchor.textContent ? anchor.textContent.trim() : '';

            if (!href || !label || seen.has(href)) {
                return;
            }

            seen.add(href);
            links.push({
                href,
                label,
                isActive: anchor.classList.contains('active')
            });
        });

        return links;
    };

    const getProfileHref = (header) => {
        const profileAnchor =
            header.querySelector('.pfp-btn') ||
            header.querySelector('#pfp-container a') ||
            header.querySelector('a[href="preferences.html"]') ||
            header.querySelector('a[href$="/preferences.html"]');

        return profileAnchor ? profileAnchor.getAttribute('href') : 'preferences.html';
    };

    const closeMenu = (container, button, menu) => {
        container.classList.remove('is-open');
        button.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-hidden', 'true');
        menu.setAttribute('tabindex', '-1');
    };

    const openMenu = (container, button, menu) => {
        container.classList.add('is-open');
        button.setAttribute('aria-expanded', 'true');
        menu.setAttribute('aria-hidden', 'false');
        menu.setAttribute('tabindex', '0');
    };

    const initMobileNav = () => {
        const header = document.querySelector('header');
        if (!header || header.querySelector('.mobile-nav')) {
            return;
        }

        const desktopLinks = getNavLinks(header);
        if (!desktopLinks.length) {
            return;
        }

        const profileHref = getProfileHref(header);
        const menuId = 'mobile-nav-menu';

        const container = document.createElement('div');
        container.className = 'mobile-nav';

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'mobile-nav-toggle';
        toggle.setAttribute('aria-label', 'Toggle navigation menu');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', menuId);
        toggle.innerHTML =
            '<span class="mobile-nav-toggle-line"></span>' +
            '<span class="mobile-nav-toggle-line"></span>' +
            '<span class="mobile-nav-toggle-line"></span>';

        const menu = document.createElement('div');
        menu.id = menuId;
        menu.className = 'mobile-nav-menu';
        menu.setAttribute('aria-hidden', 'true');
        menu.setAttribute('tabindex', '-1');
        const navList = document.createElement('ul');
        navList.className = 'mobile-nav-list';

        desktopLinks.forEach((link) => {
            const item = document.createElement('li');
            const anchor = document.createElement('a');
            anchor.href = link.href;
            anchor.textContent = link.label;
            anchor.className = 'mobile-nav-link';
            if (link.isActive) {
                anchor.classList.add('active');
            }
            item.appendChild(anchor);
            navList.appendChild(item);
        });

        const hasProfileInNav = desktopLinks.some((link) => link.href.includes('preferences'));
        if (!hasProfileInNav) {
            const profileItem = document.createElement('li');
            const profileAnchor = document.createElement('a');
            profileAnchor.href = profileHref;
            profileAnchor.className = 'mobile-nav-link mobile-nav-profile-link';
            profileAnchor.innerHTML =
                '<svg class="mobile-nav-profile-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80" aria-hidden="true" focusable="false">' +
                '<path d="M59,32C57.52-3.81,6.48-3.81,5,32a27,27,0,0,0,54,0ZM32,6.93c21.5-.08,33,25.81,18.78,41.65C43.84,29,20.15,29,13.22,48.58-1,32.74,10.5,6.85,32,6.93ZM14.73,50.15c6-19.07,28.53-19.07,34.54,0C40,59.31,24,59.31,14.73,50.15Z"></path>' +
                '<path d="M32,30.43a9.85,9.85,0,0,0,9.84-9.84c-.54-13.06-19.14-13-19.68,0A9.85,9.85,0,0,0,32,30.43Zm0-17.75a7.92,7.92,0,0,1,7.91,7.91c-.4,10.48-15.42,10.48-15.82,0A7.92,7.92,0,0,1,32,12.68Z"></path>' +
                '</svg>' +
                '<span>Account</span>';
            profileItem.appendChild(profileAnchor);
            navList.appendChild(profileItem);
        }

        menu.appendChild(navList);
        container.appendChild(toggle);
        container.appendChild(menu);

        const navbar = header.querySelector('.navbar');
        const headerTop = header.querySelector('#header-top');
        if (navbar) {
            navbar.appendChild(container);
        } else if (headerTop) {
            headerTop.appendChild(container);
        } else {
            header.appendChild(container);
        }

        toggle.addEventListener('click', () => {
            if (container.classList.contains('is-open')) {
                closeMenu(container, toggle, menu);
            } else {
                openMenu(container, toggle, menu);
            }
        });

        document.addEventListener('click', (event) => {
            if (!container.contains(event.target)) {
                closeMenu(container, toggle, menu);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeMenu(container, toggle, menu);
                toggle.blur();
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > MOBILE_BREAKPOINT) {
                closeMenu(container, toggle, menu);
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileNav);
    } else {
        initMobileNav();
    }
})();
